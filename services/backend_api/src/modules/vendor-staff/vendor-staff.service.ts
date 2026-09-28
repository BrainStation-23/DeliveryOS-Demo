import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AcceptOrderDto } from './dto/accept-order.dto';
import { RejectOrderDto } from './dto/reject-order.dto';
import { OrderStatus, PermissionScope, Prisma, User, UserRole } from '@prisma/client';
import { TrackingGateway } from '../realtime/tracking.gateway';
import { OrderFlowService } from '../order-flow/order-flow.service';
import { assertTransition } from '../orders/order-state.machine';
import { OrderService } from '../orders/order.service';

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

    if (targetVendorIds.length > 0) {
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

    assertTransition(order.status, OrderStatus.PREPARING);

    const prepTimeMinutes = dto.prepTimeMinutes ?? order.vendor.defaultPrepTimeMinutes;

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
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

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.READY_FOR_PICKUP,
      },
    });

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

    assertTransition(order.status, OrderStatus.DISPATCHED);

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.DISPATCHED,
        pickedUpAt: new Date(),
      },
    });

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
    if (user.role === UserRole.SUPER_ADMIN) {
      return this.prisma.vendor.findMany({
        select: {
          id: true,
          name: true,
          addressText: true,
          isBusy: true,
          isActive: true,
          defaultPrepTimeMinutes: true,
          brandId: true,
        },
        orderBy: { name: 'asc' },
      });
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
          },
        },
      },
    });

    if (!staffRecord) {
      throw new ForbiddenException('No active vendor staff assignment found');
    }

    if (staffRecord.scope === PermissionScope.ALL_OUTLETS_MASTER && staffRecord.brand) {
      return staffRecord.brand.outlets;
    }

    return staffRecord.vendor ? [staffRecord.vendor] : [];
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

    return this.prisma.vendor.update({
      where: { id: targetVendorId },
      data: {
        ...(data.defaultPrepTimeMinutes !== undefined && {
          defaultPrepTimeMinutes: data.defaultPrepTimeMinutes,
        }),
        ...(data.isBusy !== undefined && { isBusy: data.isBusy }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
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
      where: { vendorId },
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
                  orderBy: { name: 'asc' },
                },
                addonGroups: {
                  include: {
                    addons: {
                      orderBy: { name: 'asc' },
                    },
                  },
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
            priceDelta: Number(v.priceModifier),
            priceModifier: Number(v.priceModifier),
            isInStock: v.isInStock,
          })),
          addonGroups: p.addonGroups.map((ag) => ({
            id: ag.id,
            name: ag.title,
            title: ag.title,
            minSelection: ag.minSelection,
            maxSelection: ag.maxSelection,
            addons: ag.addons.map((a) => ({
              id: a.id,
              name: a.name,
              price: Number(a.price),
              isInStock: a.isInStock,
            })),
          })),
        })),
      })),
    };
  }

  /**
   * 12. Get Sales Ledger & Commission Breakdown
   */
  async getSalesLedger(user: User, vendorId?: string) {
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
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentMethod: true,
            subtotal: true,
            deliveryFee: true,
            totalAmount: true,
            customerNotes: true,
            deliveryAddressSnapshot: true,
            placedAt: true,
            customer: {
              select: {
                fullName: true,
                phone: true,
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
                addonsSnapshot: true,
              },
            },
          },
        },
        vendor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalGross = 0;
    let totalCommission = 0;
    let totalNet = 0;

    const formattedLedgers = ledgers.map((l) => {
      const gross = Number(l.grossAmount);
      const commission = Number(l.commissionAmount);
      const net = Number(l.netVendorPayable);

      totalGross += gross;
      totalCommission += commission;
      totalNet += net;

      return {
        id: l.id,
        orderId: l.orderId,
        orderNumber: l.order?.orderNumber || 'N/A',
        vendorId: l.vendorId,
        vendorName: l.vendor?.name || 'Unknown Outlet',
        customerName: l.order?.customer?.fullName || 'Guest Customer',
        customerPhone: l.order?.customer?.phone || '',
        customerNotes: l.order?.customerNotes || null,
        deliveryAddress: l.order?.deliveryAddressSnapshot || null,
        paymentMethod: l.order?.paymentMethod || 'CASH_ON_DELIVERY',
        orderStatus: l.order?.status || 'UNKNOWN',
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
          addons: i.addonsSnapshot,
        })),
      };
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
