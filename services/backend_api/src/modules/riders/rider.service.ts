import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { DeliverOrderDto } from './dto/deliver-order.dto';
import { DepositCashDto } from './dto/deposit-cash.dto';
import { ToggleDutyDto } from './dto/toggle-duty.dto';
import { OrderStatus, PaymentMethod, PaymentStatus, Prisma, SettlementStatus } from '@prisma/client';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { OrderFlowService } from '../order-flow/order-flow.service';
import { assertTransition } from '../orders/order-state.machine';
import { DeliveryFeeService } from '../promotions/pricing/delivery-fee.service';
import { haversineKm } from '../../common/utils/haversine';
import type { OrderAddressSnapshot } from '../orders/order.service';

@Injectable()
export class RiderService {
  private readonly logger = new Logger(RiderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly trackingGateway: TrackingGateway,
    private readonly orderFlowService: OrderFlowService,
    private readonly deliveryFeeService: DeliveryFeeService,
  ) {}

  /**
   * Helper: Retrieve rider profile by userId.
   * Lifetime earnings and completed-trip counts are computed from the trip
   * ledger so rider-app dashboards never boot from fabricated defaults.
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

    const [earningsAggregate, completedTripsCount] = await Promise.all([
      this.prisma.riderTripLedger.aggregate({
        where: { riderId: rider.id },
        _sum: { deliveryEarnings: true },
      }),
      this.prisma.order.count({
        where: { riderId: rider.id, status: OrderStatus.DELIVERED },
      }),
    ]);

    return {
      ...rider,
      earningsBalance: Number(earningsAggregate._sum.deliveryEarnings ?? 0),
      completedTripsCount,
    };
  }

  /**
   * 1. Toggle Duty State (Online/Offline) and Sync GPS Telemetry
   */
  async toggleDuty(userId: string, dtoOrOnline: ToggleDutyDto | boolean) {
    const dto: ToggleDutyDto = typeof dtoOrOnline === 'boolean' ? { isOnline: dtoOrOnline } : dtoOrOnline;
    const { isOnline, latitude, longitude } = dto;
    const rider = await this.getRiderProfile(userId);

    if (isOnline && (rider.isApproved === false || rider.user?.status !== 'ACTIVE')) {
      throw new ForbiddenException(
        'Courier account is pending approval or suspended by platform administrator. Cannot go online.',
      );
    }

    if (!isOnline) {
      // Mirror the in-flight set used by getActiveTrip: a courier may not go
      // offline while any assigned order is still working toward delivery.
      const activeOrder = await this.prisma.order.findFirst({
        where: {
          riderId: rider.id,
          status: {
            in: [
              OrderStatus.RIDER_ASSIGNED,
              OrderStatus.ACCEPTED,
              OrderStatus.PREPARING,
              OrderStatus.READY_FOR_PICKUP,
              OrderStatus.DISPATCHED,
            ],
          },
        },
      });

      if (activeOrder) {
        throw new BadRequestException(
          `Cannot go offline while you have an active in-flight delivery (Order #${activeOrder.orderNumber}). Please complete delivery first.`,
        );
      }
    }

    const dataToUpdate: Prisma.RiderUpdateInput = { isOnline };
    if (latitude !== undefined && longitude !== undefined) {
      dataToUpdate.latitude = latitude;
      dataToUpdate.longitude = longitude;
    }

    const updatedRider = await this.prisma.rider.update({
      where: { id: rider.id },
      data: dataToUpdate,
    });

    if (latitude !== undefined && longitude !== undefined) {
      try {
        await this.redis.geoadd('riders:locations', longitude, latitude, rider.id);
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to update redis geoadd for rider ${rider.id}: ${err instanceof Error ? err.message : 'Unknown'}`,
        );
      }
    }

    return updatedRider;
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

    // Assignment guard: only the assigned courier may confirm pickup. A null
    // riderId must never fall through — doing so previously let any rider scoop
    // an unassigned order, bypassing the claim mutex, the dispatch-mode check,
    // and the COD cash-limit projection.
    if (!order.riderId || order.riderId !== rider.id) {
      throw new ForbiddenException('You are not the assigned rider for this order');
    }

    assertTransition(order.status, OrderStatus.DISPATCHED);

    // Conditional on the observed status so a concurrent cancellation cannot
    // be silently overwritten by a stale pickup confirmation.
    let updatedOrder;
    try {
      updatedOrder = await this.prisma.order.update({
        where: { id: orderId, status: order.status },
        data: {
          status: OrderStatus.DISPATCHED,
          pickedUpAt: new Date(),
        },
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ConflictException('Order state changed before pickup could be confirmed; refresh and retry');
      }
      throw err;
    }

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

    // Single source of truth for cash: only a COD order with the courier's
    // explicit confirmation moves money. The collected amount is capped at the
    // order total so an over-reported figure can never inflate cashInHand.
    const totalAmount = Number(order.totalAmount);
    const isCodOrder = order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY;
    const cashConfirmed = isCodOrder && dto.codCashCollected === true;
    const requestedCollection = dto.amountCollected ?? totalAmount;
    const codCollected = cashConfirmed
      ? Math.round(Math.min(Math.max(requestedCollection, 0), totalAmount) * 100) / 100
      : 0;

    const economics = await this.deliveryFeeService.getEconomicsConfig();
    const riderShare = (economics.rider_share_percent || 80) / 100;
    const deliveryEarnings = Math.round(Number(order.deliveryFee) * riderShare * 100) / 100;

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Claim the delivery with a guarded transition: a concurrent
      //    double-submit loses here instead of incrementing cash twice.
      const claim = await tx.order.updateMany({
        where: { id: orderId, status: OrderStatus.DISPATCHED },
        data: {
          status: OrderStatus.DELIVERED,
          deliveredAt: new Date(),
          ...(cashConfirmed ? { paymentStatus: PaymentStatus.PAID } : {}),
        },
      });

      if (claim.count === 0) {
        throw new ConflictException('Order is not awaiting delivery confirmation (already delivered or state changed)');
      }

      const updatedOrder = await tx.order.findUniqueOrThrow({ where: { id: orderId } });

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
    const randSuffix = randomUUID().slice(0, 8);
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
   * Helper / Rehydration: Retrieve current active in-flight trip for rider
   */
  async getActiveTrip(userId: string) {
    const rider = await this.getRiderProfile(userId);

    const activeOrder = await this.prisma.order.findFirst({
      where: {
        riderId: rider.id,
        status: {
          in: [
            OrderStatus.RIDER_ASSIGNED,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.DISPATCHED,
          ],
        },
      },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            addressText: true,
            contactPhone: true,
            latitude: true,
            longitude: true,
          },
        },
        orderItems: {
          select: {
            id: true,
            productNameSnapshot: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
        customer: {
          select: {
            fullName: true,
            phone: true,
          },
        },
      },
      orderBy: { placedAt: 'desc' },
    });

    if (!activeOrder) {
      return null;
    }

    const economics = await this.deliveryFeeService.getEconomicsConfig();
    const riderShare = (economics.rider_share_percent || 80) / 100;
    const riderEarnings = Math.round(Number(activeOrder.deliveryFee) * riderShare * 100) / 100;

    return {
      ...activeOrder,
      totalAmount: Number(activeOrder.totalAmount),
      deliveryFee: Number(activeOrder.deliveryFee),
      riderEarnings,
    };
  }

  /**
   * 6. Report Delivery Issue / Failed Delivery
   * Resets order status to READY_FOR_PICKUP, clears assigned courier, logs audit reason,
   * releases rider lock, alerts dispatch, and triggers redispatch broadcast.
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

    // Asserts legal transition (DISPATCHED → READY_FOR_PICKUP)
    assertTransition(order.status, OrderStatus.READY_FOR_PICKUP);

    // Conditional on the observed status so a concurrent cancellation or
    // delivery confirmation cannot be overwritten by a stale issue report.
    let updatedOrder;
    try {
      updatedOrder = await this.prisma.order.update({
        where: { id: orderId, status: order.status },
        data: {
          riderId: null,
          status: OrderStatus.READY_FOR_PICKUP,
          rejectionReason: `Delivery issue reported by rider ${rider.user?.fullName || rider.id}: ${reason}`,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ConflictException('Order state changed before the issue report could be applied; refresh and retry');
      }
      throw err;
    }

    // Release rider active trip state in Redis
    await this.orderFlowService.releaseRiderActiveTrip(rider.id);

    // Broadcast realtime status change (READY_FOR_PICKUP) to customer and merchant
    this.trackingGateway.notifyOrderStatusChanged(
      order.id,
      order.customerId,
      order.status,
      OrderStatus.READY_FOR_PICKUP,
      { riderId: null, reason, vendorId: order.vendorId },
    );

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

    // Trigger redispatch broadcast to riders_pool
    try {
      await this.orderFlowService.handleOrderReady(order.id);
    } catch (err: unknown) {
      this.logger.warn(`Failed to re-broadcast order ready: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    return {
      success: true,
      message: 'Delivery issue recorded. Order reverted to READY_FOR_PICKUP, dispatcher alerted, and courier released.',
      order: updatedOrder,
    };
  }

  /**
   * 7. Get Rider Trip History & Real Earnings
   */
  async getRiderTrips(userId: string) {
    const rider = await this.getRiderProfile(userId);
    const economics = await this.deliveryFeeService.getEconomicsConfig();
    const riderShare = (economics.rider_share_percent || 80) / 100;
    const orders = await this.prisma.order.findMany({
      where: {
        riderId: rider.id,
      },
      include: {
        vendor: { select: { id: true, name: true, addressText: true, latitude: true, longitude: true } },
        orderItems: { select: { productNameSnapshot: true, quantity: true } },
        riderTrip: true,
      },
      orderBy: { placedAt: 'desc' },
      take: 50,
    });

    return orders.map((order) => {
      const snapshot = order.deliveryAddressSnapshot as unknown as OrderAddressSnapshot | null;
      const address = snapshot?.addressLine || 'Customer Address';
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
        payout: order.riderTrip
          ? Number(order.riderTrip.deliveryEarnings)
          : Math.round(Number(order.deliveryFee) * riderShare * 100) / 100,
        codCollected: order.riderTrip ? Number(order.riderTrip.codCollected) : 0,
        distanceKm: haversineKm(
          order.vendor.latitude,
          order.vendor.longitude,
          snapshot?.latitude,
          snapshot?.longitude,
        ),
        placedAt: order.placedAt,
        deliveredAt: order.deliveredAt,
      };
    });
  }
}
