import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AcceptOrderDto } from './dto/accept-order.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { OrderFlowMode, OrderStatus, PermissionScope, Prisma, User, UserRole } from '@prisma/client';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { OrderFlowService } from '../order-flow/order-flow.service';
import { assertTransition } from '../orders/order-state.machine';
import { OrderService } from '../orders/order.service';

/** Ledger join used by both the sales ledger list and the per-order detail. */
const LEDGER_INCLUDE = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      paymentMethod: true,
      paymentStatus: true,
      subtotal: true,
      couponDiscount: true,
      deliveryFee: true,
      taxAmount: true,
      totalAmount: true,
      customerNotes: true,
      rejectionReason: true,
      prepTimeMinutes: true,
      deliveryAddressSnapshot: true,
      customerPhoneSnapshot: true,
      placedAt: true,
      acceptedAt: true,
      pickedUpAt: true,
      deliveredAt: true,
      cancelledAt: true,
      customer: { select: { fullName: true, phone: true } },
      rider: {
        select: {
          id: true,
          vehicleType: true,
          user: { select: { fullName: true, phone: true } },
        },
      },
      orderItems: {
        select: {
          id: true,
          productNameSnapshot: true,
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          variantSnapshot: true,
        },
      },
    },
  },
  vendor: { select: { id: true, name: true, addressText: true } },
} satisfies Prisma.CommissionLedgerInclude;

type LedgerRow = Prisma.CommissionLedgerGetPayload<{ include: typeof LEDGER_INCLUDE }>;

/** Maps a joined commission-ledger row to the vendor portal ledger shape. */
function toLedgerRow(l: LedgerRow) {
  const gross = Number(l.grossAmount);
  const commission = Number(l.commissionAmount);
  const net = Number(l.netVendorPayable);
  return {
    id: l.id,
    orderId: l.orderId,
    orderNumber: l.order?.orderNumber || 'N/A',
    vendorId: l.vendorId,
    vendorName: l.vendor?.name || 'Unknown Outlet',
    vendorAddress: l.vendor?.addressText || null,
    customerName: l.order?.customer?.fullName || 'Guest Customer',
    customerPhone: l.order?.customerPhoneSnapshot || l.order?.customer?.phone || '',
    customerNotes: l.order?.customerNotes || null,
    rejectionReason: l.order?.rejectionReason || null,
    prepTimeMinutes: l.order?.prepTimeMinutes ?? null,
    deliveryAddress: l.order?.deliveryAddressSnapshot || null,
    paymentMethod: l.order?.paymentMethod || 'CASH_ON_DELIVERY',
    paymentStatus: l.order?.paymentStatus || 'PENDING',
    orderStatus: l.order?.status || 'UNKNOWN',
    subtotal: Number(l.order?.subtotal || 0),
    couponDiscount: Number(l.order?.couponDiscount || 0),
    deliveryFee: Number(l.order?.deliveryFee || 0),
    taxAmount: Number(l.order?.taxAmount || 0),
    totalAmount: Number(l.order?.totalAmount || 0),
    placedAt: l.order?.placedAt || l.createdAt,
    acceptedAt: l.order?.acceptedAt || null,
    pickedUpAt: l.order?.pickedUpAt || null,
    deliveredAt: l.order?.deliveredAt || null,
    cancelledAt: l.order?.cancelledAt || null,
    rider: l.order?.rider
      ? {
          id: l.order.rider.id,
          fullName: l.order.rider.user?.fullName || 'Assigned Rider',
          phone: l.order.rider.user?.phone || '',
          vehicleType: l.order.rider.vehicleType || 'motorcycle',
        }
      : null,
    grossAmount: gross,
    commissionRate: Number(l.commissionRate),
    commissionAmount: commission,
    netVendorPayable: net,
    settlementStatus: l.settlementStatus,
    settledAt: l.settledAt,
    createdAt: l.createdAt,
    items: (l.order?.orderItems || []).map((i) => ({
      id: i.id,
      productName: i.productNameSnapshot,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      totalPrice: Number(i.totalPrice),
      variant: i.variantSnapshot,
    })),
  };
}

/** Outlet row of GET /vendor/outlets — brandName feeds the portal top bar. */
export interface AccessibleOutletRow {
  id: string;
  name: string;
  addressText: string;
  isBusy: boolean;
  isActive: boolean;
  defaultPrepTimeMinutes: number;
  brandId: string;
  brandName: string | null;
}

@Injectable()
export class VendorStaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trackingGateway: TrackingGateway,
    private readonly orderFlowService: OrderFlowService,
    private readonly orderService: OrderService,
  ) {}

  /**
   * Enforces 2-Tier Vendor Staff Scope:
   * - SUPER_ADMIN: Global authority across all outlets.
   * - ALL_OUTLETS_MASTER: Permitted across any outlet sharing the brandId.
   * - PARTICULAR_OUTLET: Strictly locked to the designated vendorId.
   */
  async validateStaffOutletAccess(user: User, vendorId: string) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (user.role !== UserRole.VENDOR_ADMIN) {
      throw new ForbiddenException('Access restricted to vendor staff');
    }

    const staffRecords = await this.prisma.vendorStaff.findMany({
      where: { userId: user.id, isActive: true },
    });

    if (staffRecords.length === 0) {
      throw new ForbiddenException('No active vendor staff assignment found for this user');
    }

    const targetVendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    if (!targetVendor) {
      throw new NotFoundException('Vendor outlet not found');
    }

    if (targetVendor.isActive === false) {
      throw new ForbiddenException(
        'Outlet is suspended by platform administration. Outlet is inaccessible and operations are locked until suspension is withdrawn.',
      );
    }

    // Check permissions
    for (const record of staffRecords) {
      if (record.scope === PermissionScope.ALL_OUTLETS_MASTER) {
        if (record.brandId && targetVendor.brandId === record.brandId) {
          return true;
        }
      } else if (record.scope === PermissionScope.PARTICULAR_OUTLET) {
        if (record.vendorId === vendorId) {
          return true;
        }
      }
    }

    throw new ForbiddenException('You do not have permission to manage this vendor outlet');
  }

  /**
   * 1. Get Live Kitchen Orders
   */
  async getLiveOrders(user: User, vendorId?: string) {
    let targetVendorIds: string[] = [];

    if (user.role === UserRole.SUPER_ADMIN) {
      if (vendorId) {
        targetVendorIds = [vendorId];
      }
    } else {
      const staffRecords = await this.prisma.vendorStaff.findMany({
        where: { userId: user.id, isActive: true },
      });

      if (staffRecords.length === 0) {
        throw new ForbiddenException('No active vendor staff assignment found');
      }

      if (vendorId) {
        await this.validateStaffOutletAccess(user, vendorId);
        targetVendorIds = [vendorId];
      } else {
        for (const record of staffRecords) {
          if (record.scope === PermissionScope.ALL_OUTLETS_MASTER && record.brandId) {
            const brandOutlets = await this.prisma.vendor.findMany({
              where: { brandId: record.brandId },
              select: { id: true },
            });
            targetVendorIds.push(...brandOutlets.map((o) => o.id));
          } else if (record.scope === PermissionScope.PARTICULAR_OUTLET && record.vendorId) {
            targetVendorIds.push(record.vendorId);
          }
        }
      }
    }

    const whereClause: Prisma.OrderWhereInput = {
      status: {
        in: [
          OrderStatus.PLACED,
          OrderStatus.RIDER_ASSIGNED,
          OrderStatus.ACCEPTED,
          OrderStatus.PREPARING,
          OrderStatus.READY_FOR_PICKUP,
        ],
      },
    };

    if (user.role !== UserRole.SUPER_ADMIN) {
      if (targetVendorIds.length === 0) {
        return []; // Safe fail-close: unassigned staff see zero orders
      }
      whereClause.vendorId = { in: targetVendorIds };
    } else if (targetVendorIds.length > 0) {
      whereClause.vendorId = { in: targetVendorIds };
    }

    return this.prisma.order.findMany({
      where: whereClause,
      orderBy: { placedAt: 'desc' },
      include: {
        orderItems: true,
        vendor: {
          select: {
            id: true,
            name: true,
            defaultPrepTimeMinutes: true,
          },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
          },
        },
        rider: {
          include: {
            user: {
              select: {
                fullName: true,
                phone: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 2. Accept Incoming Order
   * If prepTimeMinutes is omitted, defaults to vendor.defaultPrepTimeMinutes
   */
  async acceptOrder(user: User, orderId: string, dto: AcceptOrderDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { vendor: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.validateStaffOutletAccess(user, order.vendorId);

    // RIDER_FIRST invariant: accepting a PLACED order would move it to
    // PREPARING, where assertClaimable() rejects every claim — stranding the
    // order without a rider forever.
    if (order.status === OrderStatus.PLACED) {
      // The order's snapshotted flow mode governs; live outlet config never
      // re-routes an in-flight order.
      if (order.orderFlowMode === OrderFlowMode.RIDER_FIRST) {
        throw new ConflictException(
          'Zero Food Waste mode is active: this order is still awaiting a courier. Accept unlocks as soon as a rider secures it.',
        );
      }
    }

    assertTransition(order.status, OrderStatus.PREPARING);

    const prepTimeMinutes = dto.prepTimeMinutes ?? order.vendor.defaultPrepTimeMinutes;

    // Conditional on the observed status so a concurrent cancel/claim cannot be
    // silently overwritten by a stale accept.
    let updatedOrder;
    try {
      updatedOrder = await this.prisma.order.update({
        where: { id: orderId, status: order.status },
        data: {
          status: OrderStatus.PREPARING,
          prepTimeMinutes,
          acceptedAt: new Date(),
        },
        include: {
          orderItems: true,
          vendor: true,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ConflictException('Order state changed before it could be accepted; refresh and retry');
      }
      throw err;
    }

    // Realtime Broadcast
    this.trackingGateway.notifyOrderStatusChanged(
      order.id,
      order.customerId,
      order.status,
      OrderStatus.PREPARING,
      { prepTimeMinutes, vendorId: order.vendorId },
    );

    return updatedOrder;
  }

  /**
   * 2b. Reject Incoming Order
   * Vendors can reject an incoming order in PLACED or RIDER_ASSIGNED state
   * (e.g. out of stock, kitchen overload). Automatically cancels pending ledgers,
   * releases couriers, and refunds online payments.
   */
  async rejectOrder(user: User, orderId: string, dto: RejectOrderDto) {
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

    await this.validateStaffOutletAccess(user, order.vendorId);

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (
      order.status !== OrderStatus.PLACED &&
      order.status !== OrderStatus.RIDER_ASSIGNED
    ) {
      throw new BadRequestException(
        `Cannot reject order in "${order.status}" status. Only new incoming orders prior to preparation can be rejected.`,
      );
    }

    const structuredReason = dto.reasonNotes
      ? `[${dto.reasonCode}] ${dto.reasonNotes}`
      : `[${dto.reasonCode}] Order rejected by store kitchen`;

    return this.orderService.executeOrderCancellation(
      order,
      structuredReason,
      UserRole.VENDOR_ADMIN,
    );
  }

  /**
   * 3. Mark Order Ready for Pickup
   */
  async markOrderReady(user: User, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.validateStaffOutletAccess(user, order.vendorId);

    assertTransition(order.status, OrderStatus.READY_FOR_PICKUP);

    // Conditional on the observed status so a concurrent cancellation cannot
    // be silently resurrected by a stale ready-mark.
    let updatedOrder;
    try {
      updatedOrder = await this.prisma.order.update({
        where: { id: orderId, status: order.status },
        data: {
          status: OrderStatus.READY_FOR_PICKUP,
        },
      });
    } catch (err: unknown) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new ConflictException('Order state changed before it could be marked ready; refresh and retry');
      }
      throw err;
    }

    // Realtime Broadcast
    this.trackingGateway.notifyOrderStatusChanged(
      order.id,
      order.customerId,
      order.status,
      OrderStatus.READY_FOR_PICKUP,
      { vendorId: order.vendorId },
    );

    // If running in VENDOR_FIRST mode, broadcast to riders now that items are ready
    await this.orderFlowService.handleOrderReady(order.id);

    return updatedOrder;
  }

  /**
   * 4. Confirm Handover to Rider at Counter
   */
  async handoverOrder(user: User, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.validateStaffOutletAccess(user, order.vendorId);

    // Delivery orders require an assigned courier: dispatching a riderless
    // delivery order leaves it in DISPATCHED, a status no rider can claim.
    // Takeaway hands over to the customer and legitimately carries no rider.
    const snapshot = order.deliveryAddressSnapshot as { deliveryMethod?: string; type?: string } | null;
    const deliveryMethod = snapshot?.deliveryMethod ?? snapshot?.type;
    const isTakeaway = deliveryMethod === 'TAKEAWAY';
    if (!isTakeaway && !order.riderId) {
      throw new BadRequestException(
        'Cannot hand over a delivery order before a courier has claimed it. Wait for a rider to secure the order first.',
      );
    }

    assertTransition(order.status, OrderStatus.DISPATCHED);

    // Conditional on the observed status so a concurrent cancellation cannot
    // be silently overwritten by a stale handover.
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
        throw new ConflictException('Order state changed before handover could be confirmed; refresh and retry');
      }
      throw err;
    }

    // Realtime Broadcast
    this.trackingGateway.notifyOrderStatusChanged(
      order.id,
      order.customerId,
      order.status,
      OrderStatus.DISPATCHED,
      { vendorId: order.vendorId },
    );

    return updatedOrder;
  }

  /**
   * 5. Toggle Product Stock Availability
   */
  async toggleProductStock(user: User, productId: string, isInStock: boolean) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    await this.validateStaffOutletAccess(user, product.vendorId);

    return this.prisma.product.update({
      where: { id: productId },
      data: { isInStock },
    });
  }

  /**
   * 6. Toggle Product Variant Stock Availability
   */
  async toggleVariantStock(user: User, variantId: string, isInStock: boolean) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });

    if (!variant) {
      throw new NotFoundException('Product variant not found');
    }

    await this.validateStaffOutletAccess(user, variant.product.vendorId);

    return this.prisma.productVariant.update({
      where: { id: variantId },
      data: { isInStock },
    });
  }

  /**
   * 7. Get Vendor Staff Profile and Assigned Outlet Info
   */
  async getStaffProfile(user: User) {
    if (user.role === UserRole.SUPER_ADMIN) {
      return {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        outletScope: PermissionScope.ALL_OUTLETS_MASTER,
        vendorId: null,
        vendorName: 'All Outlets (Super Admin)',
        managedVendorIds: [],
      };
    }

    const staffRecord = await this.prisma.vendorStaff.findFirst({
      where: { userId: user.id, isActive: true },
      include: {
        vendor: true,
        brand: {
          include: {
            outlets: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!staffRecord) {
      throw new ForbiddenException('No active vendor staff assignment found');
    }

    let managedVendorIds: string[] = [];
    if (staffRecord.scope === PermissionScope.ALL_OUTLETS_MASTER && staffRecord.brand) {
      managedVendorIds = staffRecord.brand.outlets.map((o) => o.id);
    } else if (staffRecord.vendorId) {
      managedVendorIds = [staffRecord.vendorId];
    }

    return {
      id: user.id,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      outletScope: staffRecord.scope,
      vendorId: staffRecord.vendorId || (staffRecord.brand?.outlets[0]?.id ?? null),
      vendorName: staffRecord.vendor?.name || staffRecord.brand?.name || 'Assigned Outlet',
      brandId: staffRecord.brandId,
      managedVendorIds,
    };
  }

  /**
   * 8. Get Accessible Outlets (Scoped by user role / tier)
   */
  async getAccessibleOutlets(user: User) {
    const withBrandName = <T extends { brand?: { name: string } | null }>(outlet: T): AccessibleOutletRow => ({
      ...(outlet as unknown as AccessibleOutletRow),
      brandName: outlet.brand?.name ?? null,
    });

    if (user.role === UserRole.SUPER_ADMIN) {
      const outlets = await this.prisma.vendor.findMany({
        select: {
          id: true,
          name: true,
          addressText: true,
          isBusy: true,
          isActive: true,
          defaultPrepTimeMinutes: true,
          brandId: true,
          brand: { select: { name: true } },
        },
        orderBy: { name: 'asc' },
      });
      return outlets.map(withBrandName);
    }

    const staffRecord = await this.prisma.vendorStaff.findFirst({
      where: { userId: user.id, isActive: true },
      include: {
        brand: {
          include: {
            outlets: {
              select: {
                id: true,
                name: true,
                addressText: true,
                isBusy: true,
                isActive: true,
                defaultPrepTimeMinutes: true,
                brandId: true,
                brand: { select: { name: true } },
              },
              orderBy: { name: 'asc' },
            },
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
            addressText: true,
            isBusy: true,
            isActive: true,
            defaultPrepTimeMinutes: true,
            brandId: true,
            brand: { select: { name: true } },
          },
        },
      },
    });

    if (!staffRecord) {
      throw new ForbiddenException('No active vendor staff assignment found');
    }

    if (staffRecord.scope === PermissionScope.ALL_OUTLETS_MASTER && staffRecord.brand) {
      return staffRecord.brand.outlets.map(withBrandName);
    }

    return staffRecord.vendor ? [staffRecord.vendor].map(withBrandName) : ([] as AccessibleOutletRow[]);
  }

  /**
   * 9. Get Outlet Settings & Operating Hours
   */
  async getOutletSettings(user: User, vendorId?: string) {
    let targetVendorId = vendorId;

    if (!targetVendorId) {
      const profile = await this.getStaffProfile(user);
      targetVendorId = profile.vendorId || profile.managedVendorIds[0];
      if (!targetVendorId) {
        throw new BadRequestException('No vendor outlet specified or assigned');
      }
    } else {
      await this.validateStaffOutletAccess(user, targetVendorId);
    }

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: targetVendorId },
      include: {
        operatingHours: {
          orderBy: { dayOfWeek: 'asc' },
        },
        brand: {
          select: { id: true, name: true },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor outlet not found');
    }

    return vendor;
  }

  /**
   * 10. Update Outlet Settings (Default Prep Time, Rush Pause, Active State)
   */
  async updateOutletSettings(
    user: User,
    vendorId: string | undefined,
    data: {
      defaultPrepTimeMinutes?: number;
      isBusy?: boolean;
      isActive?: boolean;
    },
  ) {
    let targetVendorId = vendorId;
    if (!targetVendorId) {
      const accessible = await this.getAccessibleOutlets(user);
      if (accessible.length === 0) {
        throw new ForbiddenException('No accessible outlet found');
      }
      targetVendorId = accessible[0].id;
    }

    await this.validateStaffOutletAccess(user, targetVendorId);

    const updated = await this.prisma.vendor.update({
      where: { id: targetVendorId },
      data: {
        ...(data.defaultPrepTimeMinutes !== undefined && {
          defaultPrepTimeMinutes: data.defaultPrepTimeMinutes,
        }),
        ...(data.isBusy !== undefined && { isBusy: data.isBusy }),
      },
    });

    if (data.isBusy !== undefined) {
      this.trackingGateway?.notifyVendorStatusChanged?.(targetVendorId, {
        vendorId: targetVendorId,
        isActive: updated.isActive,
        isBusy: updated.isBusy,
      });
    }

    return updated;
  }

  /**
   * 11. Update Weekly Operating Hours Schedule
   */
  async updateOperatingHours(
    user: User,
    vendorId: string | undefined,
    hours: Array<{
      dayOfWeek: number;
      openTime: string;
      closeTime: string;
      isClosed: boolean;
    }>,
  ) {
    let targetVendorId = vendorId;
    if (!targetVendorId) {
      const accessible = await this.getAccessibleOutlets(user);
      if (accessible.length === 0) {
        throw new ForbiddenException('No accessible outlet found');
      }
      targetVendorId = accessible[0].id;
    }

    await this.validateStaffOutletAccess(user, targetVendorId);

    for (const h of hours) {
      await this.prisma.vendorOperatingHour.upsert({
        where: {
          vendorId_dayOfWeek: {
            vendorId: targetVendorId,
            dayOfWeek: h.dayOfWeek,
          },
        },
        update: {
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed,
        },
        create: {
          vendorId: targetVendorId,
          dayOfWeek: h.dayOfWeek,
          openTime: h.openTime,
          closeTime: h.closeTime,
          isClosed: h.isClosed,
        },
      });
    }

    return this.prisma.vendorOperatingHour.findMany({
      where: { vendorId: targetVendorId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  /**
   * 11. Get Full Merchant Catalog (Including Out-of-Stock Items)
   */
  async getFullCatalog(user: User, vendorId?: string) {
    let targetVendorId = vendorId;
    if (!targetVendorId || targetVendorId === 'ALL') {
      const accessible = await this.getAccessibleOutlets(user);
      if (accessible.length === 0) {
        throw new ForbiddenException('No accessible outlet found');
      }
      targetVendorId = accessible[0].id;
    }

    await this.validateStaffOutletAccess(user, targetVendorId);

    const vendor = await this.prisma.vendor.findUnique({
      where: { id: targetVendorId },
      include: {
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            products: {
              orderBy: { sortOrder: 'asc' },
              include: {
                variants: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    if (!vendor) {
      throw new NotFoundException('Vendor outlet not found');
    }

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      defaultPrepTimeMinutes: vendor.defaultPrepTimeMinutes,
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

  /**
   * 12. Get Sales Ledger & Commission Breakdown
   * Optional date bounds let the portal pull a single business day instead of
   * the full history; the summary is computed over exactly the returned scope.
   */
  /**
   * Unified per-order detail for the vendor portal: one order's ledger row
   * (same shape as the sales-ledger list) behind staff-outlet access checks.
   */
  async getOrderLedgerDetail(user: User, orderId: string) {
    const ledger = await this.prisma.commissionLedger.findUnique({
      where: { orderId },
      include: LEDGER_INCLUDE,
    });
    if (ledger) {
      await this.validateStaffOutletAccess(user, ledger.vendorId);
      return toLedgerRow(ledger);
    }

    // Live orders can pre-date their ledger row (seeded or mid-flight data):
    // fall back to the order itself so every card is still detail-viewable,
    // with commission fields reported as unset until the ledger exists.
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: { select: { fullName: true, phone: true } },
        rider: {
          select: { id: true, vehicleType: true, user: { select: { fullName: true, phone: true } } },
        },
        orderItems: true,
        vendor: { select: { id: true, name: true, addressText: true } },
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    await this.validateStaffOutletAccess(user, order.vendorId);

    return {
      id: order.id,
      orderId: order.id,
      orderNumber: order.orderNumber,
      vendorId: order.vendorId,
      vendorName: order.vendor?.name || 'Unknown Outlet',
      vendorAddress: order.vendor?.addressText || null,
      customerName: order.customer?.fullName || 'Guest Customer',
      customerPhone: order.customerPhoneSnapshot || order.customer?.phone || '',
      customerNotes: order.customerNotes || null,
      rejectionReason: order.rejectionReason || null,
      prepTimeMinutes: order.prepTimeMinutes ?? null,
      deliveryAddress: order.deliveryAddressSnapshot || null,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      orderStatus: order.status,
      subtotal: Number(order.subtotal || 0),
      couponDiscount: Number(order.couponDiscount || 0),
      deliveryFee: Number(order.deliveryFee || 0),
      taxAmount: Number(order.taxAmount || 0),
      totalAmount: Number(order.totalAmount || 0),
      placedAt: order.placedAt,
      acceptedAt: order.acceptedAt || null,
      pickedUpAt: order.pickedUpAt || null,
      deliveredAt: order.deliveredAt || null,
      cancelledAt: order.cancelledAt || null,
      rider: order.rider
        ? {
            id: order.rider.id,
            fullName: order.rider.user?.fullName || 'Assigned Rider',
            phone: order.rider.user?.phone || '',
            vehicleType: order.rider.vehicleType || 'motorcycle',
          }
        : null,
      grossAmount: Number(order.subtotal || 0),
      commissionRate: 0,
      commissionAmount: 0,
      netVendorPayable: 0,
      settlementStatus: 'PENDING',
      settledAt: null,
      createdAt: order.placedAt,
      items: (order.orderItems || []).map((i) => ({
        id: i.id,
        productName: i.productNameSnapshot,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        totalPrice: Number(i.totalPrice),
        variant: i.variantSnapshot,
      })),
    };
  }

  async getSalesLedger(
    user: User,
    vendorId?: string,
    dateFrom?: Date,
    dateTo?: Date,
  ) {
    let targetVendorIds: string[];

    if (vendorId && vendorId !== 'ALL') {
      await this.validateStaffOutletAccess(user, vendorId);
      targetVendorIds = [vendorId];
    } else {
      const accessible = await this.getAccessibleOutlets(user);
      targetVendorIds = accessible.map((v) => v.id);
    }

    const ledgers = await this.prisma.commissionLedger.findMany({
      where: {
        vendorId: { in: targetVendorIds },
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      include: LEDGER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    let totalGross = 0;
    let totalCommission = 0;
    let totalNet = 0;

    const formattedLedgers = ledgers.map((l) => {
      const row = toLedgerRow(l);
      totalGross += row.grossAmount;
      totalCommission += row.commissionAmount;
      totalNet += row.netVendorPayable;
      return row;
    });

    return {
      summary: {
        totalOrders: formattedLedgers.length,
        grossSales: Math.round(totalGross * 100) / 100,
        commissionDeducted: Math.round(totalCommission * 100) / 100,
        netVendorPayable: Math.round(totalNet * 100) / 100,
      },
      ledgers: formattedLedgers,
    };
  }
}
