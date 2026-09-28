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
import { OrderFlowService } from '../order-flow/order-flow.service';
import { OrderFlowMode } from '../order-flow/dto/update-order-flow.dto';
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
  placedAt: Date;
  acceptedAt: Date | null;
  prepTimeMinutes: number | null;
  items: Array<{ id: string; name: string; quantity: number; unitPrice: number }>;
  deliveryAddress: string;
}
import {
  BannerLinkType,
  DiscountType,
  OrderStatus,
  PermissionScope,
  Prisma,
  SettlementStatus,
  UserRole,
} from '@prisma/client';
import { OrderService } from '../orders/order.service';
import { AdminCancelOrderDto } from './dto/admin-cancel-order.dto';

export interface OrderFlowSettingPayload {
  mode: OrderFlowMode;
  rider_search_timeout_seconds: number;
}

export interface DeliveryFeeSettingPayload {
  mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
  flatFee: number;
  baseFee: number;
  perKmRate: number;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly trackingGateway: TrackingGateway,
    private readonly orderFlowService: OrderFlowService,
    private readonly orderService: OrderService,
  ) {}

  // ===========================================================================
  // 1. Overview & Dashboard Statistics
  // ===========================================================================
  async getOverviewStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
          vendor: { select: { name: true } },
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
        outletName: o.vendor?.name || 'Unknown Outlet',
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

    const fleet = await Promise.all(
      riders.map(async (r) => {
        const activeOrderId = await this.redis.get(`rider:active_order:${r.id}`);
        let activeOrder = null;

        if (activeOrderId) {
          const ord = await this.prisma.order.findUnique({
            where: { id: activeOrderId },
            select: { id: true, orderNumber: true, status: true, vendor: { select: { name: true } } },
          });
          if (ord) {
            activeOrder = {
              id: ord.id,
              orderNumber: ord.orderNumber,
              status: ord.status,
              vendorName: ord.vendor?.name,
            };
          }
        }

        let status: 'ONLINE' | 'ON_TRIP' | 'OFFLINE' = 'OFFLINE';
        if (r.isOnline) {
          status = activeOrderId ? 'ON_TRIP' : 'ONLINE';
        }

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
          latitude: r.latitude ?? 23.7925,
          longitude: r.longitude ?? 90.4078,
          activeOrder,
          updatedAt: r.updatedAt,
        };
      }),
    );

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
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResult<LiveOrderView>> {
    const where: Prisma.OrderWhereInput = {};
    if (statusFilter && statusFilter !== 'ALL') {
      where.status = statusFilter as OrderStatus;
    }

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          customer: { select: { fullName: true, phone: true } },
          vendor: { select: { id: true, name: true, addressText: true, latitude: true, longitude: true } },
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

    const items: LiveOrderView[] = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      vendorId: o.vendorId,
      vendorName: o.vendor?.name || 'Store',
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
      placedAt: o.placedAt,
      acceptedAt: o.acceptedAt,
      prepTimeMinutes: o.prepTimeMinutes,
      items: o.orderItems.map((i) => ({
        id: i.id,
        name: i.productNameSnapshot,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      deliveryAddress: (o.deliveryAddressSnapshot as { addressLine?: string } | null)?.addressLine || 'Address',
    }));

    return toPaginatedResult(items, total, pagination);
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
      include: { user: { select: { fullName: true, phone: true } } },
    });

    if (!rider) {
      throw new NotFoundException('Rider not found');
    }

    // Release any previous rider if reassigned
    if (order.riderId && order.riderId !== riderId) {
      await this.redis.del(`rider:active_order:${order.riderId}`);
    }

    // Advance status to RIDER_ASSIGNED if it was still in PLACED
    const newStatus = order.status === OrderStatus.PLACED ? OrderStatus.RIDER_ASSIGNED : order.status;

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
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
    sortOrder?: number;
    isActive?: boolean;
    startsAt?: Date;
    endsAt?: Date;
  }) {
    return this.prisma.banner.create({
      data: {
        title: data.title,
        imageUrl: data.imageUrl,
        linkType: data.linkType || BannerLinkType.OUTLET,
        targetId: data.targetId || null,
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
      sortOrder?: number;
      isActive?: boolean;
      startsAt?: Date;
      endsAt?: Date;
    },
  ) {
    const banner = await this.prisma.banner.findUnique({ where: { id } });
    if (!banner) throw new NotFoundException('Banner not found');

    return this.prisma.banner.update({
      where: { id },
      data,
    });
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
        _count: { select: { orders: true, products: true } },
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
      isBusy: v.isBusy,
      isActive: v.isActive,
      commissionRate: Number(v.commissionRate),
      defaultPrepTimeMinutes: v.defaultPrepTimeMinutes,
      totalOrders: v._count.orders,
      totalProducts: v._count.products,
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

  async createVendor(data: {
    name: string;
    brandId?: string;
    addressText: string;
    latitude: number;
    longitude: number;
    contactPhone: string;
    commissionRate?: number;
    defaultPrepTimeMinutes?: number;
  }) {
    return this.prisma.vendor.create({
      data: {
        name: data.name,
        brandId: data.brandId || null,
        addressText: data.addressText,
        latitude: data.latitude,
        longitude: data.longitude,
        contactPhone: data.contactPhone,
        commissionRate: data.commissionRate ?? 15.00,
        defaultPrepTimeMinutes: data.defaultPrepTimeMinutes ?? 20,
        isActive: true,
      },
    });
  }

  async updateVendor(
    vendorId: string,
    data: {
      name?: string;
      brandId?: string;
      addressText?: string;
      contactPhone?: string;
      commissionRate?: number;
      deliveryRadiusKm?: number;
      defaultPrepTimeMinutes?: number;
      isActive?: boolean;
    },
  ) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.brandId !== undefined && { brandId: data.brandId }),
        ...(data.addressText !== undefined && { addressText: data.addressText }),
        ...(data.contactPhone !== undefined && { contactPhone: data.contactPhone }),
        ...(data.commissionRate !== undefined && { commissionRate: data.commissionRate }),
        ...(data.deliveryRadiusKm !== undefined && { deliveryRadiusKm: data.deliveryRadiusKm }),
        ...(data.defaultPrepTimeMinutes !== undefined && { defaultPrepTimeMinutes: data.defaultPrepTimeMinutes }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async toggleVendorStatus(vendorId: string, isActive: boolean) {
    const vendor = await this.prisma.vendor.findUnique({ where: { id: vendorId } });
    if (!vendor) throw new NotFoundException('Vendor outlet not found');

    return this.prisma.vendor.update({
      where: { id: vendorId },
      data: { isActive },
    });
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

    // Ensure user role is VENDOR_ADMIN
    if (user.role !== UserRole.VENDOR_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { role: UserRole.VENDOR_ADMIN },
      });
    }

    const effectiveBrandId = data.scope === PermissionScope.ALL_OUTLETS_MASTER
      ? (data.brandId || vendor.brandId)
      : null;

    return this.prisma.vendorStaff.create({
      data: {
        userId: data.userId,
        vendorId: data.scope === PermissionScope.PARTICULAR_OUTLET ? vendorId : null,
        brandId: effectiveBrandId,
        scope: data.scope,
        isActive: true,
      },
    });
  }

  // ===========================================================================
  // 7. Master Catalog Authority
  // ===========================================================================
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

  async overrideProduct(
    productId: string,
    data: {
      name?: string;
      description?: string;
      basePrice?: number;
      categoryId?: string;
      isInStock?: boolean;
    },
  ) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.product.update({
      where: { id: productId },
      data,
    });
  }

  async toggleProductDisable(productId: string, isInStock: boolean) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');

    return this.prisma.product.update({
      where: { id: productId },
      data: { isInStock },
    });
  }

  // ===========================================================================
  // 8. Platform System Settings
  // ===========================================================================
  async getSystemSettings() {
    const [orderFlowSetting, deliveryFeeSetting] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: 'order_flow_config' } }),
      this.prisma.systemSetting.findUnique({ where: { key: 'delivery_fee_config' } }),
    ]);

    return {
      orderFlow:
        (orderFlowSetting?.value as unknown as OrderFlowSettingPayload | null) || {
        mode: OrderFlowMode.RIDER_FIRST,
        rider_search_timeout_seconds: 90,
      },
      deliveryFee:
        (deliveryFeeSetting?.value as unknown as DeliveryFeeSettingPayload | null) || {
        mode: 'FIXED_FLAT',
        flatFee: 50.0,
        baseFee: 40.0,
        perKmRate: 15.0,
      },
    };
  }

  async updateOrderFlow(mode: OrderFlowMode, riderSearchTimeoutSeconds?: number) {
    return this.orderFlowService.setOrderFlowConfig({
      mode,
      riderSearchTimeoutSeconds,
    });
  }

  async updateDeliveryFeeMode(data: {
    mode: 'FIXED_FLAT' | 'DISTANCE_TIERED';
    flatFee?: number;
    baseFee?: number;
    perKmRate?: number;
  }) {
    const updated = await this.prisma.systemSetting.upsert({
      where: { key: 'delivery_fee_config' },
      update: {
        value: {
          mode: data.mode,
          flatFee: data.flatFee ?? 50.0,
          baseFee: data.baseFee ?? 40.0,
          perKmRate: data.perKmRate ?? 15.0,
        },
      },
      create: {
        key: 'delivery_fee_config',
        value: {
          mode: data.mode,
          flatFee: data.flatFee ?? 50.0,
          baseFee: data.baseFee ?? 40.0,
          perKmRate: data.perKmRate ?? 15.0,
        },
        description: 'Delivery fee pricing mode: FIXED_FLAT vs DISTANCE_TIERED',
      },
    });

    return updated.value;
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
  // ===========================================================================
  async getAllRiders(filters?: { approvalStatus?: 'PENDING' | 'APPROVED' | 'ALL'; isOnline?: boolean }) {
    const where: Prisma.RiderWhereInput = {};
    if (filters?.approvalStatus === 'PENDING') {
      where.isApproved = false;
    } else if (filters?.approvalStatus === 'APPROVED') {
      where.isApproved = true;
    }
    if (filters?.isOnline !== undefined) {
      where.isOnline = filters.isOnline;
    }

    const riders = await this.prisma.rider.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, phone: true, email: true, createdAt: true } },
        _count: { select: { orders: true, trips: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return riders.map((r) => ({
      id: r.id,
      userId: r.userId,
      fullName: r.user.fullName || 'Courier Partner',
      phone: r.user.phone,
      email: r.user.email,
      vehicleType: r.vehicleType,
      isOnline: r.isOnline,
      isApproved: r.isApproved,
      cashInHand: Number(r.cashInHand),
      maxCashLimit: Number(r.maxCashLimit),
      latitude: r.latitude,
      longitude: r.longitude,
      totalOrders: r._count.orders,
      totalTrips: r._count.trips,
      joinedAt: r.user.createdAt,
    }));
  }

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

      for (const t of pendingTrips) {
        totalRiderGrossEarnings += Number(t.deliveryEarnings);
        totalRiderCodCollected += Number(t.codCollected || 0);
      }

      totalVendorPayout = Math.round(totalVendorPayout * 100) / 100;
      totalPlatformMargin = Math.round(totalPlatformMargin * 100) / 100;
      totalRiderGrossEarnings = Math.round(totalRiderGrossEarnings * 100) / 100;
      totalRiderCodCollected = Math.round(totalRiderCodCollected * 100) / 100;

      // Net Rider Payout: Delivery gross earnings offset by collected COD cash held by couriers
      const totalRiderPayout = Math.max(0, Math.round((totalRiderGrossEarnings - totalRiderCodCollected) * 100) / 100);

      const orderIds = Array.from(
        new Set([...pendingCommissions.map((c) => c.orderId), ...pendingTrips.map((t) => t.orderId)]),
      );

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
          where: { id: { in: pendingCommissions.map((c) => c.id) } },
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
          where: { id: { in: pendingTrips.map((t) => t.id) } },
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
  async getCashDeposits(status?: string) {
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

      if (deposit.status !== 'PENDING_APPROVAL') {
        throw new BadRequestException(
          `Cash deposit #${deposit.referenceNo} has already been processed with status: ${deposit.status}`,
        );
      }

      const noteSuffix = notes ? ` [Admin Note: ${notes}]` : '';
      const finalNote = `${deposit.note || ''}${noteSuffix}`.trim();

      if (action === 'APPROVE') {
        const updatedDeposit = await tx.cashDeposit.update({
          where: { id: depositId },
          data: {
            status: 'APPROVED',
            note: finalNote,
          },
        });

        const updatedRider = await tx.rider.update({
          where: { id: deposit.riderId },
          data: {
            cashInHand: { decrement: Number(deposit.amount) },
          },
        });

        this.logger.log(
          `[Cash Deposit] Approved deposit #${deposit.referenceNo} for rider ${deposit.rider.user?.fullName || deposit.riderId}. Amount: ${deposit.amount} BDT, Remaining cash in hand: ${updatedRider.cashInHand} BDT`,
        );

        return {
          message: `Deposit #${deposit.referenceNo} approved successfully`,
          deposit: updatedDeposit,
          riderCashInHand: Number(updatedRider.cashInHand),
        };
      } else {
        const updatedDeposit = await tx.cashDeposit.update({
          where: { id: depositId },
          data: {
            status: 'REJECTED',
            note: finalNote,
          },
        });

        this.logger.log(
          `[Cash Deposit] Rejected deposit #${deposit.referenceNo} for rider ${deposit.rider.user?.fullName || deposit.riderId}. Reason: ${notes || 'No reason provided'}`,
        );

        return {
          message: `Deposit #${deposit.referenceNo} rejected`,
          deposit: updatedDeposit,
          riderCashInHand: Number(deposit.rider.cashInHand),
        };
      }
    });
  }
}
