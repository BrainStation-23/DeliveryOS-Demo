import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { OrderFlowMode, UpdateOrderFlowDto } from './dto/update-order-flow.dto';
import { AccountStatus, OrderStatus, PaymentMethod, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { assertClaimable, assertTransition } from '../orders/order-state.machine';
import { DeliveryFeeService } from '../promotions/pricing/delivery-fee.service';
import { NotificationsService } from '../notifications/notifications.service';
import { haversineKm } from '../../common/utils/haversine';

interface OrderFlowSettingValue {
  mode?: OrderFlowMode;
  rider_search_timeout_seconds?: number;
  stale_order_ttl_minutes?: number;
}

interface AddressSnapshot {
  addressLine?: string;
  deliveryMethod?: string;
  type?: string;
  [key: string]: unknown;
}

/**
 * Takeaway detection must read the same field checkout writes. Checkout stamps
 * `deliveryMethod` (canonical); `type` is honored for snapshots created before
 * that field existed. Reading a single hard-coded key here previously disabled
 * the entire takeaway bypass.
 */
function isTakeawayOrder(snapshot: AddressSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  const method = snapshot.deliveryMethod ?? snapshot.type;
  return method === 'TAKEAWAY';
}

@Injectable()
export class OrderFlowService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderFlowService.name);
  private escalationTimer: NodeJS.Timeout | null = null;
  private readonly sweepInstanceId = randomUUID();

  private async runEscalationIfLeader(): Promise<void> {
    const acquired = await this.redis.acquireLock(
      'lock:sweep:dispatch-escalation',
      this.sweepInstanceId,
      25,
    );
    if (!acquired) return;
    await this.evaluateDispatchEscalations();
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly trackingGateway: TrackingGateway,
    private readonly deliveryFeeService: DeliveryFeeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Rider payout for an order = delivery fee × configured rider share.
   * Single source of truth for every dispatch broadcast and claim response so
   * clients never derive earnings from the gross fee.
   */
  private async computeRiderEarnings(deliveryFee: Prisma.Decimal | number): Promise<number> {
    const economics = await this.deliveryFeeService.getEconomicsConfig();
    const riderShare = (economics.rider_share_percent || 80) / 100;
    return Math.round(Number(deliveryFee) * riderShare * 100) / 100;
  }

  /** Radius (km) around the pickup outlet for the initial courier FCM push ring. */
  private static readonly INITIAL_PUSH_RADIUS_KM = 5;

  /**
   * Geo-targeted courier push: riders within `radiusKm` of the pickup outlet
   * (Redis GEO index) receive the FCM alert. The socket broadcast to
   * riders_pool stays pool-wide so no connected courier ever misses an order;
   * this only narrows the push-notification blast radius. Falls back to a
   * role-wide push when the geo index has no candidates yet (cold start).
   */
  private async notifyNearbyRiders(
    vendor: { id: string; name: string; latitude: number | null; longitude: number | null },
    orderId: string,
    orderNumber: string,
    radiusKm: number,
  ): Promise<void> {
    let targetUserIds: string[] = [];
    if (vendor.latitude != null && vendor.longitude != null) {
      const nearby = await this.findNearbyAvailableRiders(vendor.latitude, vendor.longitude, radiusKm);
      if (nearby.length > 0) {
        const riders = await this.prisma.rider.findMany({
          where: { id: { in: nearby.map((n) => n.riderId) } },
          select: { userId: true },
        });
        targetUserIds = riders.map((r) => r.userId);
      }
    }

    const payload = {
      title: 'New Delivery Opportunity! 📦',
      body: `Order ${orderNumber} available near ${vendor.name}. Tap to accept.`,
      data: { orderId, type: 'DISPATCH_BROADCAST' },
    };

    const dispatch =
      targetUserIds.length > 0
        ? this.notificationsService.sendToUsers(targetUserIds, payload)
        : this.notificationsService.sendToRole(UserRole.RIDER, payload);

    dispatch.catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Push notify riders failed: ${msg}`);
    });
  }

  /**
   * Vendor→customer dispatch-card distance; undefined when the address
   * snapshot carries no coordinates.
   */
  private computeDistanceKm(
    vendor: { latitude: number | null; longitude: number | null },
    snapshot: AddressSnapshot | null,
  ): number | undefined {
    return haversineKm(vendor.latitude, vendor.longitude, snapshot?.latitude as number | undefined, snapshot?.longitude as number | undefined);
  }

  onModuleInit() {
    // Background scanner for unassigned dispatch escalation (runs every 30s).
    // The Redis lock lets only one replica run each tick when scaled.
    this.escalationTimer = setInterval(() => {
      this.runEscalationIfLeader().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`Error in dispatch escalation scanner: ${msg}`);
      });
    }, 30000);
    this.escalationTimer.unref();
  }

  onModuleDestroy() {
    if (this.escalationTimer) {
      clearInterval(this.escalationTimer);
      this.escalationTimer = null;
    }
  }

  /**
   * 1. Get Active Order Flow Configuration
   * Reads the Postgres system setting to determine whether the system is
   * operating in RIDER_FIRST or VENDOR_FIRST. Reads are cheap and single-row;
   * hot-path callers (dispatch) tolerate the round trip.
   */
  async getOrderFlowConfig(): Promise<{
    mode: OrderFlowMode;
    riderSearchTimeoutSeconds: number;
    staleOrderTtlMinutes: number;
  }> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key: 'order_flow_config' },
    });

    const val = (setting?.value as OrderFlowSettingValue | null) || {};
    return {
      mode: val.mode === OrderFlowMode.VENDOR_FIRST ? OrderFlowMode.VENDOR_FIRST : OrderFlowMode.RIDER_FIRST,
      riderSearchTimeoutSeconds: val.rider_search_timeout_seconds || 90,
      staleOrderTtlMinutes: val.stale_order_ttl_minutes || 60,
    };
  }

  /**
   * 2. Update Order Flow Configuration
   * The setting is a single JSON blob: preserve fields the caller did not
   * send (e.g. stale_order_ttl_minutes) instead of clobbering them.
   */
  async setOrderFlowConfig(dto: UpdateOrderFlowDto) {
    const existing = await this.prisma.systemSetting.findUnique({
      where: { key: 'order_flow_config' },
    });
    const existingValue = (existing?.value as OrderFlowSettingValue | null) || {};

    const nextValue = {
      mode: dto.mode,
      rider_search_timeout_seconds: dto.riderSearchTimeoutSeconds ?? existingValue.rider_search_timeout_seconds ?? 90,
      stale_order_ttl_minutes: existingValue.stale_order_ttl_minutes ?? 60,
      description:
        dto.mode === OrderFlowMode.RIDER_FIRST
          ? 'Zero Food Waste Mode: Secures rider before kitchen begins prep.'
          : 'Traditional Retail Mode: Store preps first, broadcasts to riders when ready.',
    };

    const updated = await this.prisma.systemSetting.upsert({
      where: { key: 'order_flow_config' },
      update: { value: nextValue },
      create: {
        key: 'order_flow_config',
        value: nextValue,
        description: 'Order fulfillment flow sequence (RIDER_FIRST vs VENDOR_FIRST)',
      },
    });

    this.logger.log(`Order flow mode updated to: ${dto.mode}`);
    return updated.value;
  }

  /**
   * 3. Update Rider Real-time Location in Redis Spatial Index
   */
  async updateRiderLocation(riderId: string, latitude: number, longitude: number) {
    await this.redis.geoadd('riders:locations:active', longitude, latitude, riderId);
  }

  /**
   * 4. Find Nearby Available Online Riders within Proximity Radius (km)
   */
  async findNearbyAvailableRiders(
    vendorLat: number,
    vendorLng: number,
    radiusKm: number = 5,
  ): Promise<Array<{ riderId: string; distanceKm: number }>> {
    const rawResults = await this.redis.geosearch(
      'riders:locations:active',
      vendorLng,
      vendorLat,
      radiusKm,
    );

    const availableRiders: Array<{ riderId: string; distanceKm: number }> = [];

    for (const [riderId, distance] of rawResults) {
      const distanceKm = parseFloat(distance);

      // Check if rider is currently busy on an active delivery
      const isBusy = await this.redis.get(`rider:active_order:${riderId}`);
      if (isBusy) continue;

      // Verify rider is online in database
      const rider = await this.prisma.rider.findUnique({
        where: { id: riderId },
        select: { isOnline: true },
      });

      if (rider && rider.isOnline) {
        availableRiders.push({ riderId, distanceKm });
      }
    }

    return availableRiders;
  }

  /**
   * 5. Dispatch Event Handler: Triggered immediately when customer places order
   */
  async handleOrderPlaced(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        vendor: true,
        orderItems: true,
        customer: { select: { fullName: true, phone: true } },
      },
    });

    if (!order) return;

    if (order.status !== OrderStatus.PLACED) {
      this.logger.warn(
        `Order ${order.orderNumber} is not in PLACED status (current: "${order.status}"); ignoring dispatch placement.`,
      );
      return;
    }

    // Online Gateway Payment Invariant:
    // When customer chooses ONLINE_GATEWAY, do not broadcast to riders or alert kitchen until payment is verified!
    if (order.paymentMethod === PaymentMethod.ONLINE_GATEWAY && order.paymentStatus !== PaymentStatus.PAID) {
      this.logger.log(
        `[Online Payment Guard] Order ${order.orderNumber} placed via ONLINE_GATEWAY. Withholding dispatch broadcast until webhook payment confirmation.`,
      );
      return;
    }

    // Takeaway Fulfillment Invariant:
    // Takeaway orders are picked up by the customer at the store.
    // Notify vendor kitchen immediately and skip rider pool broadcast regardless of mode.
    const addressSnap = order.deliveryAddressSnapshot as AddressSnapshot | null;
    if (isTakeawayOrder(addressSnap)) {
      this.logger.log(`Order ${order.orderNumber} is TAKEAWAY; notifying kitchen and skipping courier dispatch.`);
      this.trackingGateway.notifyNewOrder(order.vendorId, {
        id: order.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        vendorName: order.vendor.name,
        itemCount: order.orderItems.reduce((acc, i) => acc + i.quantity, 0),
        totalAmount: Number(order.totalAmount),
        paymentMethod: order.paymentMethod,
        customerNotes: order.customerNotes,
        items: order.orderItems.map((i) => ({
          name: i.productNameSnapshot,
          quantity: i.quantity,
        })),
        placedAt: order.placedAt.toISOString(),
      });
      return;
    }

    const { mode, riderSearchTimeoutSeconds } = await this.getOrderFlowConfig();

    if (mode === OrderFlowMode.RIDER_FIRST) {
      // RIDER_FIRST: Zero Food Waste Mode
      // Broadcast immediately to nearby riders in riders_pool.
      // Vendor chime is withheld until a delivery rider is secured!
      const deliveryAddress = (order.deliveryAddressSnapshot as AddressSnapshot | null)?.addressLine || 'Customer Address';
      const riderEarnings = await this.computeRiderEarnings(order.deliveryFee);
      const distanceKm = this.computeDistanceKm(order.vendor, order.deliveryAddressSnapshot as AddressSnapshot | null);

      this.trackingGateway.broadcastDispatch({
        orderId: order.id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        vendorName: order.vendor.name,
        vendorAddress: order.vendor.addressText,
        deliveryArea: deliveryAddress,
        itemCount: order.orderItems.reduce((acc, i) => acc + i.quantity, 0),
        totalAmount: Number(order.totalAmount),
        riderEarnings,
        timeoutSeconds: riderSearchTimeoutSeconds,
        paymentMethod: order.paymentMethod,
        isCod: order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY,
        ...(distanceKm !== undefined ? { distanceKm } : {}),
      });

      // Geo-targeted push ring around the pickup outlet (socket broadcast above
      // remains pool-wide so no connected courier misses the order)
      await this.notifyNearbyRiders(
        order.vendor,
        order.id,
        order.orderNumber,
        OrderFlowService.INITIAL_PUSH_RADIUS_KM,
      );

      this.logger.log(
        `[RIDER_FIRST] Order ${order.orderNumber} broadcasted to riders_pool. Vendor chime held until rider claim.`,
      );
    } else {
      // VENDOR_FIRST: Traditional Retail Mode
      // Trigger vendor chime immediately
      this.trackingGateway.notifyNewOrder(order.vendorId, {
        id: order.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        vendorName: order.vendor.name,
        itemCount: order.orderItems.reduce((acc, i) => acc + i.quantity, 0),
        totalAmount: Number(order.totalAmount),
        paymentMethod: order.paymentMethod,
        customerNotes: order.customerNotes,
        items: order.orderItems.map((i) => ({
          name: i.productNameSnapshot,
          quantity: i.quantity,
        })),
        placedAt: order.placedAt.toISOString(),
      });

      this.logger.log(`[VENDOR_FIRST] Order ${order.orderNumber} sent directly to vendor kitchen console.`);
    }
  }

  /**
   * 5b. Payment Verified Trigger: Activated once online gateway payment webhook succeeds
   */
  async handleOrderPaid(orderId: string) {
    this.logger.log(`[Payment Verified] Online payment confirmed for Order ID: ${orderId}. Re-evaluating fulfillment broadcast.`);
    await this.handleOrderPlaced(orderId);
  }

  /**
   * 6. Dispatch Event Handler: Triggered when vendor marks order READY_FOR_PICKUP
   */
  async handleOrderReady(orderId: string) {
    const { mode, riderSearchTimeoutSeconds } = await this.getOrderFlowConfig();

    // In VENDOR_FIRST mode, rider broadcast is triggered when food is packaged
    if (mode === OrderFlowMode.VENDOR_FIRST) {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { vendor: true, orderItems: true },
      });

      if (!order || order.riderId) return; // already assigned or not found

      const addressSnap = order.deliveryAddressSnapshot as AddressSnapshot | null;
      if (isTakeawayOrder(addressSnap)) {
        this.logger.log(`Order ${order.orderNumber} is TAKEAWAY; skipping courier dispatch on ready.`);
        return;
      }

      const deliveryAddress = (order.deliveryAddressSnapshot as AddressSnapshot | null)?.addressLine || 'Customer Address';
      const riderEarnings = await this.computeRiderEarnings(order.deliveryFee);
      const distanceKm = this.computeDistanceKm(order.vendor, order.deliveryAddressSnapshot as AddressSnapshot | null);

      this.trackingGateway.broadcastDispatch({
        orderId: order.id,
        orderNumber: order.orderNumber,
        vendorId: order.vendorId,
        vendorName: order.vendor.name,
        vendorAddress: order.vendor.addressText,
        deliveryArea: deliveryAddress,
        itemCount: order.orderItems.reduce((acc, i) => acc + i.quantity, 0),
        totalAmount: Number(order.totalAmount),
        riderEarnings,
        timeoutSeconds: riderSearchTimeoutSeconds,
        paymentMethod: order.paymentMethod,
        isCod: order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY,
        ...(distanceKm !== undefined ? { distanceKm } : {}),
      });

      this.logger.log(`[VENDOR_FIRST] Order ${order.orderNumber} READY_FOR_PICKUP broadcasted to riders_pool.`);
    }
  }

  /**
   * 7. Atomic Rider Order Claim protected by Redis Distributed Mutex
   */
  async claimOrder(riderUserId: string, orderId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { userId: riderUserId },
      include: {
        user: { select: { fullName: true, phone: true, status: true } },
      },
    });

    if (!rider || !rider.isOnline) {
      throw new BadRequestException('Rider is offline or profile not found');
    }

    if (!rider.isApproved) {
      throw new BadRequestException('Rider account is pending admin approval');
    }

    if (rider.user?.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException('Rider account is suspended or inactive');
    }

    // Check if rider already has an active order
    const alreadyBusy = await this.redis.get(`rider:active_order:${rider.id}`);
    if (alreadyBusy) {
      throw new BadRequestException('You already have an active assigned delivery trip');
    }

    // Acquire Redis Distributed Mutex (10-second TTL)
    const lockKey = `lock:order_claim:${orderId}`;
    const acquired = await this.redis.acquireLock(lockKey, rider.id, 10);

    if (!acquired) {
      throw new ConflictException('This order is currently being claimed by another rider.');
    }

    try {
      const { mode } = await this.getOrderFlowConfig();

      const updatedOrder = await this.prisma.$transaction(async (tx) => {
        // DB backstop for the busy check: the Redis `rider:active_order` marker
        // can be lost (crash between commit and SET, eviction, flush). The
        // database remains the source of truth for in-flight assignments.
        const inFlight = await tx.order.findFirst({
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
          select: { orderNumber: true },
        });
        if (inFlight) {
          throw new ConflictException(
            `You already have an active delivery trip (Order #${inFlight.orderNumber}). Complete it before claiming another.`,
          );
        }

        const order = await tx.order.findUnique({
          where: { id: orderId },
          include: { vendor: true, orderItems: true },
        });

        if (!order) {
          throw new NotFoundException('Order not found');
        }

        if (order.riderId !== null) {
          throw new ConflictException('This order has already been secured by another delivery rider.');
        }

        // Online Payment Invariant: an unverified ONLINE_GATEWAY order must
        // never enter the courier fleet, even by direct claim.
        if (order.paymentMethod === PaymentMethod.ONLINE_GATEWAY && order.paymentStatus !== PaymentStatus.PAID) {
          throw new BadRequestException('This order is awaiting payment confirmation and cannot be claimed yet');
        }

        if (order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
          const projectedCash = Number(rider.cashInHand) + Number(order.totalAmount);
          if (projectedCash > Number(rider.maxCashLimit)) {
            throw new BadRequestException(
              `Order total (৳${order.totalAmount}) would exceed your cash-in-hand limit of ৳${rider.maxCashLimit} (current: ৳${rider.cashInHand}). Please deposit collected cash before claiming COD orders.`,
            );
          }
        }

        assertClaimable(mode, order.status);
        const newStatus = mode === OrderFlowMode.RIDER_FIRST ? OrderStatus.RIDER_ASSIGNED : order.status;
        if (newStatus !== order.status) {
          assertTransition(order.status, newStatus);
        }

        const updated = await tx.order.update({
          where: { id: orderId },
          data: {
            riderId: rider.id,
            status: newStatus,
          },
          include: {
            vendor: true,
            orderItems: true,
          },
        });

        return updated;
      });

      // Mark rider as busy in Redis after DB transaction successfully commits
      await this.redis.set(`rider:active_order:${rider.id}`, orderId);

      // Side Effects outside DB transaction:
      if (mode === OrderFlowMode.RIDER_FIRST) {
        // Emit RIDER_ASSIGNED to customer tracking
        this.trackingGateway.notifyOrderStatusChanged(
          updatedOrder.id,
          updatedOrder.customerId,
          OrderStatus.PLACED,
          OrderStatus.RIDER_ASSIGNED,
          {
            riderId: rider.id,
            riderName: rider.user.fullName,
            riderPhone: rider.user.phone,
            vendorId: updatedOrder.vendorId,
          },
        );

        // NOW trigger Vendor kitchen chime with Rider Guaranteed Badge!
        this.trackingGateway.notifyNewOrder(updatedOrder.vendorId, {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          vendorId: updatedOrder.vendorId,
          vendorName: updatedOrder.vendor.name,
          riderAssigned: true,
          riderName: rider.user.fullName,
          riderPhone: rider.user.phone,
          itemCount: updatedOrder.orderItems.reduce((acc, i) => acc + i.quantity, 0),
          totalAmount: Number(updatedOrder.totalAmount),
          paymentMethod: updatedOrder.paymentMethod,
          customerNotes: updatedOrder.customerNotes,
          items: updatedOrder.orderItems.map((i) => ({
            name: i.productNameSnapshot,
            quantity: i.quantity,
          })),
          placedAt: updatedOrder.placedAt.toISOString(),
        });

        this.logger.log(
          `[RIDER_FIRST] Rider ${rider.user.fullName} secured order ${updatedOrder.orderNumber}. Kitchen console alerted!`,
        );
      } else {
        // VENDOR_FIRST: Emit status update with assigned rider
        this.trackingGateway.notifyOrderStatusChanged(
          updatedOrder.id,
          updatedOrder.customerId,
          updatedOrder.status,
          updatedOrder.status,
          {
            riderId: rider.id,
            riderName: rider.user.fullName,
            riderPhone: rider.user.phone,
            vendorId: updatedOrder.vendorId,
          },
        );
      }

      // Send push notification to customer
      this.notificationsService
        .sendToUser(updatedOrder.customerId, {
          title: 'Rider Assigned! 🛵',
          body: `${rider.user.fullName} is delivering your order from ${updatedOrder.vendor.name}.`,
          data: { orderId: updatedOrder.id, status: updatedOrder.status },
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          this.logger.warn(`Push notify customer failed: ${msg}`);
        });

      const riderEarnings = await this.computeRiderEarnings(updatedOrder.deliveryFee);
      return { ...updatedOrder, riderEarnings };
    } finally {
      // Safely release Redis distributed lock
      await this.redis.releaseLock(lockKey, rider.id);
    }
  }

  /**
   * 8. Release Rider Active Order (called upon delivery)
   */
  async releaseRiderActiveTrip(riderId: string) {
    await this.redis.del(`rider:active_order:${riderId}`);
  }

  /**
   * 9. Evaluate Unassigned Order Dispatch Escalations (Tier 1 & Tier 2)
   * Scanning is capped at the stale-order TTL: older unassigned orders are the
   * reaper's responsibility (OrderService.sweepStaleOrders), so a forgotten
   * order can never re-broadcast and re-alert admins every hour forever.
   */
  async evaluateDispatchEscalations() {
    const { mode, riderSearchTimeoutSeconds, staleOrderTtlMinutes } = await this.getOrderFlowConfig();

    const unassignedOrders = await this.prisma.order.findMany({
      where: {
        riderId: null,
        status: mode === OrderFlowMode.RIDER_FIRST ? OrderStatus.PLACED : OrderStatus.READY_FOR_PICKUP,
        placedAt: { gte: new Date(Date.now() - staleOrderTtlMinutes * 60_000) },
        OR: [
          { paymentMethod: PaymentMethod.CASH_ON_DELIVERY },
          { paymentMethod: PaymentMethod.ONLINE_GATEWAY, paymentStatus: PaymentStatus.PAID },
        ],
      },
      include: {
        vendor: { select: { id: true, name: true, addressText: true, latitude: true, longitude: true } },
        orderItems: true,
      },
    });

    const now = Date.now();
    for (const order of unassignedOrders) {
      if (isTakeawayOrder(order.deliveryAddressSnapshot as AddressSnapshot | null)) {
        continue;
      }

      const agingSeconds = Math.round((now - order.placedAt.getTime()) / 1000);

      // Tier 1 Escalation: aging exceeds configured timeout (default 90s)
      if (agingSeconds >= riderSearchTimeoutSeconds) {
        const tier1Key = `dispatch:escalated:${order.id}:tier1`;
        const alreadyEscalatedTier1 = await this.redis.get(tier1Key);

        if (!alreadyEscalatedTier1) {
          await this.redis.set(tier1Key, '1', 3600); // 1 hour TTL

          const deliveryAddress = (order.deliveryAddressSnapshot as AddressSnapshot | null)?.addressLine || 'Customer Address';
          const riderEarnings = await this.computeRiderEarnings(order.deliveryFee);
          const distanceKm = this.computeDistanceKm(order.vendor, order.deliveryAddressSnapshot as AddressSnapshot | null);

          this.trackingGateway.broadcastDispatch({
            orderId: order.id,
            orderNumber: order.orderNumber,
            vendorId: order.vendorId,
            vendorName: order.vendor.name,
            vendorAddress: order.vendor.addressText,
            deliveryArea: deliveryAddress,
            itemCount: order.orderItems.reduce((acc, i) => acc + i.quantity, 0),
            totalAmount: Number(order.totalAmount),
            riderEarnings,
            timeoutSeconds: riderSearchTimeoutSeconds,
            searchRadiusKm: 6,
            paymentMethod: order.paymentMethod,
            isCod: order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY,
            ...(distanceKm !== undefined ? { distanceKm } : {}),
          });

          this.trackingGateway.notifyDispatchEscalated({
            orderId: order.id,
            orderNumber: order.orderNumber,
            tier: 1,
            agingSeconds,
            searchRadiusKm: 6,
            vendorName: order.vendor.name,
          });

          // Escalation tier widens the geo-targeted push ring to 6 km
          await this.notifyNearbyRiders(order.vendor, order.id, order.orderNumber, 6);

          this.logger.warn(
            `[Escalation Tier 1] Order ${order.orderNumber} unassigned for ${agingSeconds}s. Priority push ring expanded to 6km.`,
          );
        }
      }

      // Tier 2 Escalation: aging exceeds 2x timeout (default 180s)
      if (agingSeconds >= riderSearchTimeoutSeconds * 2) {
        const tier2Key = `dispatch:escalated:${order.id}:tier2`;
        const alreadyEscalatedTier2 = await this.redis.get(tier2Key);

        if (!alreadyEscalatedTier2) {
          await this.redis.set(tier2Key, '1', 3600);

          this.trackingGateway.notifyDispatchEscalated({
            orderId: order.id,
            orderNumber: order.orderNumber,
            tier: 2,
            agingSeconds,
            searchRadiusKm: 10,
            vendorName: order.vendor.name,
          });

          // Tier 2 widens the geo-targeted push ring to 10 km
          await this.notifyNearbyRiders(order.vendor, order.id, order.orderNumber, 10);

          this.logger.error(
            `[Escalation Tier 2 - CRITICAL] Order ${order.orderNumber} unassigned for ${agingSeconds}s! High priority alert emitted to admin_hq.`,
          );
        }
      }
    }
  }
}

