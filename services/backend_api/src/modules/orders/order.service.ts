import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CouponService } from '../promotions/coupons/coupon.service';
import { DeliveryFeeService } from '../promotions/pricing/delivery-fee.service';
import { CheckoutDto, DeliveryMethod } from './dto/checkout.dto';
import { ValidateReorderDto } from './dto/validate-reorder.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { assertTransition } from './order-state.machine';
import { Order, OrderStatus, PaymentMethod, PaymentStatus, Prisma, SettlementStatus, UserRole } from '@prisma/client';

import { TrackingGateway } from '../realtime/tracking.gateway';
import { OrderFlowService } from '../order-flow/order-flow.service';
import { RedisService } from '../../common/redis/redis.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface OrderAddressSnapshot {
  type: string;
  vendorAddress?: string;
  addressId?: string;
  addressLine?: string;
  buildingFloor?: string | null;
  label?: string;
  latitude?: number;
  longitude?: number;
  deliveryNote?: string | null;
  [key: string]: Prisma.InputJsonValue | null | undefined;
}

export interface OrderVariantSnapshot {
  id: string;
  name: string;
  priceModifier: number;
  [key: string]: Prisma.InputJsonValue | undefined;
}

export interface OrderAddonSnapshot {
  id: string;
  name: string;
  price: number;
  [key: string]: Prisma.InputJsonValue | undefined;
}

export interface OrderItemCreatePayload {
  productId: string;
  productNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
  specialInstructions?: string;
  variantSnapshot?: OrderVariantSnapshot | null;
  addonsSnapshot?: OrderAddonSnapshot[] | null;
}

export interface RiderTelemetryLocation {
  riderId: string;
  fullName: string;
  phone: string;
  latitude: number;
  longitude: number;
  bearing: number;
  speed: number;
  updatedAt?: string;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly couponService: CouponService,
    private readonly deliveryFeeService: DeliveryFeeService,
    private readonly trackingGateway: TrackingGateway,
    private readonly orderFlowService: OrderFlowService,
    private readonly redis: RedisService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 1. Atomic Order Checkout with Geofence & Single-Vendor Guard
   */
  async checkout(customerId: string, dto: CheckoutDto) {
    // 1. Fetch customer
    const customer = await this.prisma.user.findUnique({
      where: { id: customerId },
    });
    if (!customer || customer.status !== 'ACTIVE') {
      throw new ForbiddenException('Customer account is not active');
    }

    // 2. Fetch vendor outlet
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: dto.vendorId },
      include: {
        operatingHours: true,
      },
    });
    if (!vendor || !vendor.isActive) {
      throw new BadRequestException('Vendor outlet not found or currently closed');
    }

    if (vendor.isBusy) {
      throw new BadRequestException(
        `Vendor "${vendor.name}" is currently busy and temporarily paused receiving new orders`,
      );
    }

    // Operating Hours Validation Guard
    if (vendor.operatingHours && vendor.operatingHours.length > 0) {
      const now = new Date();
      const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const todayHours = vendor.operatingHours.find((h) => h.dayOfWeek === currentDay);

      if (todayHours) {
        if (todayHours.isClosed) {
          throw new BadRequestException(`Vendor "${vendor.name}" is scheduled closed today`);
        }

        const currentHour = now.getHours().toString().padStart(2, '0');
        const currentMinute = now.getMinutes().toString().padStart(2, '0');
        const currentSecond = now.getSeconds().toString().padStart(2, '0');
        const currentTime = `${currentHour}:${currentMinute}:${currentSecond}`;

        const openTime = todayHours.openTime.length === 5 ? `${todayHours.openTime}:00` : todayHours.openTime;
        const closeTime = todayHours.closeTime.length === 5 ? `${todayHours.closeTime}:00` : todayHours.closeTime;

        let isOpen: boolean;
        if (openTime <= closeTime) {
          isOpen = currentTime >= openTime && currentTime <= closeTime;
        } else {
          // Overnight shift (e.g. 18:00 - 02:00)
          isOpen = currentTime >= openTime || currentTime <= closeTime;
        }

        if (!isOpen) {
          throw new BadRequestException(
            `Vendor "${vendor.name}" is currently outside operating hours (${todayHours.openTime} - ${todayHours.closeTime})`,
          );
        }
      }
    }

    // 3. Validate Delivery Address & Spatial Geofence Guard
    let distanceKm = 0;
    let addressSnapshot: OrderAddressSnapshot = {
      type: 'TAKEAWAY',
      vendorAddress: vendor.addressText,
    };

    if (dto.deliveryMethod === DeliveryMethod.HOME_DELIVERY) {
      if (!dto.deliveryAddressId) {
        throw new BadRequestException('deliveryAddressId is required for Home Delivery');
      }

      const address = await this.prisma.customerAddress.findUnique({
        where: { id: dto.deliveryAddressId },
      });

      if (!address || address.userId !== customerId) {
        throw new NotFoundException('Delivery address not found or does not belong to customer');
      }

      // Check Spatial Coverage via PostGIS
      const coverageQuery = await this.prisma.$queryRaw<
        Array<{ distanceKm: string | number; isWithinCoverage: boolean }>
      >`
        SELECT 
          ROUND((ST_Distance(
            CAST(ST_SetSRID(ST_MakePoint(${vendor.longitude}, ${vendor.latitude}), 4326) AS geography),
            CAST(ST_SetSRID(ST_MakePoint(${address.longitude}, ${address.latitude}), 4326) AS geography)
          ) / 1000)::numeric, 2) AS "distanceKm",
          ST_DWithin(
            CAST(ST_SetSRID(ST_MakePoint(${vendor.longitude}, ${vendor.latitude}), 4326) AS geography),
            CAST(ST_SetSRID(ST_MakePoint(${address.longitude}, ${address.latitude}), 4326) AS geography),
            ${Number(vendor.deliveryRadiusKm)} * 1000
          ) AS "isWithinCoverage"
      `;

      const isWithinCoverage = coverageQuery[0]?.isWithinCoverage === true;
      distanceKm = Number(coverageQuery[0]?.distanceKm || 0);

      if (!isWithinCoverage) {
        throw new HttpException(
          {
            success: false,
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            error: 'ADDRESS_OUT_OF_COVERAGE',
            message: `Selected address is outside ${vendor.name}'s delivery coverage radius of ${vendor.deliveryRadiusKm} km. Distance is ${distanceKm} km.`,
          },
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      addressSnapshot = {
        type: 'HOME_DELIVERY',
        addressId: address.id,
        label: address.label,
        addressLine: address.addressLine,
        buildingFloor: address.buildingFloor,
        deliveryNote: address.deliveryNote,
        latitude: address.latitude,
        longitude: address.longitude,
      };
    }

    // 4. Validate Products & Single-Vendor Guard
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        variants: true,
        addonGroups: {
          include: { addons: true },
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products in the cart were not found');
    }

    // Single-Vendor Check
    for (const product of products) {
      if (product.vendorId !== dto.vendorId) {
        throw new BadRequestException('All items in the cart must belong to the same vendor outlet.');
      }
      if (!product.isInStock) {
        throw new BadRequestException(`Product "${product.name}" is currently sold out.`);
      }
    }

    // Calculate Items and Freeze Snapshots
    let grossSubtotal = 0;
    const itemsToCreate: OrderItemCreatePayload[] = [];

    for (const itemDto of dto.items) {
      const product = products.find((p) => p.id === itemDto.productId)!;
      let unitPrice = Number(product.basePrice);

      let variantSnapshot: OrderVariantSnapshot | null = null;
      if (itemDto.variantId) {
        const variant = product.variants.find((v) => v.id === itemDto.variantId);
        if (!variant) {
          throw new BadRequestException(`Variant not found for product "${product.name}"`);
        }
        if (!variant.isInStock) {
          throw new BadRequestException(`Variant "${variant.name}" for "${product.name}" is currently sold out`);
        }
        unitPrice += Number(variant.priceModifier);
        variantSnapshot = {
          id: variant.id,
          name: variant.name,
          priceModifier: Number(variant.priceModifier),
        };
      }

      const addonsSnapshot: OrderAddonSnapshot[] = [];
      if (itemDto.addonIds && itemDto.addonIds.length > 0) {
        const allAddons = product.addonGroups.flatMap((g) => g.addons);
        for (const addonId of itemDto.addonIds) {
          const addon = allAddons.find((a) => a.id === addonId);
          if (!addon) {
            throw new BadRequestException(`Addon not found for product "${product.name}"`);
          }
          if (!addon.isInStock) {
            throw new BadRequestException(`Addon "${addon.name}" is currently sold out`);
          }
          unitPrice += Number(addon.price);
          addonsSnapshot.push({
            id: addon.id,
            name: addon.name,
            price: Number(addon.price),
          });
        }
      }

      const itemTotal = unitPrice * itemDto.quantity;
      grossSubtotal += itemTotal;

      itemsToCreate.push({
        productId: product.id,
        productNameSnapshot: product.name,
        unitPrice,
        quantity: itemDto.quantity,
        totalPrice: itemTotal,
        variantSnapshot,
        addonsSnapshot: addonsSnapshot.length > 0 ? addonsSnapshot : null,
      });
    }

    grossSubtotal = Math.round(grossSubtotal * 100) / 100;

    // 5. Calculate Delivery Fee
    let deliveryFee = 0.0;
    if (dto.deliveryMethod === DeliveryMethod.HOME_DELIVERY) {
      const feeCalc = await this.deliveryFeeService.calculateFee(distanceKm);
      deliveryFee = feeCalc.deliveryFee;
    }

    // 6. Validate & Apply Coupon
    let couponDiscount = 0.0;
    let appliedCouponId: string | null = null;

    if (dto.couponCode) {
      const couponValidation = await this.couponService.validateCoupon({
        code: dto.couponCode,
        cartSubtotal: grossSubtotal,
        vendorId: vendor.id,
      });
      couponDiscount = couponValidation.discountAmount;
      appliedCouponId = couponValidation.couponId;
    }

    // 7. Calculate Financial Balance & Platform Commission
    const netSubtotal = Math.max(0, Math.round((grossSubtotal - couponDiscount) * 100) / 100);
    const taxAmount = 0.0;
    const totalAmount = Math.round((netSubtotal + deliveryFee + taxAmount) * 100) / 100;

    const commissionRate = Number(vendor.commissionRate);
    const commissionAmount = Math.round((netSubtotal * (commissionRate / 100)) * 100) / 100;
    const netVendorPayable = Math.round((netSubtotal - commissionAmount) * 100) / 100;

    // 8. Execute Atomic ACID Transaction with deterministic sequential order number
    let order: Order | null = null;
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      const orderNumber = await this.generateOrderNumber();
      try {
        order = await this.prisma.$transaction(async (tx) => {
          // Create Order
          const newOrder = await tx.order.create({
            data: {
              orderNumber,
              customerId,
              vendorId: vendor.id,
              couponId: appliedCouponId,
              status: OrderStatus.PLACED,
              subtotal: grossSubtotal,
              couponDiscount,
              deliveryFee,
              taxAmount,
              totalAmount,
              paymentMethod: dto.paymentMethod || 'CASH_ON_DELIVERY',
              paymentStatus: PaymentStatus.PENDING,
              deliveryAddressSnapshot: addressSnapshot as unknown as Prisma.InputJsonObject,
              customerPhoneSnapshot: customer.phone,
              prepTimeMinutes: vendor.defaultPrepTimeMinutes,
              customerNotes: dto.customerNotes,
            },
          });

          // Create Order Items
          for (const item of itemsToCreate) {
            await tx.orderItem.create({
              data: {
                orderId: newOrder.id,
                productId: item.productId,
                productNameSnapshot: item.productNameSnapshot,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                totalPrice: item.totalPrice,
                variantSnapshot: item.variantSnapshot ? (item.variantSnapshot as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
                addonsSnapshot: item.addonsSnapshot ? (item.addonsSnapshot as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
              },
            });
          }

          // Create Commission Ledger
          await tx.commissionLedger.create({
            data: {
              orderId: newOrder.id,
              vendorId: vendor.id,
              grossAmount: netSubtotal,
              commissionRate,
              commissionAmount,
              netVendorPayable,
              settlementStatus: SettlementStatus.PENDING,
            },
          });

          // Increment Coupon Usage if applied
          if (appliedCouponId) {
            await tx.coupon.update({
              where: { id: appliedCouponId },
              data: { currentUses: { increment: 1 } },
            });
          }

          return newOrder;
        });
        break;
      } catch (err: unknown) {
        const prismaErr = err as { code?: string; meta?: { target?: string[] } };
        if (prismaErr.code === 'P2002' && prismaErr.meta?.target?.includes('order_number') && attempts < 3) {
          this.logger.warn(`Order number collision on ${orderNumber}, retrying (attempt ${attempts + 1})...`);
          continue;
        }
        throw err;
      }
    }

    if (!order) {
      throw new HttpException(
        {
          success: false,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'ORDER_CREATION_FAILED',
          message: 'Order could not be created after order number retries',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    // Trigger Dispatch FSM based on active mode (RIDER_FIRST vs VENDOR_FIRST)
    await this.orderFlowService.handleOrderPlaced(order.id);

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      subtotal: Number(order.subtotal),
      couponDiscount: Number(order.couponDiscount),
      deliveryFee: Number(order.deliveryFee),
      totalAmount: Number(order.totalAmount),
      status: order.status,
      paymentMethod: order.paymentMethod,
      commissionAmount,
      netVendorPayable,
    };
  }

  /**
   * 2. Validate Re-Order from History
   */
  async validateReorder(customerId: string, dto: ValidateReorderDto) {
    const previousOrder = await this.prisma.order.findUnique({
      where: { id: dto.previousOrderId },
      include: {
        vendor: true,
        orderItems: true,
      },
    });

    if (!previousOrder) {
      throw new NotFoundException('Previous order record not found');
    }

    const vendor = previousOrder.vendor;
    const isStoreOperational = vendor.isActive && !vendor.isBusy;

    const validItems: Array<{
      productId: string;
      name: string;
      currentBasePrice: number;
      quantity: number;
      variantId: string | null;
      isAvailable: boolean;
    }> = [];
    const unavailableItems: Array<{ productId: string; name: string; reason: string }> = [];

    for (const item of previousOrder.orderItems) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
        include: { variants: true, addonGroups: { include: { addons: true } } },
      });

      if (!product || !product.isInStock) {
        unavailableItems.push({
          productId: item.productId,
          name: item.productNameSnapshot,
          reason: 'Item is currently sold out',
        });
        continue;
      }

      // Check variant if applicable
      let variantOk = true;
      const variantSnap = item.variantSnapshot as unknown as OrderVariantSnapshot | null;
      if (variantSnap?.id) {
        const variant = product.variants.find((v) => v.id === variantSnap.id);
        if (!variant || !variant.isInStock) {
          variantOk = false;
        }
      }

      if (!variantOk) {
        unavailableItems.push({
          productId: item.productId,
          name: item.productNameSnapshot,
          reason: 'Selected variant is currently sold out',
        });
        continue;
      }

      validItems.push({
        productId: product.id,
        name: product.name,
        currentBasePrice: Number(product.basePrice),
        quantity: item.quantity,
        variantId: variantSnap?.id || null,
        isAvailable: true,
      });
    }

    const hasStockChanges = unavailableItems.length > 0;

    return {
      isStoreOperational,
      hasStockChanges,
      vendorId: vendor.id,
      vendorName: vendor.name,
      validItems,
      unavailableItems,
    };
  }

  /**
   * 3. Get Order Details by ID
   */
  async getOrderById(orderId: string, userId: string, role: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            contactPhone: true,
            logoUrl: true,
            addressText: true,
            latitude: true,
            longitude: true,
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
        orderItems: true,
        commission: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Permission check: Customers can only view their own orders
    if (role === UserRole.CUSTOMER && order.customerId !== userId) {
      throw new ForbiddenException('You do not have permission to view this order');
    }

    return order;
  }

  /**
   * 4. Customer Order History
   */
  async getCustomerOrderHistory(customerId: string) {
    return this.prisma.order.findMany({
      where: { customerId },
      orderBy: { placedAt: 'desc' },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
          },
        },
        orderItems: true,
      },
    });
  }

  /**
   * 5. Live Tracking Fallback Polling Endpoint
   * Returns store coordinates, destination, latest rider telemetry, and route snapshot.
   */
  async getLiveTracking(orderId: string, userId: string, role: UserRole) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        vendor: true,
        rider: {
          include: {
            user: { select: { fullName: true, phone: true } },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (role === UserRole.CUSTOMER && order.customerId !== userId) {
      throw new ForbiddenException('You do not have permission to view live tracking for this order');
    }

    const destSnap = order.deliveryAddressSnapshot as unknown as OrderAddressSnapshot;
    const storeLocation = {
      id: order.vendor.id,
      name: order.vendor.name,
      address: order.vendor.addressText,
      latitude: order.vendor.latitude,
      longitude: order.vendor.longitude,
    };

    const destinationLocation = {
      label: destSnap?.label || 'Home',
      addressLine: destSnap?.addressLine || '',
      latitude: destSnap?.latitude,
      longitude: destSnap?.longitude,
    };

    // Retrieve latest rider telemetry: 1st from Redis live order, 2nd from Redis telemetry, 3rd from DB
    const economics = await this.deliveryFeeService.getEconomicsConfig();
    let riderLocation: RiderTelemetryLocation | null = null;
    let estimatedMinutesRemaining = economics.eta_fallback_minutes || 10;

    const liveLocRaw = await this.redis.get(`order:live_location:${orderId}`);
    if (liveLocRaw) {
      try {
        const live = JSON.parse(liveLocRaw);
        riderLocation = {
          riderId: live.riderId,
          fullName: live.fullName || order.rider?.user?.fullName,
          phone: live.phone || order.rider?.user?.phone,
          latitude: live.latitude,
          longitude: live.longitude,
          bearing: live.bearing ?? 0,
          speed: live.speed ?? 0,
          updatedAt: live.updatedAt,
        };
        estimatedMinutesRemaining = live.estimatedMinutesRemaining ?? estimatedMinutesRemaining;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to parse live order telemetry for order ${orderId}: ${msg}`);
      }
    }

    if (!riderLocation && order.rider) {
      const telemetryRaw = await this.redis.get(`rider:telemetry:${order.rider.id}`);
      if (telemetryRaw) {
        try {
          const telem = JSON.parse(telemetryRaw);
          riderLocation = {
            riderId: order.rider.id,
            fullName: order.rider.user.fullName,
            phone: order.rider.user.phone,
            latitude: telem.latitude,
            longitude: telem.longitude,
            bearing: telem.bearing ?? 0,
            speed: telem.speed ?? 0,
            updatedAt: telem.updatedAt,
          };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Failed to parse rider telemetry for rider ${order.rider.id}: ${msg}`);
        }
      }

      if (!riderLocation && order.rider.latitude && order.rider.longitude) {
        riderLocation = {
          riderId: order.rider.id,
          fullName: order.rider.user.fullName,
          phone: order.rider.user.phone,
          latitude: order.rider.latitude,
          longitude: order.rider.longitude,
          bearing: 0,
          speed: 0,
          updatedAt: order.rider.updatedAt.toISOString(),
        };
      }
    }

    const routeSnapshot = {
      origin: {
        latitude: storeLocation.latitude,
        longitude: storeLocation.longitude,
      },
      rider: riderLocation
        ? { latitude: riderLocation.latitude, longitude: riderLocation.longitude }
        : null,
      destination: {
        latitude: destinationLocation.latitude,
        longitude: destinationLocation.longitude,
      },
    };

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      storeLocation,
      destinationLocation,
      riderLocation,
      estimatedMinutesRemaining,
      routeSnapshot,
      placedAt: order.placedAt,
      acceptedAt: order.acceptedAt,
      pickedUpAt: order.pickedUpAt,
      deliveredAt: order.deliveredAt,
    };
  }

  /**
   * Generates a deterministic sequential order number: ORD-YYYYMMDD-0001
   * Uses Redis atomic INCR counter per day with 48h TTL.
   */
  private async generateOrderNumber(): Promise<string> {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const key = `order:seq:${dateStr}`;
    const seq = await this.redis.incr(key);
    if (seq === 1) {
      await this.redis.expire(key, 172800); // 48h TTL
    }
    const paddedSeq = seq.toString().padStart(4, '0');
    return `ORD-${dateStr}-${paddedSeq}`;
  }

  /**
   * 6. Cancel Customer Order
   * Customers can cancel their own orders ONLY while status is PLACED or RIDER_ASSIGNED (pre-prep).
   */
  async cancelCustomerOrder(customerId: string, orderId: string, dto: CancelOrderDto) {
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

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You do not have permission to cancel this order');
    }

    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (
      order.status !== OrderStatus.PLACED &&
      order.status !== OrderStatus.RIDER_ASSIGNED
    ) {
      throw new BadRequestException(
        `Cannot cancel order in "${order.status}" status. Customer self-cancellation is only permitted prior to kitchen preparation.`,
      );
    }

    const reason = dto.reason?.trim() || 'Cancelled by customer';
    return this.executeOrderCancellation(order, reason, UserRole.CUSTOMER);
  }

  /**
   * 7. Centralized Atomic Order Cancellation Engine
   * Enforces ADR-002 FSM transition, ADR-009 double-entry ledger removal, coupon quota restoration,
   * payment refund reconciliation, Redis courier mutex release, and realtime WebSocket event broadcast.
   */
  async executeOrderCancellation(
    order: {
      id: string;
      orderNumber: string;
      customerId: string;
      vendorId: string;
      riderId: string | null;
      couponId: string | null;
      status: OrderStatus;
      paymentMethod: PaymentMethod;
      paymentStatus: PaymentStatus;
      rider?: { id: string; userId: string } | null;
    },
    reason: string,
    cancelledByRole: UserRole,
  ) {
    // 1. Assert state machine transition legality
    assertTransition(order.status, OrderStatus.CANCELLED);

    const riderIdToRelease = order.riderId;
    const riderUserId = order.rider?.userId;

    // 2. Execute DB transaction
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Reconcile Payment state
      let nextPaymentStatus = order.paymentStatus;
      if (order.paymentStatus === PaymentStatus.PAID) {
        nextPaymentStatus = PaymentStatus.REFUNDED;
        await tx.payment.updateMany({
          where: { orderId: order.id, status: PaymentStatus.PAID },
          data: {
            status: PaymentStatus.REFUNDED,
            updatedAt: new Date(),
          },
        });
      } else if (order.paymentStatus === PaymentStatus.PENDING) {
        nextPaymentStatus = PaymentStatus.FAILED;
        await tx.payment.updateMany({
          where: { orderId: order.id, status: PaymentStatus.PENDING },
          data: {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // Reconcile Coupon usage
      if (order.couponId) {
        await tx.coupon.update({
          where: { id: order.couponId },
          data: {
            currentUses: { decrement: 1 },
          },
        });
      }

      // Delete pending commission ledgers to prevent settlement payout
      await tx.commissionLedger.deleteMany({
        where: { orderId: order.id, settlementStatus: SettlementStatus.PENDING },
      });

      // Delete pending rider trip ledgers
      await tx.riderTripLedger.deleteMany({
        where: { orderId: order.id, status: SettlementStatus.PENDING },
      });

      // Update Order to CANCELLED
      return tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          rejectionReason: reason,
          paymentStatus: nextPaymentStatus,
          riderId: null,
        },
        include: {
          orderItems: true,
          vendor: true,
          customer: { select: { id: true, fullName: true, phone: true } },
        },
      });
    });

    // 3. Post-transaction Side Effects: Release Rider Mutex in Redis
    if (riderIdToRelease) {
      try {
        await this.orderFlowService.releaseRiderActiveTrip(riderIdToRelease);
        await this.redis.del(`lock:order_claim:${order.id}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.error(`Failed to release rider mutex on cancel: ${msg}`);
      }
    }

    // 4. Realtime WebSockets: Broadcast cancellation
    try {
      this.trackingGateway.notifyOrderStatusChanged(
        order.id,
        order.customerId,
        order.status,
        OrderStatus.CANCELLED,
        {
          reason,
          cancelledBy: cancelledByRole,
          paymentStatus: updatedOrder.paymentStatus,
          vendorId: order.vendorId,
        },
      );

      if (this.trackingGateway?.server) {
        const payload = {
          orderId: order.id,
          orderNumber: order.orderNumber,
          previousStatus: order.status,
          status: OrderStatus.CANCELLED,
          reason,
          cancelledBy: cancelledByRole,
          paymentStatus: updatedOrder.paymentStatus,
          cancelledAt: updatedOrder.cancelledAt,
        };
        this.trackingGateway.server.to(`order_${order.id}`).emit('order:cancelled', payload);
        this.trackingGateway.server.to(`user_${order.customerId}`).emit('order:cancelled', payload);
        this.trackingGateway.server.to(`vendor_${order.vendorId}`).emit('order:cancelled', payload);
        this.trackingGateway.server.to('admin_hq').emit('order:cancelled', payload);
        if (riderUserId) {
          this.trackingGateway.server.to(`user_${riderUserId}`).emit('order:cancelled', payload);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`Failed to broadcast cancel socket event: ${msg}`);
    }

    // 5. Push Notifications
    if (cancelledByRole !== UserRole.CUSTOMER) {
      this.notificationsService
        .sendToUser(order.customerId, {
          title: 'Order Cancelled',
          body: `Order ${order.orderNumber} was cancelled. Reason: ${reason}`,
          data: { orderId: order.id, type: 'ORDER_CANCELLED' },
        })
        .catch((err: unknown) => {
          this.logger.warn(`Push notify customer failed: ${err instanceof Error ? err.message : 'Unknown'}`);
        });
    }

    if (riderUserId) {
      this.notificationsService
        .sendToUser(riderUserId, {
          title: 'Delivery Trip Cancelled',
          body: `Order ${order.orderNumber} has been cancelled.`,
          data: { orderId: order.id, type: 'TRIP_CANCELLED' },
        })
        .catch((err: unknown) => {
          this.logger.warn(`Push notify rider failed: ${err instanceof Error ? err.message : 'Unknown'}`);
        });
    }

    return updatedOrder;
  }

  /**
   * 8. Switch unpaid online order to Cash on Delivery and trigger dispatch broadcast
   */
  async switchToCOD(customerId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        vendor: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    if (order.customerId !== customerId) {
      throw new ForbiddenException('You do not have permission to modify this order');
    }

    if (order.status !== OrderStatus.PLACED) {
      throw new BadRequestException(`Cannot switch payment method for order in status ${order.status}`);
    }

    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Order is already marked as paid');
    }

    if (order.paymentMethod === PaymentMethod.CASH_ON_DELIVERY) {
      return order; // Already COD
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      },
      include: {
        vendor: true,
        orderItems: true,
      },
    });

    try {
      this.trackingGateway.notifyOrderStatusChanged(
        order.id,
        order.customerId,
        order.status,
        order.status,
        {
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
          customerId: order.customerId,
          vendorId: order.vendorId,
        },
      );
    } catch (err: unknown) {
      this.logger.warn(`Failed to broadcast switch-cod socket event: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    try {
      await this.orderFlowService.handleOrderPlaced(order.id);
    } catch (err: unknown) {
      this.logger.error(`Error triggering order flow after switch to COD: ${err instanceof Error ? err.message : 'Unknown'}`);
    }

    return updatedOrder;
  }
}
