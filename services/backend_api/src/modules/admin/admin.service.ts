import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { PaginatedResult, PaginationQueryDto, toPaginatedResult } from '../../common/dto/pagination.dto';

export interface LiveOrderView {
  id: string;
  orderNumber: string;
  vendorId: string;
  vendorName: string;
  vendorAddress: string;
  vendorLatitude: number | null;
  vendorLongitude: number | null;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerNotes: string | null;
  riderId: string | null;
  riderName: string | null;
  riderPhone: string | null;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  deliveryFee: number;
  subtotal: number;
  couponDiscount: number;
  taxAmount: number;
  placedAt: Date;
  acceptedAt: Date | null;
  prepTimeMinutes: number | null;
  pickedUpAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  rejectionReason: string | null;
  items: Array<{ id: string; name: string; quantity: number; unitPrice: number }>;
  deliveryAddress: string;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
}
import {
  AccountStatus,
  BannerLinkType,
  CashDepositStatus,
  DiscountType,
  OrderFlowMode,
  OrderStatus,
  PermissionScope,
  Prisma,
  SettlementStatus,
  UserRole,
} from '@prisma/client';
import { OrderService } from '../orders/order.service';
import { AdminCancelOrderDto } from './dto/admin-cancel-order.dto';
import { DeliveryFeeConfig, DeliveryFeeService, DEFAULT_DELIVERY_ECONOMICS, DEFAULT_DELIVERY_FEE_CONFIG, DeliveryEconomicsConfig, normalizeDeliveryFeeConfig } from '../promotions/pricing/delivery-fee.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GetLiveOrdersQueryDto } from './dto/admin-governance.dto';
import { startOfRegionToday } from '../../common/utils/region-time';
import { outletDisplayName } from '../../common/utils/outlet-display-name';

export interface DispatchSettingPayload {
  rider_search_timeout_seconds: number;
  stale_order_ttl_minutes: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly trackingGateway: TrackingGateway,
    private readonly orderService: OrderService,
    private readonly deliveryFeeService: DeliveryFeeService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ===========================================================================
  // 1. Overview & Dashboard Statistics
  // ===========================================================================
  async getOverviewStats() {
    // Region-local midnight (e.g. Asia/Dhaka) so "today" rolls over on the
    // business calendar rather than the server's UTC clock.
    const today = startOfRegionToday();

    const [
      totalOrdersCount,
      todayOrdersCount,
      totalVendors,
      activeVendors,
      totalRiders,
      onlineRiders,
      ledgersToday,
      recentOrders,
    ] = await Promise.all([
      this.prisma.order.count(),
      this.prisma.order.count({ where: { placedAt: { gte: today } } }),
      this.prisma.vendor.count(),
      this.prisma.vendor.count({ where: { isActive: true } }),
      this.prisma.rider.count(),
      this.prisma.rider.count({ where: { isOnline: true } }),
      this.prisma.commissionLedger.findMany({
        where: { createdAt: { gte: today } },
        select: {
          grossAmount: true,
          commissionAmount: true,
          netVendorPayable: true,
        },
      }),
      this.prisma.order.findMany({
        take: 8,
        orderBy: { placedAt: 'desc' },
        include: {
          customer: { select: { fullName: true, phone: true } },
          vendor: { select: { name: true, brand: { select: { name: true } } } },
          rider: { include: { user: { select: { fullName: true, phone: true } } } },
        },
      }),
    ]);

    let todayGrossSales = 0;
    let todayCommission = 0;
    let todayNetPayable = 0;

    for (const l of ledgersToday) {
      todayGrossSales += Number(l.grossAmount);
      todayCommission += Number(l.commissionAmount);
      todayNetPayable += Number(l.netVendorPayable);
    }

    // Active trips currently in progress
    const activeTripsCount = await this.prisma.order.count({
      where: {
        status: {
          in: [
            OrderStatus.RIDER_ASSIGNED,
            OrderStatus.ACCEPTED,
            OrderStatus.PREPARING,
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.DISPATCHED,
          ],
        },
        riderId: { not: null },
      },
    });

    return {
      metrics: {
        totalOrders: totalOrdersCount,
        todayOrders: todayOrdersCount,
        activeRiders: onlineRiders,
        ridersOnTrip: activeTripsCount,
        totalRiders,
        onlineVendors: activeVendors,
        totalVendors,
        todayVolume: Math.round(todayGrossSales * 100) / 100,
        todayCommission: Math.round(todayCommission * 100) / 100,
        todayNetPayable: Math.round(todayNetPayable * 100) / 100,
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        customerName: o.customer?.fullName || 'Guest',
        outletName: outletDisplayName(o.vendor?.brand?.name, o.vendor?.name),
        riderName: o.rider?.user?.fullName || null,
        status: o.status,
        totalAmount: Number(o.totalAmount),
        paymentMethod: o.paymentMethod,
        placedAt: o.placedAt,
      })),
    };
  }

  // ===========================================================================
  // 2. Fleet Radar & Rider Fleet Oversight
  // ===========================================================================
  async getFleetRadar() {
    const riders = await this.prisma.rider.findMany({
      include: {
        user: { select: { id: true, fullName: true, phone: true, status: true } },
      },
      orderBy: { isOnline: 'desc' },
    });

    // Single batched lookup; the database is the busy-signal source of truth.
    const inFlightStatuses = [
      OrderStatus.RIDER_ASSIGNED,
      OrderStatus.ACCEPTED,
      OrderStatus.PREPARING,
      OrderStatus.READY_FOR_PICKUP,
      OrderStatus.DISPATCHED,
    ];
    const activeOrders = await this.prisma.order.findMany({
      where: { riderId: { not: null }, status: { in: inFlightStatuses } },
      select: {
        riderId: true,
        id: true,
        orderNumber: true,
        status: true,
        placedAt: true,
        vendor: { select: { name: true, brand: { select: { name: true } } } },
      },
      orderBy: { placedAt: 'desc' },
    });
    const activeOrderByRider = new Map<string, (typeof activeOrders)[number]>();
    for (const ord of activeOrders) {
      if (ord.riderId && !activeOrderByRider.has(ord.riderId)) {
        activeOrderByRider.set(ord.riderId, ord);
      }
    }

    const fleet = riders.map((r) => {
      const ord = activeOrderByRider.get(r.id);

      const activeOrder = ord
        ? {
            id: ord.id,
            orderNumber: ord.orderNumber,
            status: ord.status,
            vendorName: outletDisplayName(ord.vendor?.brand?.name, ord.vendor?.name),
          }
        : null;

      const status: 'ONLINE' | 'ON_TRIP' | 'OFFLINE' = r.isOnline ? (ord ? 'ON_TRIP' : 'ONLINE') : 'OFFLINE';

      return {
        id: r.id,
        userId: r.userId,
        riderName: r.user.fullName,
        phone: r.user.phone,
        vehicleType: r.vehicleType,
        isOnline: r.isOnline,
        isApproved: r.isApproved ?? true,
        status,
        cashInHand: Number(r.cashInHand),
        maxCashLimit: Number(r.maxCashLimit),
        cashSafetyWarning: Number(r.cashInHand) >= Number(r.maxCashLimit) * 0.9,
        // Null when the courier has never beaconed a fix; the map skips nulls
        // instead of plotting a fake default position.
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        activeOrder,
        updatedAt: r.updatedAt,
      };
    });

    return fleet;
  }

  async updateRiderCashLimit(riderId: string, maxCashLimit: number) {
    const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new NotFoundException('Rider not found');

    return this.prisma.rider.update({
      where: { id: riderId },
      data: { maxCashLimit },
    });
  }

  // ===========================================================================
  // 3. Live Order Lifecycle Monitor & Manual Dispatch Force-Assign
  // ===========================================================================
  async getLiveOrders(
    statusFilter: string | undefined,
    pagination: GetLiveOrdersQueryDto,
  ): Promise<PaginatedResult<LiveOrderView>> {
    const where: Prisma.OrderWhereInput = {};
    if (statusFilter && statusFilter !== 'ALL') {
      where.status = statusFilter as OrderStatus;
    }

    // Courier assignment dimension: UNASSIGNED isolates the dispatch queue
    // (active orders with no rider, across every lifecycle stage) while
    // ASSIGNED keeps only secured orders. An explicit status filter still
    // wins over the default terminal exclusion.
    if (pagination.assignment === 'UNASSIGNED') {
      where.riderId = null;
      if (!where.status) {
        where.status = { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] };
      }
    } else if (pagination.assignment === 'ASSIGNED') {
      where.riderId = { not: null };
    }

    // ISO-8601 validity is guaranteed by the DTO validator, so both bounds
    // parse safely; either bound may arrive alone for open-ended ranges.
    const dateFrom = pagination.dateFrom ? new Date(pagination.dateFrom) : undefined;
    const dateTo = pagination.dateTo ? new Date(pagination.dateTo) : undefined;
    if (dateFrom || dateTo) {
      where.placedAt = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    if (pagination.search?.trim()) {
      const term = pagination.search.trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { customer: { phone: { contains: term } } },
        { customer: { fullName: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          customer: { select: { fullName: true, phone: true } },
          vendor: { select: { id: true, name: true, addressText: true, latitude: true, longitude: true, brand: { select: { name: true } } } },
          rider: {
            include: {
              user: { select: { fullName: true, phone: true } },
            },
          },
          orderItems: true,
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    const items: LiveOrderView[] = orders.map((o) => this.toLiveOrderView(o));

    return toPaginatedResult(items, total, pagination);
  }

  async getOrderById(orderId: string): Promise<LiveOrderView> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { fullName: true, phone: true } },
        vendor: { select: { id: true, name: true, addressText: true, latitude: true, longitude: true, brand: { select: { name: true } } } },
        rider: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
        orderItems: true,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.toLiveOrderView(order);
  }

  private toLiveOrderView(o: Prisma.OrderGetPayload<{
    include: {
      customer: { select: { fullName: true; phone: true } };
      vendor: { select: { id: true; name: true; addressText: true; latitude: true; longitude: true; brand: { select: { name: true } } } };
      rider: { include: { user: { select: { fullName: true; phone: true } } } };
      orderItems: true;
    };
  }>): LiveOrderView {
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      vendorId: o.vendorId,
      vendorName: outletDisplayName(o.vendor?.brand?.name, o.vendor?.name),
      vendorAddress: o.vendor?.addressText || '',
      vendorLatitude: o.vendor?.latitude ?? null,
      vendorLongitude: o.vendor?.longitude ?? null,
      customerId: o.customerId,
      customerName: o.customer?.fullName || 'Customer',
      customerPhone: o.customer?.phone || '',
      customerNotes: o.customerNotes || null,
      riderId: o.riderId,
      riderName: o.rider?.user?.fullName || null,
      riderPhone: o.rider?.user?.phone || null,
      status: o.status,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      totalAmount: Number(o.totalAmount),
      deliveryFee: Number(o.deliveryFee),
      subtotal: Number(o.subtotal ?? 0),
      couponDiscount: Number(o.couponDiscount ?? 0),
      taxAmount: Number(o.taxAmount ?? 0),
      placedAt: o.placedAt,
      acceptedAt: o.acceptedAt,
      prepTimeMinutes: o.prepTimeMinutes,
      pickedUpAt: o.pickedUpAt,
      deliveredAt: o.deliveredAt,
      cancelledAt: o.cancelledAt,
      rejectionReason: o.rejectionReason || null,
      items: o.orderItems.map((i) => ({
        id: i.id,
        name: i.productNameSnapshot,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      deliveryAddress: (o.deliveryAddressSnapshot as { addressLine?: string } | null)?.addressLine || 'Address',
      deliveryLatitude: (o.deliveryAddressSnapshot as { latitude?: number } | null)?.latitude ?? null,
      deliveryLongitude: (o.deliveryAddressSnapshot as { longitude?: number } | null)?.longitude ?? null,
    };
  }

  /**
   * Super Admin Manual Dispatch Override:
   * Forces assignment of a specific online rider to an active order.
   */
  async forceAssignRider(orderId: string, riderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        vendor: true,
        orderItems: true,
        customer: { select: { fullName: true, phone: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status === OrderStatus.DELIVERED || order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException(`Cannot reassign order in status "${order.status}"`);
    }

    const rider = await this.prisma.rider.findUnique({
      where: { id: riderId },
      include: { user: { select: { id: true, fullName: true, phone: true, status: true } } },
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    // Fleet governance guards: no override to unapproved/suspended/offline
    // couriers or couriers already mid-trip (the Redis marker alone is not a
    // reliable busy signal — the database is).
    if (!rider.isApproved || rider.user?.status !== 'ACTIVE') {
      throw new BadRequestException('This courier is unapproved or suspended and cannot be assigned orders');
    }
    if (!rider.isOnline) {
      throw new BadRequestException('This courier is currently offline. The rider must go on duty before assignment');
    }

    // Online Payment Invariant (ADR-011): an unverified ONLINE_GATEWAY order
    // must never enter the courier fleet, even by admin override.
    if (order.paymentMethod === 'ONLINE_GATEWAY' && order.paymentStatus !== 'PAID') {
      throw new BadRequestException(
        'This order is awaiting online payment confirmation and cannot be assigned to a courier yet',
      );
    }

    if (rider.id !== order.riderId) {
      const riderInFlight = await this.prisma.order.findFirst({
        where: {
          riderId: rider.id,
          id: { not: order.id },
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
      if (riderInFlight) {
        throw new ConflictException(
          `Courier is already mid-trip on Order #${riderInFlight.orderNumber}. Complete or reassign that trip first.`,
        );
      }
    }

    // Release any previous rider if reassigned
    if (order.riderId && order.riderId !== riderId) {
      await this.redis.del(`rider:active_order:${order.riderId}`);
    }

    // Advance status to RIDER_ASSIGNED if it was still in PLACED.
    // Conditional on the observed status so a concurrent cancellation, claim,
    // or delivery cannot be silently overwritten by a stale override.
    const newStatus = order.status === OrderStatus.PLACED ? OrderStatus.RIDER_ASSIGNED : order.status;

    let updatedOrder;
    try {
      updatedOrder = await this.prisma.order.update({
        where: { id: orderId, status: order.status },
        data: {
          riderId: rider.id,
          status: newStatus,
        },
        include: {
          customer: { select: { fullName: true, phone: true } },
          vendor: true,
          orderItems: true,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ConflictException('Order state changed before the assignment could be applied; refresh and retry');
      }
      throw err;
    }

    // Mark rider busy in Redis
    await this.redis.set(`rider:active_order:${rider.id}`, orderId);

    // Broadcast tracking events to customer and store
    this.trackingGateway.notifyOrderStatusChanged(
      order.id,
      order.customerId,
      order.status,
      newStatus,
      {
        riderId: rider.id,
        riderName: rider.user.fullName,
        riderPhone: rider.user.phone,
        forcedByAdmin: true,
        vendorId: order.vendorId,
      },
    );

    // Direct realtime socket notification to the courier's private rooms
    if (this.trackingGateway?.server) {
      this.trackingGateway.server
        .to(`rider_${rider.id}`)
        .to(`user_${rider.userId}`)
        .emit('order:assigned', {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          vendorName: updatedOrder.vendor?.name,
          totalAmount: Number(updatedOrder.totalAmount),
        });
    }

    // High-priority FCM Push Notification
    this.notificationsService
      .sendToUser(rider.userId, {
        title: 'New Order Assigned! 📦',
        body: `You have been manually assigned order #${updatedOrder.orderNumber} from ${updatedOrder.vendor?.name || 'Restaurant'}`,
        data: {
          orderId: updatedOrder.id,
          orderNumber: updatedOrder.orderNumber,
          type: 'ORDER_ASSIGNED',
        },
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`Push notify rider failed on force-assign: ${msg}`);
      });

    this.logger.log(
      `[ADMIN FORCE-ASSIGN] Order #${order.orderNumber} manually assigned to rider ${rider.user.fullName} (${rider.id})`,
    );

    return {
      orderId: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      assignedRider: {
        id: rider.id,
        name: rider.user.fullName,
        phone: rider.user.phone,
      },
    };
  }

  // ===========================================================================
  // 4. Promotional Banners Management
  // ===========================================================================
  async getAllBanners() {
    return this.prisma.banner.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createBanner(data: {
    title: string;
    imageUrl: string;
    linkType?: BannerLinkType;
    targetId?: string;
    targetUrl?: string;
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: Date;
    endsAt?: Date;
  }) {
    await this.validateBannerTarget(data);
    return this.prisma.banner.create({
      data: {
        title: data.title,
        imageUrl: data.imageUrl,
        linkType: data.linkType || BannerLinkType.OUTLET,
        targetId: data.targetId || null,
        targetUrl: data.targetUrl || null,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
        startsAt: data.startsAt || new Date(),
        endsAt: data.endsAt || null,
      },
    });
  }

  async updateBanner(
    id: string,
    data: {
      title?: string;
      imageUrl?: string;
      linkType?: BannerLinkType;
      targetId?: string;
      targetUrl?: string;
      sortOrder?: number;
      isActive?: boolean;
      startsAt?: Date;
      endsAt?: Date;
    },
  ) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');

    await this.validateBannerTarget(data, banner);

    return this.prisma.banner.update({
      where: { id },
      data,
    });
  }

  /** Deeplink integrity: an EXTERNAL banner must carry an absolute http(s)
   *  URL; an INTERNAL banner must carry an internal targetUrl (e.g. /search?q=pizza, /cart);
   *  OUTLET/CATEGORY banners must reference an existing target so the
   *  customer app can never be deeplinked into a dead screen. */
  private async validateBannerTarget(
    data: { linkType?: BannerLinkType; targetId?: string; targetUrl?: string },
    existing?: { linkType: BannerLinkType; targetId: string | null; targetUrl: string | null },
  ) {
    const linkType = data.linkType ?? existing?.linkType ?? BannerLinkType.OUTLET;
    const targetId = data.targetId ?? existing?.targetId ?? null;
    const targetUrl = data.targetUrl ?? existing?.targetUrl ?? null;

    if (linkType === BannerLinkType.EXTERNAL) {
      if (!targetUrl || !/^https?:\/\//i.test(targetUrl.trim())) {
        throw new BadRequestException('EXTERNAL banners require a valid absolute http(s) targetUrl');
      }
      return;
    }

    if (linkType === BannerLinkType.INTERNAL) {
      if (!targetUrl || !targetUrl.trim()) {
        throw new BadRequestException('INTERNAL banners require a targetUrl (e.g. /search?q=pizza, /cart)');
      }
      return;
    }

    if (!targetId) {
      throw new BadRequestException(`${linkType} banners require a targetId`);
    }
    if (linkType === BannerLinkType.OUTLET) {
      const vendor = await this.prisma.vendor.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!vendor) throw new BadRequestException('Banner target outlet does not exist');
    } else if (linkType === BannerLinkType.CATEGORY) {
      const category = await this.prisma.category.findUnique({ where: { id: targetId }, select: { id: true } });
      if (!category) throw new BadRequestException('Banner target category does not exist');
    }
  }

  async deleteBanner(id: string) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');

    await this.prisma.banner.delete({ where: { id } });
    return { success: true, message: 'Banner deleted successfully' };
  }

  // ===========================================================================
  // 5. Coupon Engine Management
  // ===========================================================================
  async getAllCoupons() {
    return this.prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { orders: true } },
      },
    });
  }

  async createCoupon(data: {
    code: string;
    description?: string;
    discountType: DiscountType;
    discountValue: number;
    minOrderAmount?: number;
    maxDiscountAmount?: number;
    usageLimit?: number;
    validFrom?: Date;
    validTo?: Date;
    isActive?: boolean;
  }) {
    const existing = await this.prisma.coupon.findUnique({ where: { code: data.code.toUpperCase() } });
    if (existing) {
      throw new ConflictException(`Coupon code "${data.code}" already exists`);
    }

    return this.prisma.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        description: data.description || null,
        discountType: data.discountType,
        discountValue: data.discountValue,
        minOrderAmount: data.minOrderAmount || 0,
        maxDiscountAmount: data.maxDiscountAmount || null,
        usageLimit: data.usageLimit || 1000,
        validFrom: data.validFrom || new Date(),
        validTo: data.validTo || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async updateCoupon(
    id: string,
    data: {
      description?: string;
      discountType?: DiscountType;
      discountValue?: number;
      minOrderAmount?: number;
      maxDiscountAmount?: number;
      usageLimit?: number;
      validFrom?: Date;
      validTo?: Date;
      isActive?: boolean;
    },
  ) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    return this.prisma.coupon.update({
      where: { id },
      data,
    });
  }

  async deleteCoupon(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    await this.prisma.coupon.delete({ where: { id } });
    return { success: true, message: 'Coupon deleted successfully' };
  }

  // ===========================================================================
  // 6. Vendor & Staff Governance
  // ===========================================================================
  async getAllVendors() {
    const vendors = await this.prisma.vendor.findMany({
      include: {
        brand: { select: { id: true, name: true } },
        operatingHours: true,
        staff: {
          include: {
            user: { select: { id: true, fullName: true, phone: true } },
          },
        },
        _count: {
          select: {
            staff: true,
            categories: true,
            products: true,
            orders: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return vendors.map((v) => ({
      id: v.id,
      name: v.name,
      brandId: v.brandId,
      brandName: v.brand?.name || null,
      addressText: v.addressText,
      contactPhone: v.contactPhone,
      bannerUrl: v.bannerUrl,
      latitude: Number(v.latitude),
      longitude: Number(v.longitude),
      deliveryRadiusKm: Number(v.deliveryRadiusKm),
      isBusy: v.isBusy,
      isActive: v.isActive,
      commissionRate: Number(v.commissionRate),
      defaultPrepTimeMinutes: v.defaultPrepTimeMinutes,
      totalStaff: v.staff.length,
      totalCategories: v._count?.categories ?? 0,
      totalProducts: v._count?.products ?? 0,
      totalOrders: v._count?.orders ?? 0,
      staff: v.staff.map((s) => ({
        id: s.id,
        userId: s.userId,
        fullName: s.user?.fullName || 'Staff User',
        phone: s.user?.phone || '',
        scope: s.scope,
        isActive: s.isActive,
      })),
    }));
  }

  // ===========================================================================
  // 6b. Brand Governance
  // ===========================================================================
  async getAllBrands() {
    const brands = await this.prisma.vendorBrand.findMany({
      include: { _count: { select: { outlets: true, staff: true } } },
      orderBy: { name: 'asc' },
    });
    return brands.map((b) => ({
      id: b.id,
      name: b.name,
      logoUrl: b.logoUrl,
      totalOutlets: b._count.outlets,
      totalStaff: b._count.staff,
      createdAt: b.createdAt,
    }));
  }

  async createBrand(data: { name: string; logoUrl?: string }) {
    const name = data.name.trim();
    const duplicate = await this.prisma.vendorBrand.findFirst({ where: { name } });
    if (duplicate) {
      throw new ConflictException(`A brand named "${name}" already exists`);
    }
    return this.prisma.vendorBrand.create({
      data: { name, logoUrl: data.logoUrl?.trim() || null },
    });
  }

  async updateBrand(brandId: string, data: { name?: string; logoUrl?: string }) {
    const brand = await this.prisma.vendorBrand.findUnique({ where: { id: brandId } });
    if (!brand) throw new NotFoundException('Brand not found');

    const name = data.name?.trim();
    if (name && name !== brand.name) {
      const duplicate = await this.prisma.vendorBrand.findFirst({ where: { name } });
      if (duplicate) throw new ConflictException(`A brand named "${name}" already exists`);
    }

    return this.prisma.vendorBrand.update({
      where: { id: brandId },
      data: {
        ...(name !== undefined && { name }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl?.trim() || null }),
      },
    });
  }

  async deleteBrand(brandId: string) {
    const brand = await this.prisma.vendorBrand.findUnique({
      where: { id: brandId },
      include: { _count: { select: { outlets: true, staff: true } } },
    });
    if (!brand) throw new NotFoundException('Brand not found');

    if (brand._count.outlets > 0) {
      throw new ConflictException(
        `Brand "${brand.name}" still operates ${brand._count.outlets} outlet(s) — reassign or delete them first`,
      );
    }
    if (brand._count.staff > 0) {
      throw new ConflictException(
        `Brand "${brand.name}" still has ${brand._count.staff} staff assignment(s) — remove them first`,
      );
    }
    await this.prisma.vendorBrand.delete({ where: { id: brandId } });
  }

  /**
   * Sets, replaces, or clears the brand owner (the brand-scoped
   * ALL_OUTLETS_MASTER assignment) in one atomic operation. Replacing an
   * owner removes the previous master assignment and demotes accounts whose
   * last tie it was — identical semantics to removeVendorStaff. A candidate
   * holding any other active assignment is rejected (one active role per
   * account).
   */
  async setBrandOwner(brandId: string, userId?: string | null) {
    const { result, sessionPurgeIds } = await this.prisma.$transaction(async (tx) => {
      const brand = await tx.vendorBrand.findUnique({
        where: { id: brandId },
        include: {
          staff: {
            where: { scope: PermissionScope.ALL_OUTLETS_MASTER, isActive: true },
            include: { user: { select: { id: true, fullName: true, phone: true, role: true } } },
          },
        },
      });
      if (!brand) throw new NotFoundException('Brand not found');

      const demotedUserIds: string[] = [];
      for (const owner of brand.staff) {
        await tx.vendorStaff.delete({ where: { id: owner.id } });
        const remaining = await tx.vendorStaff.count({ where: { userId: owner.userId } });
        if (remaining === 0 && owner.user?.role === UserRole.VENDOR_ADMIN) {
          await tx.user.update({
            where: { id: owner.userId },
            data: { role: UserRole.CUSTOMER },
          });
          demotedUserIds.push(owner.userId);
        }
      }

      if (!userId) {
        return { result: { owner: null, demotedCount: demotedUserIds.length }, sessionPurgeIds: demotedUserIds };
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('Owner user not found');

      // This brand's owners were just cleared, so anything still active means
      // the candidate is committed to another outlet or brand.
      const activeElsewhere = await tx.vendorStaff.findFirst({ where: { userId, isActive: true } });
      if (activeElsewhere) {
        throw new ConflictException(
          `${user.fullName} already holds an active assignment — remove it before making them the brand owner`,
        );
      }

      const created = await tx.vendorStaff.create({
        data: { userId, brandId, scope: PermissionScope.ALL_OUTLETS_MASTER, isActive: true },
      });

      if (user.role !== UserRole.VENDOR_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
        await tx.user.update({ where: { id: userId }, data: { role: UserRole.VENDOR_ADMIN } });
      }

      return {
        result: {
          owner: {
            id: created.id,
            userId,
            fullName: user.fullName,
            phone: user.phone,
            scope: created.scope,
            isActive: true,
          },
          demotedCount: demotedUserIds.length,
        },
        sessionPurgeIds: [...demotedUserIds, userId],
      };
    });

    for (const id of sessionPurgeIds) {
      await this.redis.del(`auth:user:${id}`);
    }

    return result;
  }

  // ===========================================================================
  // 6c. Outlet Catalog Governance View
  // ===========================================================================
  async getVendorCatalog(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            products: {
              orderBy: { sortOrder: 'asc' },
              include: {
                variants: { orderBy: { sortOrder: 'asc' } },
              },
            },
          },
        },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      categories: vendor.categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        products: c.products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          basePrice: Number(p.basePrice),
          imageUrl: p.imageUrl,
          isInStock: p.isInStock,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: Number(v.price),
            sortOrder: v.sortOrder,
            isInStock: v.isInStock,
          })),
        })),
      })),
    };
  }

  // ===========================================================================
  // 6d. Owner / Staff Account Governance
  // ===========================================================================
  async searchUsersByPhone(phone: string) {
    const term = phone.trim();
    if (term.length < 3) return [];
    return this.prisma.user.findMany({
      where: { phone: { contains: term } },
      select: { id: true, phone: true, fullName: true, role: true, status: true },
      take: 10,
      orderBy: { phone: 'asc' },
    });
  }

  /** Provisions a VENDOR_ADMIN account; the owner later signs in via phone OTP. */
  async createStaffUser(data: { phone: string; fullName: string }) {
    const phone = data.phone.trim();
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) {
      throw new ConflictException(`An account with phone ${phone} already exists (${existing.role})`);
    }
    return this.prisma.user.create({
      data: {
        phone,
        fullName: data.fullName.trim(),
        role: UserRole.VENDOR_ADMIN,
        status: AccountStatus.ACTIVE,
      },
      select: { id: true, phone: true, fullName: true, role: true, status: true },
    });
  }

  async getAllVendorStaff() {
    const staff = await this.prisma.vendorStaff.findMany({
      include: {
        user: { select: { id: true, fullName: true, phone: true, status: true } },
        vendor: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return staff.map((s) => ({
      id: s.id,
      userId: s.userId,
      fullName: s.user?.fullName || 'Staff User',
      phone: s.user?.phone || '',
      userStatus: s.user?.status || 'ACTIVE',
      scope: s.scope,
      isActive: s.isActive,
      vendorId: s.vendorId,
      vendorName: s.vendor?.name || null,
      brandId: s.brandId,
      brandName: s.brand?.name || null,
    }));
  }

  /**
   * Removes a staff assignment. When it was the user's last outlet/brand tie,
   * the account demotes back to CUSTOMER so it cannot reach vendor portals;
   * the 30s session cache is purged so the revocation lands immediately.
   */
  async removeVendorStaff(staffId: string) {
    const staff = await this.prisma.vendorStaff.findUnique({
      where: { id: staffId },
      include: { user: true },
    });
    if (!staff) throw new NotFoundException('Staff assignment not found');

    await this.prisma.vendorStaff.delete({ where: { id: staffId } });

    const remaining = await this.prisma.vendorStaff.count({ where: { userId: staff.userId } });
    let demoted = false;
    if (remaining === 0 && staff.user?.role === UserRole.VENDOR_ADMIN) {
      await this.prisma.user.update({
        where: { id: staff.userId },
        data: { role: UserRole.CUSTOMER },
      });
      demoted = true;
    }

    await this.redis.del(`auth:user:${staff.userId}`);
    return { removed: true, demoted };
  }

  async createVendor(data: {
    name: string;
    brandId: string;
    typeId: string;
    addressText: string;
    latitude: number;
    longitude: number;
    contactPhone: string;
    bannerUrl?: string;
    commissionRate?: number;
    deliveryRadiusKm?: number;
    defaultPrepTimeMinutes?: number;
    orderFlowMode?: OrderFlowMode;
  }) {
    if (!data.brandId) {
      throw new BadRequestException('Every outlet must belong to a brand');
    }

    const type = await this.prisma.outletType.findUnique({ where: { id: data.typeId } });
    if (!type) {
      throw new BadRequestException(`Outlet type with ID "${data.typeId}" not found`);
    }
    if (!type.isActive) {
      throw new ConflictException(
        `Outlet type "${type.name}" is deactivated — outlets cannot be created under it while it remains hidden from customers`,
      );
    }

    return this.prisma.vendor.create({
      data: {
        name: data.name,
        brandId: data.brandId,
        typeId: data.typeId,
        addressText: data.addressText,
        latitude: data.latitude,
        longitude: data.longitude,
        contactPhone: data.contactPhone,
        ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl }),
        commissionRate: data.commissionRate ?? 15.00,
        deliveryRadiusKm: data.deliveryRadiusKm ?? 5.00,
        defaultPrepTimeMinutes: data.defaultPrepTimeMinutes ?? 20,
        orderFlowMode: data.orderFlowMode ?? OrderFlowMode.RIDER_FIRST,
        isActive: true,
      },
      include: { type: true },
    });
  }

  async updateVendor(
    vendorId: string,
    data: {
      name?: string;
      brandId?: string;
      typeId?: string;
      addressText?: string;
      contactPhone?: string;
      commissionRate?: number;
      deliveryRadiusKm?: number;
      defaultPrepTimeMinutes?: number;
      logoUrl?: string;
      bannerUrl?: string;
      latitude?: number;
      longitude?: number;
      isActive?: boolean;
      isBusy?: boolean;
      orderFlowMode?: OrderFlowMode;
    },
  ) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    if (data.typeId !== undefined) {
      const type = await this.prisma.outletType.findUnique({ where: { id: data.typeId } });
      if (!type) {
        throw new BadRequestException(`Outlet type with ID "${data.typeId}" not found`);
      }
    }

    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        // Brands are mandatory (ADR-017): an update may switch brands but never detach.
        ...(data.brandId !== undefined && data.brandId !== '' && { brandId: data.brandId }),
        ...(data.typeId !== undefined && { typeId: data.typeId }),
        ...(data.addressText !== undefined && { addressText: data.addressText }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
        ...(data.commissionRate !== undefined && { commissionRate: data.commissionRate }),
        ...(data.deliveryRadiusKm !== undefined && { deliveryRadiusKm: data.deliveryRadiusKm }),
        ...(data.defaultPrepTimeMinutes !== undefined && { defaultPrepTimeMinutes: data.defaultPrepTimeMinutes }),
        ...(data.latitude !== undefined && { latitude: data.latitude }),
        ...(data.longitude !== undefined && { longitude: data.longitude }),
        ...(data.bannerUrl !== undefined && data.bannerUrl !== '' && { bannerUrl: data.bannerUrl || null }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isBusy !== undefined && { isBusy: data.isBusy }),
        ...(data.orderFlowMode !== undefined && { orderFlowMode: data.orderFlowMode }),
      },
      include: { type: true },
    });

    if (data.isActive !== undefined || data.isBusy !== undefined) {
      this.trackingGateway?.notifyVendorStatusChanged?.(vendorId, {
        vendorId,
        isActive: updated.isActive,
        isBusy: updated.isBusy,
      });
    }

    return updated;
  }

  async deleteVendor(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        _count: {
          select: {
            staff: true,
            categories: true,
            products: true,
            orders: true,
          },
        },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    if (vendor._count.staff > 0) {
      throw new ConflictException(
        `Outlet "${vendor.name}" still has ${vendor._count.staff} tagged staff assignment(s) — remove them first`,
      );
    }
    if (vendor._count.categories > 0) {
      throw new ConflictException(
        `Outlet "${vendor.name}" still has ${vendor._count.categories} category/categories — remove or delete them first`,
      );
    }
    if (vendor._count.products > 0) {
      throw new ConflictException(
        `Outlet "${vendor.name}" still has ${vendor._count.products} item/product(s) — remove or delete them first`,
      );
    }
    if (vendor._count.orders > 0) {
      throw new ConflictException(
        `Outlet "${vendor.name}" has ${vendor._count.orders} order(s) — cannot delete an outlet with historical orders`,
      );
    }

    await this.prisma.vendor.delete({ where: { id: vendorId } });
    return { id: vendorId, name: vendor.name };
  }

  async toggleVendorStatus(vendorId: string, isActive: boolean) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { isActive },
    });

    this.trackingGateway?.notifyVendorStatusChanged?.(vendorId, {
      vendorId,
      isActive: updated.isActive,
      isBusy: updated.isBusy,
    });

    return updated;
  }

  async toggleVendorPause(vendorId: string, isBusy: boolean) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    const updated = await this.prisma.vendor.update({
      where: { id: vendorId },
      data: { isBusy },
    });

    this.trackingGateway?.notifyVendorStatusChanged?.(vendorId, {
      vendorId,
      isActive: updated.isActive,
      isBusy: updated.isBusy,
    });

    return updated;
  }

  async assignVendorStaff(
    vendorId: string,
    data: {
      userId: string;
      scope: PermissionScope;
      role?: string;
      brandId?: string;
    },
  ) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    const user = await this.prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) throw new NotFoundException('User not found');

    // One active assignment per account: an owner governs one brand, a manager
    // one outlet — accumulating active roles is rejected explicitly.
    const activeElsewhere = await this.prisma.vendorStaff.findFirst({
      where: { userId: data.userId, isActive: true },
    });
    if (activeElsewhere) {
      const sameRow =
        activeElsewhere.vendorId === vendorId ||
        (data.scope === PermissionScope.ALL_OUTLETS_MASTER &&
          activeElsewhere.scope === PermissionScope.ALL_OUTLETS_MASTER &&
          activeElsewhere.brandId === (data.brandId || vendor.brandId));
      if (!sameRow) {
        throw new ConflictException(
          'This account already holds an active assignment — remove it before assigning elsewhere',
        );
      }
    }

    // Ensure user role is VENDOR_ADMIN
    if (user.role !== UserRole.VENDOR_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.VENDOR_ADMIN },
      });
    }

    const targetVendorId = data.scope === PermissionScope.PARTICULAR_OUTLET ? vendorId : null;
    const effectiveBrandId = data.scope === PermissionScope.ALL_OUTLETS_MASTER
      ? (data.brandId || vendor.brandId)
      : null;

    const existing = await this.prisma.vendorStaff.findFirst({
      where: {
        userId: data.userId,
        vendorId: targetVendorId,
      },
    });

    let staffRecord;
    if (existing) {
      staffRecord = await this.prisma.vendorStaff.update({
        where: { id: existing.id },
        data: {
          brandId: effectiveBrandId,
          scope: data.scope,
          isActive: true,
        },
      });
    } else {
      staffRecord = await this.prisma.vendorStaff.create({
        data: {
          userId: data.userId,
          vendorId: targetVendorId,
          brandId: effectiveBrandId,
          scope: data.scope,
          isActive: true,
        },
      });
    }

    // Invalidate Redis user session cache so JwtAuthGuard re-fetches updated role/scope
    await this.redis.del(`auth:user:${user.id}`);

    return staffRecord;
  }

  // ===========================================================================
  // 7. Master Catalog Authority
  // ===========================================================================

  /**
   * Wholesale product save (ADR-017): the variations array is the single
   * source of truth. Invariants enforced in one transaction:
   *  - at least one variation,
   *  - variations ordered (first defines the product display price),
   *  - product.basePrice synced to variations[0].price.
   */
  async saveProduct(
    input: {
      vendorId?: string;
      categoryId: string;
      name: string;
      description?: string | null;
      imageUrl?: string | null;
      isInStock?: boolean;
      sortOrder?: number;
      variations: Array<{ id?: string; name: string; price: number; isInStock: boolean }>;
    },
    productId?: string,
  ) {
    const variations = input.variations.filter((v) => v.name.trim() && v.price >= 0);
    if (variations.length === 0) {
      throw new BadRequestException('A product must have at least one variation');
    }

    const basePrice = variations[0].price;

    if (!productId && !input.vendorId) {
      throw new BadRequestException('vendorId is required when creating a product');
    }

    return this.prisma.$transaction(async (tx) => {
      if (productId) {
        const existing = await tx.product.findUnique({ where: { id: productId } });
        if (!existing) throw new NotFoundException('Product not found');

        const existingVariants = await tx.productVariant.findMany({ where: { productId } });
        const keptIds = new Set(variations.map((v) => v.id).filter((id): id is string => !!id));
        for (const variant of existingVariants) {
          if (!keptIds.has(variant.id)) {
            // Safe even for historical orders: line items freeze variant JSONB snapshots (ADR-008).
            await tx.productVariant.delete({ where: { id: variant.id } });
          }
        }

        await tx.product.update({
          where: { id: productId },
          data: {
            name: input.name.trim(),
            description: input.description ?? null,
            imageUrl: input.imageUrl ?? null,
            isInStock: input.isInStock ?? true,
            sortOrder: input.sortOrder ?? 0,
            categoryId: input.categoryId,
            basePrice,
          },
        });

        for (const [index, variant] of variations.entries()) {
          const data = {
            name: variant.name.trim(),
            price: variant.price,
            isInStock: variant.isInStock,
            sortOrder: index + 1,
          };
          if (variant.id) {
            await tx.productVariant.update({ where: { id: variant.id }, data });
          } else {
            await tx.productVariant.create({ data: { ...data, productId } });
          }
        }

        return tx.product.findUnique({
          where: { id: productId },
          include: { variants: { orderBy: { sortOrder: 'asc' } } },
        });
      }

      const created = await tx.product.create({
        data: {
          name: input.name.trim(),
          description: input.description ?? null,
          imageUrl: input.imageUrl ?? null,
          isInStock: input.isInStock ?? true,
          sortOrder: input.sortOrder ?? 0,
          categoryId: input.categoryId,
          vendorId: input.vendorId as string,
          basePrice,
          variants: {
            create: variations.map((variant, index) => ({
              name: variant.name.trim(),
              price: variant.price,
              isInStock: variant.isInStock,
              sortOrder: index + 1,
            })),
          },
        },
        include: { variants: { orderBy: { sortOrder: 'asc' } } },
      });
      return created;
    });
  }

  /**
   * Hard product delete guarded by order history: line items freeze JSONB
   * snapshots (ADR-008) but carry a required product FK, so any product that
   * ever appeared on an order must be retired via isInStock instead.
   */
  async deleteProduct(productId: string) {
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        include: { _count: { select: { orderItems: true } } },
      });
      if (!product) throw new NotFoundException('Product not found');

      if (product._count.orderItems > 0) {
        throw new ConflictException(
          `"${product.name}" appears on ${product._count.orderItems} historical order line item(s) and cannot be deleted — mark it out of stock instead`,
        );
      }

      await tx.productVariant.deleteMany({ where: { productId } });
      await tx.product.delete({ where: { id: productId } });

      return { id: productId, name: product.name };
    });
  }

  async updateVendorStaffAssignment(
    staffId: string,
    data: { isActive?: boolean; scope?: PermissionScope; brandId?: string; vendorId?: string },
  ) {
    const staff = await this.prisma.vendorStaff.findUnique({
      where: { id: staffId },
      include: { vendor: true },
    });
    if (!staff) throw new NotFoundException('Staff assignment not found');

    const patch: Prisma.VendorStaffUncheckedUpdateInput = {};
    if (data.isActive !== undefined) {
      patch.isActive = data.isActive;
    }

    if (data.scope && data.scope !== staff.scope) {
      // Owner scope binds to the brand, Manager scope binds to one outlet.
      if (data.scope === PermissionScope.ALL_OUTLETS_MASTER) {
        const brandId = data.brandId || staff.vendor?.brandId;
        if (!brandId) throw new BadRequestException('Brand owner scope requires a brand');
        patch.scope = data.scope;
        patch.brandId = brandId;
        patch.vendorId = null;
      } else {
        const vendorId = data.vendorId || staff.vendorId;
        if (!vendorId) throw new BadRequestException('Branch manager scope requires an outlet');
        patch.scope = data.scope;
        patch.vendorId = vendorId;
        patch.brandId = null;
      }
    }

    const updated = await this.prisma.vendorStaff.update({ where: { id: staffId }, data: patch });

    // Scope/active changes must reach the guarded session within this request's lifetime.
    await this.redis.del(`auth:user:${staff.userId}`);
    return updated;
  }

  async updateStaffAccount(
    userId: string,
    data: { fullName?: string; phone?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User account not found');

    const phone = data.phone?.trim();
    if (phone && phone !== user.phone) {
      const duplicate = await this.prisma.user.findUnique({ where: { phone } });
      if (duplicate) throw new ConflictException(`An account with phone ${phone} already exists`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.fullName !== undefined && { fullName: data.fullName.trim() }),
        ...(phone !== undefined && { phone }),
      },
      select: { id: true, phone: true, fullName: true, role: true, status: true },
    });

    await this.redis.del(`auth:user:${userId}`);
    return updated;
  }

  async searchBrands(search: string | undefined, pagination: PaginationQueryDto) {
    const term = search?.trim();
    const where: Prisma.VendorBrandWhereInput = term
      ? { name: { contains: term, mode: 'insensitive' } }
      : {};

    const [brands, total] = await this.prisma.$transaction([
      this.prisma.vendorBrand.findMany({
        where,
        include: {
          _count: { select: { outlets: true, staff: true } },
          // Brand-scoped owners carry vendorId=null, so they never surface in
          // outlet-derived staff lists — resolve them straight from the brand.
          staff: {
            where: { scope: PermissionScope.ALL_OUTLETS_MASTER },
            include: { user: { select: { id: true, fullName: true, phone: true, status: true } } },
          },
        },
        orderBy: { name: 'asc' },
        skip: pagination.skip,
        take: pagination.limit,
      }),
      this.prisma.vendorBrand.count({ where }),
    ]);

    const items = brands.map((b) => {
      const ownerStaff = b.staff.find((s) => s.isActive) || b.staff[0];
      return {
        id: b.id,
        name: b.name,
        logoUrl: b.logoUrl,
        totalOutlets: b._count.outlets,
        totalStaff: b._count.staff,
        createdAt: b.createdAt,
        owner: ownerStaff
          ? {
              id: ownerStaff.id,
              userId: ownerStaff.userId,
              fullName: ownerStaff.user?.fullName || 'Owner',
              phone: ownerStaff.user?.phone || '',
              userStatus: ownerStaff.user?.status || 'ACTIVE',
              scope: ownerStaff.scope,
              isActive: ownerStaff.isActive,
              vendorId: null,
              vendorName: null,
              brandId: b.id,
              brandName: b.name,
            }
          : null,
      };
    });

    return {
      items,
      total,
      page: pagination.page,
      limit: pagination.limit,
      totalPages: Math.max(1, Math.ceil(total / pagination.limit)),
    };
  }

  /** Aggregated outlet detail powering the unified Outlet Page. */
  async getOutletDetail(vendorId: string) {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      include: {
        brand: { select: { id: true, name: true, logoUrl: true } },
        operatingHours: { orderBy: { dayOfWeek: 'asc' } },
        staff: {
          include: { user: { select: { id: true, fullName: true, phone: true, status: true } } },
          orderBy: { createdAt: 'asc' },
        },
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            products: {
              orderBy: { sortOrder: 'asc' },
              include: { variants: { orderBy: { sortOrder: 'asc' } } },
            },
          },
        },
        _count: {
          select: {
            staff: true,
            categories: true,
            products: true,
            orders: true,
          },
        },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    return {
      vendor: {
        id: vendor.id,
        name: vendor.name,
        brandId: vendor.brandId,
        brandName: vendor.brand?.name || null,
        brandLogoUrl: vendor.brand?.logoUrl || null,
        bannerUrl: vendor.bannerUrl,
        addressText: vendor.addressText,
        contactPhone: vendor.contactPhone,
        latitude: Number(vendor.latitude),
        longitude: Number(vendor.longitude),
        commissionRate: Number(vendor.commissionRate),
        deliveryRadiusKm: Number(vendor.deliveryRadiusKm),
        defaultPrepTimeMinutes: vendor.defaultPrepTimeMinutes,
        isActive: vendor.isActive,
        isBusy: vendor.isBusy,
        totalStaff: vendor.staff.length,
        totalCategories: vendor._count?.categories ?? vendor.categories.length,
        totalProducts: vendor._count?.products ?? 0,
        totalOrders: vendor._count?.orders ?? 0,
      },
      operatingHours: vendor.operatingHours,
      staff: vendor.staff.map((s) => ({
        id: s.id,
        userId: s.userId,
        fullName: s.user?.fullName || 'Staff User',
        phone: s.user?.phone || '',
        userStatus: s.user?.status || 'ACTIVE',
        scope: s.scope,
        isActive: s.isActive,
        vendorId: s.vendorId,
        vendorName: s.vendorId === vendor.id ? vendor.name : null,
        brandId: s.brandId,
        brandName: vendor.brand?.name || null,
      })),
      categories: vendor.categories.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        products: c.products.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          imageUrl: p.imageUrl,
          isInStock: p.isInStock,
          basePrice: Number(p.basePrice),
          sortOrder: p.sortOrder,
          variants: p.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: Number(v.price),
            sortOrder: v.sortOrder,
            isInStock: v.isInStock,
          })),
        })),
      })),
    };
  }

  async updateOutletOperatingHours(
    vendorId: string,
    hours: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>,
  ) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    await this.prisma.$transaction(
      hours.map((day) =>
        this.prisma.vendorOperatingHour.upsert({
          where: { vendorId_dayOfWeek: { vendorId, dayOfWeek: day.dayOfWeek } },
          update: { openTime: day.openTime, closeTime: day.closeTime, isClosed: day.isClosed },
          create: { vendorId, ...day },
        }),
      ),
    );

    return this.prisma.vendorOperatingHour.findMany({
      where: { vendorId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async createOutletCategory(vendorId: string, data: { name: string; sortOrder?: number }) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');
    return this.prisma.category.create({
      data: {
        vendorId,
        name: data.name.trim(),
        sortOrder: data.sortOrder ?? 0,
        isActive: true,
      },
    });
  }

  async updateCategory(categoryId: string, data: { name?: string; sortOrder?: number; isActive?: boolean }) {
    const category = await this.prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    return this.prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  /**
   * Category deletion guarded by product attachments: products reference the
   * category with a nullable FK, but silently orphaning live menu items is
   * never acceptable — categories only delete while product-less (retire
   * stocked ones via PATCH isActive=false instead).
   */
  async deleteCategory(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');

    if (category._count.products > 0) {
      throw new ConflictException(
        `Category "${category.name}" still has ${category._count.products} product(s) attached — move or delete them first`,
      );
    }

    await this.prisma.category.delete({ where: { id: categoryId } });
    return { id: categoryId, name: category.name };
  }

  async getCentralCategories() {
    return this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: { select: { products: true } },
      },
    });
  }

  async createCentralCategory(data: { name: string; imageUrl?: string; sortOrder?: number; isActive?: boolean }) {
    return this.prisma.category.create({
      data: {
        name: data.name,
        imageUrl: data.imageUrl || null,
        sortOrder: data.sortOrder || 0,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  // ===========================================================================
  // 8. Platform System Settings
  // ===========================================================================
  async getSystemSettings() {
    const [dispatchSetting, deliveryFeeSetting, economicsSetting] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: 'dispatch_config' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'delivery_fee_config' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'delivery_economics' } }),
    ]);

    return {
      dispatch:
        (dispatchSetting?.value as unknown as DispatchSettingPayload | null) || {
          rider_search_timeout_seconds: 90,
          stale_order_ttl_minutes: 60,
        },
      deliveryFee: normalizeDeliveryFeeConfig(
        deliveryFeeSetting?.value as Record<string, unknown> | null,
        DEFAULT_DELIVERY_FEE_CONFIG,
      ),
      deliveryEconomics: (economicsSetting?.value as unknown as DeliveryEconomicsConfig | null) ||
        DEFAULT_DELIVERY_ECONOMICS,
    };
  }

  async updateDeliveryFeeMode(data: {
    mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
    flatFee?: number;
    baseFee?: number;
    baseKm?: number;
    perKmRate?: number;
  }): Promise<DeliveryFeeConfig> {
    const flatFee = data.flatFee ?? 50.0;
    const baseFee = data.baseFee ?? 40.0;
    const baseKm = data.baseKm ?? 2.0;
    const perKmRate = data.perKmRate ?? 15.0;

    const payload: DeliveryFeeConfig = {
      mode: data.mode,
      flatFee,
      baseFee,
      baseKm,
      perKmRate,
    };

    const updated = await this.prisma.systemSetting.upsert({
      where: { key: 'delivery_fee_config' },
      update: {
        value: { ...payload },
      },
      create: {
        key: 'delivery_fee_config',
        value: { ...payload },
        description: 'Delivery fee pricing mode: FIXED_FLAT vs DISTANCE_TIERED',
      },
    });

    this.deliveryFeeService.invalidateCache();

    return updated.value as unknown as DeliveryFeeConfig;
  }

  async updateDeliveryEconomics(data: {
    riderSharePercent: number;
    etaAvgSpeedKmh: number;
    etaFallbackMinutes: number;
  }): Promise<DeliveryEconomicsConfig> {
    const payload: DeliveryEconomicsConfig = {
      rider_share_percent: data.riderSharePercent,
      eta_avg_speed_kmh: data.etaAvgSpeedKmh,
      eta_fallback_minutes: data.etaFallbackMinutes,
    };

    await this.prisma.systemSetting.upsert({
      where: { key: 'delivery_economics' },
      update: { value: { ...payload } },
      create: {
        key: 'delivery_economics',
        value: { ...payload },
        description: 'Rider payout share of delivery fees and ETA computation economics',
      },
    });

    this.deliveryFeeService.invalidateCache();

    return payload;
  }

  // ===========================================================================
  // 9. Financial Settlements & CSV Export
  // ===========================================================================
  async getSettlementStatements(startDate?: Date, endDate?: Date) {
    const where: Prisma.CommissionLedgerWhereInput = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const ledgers = await this.prisma.commissionLedger.findMany({
      where,
      include: {
        vendor: {
          include: { brand: true },
        },
      },
    });

    const vendorMap = new Map<
      string,
      {
        vendorId: string;
        vendorName: string;
        brandName: string;
        totalOrders: number;
        grossSales: number;
        platformCommission: number;
        netVendorPayable: number;
        settlementStatus: string;
      }
    >();

    for (const l of ledgers) {
      const vId = l.vendorId;
      const gross = Number(l.grossAmount);
      const commission = Number(l.commissionAmount);
      const net = Number(l.netVendorPayable);

      if (!vendorMap.has(vId)) {
        vendorMap.set(vId, {
          vendorId: vId,
          vendorName: l.vendor?.name || 'Store',
          brandName: l.vendor?.brand?.name || 'Independent',
          totalOrders: 0,
          grossSales: 0,
          platformCommission: 0,
          netVendorPayable: 0,
          settlementStatus: l.settlementStatus,
        });
      }

      const existing = vendorMap.get(vId)!;
      existing.totalOrders += 1;
      existing.grossSales = Math.round((existing.grossSales + gross) * 100) / 100;
      existing.platformCommission = Math.round((existing.platformCommission + commission) * 100) / 100;
      existing.netVendorPayable = Math.round((existing.netVendorPayable + net) * 100) / 100;
    }

    return Array.from(vendorMap.values());
  }

  generateSettlementCsv(statements: Array<{
    vendorId: string;
    vendorName: string;
    brandName: string;
    totalOrders: number;
    grossSales: number;
    platformCommission: number;
    netVendorPayable: number;
    settlementStatus: string;
  }>): string {
    const header = [
      'Vendor ID',
      'Vendor Name',
      'Brand',
      'Total Orders',
      'Gross Sales (BDT)',
      'Platform Commission (BDT)',
      'Net Vendor Payable (BDT)',
      'Settlement Status',
    ].join(',');

    const rows = statements.map((s) =>
      [
        `"${s.vendorId}"`,
        `"${s.vendorName.replace(/"/g, '""')}"`,
        `"${s.brandName.replace(/"/g, '""')}"`,
        s.totalOrders,
        s.grossSales.toFixed(2),
        s.platformCommission.toFixed(2),
        s.netVendorPayable.toFixed(2),
        `"${s.settlementStatus}"`,
      ].join(','),
    );

    return [header, ...rows].join('\n');
  }

  // ===========================================================================
  // 10. Rider Fleet Approval & Governance
  // (roster listing + detail live in AdminFleetService)
  // ===========================================================================
  async setRiderApproval(riderId: string, isApproved: boolean) {
    const rider = await this.prisma.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new NotFoundException(`Rider with ID "${riderId}" not found`);

    const updated = await this.prisma.rider.update({
      where: { id: riderId },
      data: {
        isApproved,
        ...(!isApproved && { isOnline: false }),
      },
      include: { user: { select: { fullName: true, phone: true } } },
    });

    this.logger.log(`Rider ${riderId} (${updated.user.fullName}) approval set to: ${isApproved}`);
    return updated;
  }

  // ===========================================================================
  // 11. Automated Financial Settlement Cycle Engine
  // ===========================================================================
  async executeSettlementCycle(executedByUserId?: string) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch pending commission ledgers for delivered orders
      const pendingCommissions = await tx.commissionLedger.findMany({
        where: {
          settlementStatus: SettlementStatus.PENDING,
          order: { status: OrderStatus.DELIVERED },
        },
      });

      // 2. Fetch pending rider trip ledgers
      const pendingTrips = await tx.riderTripLedger.findMany({
        where: {
          status: SettlementStatus.PENDING,
          order: { status: OrderStatus.DELIVERED },
        },
      });

      if (pendingCommissions.length === 0 && pendingTrips.length === 0) {
        return {
          message: 'No pending orders eligible for settlement cycle at this time.',
          batch: null,
          settledOrdersCount: 0,
        };
      }

      // Compute aggregates
      let totalVendorPayout = 0;
      let totalPlatformMargin = 0;
      let totalRiderGrossEarnings = 0;
      let totalRiderCodCollected = 0;

      for (const c of pendingCommissions) {
        totalVendorPayout += Number(c.netVendorPayable);
        totalPlatformMargin += Number(c.commissionAmount);
      }

      // Group pending trips by riderId to calculate per-courier net payouts
      const riderNetMap = new Map<string, { gross: number; cod: number }>();
      for (const t of pendingTrips) {
        const gross = Number(t.deliveryEarnings);
        const cod = Number(t.codCollected || 0);
        totalRiderGrossEarnings += gross;
        totalRiderCodCollected += cod;

        const current = riderNetMap.get(t.riderId) || { gross: 0, cod: 0 };
        current.gross += gross;
        current.cod += cod;
        riderNetMap.set(t.riderId, current);
      }

      let totalRiderPayout = 0;
      for (const [, balance] of riderNetMap) {
        const net = balance.gross - balance.cod;
        if (net > 0) {
          totalRiderPayout += net;
        }
      }

      totalVendorPayout = Math.round(totalVendorPayout * 100) / 100;
      totalPlatformMargin = Math.round(totalPlatformMargin * 100) / 100;
      totalRiderGrossEarnings = Math.round(totalRiderGrossEarnings * 100) / 100;
      totalRiderCodCollected = Math.round(totalRiderCodCollected * 100) / 100;
      totalRiderPayout = Math.round(totalRiderPayout * 100) / 100;

      const orderIds = Array.from(
        new Set([...pendingCommissions.map((c) => c.orderId), ...pendingTrips.map((t) => t.orderId)]),
      );

      // Claim the ledgers atomically: a concurrent settlement cycle racing us
      // steals rows out from under the PENDING predicate, and any shortfall
      // aborts this batch before a double-settled payout can be recorded.
      const claimedCommissions = pendingCommissions.length
        ? await tx.commissionLedger.updateMany({
            where: {
              id: { in: pendingCommissions.map((c) => c.id) },
              settlementStatus: SettlementStatus.PENDING,
            },
            data: { settlementStatus: SettlementStatus.PROCESSING },
          })
        : { count: 0 };
      const claimedTrips = pendingTrips.length
        ? await tx.riderTripLedger.updateMany({
            where: { id: { in: pendingTrips.map((t) => t.id) }, status: SettlementStatus.PENDING },
            data: { status: SettlementStatus.PROCESSING },
          })
        : { count: 0 };

      if (claimedCommissions.count !== pendingCommissions.length || claimedTrips.count !== pendingTrips.length) {
        throw new ConflictException(
          'Settlement ledgers are being claimed by another settlement cycle; retry in a moment.',
        );
      }

      const batchNumber = `SETTLE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
      const now = new Date();
      const oldestDate = pendingCommissions[0]?.createdAt || now;

      // Create SettlementBatch
      const batch = await tx.settlementBatch.create({
        data: {
          batchNumber,
          startDate: oldestDate,
          endDate: now,
          totalOrders: orderIds.length,
          totalVendorPayout,
          totalRiderPayout,
          totalPlatformMargin,
          status: SettlementStatus.SETTLED,
          executedByUserId: executedByUserId || null,
          executedAt: now,
        },
      });

      // Mark CommissionLedgers as SETTLED
      if (pendingCommissions.length > 0) {
        await tx.commissionLedger.updateMany({
          where: {
            id: { in: pendingCommissions.map((c) => c.id) },
            settlementStatus: SettlementStatus.PROCESSING,
          },
          data: {
            settlementStatus: SettlementStatus.SETTLED,
            settledAt: now,
            settlementBatchId: batch.id,
          },
        });
      }

      // Mark RiderTripLedgers as SETTLED
      if (pendingTrips.length > 0) {
        await tx.riderTripLedger.updateMany({
          where: { id: { in: pendingTrips.map((t) => t.id) }, status: SettlementStatus.PROCESSING },
          data: {
            status: SettlementStatus.SETTLED,
            settlementBatchId: batch.id,
          },
        });
      }

      this.logger.log(
        `[Settlement Engine] Closed Batch ${batchNumber}: ${orderIds.length} orders settled (Vendors: ${totalVendorPayout} BDT, Riders Net: ${totalRiderPayout} BDT [Gross: ${totalRiderGrossEarnings}, COD Offset: ${totalRiderCodCollected}], Platform: ${totalPlatformMargin} BDT)`,
      );

      return {
        message: `Settlement cycle successfully closed in Batch ${batchNumber}`,
        batch,
        settledOrdersCount: orderIds.length,
      };
    });
  }

  async getSettlementBatches() {
    return this.prisma.settlementBatch.findMany({
      orderBy: { executedAt: 'desc' },
      include: {
        _count: {
          select: { commissions: true, riderTrips: true },
        },
      },
    });
  }

  /**
   * 12. Super Admin Force-Cancel Order
   * Allows administrative cancellation of any order prior to DISPATCHED or DELIVERED.
   * Full atomic ledger cleanup, online payment refunding, courier release, and audit trail.
   */
  async cancelOrder(adminUserId: string, orderId: string, dto: AdminCancelOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        vendor: true,
        rider: { include: { user: true } },
        payments: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" not found`);
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('Cannot cancel an order that has already been delivered');
    }

    if (order.status === OrderStatus.DISPATCHED) {
      throw new BadRequestException(
        'Cannot cancel order while courier is on the road (DISPATCHED). Please coordinate direct return with the assigned rider.',
      );
    }

    const auditReason = `[ADMIN_FORCE_CANCEL by ${adminUserId}] ${dto.reason.trim()}`;
    return this.orderService.executeOrderCancellation(order, auditReason, UserRole.SUPER_ADMIN);
  }

  /**
   * 13. Financial Cash Deposits Administration
   */
  async getCashDeposits(status?: CashDepositStatus) {
    const where: Prisma.CashDepositWhereInput = {};
    if (status) {
      where.status = status;
    }
    return this.prisma.cashDeposit.findMany({
      where,
      include: {
        rider: {
          select: {
            id: true,
            cashInHand: true,
            maxCashLimit: true,
            isApproved: true,
            user: {
              select: {
                id: true,
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { depositedAt: 'desc' },
    });
  }

  async verifyCashDeposit(depositId: string, action: 'APPROVE' | 'REJECT', notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      const deposit = await tx.cashDeposit.findUnique({
        where: { id: depositId },
        include: { rider: { include: { user: true } } },
      });

      if (!deposit) {
        throw new NotFoundException(`Cash deposit with ID "${depositId}" not found`);
      }

      if (deposit.status !== CashDepositStatus.PENDING_APPROVAL) {
        throw new BadRequestException(
          `Cash deposit #${deposit.referenceNo} has already been processed with status: ${deposit.status}`,
        );
      }

      const noteSuffix = notes ? ` [Admin Note: ${notes}]` : '';
      const finalNote = `${deposit.note || ''}${noteSuffix}`.trim();

      if (action === 'APPROVE') {
        const claimed = await tx.cashDeposit.updateMany({
          where: { id: depositId, status: CashDepositStatus.PENDING_APPROVAL },
          data: {
            status: CashDepositStatus.APPROVED,
            note: finalNote,
          },
        });
        if (claimed.count === 0) {
          throw new ConflictException(`Cash deposit #${deposit.referenceNo} is being processed concurrently`);
        }

        // Guarded decrement: never drive cashInHand negative on a duplicate or
        // over-deposited approval.
        const decremented = await tx.rider.updateMany({
          where: { id: deposit.riderId, cashInHand: { gte: Number(deposit.amount) } },
          data: {
            cashInHand: { decrement: Number(deposit.amount) },
          },
        });
        if (decremented.count === 0) {
          throw new BadRequestException(
            `Rider cash-in-hand (৳${Number(deposit.rider.cashInHand)}) is lower than the deposit amount (৳${Number(
              deposit.amount,
            )}); approval aborted.`,
          );
        }

        const updatedRider = await tx.rider.findUniqueOrThrow({ where: { id: deposit.riderId } });

        this.logger.log(
          `[Cash Deposit] Approved deposit #${deposit.referenceNo} for rider ${deposit.rider.user?.fullName || deposit.riderId}. Amount: ${deposit.amount} BDT, Remaining cash in hand: ${updatedRider.cashInHand} BDT`,
        );

        return {
          message: `Deposit #${deposit.referenceNo} approved successfully`,
          deposit: { ...deposit, status: CashDepositStatus.APPROVED, note: finalNote },
          riderCashInHand: Number(updatedRider.cashInHand),
        };
      } else {
        const claimed = await tx.cashDeposit.updateMany({
          where: { id: depositId, status: CashDepositStatus.PENDING_APPROVAL },
          data: {
            status: CashDepositStatus.REJECTED,
            note: finalNote,
          },
        });
        if (claimed.count === 0) {
          throw new ConflictException(`Cash deposit #${deposit.referenceNo} is being processed concurrently`);
        }

        this.logger.log(
          `[Cash Deposit] Rejected deposit #${deposit.referenceNo} for rider ${deposit.rider.user?.fullName || deposit.riderId}. Reason: ${notes || 'No reason provided'}`,
        );

        return {
          message: `Deposit #${deposit.referenceNo} rejected`,
          deposit: { ...deposit, status: CashDepositStatus.REJECTED, note: finalNote },
          riderCashInHand: Number(deposit.rider.cashInHand),
        };
      }
    });
  }
}
