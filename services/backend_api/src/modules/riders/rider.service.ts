import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DeliverOrderDto } from './dto/deliver-order.dto';
import { DepositCashDto } from './dto/deposit-cash.dto';
import { OrderStatus, PaymentMethod, PaymentStatus, SettlementStatus } from '@prisma/client';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { OrderFlowService } from '../order-flow/order-flow.service';
import { assertTransition } from '../orders/order-state.machine';
import { DeliveryFeeService } from '../promotions/pricing/delivery-fee.service';
import type { OrderAddressSnapshot } from '../orders/order.service';

@Injectable()
export class RiderService {
  private readonly logger = new Logger(RiderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingGateway: TrackingGateway,
    private readonly orderFlowService: OrderFlowService,
    private readonly deliveryFeeService: DeliveryFeeService,
  ) {}

  /**
   * Helper: Retrieve rider profile by userId
   */
  async getRiderProfile(userId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!rider) {
      throw new NotFoundException('Rider profile not found for this user account');
    }

    return rider;
  }

  /**
   * 1. Toggle Duty State (Online/Offline)
   */
  async toggleDuty(userId: string, isOnline: boolean) {
    const rider = await this.getRiderProfile(userId);

    if (isOnline && (rider.isApproved === false || rider.user?.status !== 'ACTIVE')) {
      throw new ForbiddenException(
        'Courier account is pending approval or suspended by platform administrator. Cannot go online.',
      );
    }

    if (!isOnline) {
      const activeOrder = await this.prisma.order.findFirst({
        where: {
          riderId: rider.id,
          status: {
            in: [OrderStatus.RIDER_ASSIGNED, OrderStatus.DISPATCHED],
          },
        },
      });

      if (activeOrder) {
        throw new BadRequestException(
          `Cannot go offline while you have an active in-flight delivery (Order #${activeOrder.orderNumber}). Please complete delivery first.`,
        );
      }
    }

    return this.prisma.rider.update({
      where: { id: rider.id },
      data: { isOnline },
    });
  }

  /**
   * 2. Claim Broadcasted Order
   */
  async claimOrder(userId: string, orderId: string) {
    return this.orderFlowService.claimOrder(userId, orderId);
  }

  /**
   * 3. Confirm Order Pickup at Vendor Outlet
   */
  async pickupOrder(userId: string, orderId: string) {
    const rider = await this.getRiderProfile(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.riderId && order.riderId !== rider.id) {
      throw new ForbiddenException('This order is assigned to another delivery rider');
    }

    assertTransition(order.status, OrderStatus.DISPATCHED);

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        riderId: rider.id,
        status: OrderStatus.DISPATCHED,
        pickedUpAt: new Date(),
      },
    });

    // Realtime Broadcast: order:status:changed (DISPATCHED)
    this.trackingGateway.notifyOrderStatusChanged(
      order.id,
      order.customerId,
      order.status,
      OrderStatus.DISPATCHED,
      { riderId: rider.id, vendorId: order.vendorId },
    );

    return updatedOrder;
  }

  /**
   * 3. Confirm Delivery & COD Collection
   * Records cash collected on COD orders and records entry in rider_trip_ledgers.
   */
  async deliverOrder(userId: string, orderId: string, dto: DeliverOrderDto) {
    const rider = await this.getRiderProfile(userId);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { riderTrip: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (!order.riderId || order.riderId !== rider.id) {
      throw new ForbiddenException('You are not the assigned rider for this order');
    }

    assertTransition(order.status, OrderStatus.DELIVERED);

    const isCodOrder = order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY;
    const codCollected = isCodOrder
      ? (dto.amountCollected ?? (dto.codCashCollected ? Number(order.totalAmount) : 0))
      : 0;

    const economics = await this.deliveryFeeService.getEconomicsConfig();
    const riderShare = (economics.rider_share_percent || 80) / 100;
    const deliveryEarnings = Math.round(Number(order.deliveryFee) * riderShare * 100) / 100;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update Order Status
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          riderId: rider.id,
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date(),
          paymentStatus:
            order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY && dto.codCashCollected
              ? PaymentStatus.PAID
              : order.paymentStatus,
        },
      });

      // 2. If COD cash collected, add to rider cashInHand
      if (codCollected > 0) {
        await tx.rider.update({
          where: { id: rider.id },
          data: {
            cashInHand: { increment: codCollected },
          },
        });
      }

      // 3. Upsert Trip Ledger
      const tripLedger = await tx.riderTripLedger.upsert({
        where: { orderId },
        create: {
          orderId,
          riderId: rider.id,
          deliveryEarnings,
          codCollected,
          status: SettlementStatus.PENDING,
        },
        update: {
          deliveryEarnings,
          codCollected,
        },
      });

      return {
        order: updatedOrder,
        tripLedger,
      };
    });

    // Realtime Broadcast: order:status:changed (DELIVERED)
    this.trackingGateway.notifyOrderStatusChanged(
      order.id,
      order.customerId,
      order.status,
      OrderStatus.DELIVERED,
      { codCollected, vendorId: order.vendorId },
    );

    // Release rider active trip state in Redis
    await this.orderFlowService.releaseRiderActiveTrip(rider.id);

    return result;
  }

  /**
   * 4. Deposit Collected COD Cash to Platform Account (Requires Admin Verification)
   */
  async depositCash(userId: string, dto: DepositCashDto) {
    const rider = await this.getRiderProfile(userId);
    const depositAmount = Number(dto.amount);

    if (depositAmount <= 0) {
      throw new BadRequestException('Deposit amount must be greater than zero');
    }

    const currentCashInHand = Number(rider.cashInHand || 0);
    if (depositAmount > currentCashInHand) {
      throw new BadRequestException(
        `Cannot deposit ${depositAmount} BDT. Current cash in hand is only ${currentCashInHand} BDT.`,
      );
    }

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000).toString();
    const referenceNo = dto.referenceNo || `DEP-${dateStr}-${randSuffix}`;

    // Security Guard: Create deposit in PENDING_APPROVAL status.
    // Cash in hand is officially decremented upon Admin verification.
    const deposit = await this.prisma.cashDeposit.create({
      data: {
        riderId: rider.id,
        amount: depositAmount,
        referenceNo,
        note: dto.note || dto.notes,
        status: 'PENDING_APPROVAL',
      },
    });

    return {
      message: 'Cash deposit request submitted for admin verification',
      deposit,
      cashInHand: currentCashInHand,
      remainingCashInHand: currentCashInHand,
      status: 'PENDING_APPROVAL',
    };
  }

  /**
   * 5. Get Cash Deposit History for Rider
   */
  async getCashDeposits(userId: string) {
    const rider = await this.getRiderProfile(userId);
    return this.prisma.cashDeposit.findMany({
      where: { riderId: rider.id },
      orderBy: { depositedAt: 'desc' },
    });
  }

  /**
   * 6. Report Delivery Issue / Failed Delivery
   */
  async reportDeliveryIssue(userId: string, orderId: string, reason: string) {
    const rider = await this.getRiderProfile(userId);
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendor: true },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.riderId !== rider.id) {
      throw new ForbiddenException('You are not assigned to this order');
    }

    // Release rider active trip state in Redis
    await this.orderFlowService.releaseRiderActiveTrip(rider.id);

    // Notify realtime sockets and admin HQ
    try {
      if (this.trackingGateway?.server) {
        this.trackingGateway.server.to('admin_hq').emit('order:delivery_failed', {
          orderId: order.id,
          orderNumber: order.orderNumber,
          riderId: rider.id,
          riderName: rider.user?.fullName,
          reason,
          reportedAt: new Date().toISOString(),
        });
      }
    } catch (err: unknown) {
      this.logger.warn(`Failed to emit order:delivery_failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    return {
      success: true,
      message: 'Delivery issue recorded. Dispatcher alerted and courier released.',
    };
  }

  /**
   * 7. Get Rider Trip History & Real Earnings
   */
  async getRiderTrips(userId: string) {
    const rider = await this.getRiderProfile(userId);
    const orders = await this.prisma.order.findMany({
      where: {
        riderId: rider.id,
      },
      include: {
        vendor: { select: { id: true, name: true, addressText: true } },
        orderItems: { select: { productNameSnapshot: true, quantity: true } },
        riderTrip: true,
      },
      orderBy: { placedAt: 'desc' },
      take: 50,
    });

    return orders.map((order) => {
      const address =
        (order.deliveryAddressSnapshot as unknown as OrderAddressSnapshot | null)?.addressLine ||
        'Customer Address';
      const itemsSummary = order.orderItems.map((i) => `${i.quantity}x ${i.productNameSnapshot}`).join(', ');
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        vendorName: order.vendor.name,
        customerAddress: address,
        itemsSummary,
        deliveryFee: Number(order.deliveryFee),
        totalAmount: Number(order.totalAmount),
        paymentMethod: order.paymentMethod,
        isCod: order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY,
        payout: order.riderTrip ? Number(order.riderTrip.deliveryEarnings) : Number(order.deliveryFee) * 0.8,
        codCollected: order.riderTrip ? Number(order.riderTrip.codCollected) : 0,
        placedAt: order.placedAt,
        deliveredAt: order.deliveredAt,
      };
    });
  }
}
