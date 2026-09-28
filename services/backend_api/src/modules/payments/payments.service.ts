import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderFlowService: OrderFlowService,
    private readonly trackingGateway: TrackingGateway,
    private readonly notificationsService: NotificationsService,
    private readonly sslcommerzGateway: SslCommerzGatewayAdapter,
    private readonly sandboxGateway: SandboxGatewayAdapter,
  ) {}

  onModuleInit() {
    // 15-minute background sweep for unpaid orders
    this.expirationInterval = setInterval(() => {
      this.sweepExpiredPayments().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`Sweep expired payments failed: ${msg}`);
      });
    }, 60000);
    this.expirationInterval.unref();
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

    // Create payment ledger record
    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        gateway: dto.gateway,
        transactionId: initiation.transactionId,
        sessionKey: initiation.sessionKey,
        amount: order.totalAmount,
        currency: 'BDT',
        status: PaymentStatus.PENDING,
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
      const payment = await tx.payment.findFirst({
        where: {
          OR: [
            ...(validation.transactionId ? [{ transactionId: validation.transactionId }] : []),
            ...(validation.orderId ? [{ orderId: validation.orderId }] : []),
          ],
        },
        include: {
          order: { select: { id: true, orderNumber: true, customerId: true, paymentStatus: true } },
        },
      });

      if (!payment) {
        return { payment: null as typeof payment, alreadyProcessed: false };
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

      if (claimed.count === 0) {
        return { payment, alreadyProcessed: true };
      }

      if (validation.status === PaymentStatus.PAID) {
        await tx.order.update({
          where: { id: payment.orderId },
          data: { paymentStatus: PaymentStatus.PAID },
        });
      }

      return { payment, alreadyProcessed: false };
    });

    if (!outcome.payment) {
      this.logger.warn(
        `Webhook received for unknown payment: Trx=${validation.transactionId}, Order=${validation.orderId}`,
      );
      throw new NotFoundException('No matching payment transaction found');
    }

    if (outcome.alreadyProcessed) {
      this.logger.log(`Payment ${outcome.payment.transactionId} already processed. Skipping duplicate webhook.`);
      return {
        success: true,
        message: 'Payment already processed',
        transactionId: outcome.payment.transactionId,
      };
    }

    const payment = outcome.payment;

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
   */
  async getPaymentStatus(transactionId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { transactionId },
      include: {
        order: { select: { id: true, orderNumber: true, status: true, paymentStatus: true, totalAmount: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException(`Payment transaction "${transactionId}" not found`);
    }

    return payment;
  }

  /**
   * 4. Execute gateway refund for a PAID payment (cancellation reconciliation)
   */
  async refundForOrder(orderId: string, remarks?: string): Promise<RefundResult | null> {
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

    for (const order of expiredOrders) {
      this.logger.warn(`Order ${order.orderNumber} expired after 15m unpaid. Marking CANCELLED.`);
      await this.prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.CANCELLED, cancelledAt: new Date() },
        });

        for (const p of order.payments) {
          if (p.status === PaymentStatus.PENDING) {
            await tx.payment.update({
              where: { id: p.id },
              data: { status: PaymentStatus.FAILED, failedAt: new Date() },
            });
          }
        }
      });
    }
  }
}
