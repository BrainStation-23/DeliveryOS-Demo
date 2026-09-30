import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma, SettlementStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { OrderFlowService } from '../order-flow/order-flow.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { SslCommerzGatewayAdapter } from './gateways/sslcommerz.gateway';
import { SandboxGatewayAdapter } from './gateways/sandbox.gateway';
import { InitiatePaymentDto, SupportedPaymentGateway } from './dto/initiate-payment.dto';
import { IPaymentGateway, RefundResult } from './interfaces/payment-gateway.interface';

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  private expirationInterval: NodeJS.Timeout | null = null;
  private readonly sweepInstanceId = randomUUID();

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly orderFlowService: OrderFlowService,
    private readonly trackingGateway: TrackingGateway,
    private readonly notificationsService: NotificationsService,
    private readonly sslcommerzGateway: SslCommerzGatewayAdapter,
    private readonly sandboxGateway: SandboxGatewayAdapter,
  ) {}

  onModuleInit() {
    // 15-minute background sweep for unpaid orders. The Redis lock lets only
    // one replica run each tick when the API is scaled horizontally.
    this.expirationInterval = setInterval(() => {
      this.runSweepIfLeader().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`Sweep expired payments failed: ${msg}`);
      });
    }, 60000);
    this.expirationInterval.unref();
  }

  private async runSweepIfLeader(): Promise<void> {
    const acquired = await this.redis.acquireLock(
      'lock:sweep:expired-payments',
      this.sweepInstanceId,
      55,
    );
    if (!acquired) return;
    await this.sweepExpiredPayments();
  }

  onModuleDestroy() {
    if (this.expirationInterval) {
      clearInterval(this.expirationInterval);
    }
  }

  private getGatewayAdapter(gateway: string): IPaymentGateway {
    switch (gateway.toUpperCase()) {
      case SupportedPaymentGateway.SSLCOMMERZ:
        return this.sslcommerzGateway;
      case SupportedPaymentGateway.SANDBOX:
        if (process.env.NODE_ENV === 'production') {
          throw new BadRequestException('Sandbox payment gateway is disabled in production');
        }
        return this.sandboxGateway;
      default:
        throw new BadRequestException(`Unsupported payment gateway: "${gateway}"`);
    }
  }

  /**
   * 1. Initiate Online Payment Session
   */
  async initiatePayment(userId: string, dto: InitiatePaymentDto) {
    const lockKey = `lock:payment:order:${dto.orderId}`;
    const lockVal = randomUUID();
    const acquired = await this.redis.acquireLock(lockKey, lockVal, 10);
    if (!acquired) {
      throw new ConflictException('Payment initiation is already in progress for this order');
    }

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: dto.orderId },
        include: {
          customer: { select: { id: true, fullName: true, phone: true } },
          vendor: { select: { id: true, name: true } },
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID "${dto.orderId}" not found`);
      }

      if (order.customerId !== userId) {
        throw new UnauthorizedException('You do not have permission to pay for this order');
      }

      if (order.paymentMethod !== PaymentMethod.ONLINE_GATEWAY) {
        throw new BadRequestException('Order was placed with Cash on Delivery and does not require online checkout');
      }

      if (order.paymentStatus === PaymentStatus.PAID) {
        throw new ConflictException('This order has already been paid successfully');
      }

      if (order.status === OrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot initiate payment for a cancelled order');
      }

      // Check for an existing PENDING payment session created within the last 15 minutes
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      const existingPending = await this.prisma.payment.findFirst({
        where: {
          orderId: order.id,
          status: PaymentStatus.PENDING,
          createdAt: { gte: fifteenMinutesAgo },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (existingPending && existingPending.gateway === dto.gateway && existingPending.transactionId) {
        const cachedUrl = (existingPending.gatewayResponse as { paymentUrl?: string } | null)?.paymentUrl;
        if (cachedUrl) {
          this.logger.log(
            `Reusing active payment session for Order ${order.orderNumber} (Trx: ${existingPending.transactionId})`,
          );
          return {
            paymentId: existingPending.id,
            paymentUrl: cachedUrl,
            transactionId: existingPending.transactionId,
            gateway: existingPending.gateway,
            amount: Number(existingPending.amount),
            currency: existingPending.currency,
            orderNumber: order.orderNumber,
          };
        }
      }

      const adapter = this.getGatewayAdapter(dto.gateway);

      const initiation = await adapter.initiatePayment({
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: Number(order.totalAmount),
        currency: 'BDT',
        customerPhone: order.customer.phone,
        customerName: order.customer.fullName || 'Valued Customer',
        redirectUrl: dto.redirectUrl,
      });

      // Create payment ledger record with paymentUrl persisted for idempotency
      const payment = await this.prisma.payment.create({
        data: {
          orderId: order.id,
          gateway: dto.gateway,
          transactionId: initiation.transactionId,
          sessionKey: initiation.sessionKey,
          amount: order.totalAmount,
          currency: 'BDT',
          status: PaymentStatus.PENDING,
          gatewayResponse: { paymentUrl: initiation.paymentUrl },
        },
      });

      this.logger.log(
        `Created Payment ${payment.id} for Order ${order.orderNumber} via ${dto.gateway} (Trx: ${initiation.transactionId})`,
      );

      return {
        paymentId: payment.id,
        paymentUrl: initiation.paymentUrl,
        transactionId: initiation.transactionId,
        gateway: dto.gateway,
        amount: Number(order.totalAmount),
        currency: 'BDT',
        orderNumber: order.orderNumber,
      };
    } finally {
      await this.redis.releaseLock(lockKey, lockVal);
    }
  }

  /**
   * 2. Process Gateway Webhook / IPN Notification
   */
  async handleWebhook(
    gatewayName: string,
    payload: Record<string, unknown>,
    headers: Record<string, string>,
  ) {
    const adapter = this.getGatewayAdapter(gatewayName);
    const validation = await adapter.verifyWebhook(payload, headers);

    if (!validation.isValid) {
      this.logger.warn(`Rejected webhook for ${gatewayName}: Invalid signature or checksum`);
      throw new UnauthorizedException('Invalid payment signature or tamper detected');
    }

    // Atomic idempotency: locate the payment and claim the PENDING→PAID/FAILED
    // transition inside a single guarded update so concurrent webhook replays
    // cannot double-run side effects.
    const outcome = await this.prisma.$transaction(async (tx) => {
      let payment = null;

      if (validation.transactionId) {
        payment = await tx.payment.findFirst({
          where: { transactionId: validation.transactionId },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerId: true,
                paymentStatus: true,
                status: true,
                paymentMethod: true,
              },
            },
          },
        });
      }

      if (!payment && validation.orderId) {
        payment = await tx.payment.findFirst({
          where: {
            orderId: validation.orderId,
            status: PaymentStatus.PENDING,
          },
          orderBy: { createdAt: 'desc' },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                customerId: true,
                paymentStatus: true,
                status: true,
                paymentMethod: true,
              },
            },
          },
        });
      }

      if (!payment) {
        return {
          payment: null as typeof payment,
          alreadyProcessed: false,
          strandedCharge: false,
          reconciliation: false,
          amountMismatch: false,
        };
      }

      // Amount integrity: a confirmed charge must match the initiated amount.
      // A mismatch means tampering or a gateway-side partial charge — never mark PAID.
      if (Math.abs(validation.amount - Number(payment.amount)) > 0.01) {
        return {
          payment,
          alreadyProcessed: false,
          strandedCharge: false,
          reconciliation: false,
          amountMismatch: true,
        };
      }

      const claimed = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          status: validation.status,
          gatewayResponse: validation.rawResponse as Prisma.InputJsonValue,
          paidAt: validation.status === PaymentStatus.PAID ? new Date() : null,
          failedAt: validation.status === PaymentStatus.FAILED ? new Date() : null,
        },
      });

      const isCancelled = payment.order?.status === OrderStatus.CANCELLED;
      const isCodSwitched = payment.order?.paymentMethod === PaymentMethod.CASH_ON_DELIVERY;

      if (claimed.count === 0) {
        if (payment.status === PaymentStatus.PAID) {
          return {
            payment,
            alreadyProcessed: true,
            strandedCharge: false,
            reconciliation: false,
            amountMismatch: false,
          };
        }
        if (validation.status === PaymentStatus.PAID) {
          // Gateway confirmed money taken but our row is already terminal
          // (e.g. switchToCOD marked it FAILED moments earlier). Record the
          // confirmed charge so the reconciliation path can refund it instead
          // of silently dropping a real charge.
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: PaymentStatus.PAID,
              paidAt: new Date(),
              gatewayResponse: validation.rawResponse as Prisma.InputJsonValue,
            },
          });
          return {
            payment,
            alreadyProcessed: false,
            strandedCharge: true,
            reconciliation: false,
            amountMismatch: false,
          };
        }
        return {
          payment,
          alreadyProcessed: true,
          strandedCharge: false,
          reconciliation: false,
          amountMismatch: false,
        };
      }

      if (validation.status === PaymentStatus.PAID && !isCancelled && !isCodSwitched) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: PaymentStatus.PAID },
        });
      }

      return {
        payment,
        alreadyProcessed: false,
        strandedCharge: false,
        reconciliation: validation.status === PaymentStatus.PAID && (isCancelled || isCodSwitched),
        amountMismatch: false,
      };
    });

    if (!outcome.payment) {
      this.logger.warn(
        `Webhook received for unknown payment: Trx=${validation.transactionId}, Order=${validation.orderId}`,
      );
      throw new NotFoundException('No matching payment transaction found');
    }

    const payment = outcome.payment;

    if (outcome.amountMismatch) {
      this.logger.error(
        `Webhook amount mismatch for Order ${payment.order?.orderNumber} (Trx: ${payment.transactionId}): expected ${Number(payment.amount)}, gateway reported ${validation.amount}. Transaction NOT marked paid.`,
      );
      return {
        success: false,
        message: 'Payment amount mismatch; transaction rejected for manual review',
        transactionId: payment.transactionId,
      };
    }

    if (outcome.strandedCharge || outcome.reconciliation) {
      const cause = outcome.strandedCharge
        ? 'order was switched to Cash on Delivery after the session opened'
        : `order is ${payment.order?.status === OrderStatus.CANCELLED ? 'CANCELLED' : 'switched to COD'}`;
      this.logger.error(
        `Reconciling confirmed charge for Order ${payment.order?.orderNumber} (Trx: ${payment.transactionId}): ${cause}. Withholding dispatch; auto-refunding.`,
      );
      const refund = await this.refundForOrder(
        payment.orderId,
        `Reconciliation: payment confirmed after ${cause} (Trx: ${payment.transactionId})`,
      );
      this.notificationsService
        .sendToUser(payment.order!.customerId, {
          title: 'Payment Reconciliation',
          body: `Your payment for order ${payment.order?.orderNumber} was received after the order changed. ${
            refund?.success ? 'A refund has been initiated.' : 'Our team will process your refund shortly.'
          }`,
          data: { orderId: payment.orderId, type: 'PAYMENT_RECONCILED' },
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          this.logger.warn(`Push notify payment reconciliation failed: ${msg}`);
        });
      return {
        success: true,
        message: refund?.success
          ? 'Confirmed charge refunded via gateway reconciliation'
          : 'Confirmed charge flagged for manual refund reconciliation',
        transactionId: payment.transactionId,
        status: PaymentStatus.PAID,
        refundInitiated: refund?.success === true,
      };
    }

    if (outcome.alreadyProcessed) {
      this.logger.log(`Payment ${payment.transactionId} already processed. Skipping duplicate webhook.`);
      return {
        success: true,
        message: 'Payment already processed',
        transactionId: payment.transactionId,
      };
    }

    if (validation.status === PaymentStatus.PAID) {
      this.logger.log(`Payment confirmed PAID for Order ${payment.order.orderNumber} (Trx: ${payment.transactionId})`);

      // 1. Emit live WebSocket updates to customer order tracking screen
      if (this.trackingGateway?.server) {
        this.trackingGateway.server.to(`order_${payment.orderId}`).emit('order:payment:verified', {
          orderId: payment.orderId,
          orderNumber: payment.order.orderNumber,
          transactionId: payment.transactionId,
          status: 'PAID',
        });
        this.trackingGateway.server.to(`user_${payment.order.customerId}`).emit('order:payment:verified', {
          orderId: payment.orderId,
          orderNumber: payment.order.orderNumber,
          transactionId: payment.transactionId,
          status: 'PAID',
        });
      }

      // 2. Dispatch push notification to customer
      this.notificationsService
        .sendToUser(payment.order.customerId, {
          title: 'Payment Successful! 🎉',
          body: `Your payment for order ${payment.order.orderNumber} was confirmed. We are assigning a courier!`,
          data: { orderId: payment.orderId, type: 'PAYMENT_VERIFIED' },
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          this.logger.warn(`Push notify payment success failed: ${msg}`);
        });

      // 3. Trigger Order Flow Fulfillment Broadcast (RIDER_FIRST broadcast or VENDOR_FIRST chime)
      await this.orderFlowService.handleOrderPaid(payment.orderId);
    } else {
      this.logger.warn(`Payment failed for Order ${payment.order.orderNumber} (Status: ${validation.status})`);
    }

    return {
      success: true,
      transactionId: payment.transactionId,
      orderNumber: payment.order.orderNumber,
      status: validation.status,
    };
  }

  /**
   * 3. Query Payment Status
   * Ownership-enforced and redacted: only the paying customer may read it, and
   * internal fields (sessionKey, raw gatewayResponse) never leave the server.
   */
  async getPaymentStatus(transactionId: string, userId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
      select: {
        id: true,
        transactionId: true,
        gateway: true,
        amount: true,
        currency: true,
        status: true,
        paidAt: true,
        failedAt: true,
        refundId: true,
        refundedAt: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            totalAmount: true,
            customerId: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment transaction "${transactionId}" not found`);
    }

    if (payment.order.customerId !== userId) {
      throw new ForbiddenException('You do not have permission to view this payment');
    }

    return {
      id: payment.id,
      transactionId: payment.transactionId,
      gateway: payment.gateway,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      refundId: payment.refundId,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
      order: {
        id: payment.order.id,
        orderNumber: payment.order.orderNumber,
        status: payment.order.status,
        paymentStatus: payment.order.paymentStatus,
        totalAmount: Number(payment.order.totalAmount),
      },
    };
  }

  /**
   * 4. Execute gateway refund for a PAID payment (cancellation reconciliation)
   * A per-order Redis mutex serializes concurrent refund attempts (cancel +
   * webhook reconciliation) so the gateway can never be asked to refund the
   * same charge twice.
   */
  async refundForOrder(orderId: string, remarks?: string): Promise<RefundResult | null> {
    const lockKey = `lock:refund:order:${orderId}`;
    const lockVal = randomUUID();
    const acquired = await this.redis.acquireLock(lockKey, lockVal, 30);
    if (!acquired) {
      // Another refund for this order is in flight; report not-done so the
      // caller never records REFUNDED on the strength of someone else's
      // in-flight attempt (that path owns the final state).
      this.logger.warn(`Refund for Order ${orderId} already in progress; skipping duplicate gateway call`);
      return { success: false, refundId: null, raw: { status: 'ALREADY_IN_PROGRESS' } };
    }

    try {
      return await this.executeRefund(orderId, remarks);
    } finally {
      await this.redis.releaseLock(lockKey, lockVal);
    }
  }

  private async executeRefund(orderId: string, remarks?: string): Promise<RefundResult | null> {
    // 1. Idempotency: check if payment for this order is already refunded
    const existingRefund = await this.prisma.payment.findFirst({
      where: { orderId, status: PaymentStatus.REFUNDED },
      orderBy: { createdAt: 'desc' },
    });
    if (existingRefund) {
      this.logger.log(
        `Order ${orderId} already refunded (Payment: ${existingRefund.id}, Ref: ${existingRefund.refundId})`,
      );
      return {
        success: true,
        refundId: existingRefund.refundId ?? null,
        raw: ((existingRefund.gatewayResponse as Record<string, unknown>)?.refund as Record<string, unknown>) || {},
      };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { orderId, status: PaymentStatus.PAID },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      return null;
    }

    const adapter = this.getGatewayAdapter(payment.gateway);
    const gatewayResponse = (payment.gatewayResponse ?? {}) as {
      bank_tran_id?: string;
      val_id?: string;
      refund?: Record<string, unknown>;
    };

    const result: RefundResult = await adapter.refund({
      transactionId: payment.transactionId || '',
      bankTranId: gatewayResponse.bank_tran_id || gatewayResponse.val_id || null,
      amount: Number(payment.amount),
      remarks: remarks || `DeliveryOS refund for transaction ${payment.transactionId}`,
    });

    if (result.success) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REFUNDED,
          refundId: result.refundId,
          refundedAt: new Date(),
          gatewayResponse: { ...gatewayResponse, refund: result.raw } as Prisma.InputJsonValue,
        },
      });
      this.logger.log(`Refund executed for Order ${orderId} (Ref: ${result.refundId})`);
    } else {
      this.logger.error(`Refund FAILED for Order ${orderId}: ${JSON.stringify(result.raw)}`);
    }

    return result;
  }

  /**
   * 5. Sweep Expired Unpaid Online Orders (> 15 minutes)
   */
  async sweepExpiredPayments() {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000);
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        paymentMethod: PaymentMethod.ONLINE_GATEWAY,
        paymentStatus: PaymentStatus.PENDING,
        status: OrderStatus.PLACED,
        placedAt: { lt: cutoff },
      },
      include: { payments: true },
    });

    const reason = 'Online payment timed out (15m window expired)';

    for (const order of expiredOrders) {
      this.logger.warn(`Order ${order.orderNumber} expired after 15m unpaid. Reconciling cancellation.`);

      // Claim-then-reconcile: the guarded update is the single source of truth.
      // If the webhook marks the order PAID between findMany and this tx, the
      // claim matches 0 rows and every destructive step below is skipped.
      const cancelled = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.order.updateMany({
          where: { id: order.id, status: OrderStatus.PLACED, paymentStatus: PaymentStatus.PENDING },
          data: {
            status: OrderStatus.CANCELLED,
            cancelledAt: new Date(),
            rejectionReason: reason,
            paymentStatus: PaymentStatus.FAILED,
          },
        });
        if (claim.count === 0) {
          return false;
        }

        // Reconcile coupon quota if used (never below zero)
        if (order.couponId) {
          await tx.coupon.updateMany({
            where: { id: order.couponId, currentUses: { gt: 0 } },
            data: { currentUses: { decrement: 1 } },
          });
        }

        // Delete unearned pending ledgers
        await tx.commissionLedger.deleteMany({
          where: { orderId: order.id, settlementStatus: SettlementStatus.PENDING },
        });
        await tx.riderTripLedger.deleteMany({
          where: { orderId: order.id, status: SettlementStatus.PENDING },
        });

        // Fail any sessions still PENDING at claim time
        await tx.payment.updateMany({
          where: { orderId: order.id, status: PaymentStatus.PENDING },
          data: { status: PaymentStatus.FAILED, failedAt: new Date() },
        });

        return true;
      });

      if (!cancelled) {
        this.logger.log(
          `Order ${order.orderNumber} left the sweep window (paid or state changed); skipping expiry cancellation.`,
        );
        continue;
      }

      // Realtime websocket notifications
      try {
        if (this.trackingGateway?.server) {
          const payload = {
            orderId: order.id,
            orderNumber: order.orderNumber,
            previousStatus: order.status,
            status: OrderStatus.CANCELLED,
            reason,
            cancelledBy: 'SYSTEM',
            paymentStatus: PaymentStatus.FAILED,
            cancelledAt: new Date(),
          };
          this.trackingGateway.server.to(`order_${order.id}`).emit('order:cancelled', payload);
          this.trackingGateway.server.to(`user_${order.customerId}`).emit('order:cancelled', payload);
          this.trackingGateway.server.to(`vendor_${order.vendorId}`).emit('order:cancelled', payload);
          this.trackingGateway.server.to('admin_hq').emit('order:cancelled', payload);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`Failed to broadcast expired payment cancel socket: ${msg}`);
      }

      // Push notification
      this.notificationsService
        .sendToUser(order.customerId, {
          title: 'Order Cancelled',
          body: `Order ${order.orderNumber} was cancelled because online payment was not completed within 15 minutes.`,
          data: { orderId: order.id, status: OrderStatus.CANCELLED },
        })
        .catch(() => {});
    }
  }
}
