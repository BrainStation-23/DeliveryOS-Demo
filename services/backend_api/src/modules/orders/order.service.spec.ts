import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PermissionScope,
  UserRole,
} from '@prisma/client';
import { DeliveryMethod } from './dto/checkout.dto';
import { OrderService } from './order.service';

type MockPrisma = {
  order: { findUnique: jest.Mock; findMany: jest.Mock; updateMany: jest.Mock; update: jest.Mock; create: jest.Mock };
  orderItem: { create: jest.Mock };
  payment: { updateMany: jest.Mock };
  commissionLedger: { deleteMany: jest.Mock; create: jest.Mock };
  riderTripLedger: { deleteMany: jest.Mock };
  coupon: { updateMany: jest.Mock };
  user: { findUnique: jest.Mock };
  vendor: { findUnique: jest.Mock };
  customerAddress: { findUnique: jest.Mock };
  vendorStaff: { findMany: jest.Mock };
  product: { findUnique: jest.Mock; findMany: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

type MockPaymentsService = {
  refundForOrder: jest.Mock;
};

type MockRedis = {
  del: jest.Mock;
  set: jest.Mock;
  get: jest.Mock;
  incr: jest.Mock;
  expire: jest.Mock;
  acquireLock: jest.Mock;
  releaseLock: jest.Mock;
};

type MockTrackingGateway = {
  emitToOrderRoom: jest.Mock;
  emitToAdmin: jest.Mock;
  notifyOrderStatusChanged?: jest.Mock;
};

type MockCouponService = {
  validateCoupon: jest.Mock;
};

type MockDeliveryFeeService = {
  calculateFee: jest.Mock;
};

type MockOrderFlowService = {
  handleOrderPlaced?: jest.Mock;
  releaseRiderActiveTrip?: jest.Mock;
  getDispatchConfig?: jest.Mock;
};

describe('OrderService - Security Scoping & Cancellation State Claims', () => {
  let orderService: OrderService;
  let prisma: MockPrisma;
  let paymentsService: MockPaymentsService;
  let redis: MockRedis;
  let trackingGateway: MockTrackingGateway;
  let notificationsService: { sendToUser: jest.Mock };
  let orderFlowService: MockOrderFlowService;
  let couponService: MockCouponService;
  let deliveryFeeService: MockDeliveryFeeService;

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          id: 'order-created-1',
          ...data,
        })),
      },
      orderItem: {
        create: jest.fn().mockResolvedValue({ id: 'item-1' }),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      commissionLedger: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({ id: 'comm-1' }),
      },
      riderTripLedger: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      coupon: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn(),
      },
      vendor: {
        findUnique: jest.fn(),
      },
      customerAddress: {
        findUnique: jest.fn(),
      },
      vendorStaff: {
        findMany: jest.fn(),
      },
      product: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
      $transaction: jest.fn(async (fn: (tx: MockPrisma) => Promise<unknown>) => fn(prisma)),
    };

    paymentsService = {
      refundForOrder: jest.fn().mockResolvedValue({ success: true, refundId: 'ref-1', raw: {} }),
    };

    redis = {
      del: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(true),
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(true),
    };

    trackingGateway = {
      emitToOrderRoom: jest.fn(),
      emitToAdmin: jest.fn(),
      notifyOrderStatusChanged: jest.fn(),
    };

    notificationsService = {
      sendToUser: jest.fn().mockResolvedValue(true),
    };

    couponService = {
      validateCoupon: jest.fn().mockResolvedValue({ discountAmount: 0, couponId: null, usageLimit: 0 }),
    };

    deliveryFeeService = {
      calculateFee: jest.fn().mockResolvedValue({ deliveryFee: 40 }),
    };

    orderFlowService = {
      handleOrderPlaced: jest.fn().mockResolvedValue(undefined),
    };

    orderService = new OrderService(
      prisma as never,
      couponService as never,
      deliveryFeeService as never,
      trackingGateway as never,
      orderFlowService as never,
      redis as never,
      notificationsService as never,
      paymentsService as never,
    );
  });

  describe('T1: OrderCheckoutService', () => {
    const mockActiveUser = {
      id: 'customer-1',
      status: 'ACTIVE',
      phone: '+8801700000005',
    };

    const mockVendor = {
      id: 'vendor-1',
      name: 'Burger Point',
      isActive: true,
      isBusy: false,
      commissionRate: 15,
      deliveryRadiusKm: 5,
      addressText: 'Gulshan 2, Dhaka',
      latitude: 23.7925,
      longitude: 90.4078,
      operatingHours: [],
    };

    const mockProduct = {
      id: 'prod-1',
      name: 'Beef Burger',
      vendorId: 'vendor-1',
      basePrice: 100,
      isInStock: true,
      variants: [],
    };

    it('rejects checkout with 422 ADDRESS_OUT_OF_COVERAGE when customer address is outside vendor delivery radius', async () => {
      prisma.user.findUnique.mockResolvedValue(mockActiveUser);
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      prisma.customerAddress.findUnique.mockResolvedValue({
        id: 'addr-1',
        userId: 'customer-1',
        latitude: 23.95,
        longitude: 90.55,
        label: 'Home',
        addressLine: 'Far Away Street',
      });
      prisma.$queryRaw.mockResolvedValue([{ distanceKm: 15.2, isWithinCoverage: false }]);

      await expect(
        orderService.checkout('customer-1', {
          vendorId: 'vendor-1',
          deliveryMethod: DeliveryMethod.HOME_DELIVERY,
          deliveryAddressId: 'addr-1',
          items: [{ productId: 'prod-1', quantity: 1 }],
          paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            error: 'ADDRESS_OUT_OF_COVERAGE',
          }),
        }),
      );
    });

    it('clamps coupon discount so netSubtotal cannot fall below zero', async () => {
      prisma.user.findUnique.mockResolvedValue(mockActiveUser);
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      couponService.validateCoupon.mockResolvedValue({
        discountAmount: 150,
        couponId: 'coupon-large',
        usageLimit: 10,
      });

      const result = await orderService.checkout('customer-1', {
        vendorId: 'vendor-1',
        deliveryMethod: DeliveryMethod.TAKEAWAY,
        items: [{ productId: 'prod-1', quantity: 1 }],
        couponCode: 'HUGE150',
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 100,
            couponDiscount: 150,
            deliveryFee: 0,
            totalAmount: 0,
          }),
        }),
      );
      expect(result.totalAmount).toBe(0);
      expect(result.couponDiscount).toBe(150);
    });

    it('isolates post-commit dispatch failure without throwing 500', async () => {
      prisma.user.findUnique.mockResolvedValue(mockActiveUser);
      prisma.vendor.findUnique.mockResolvedValue(mockVendor);
      prisma.product.findMany.mockResolvedValue([mockProduct]);
      orderFlowService.handleOrderPlaced!.mockRejectedValue(new Error('Dispatch broker temporarily offline'));

      const result = await orderService.checkout('customer-1', {
        vendorId: 'vendor-1',
        deliveryMethod: DeliveryMethod.TAKEAWAY,
        items: [{ productId: 'prod-1', quantity: 1 }],
        paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      });

      expect(result).toBeDefined();
      expect(result.orderId).toBe('order-created-1');
      expect(orderFlowService.handleOrderPlaced).toHaveBeenCalledWith('order-created-1');
    });
  });

  describe('Step 1.3: validateReorder (IDOR Prevention)', () => {
    it('throws ForbiddenException if customer does not own the previous order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'customer-b',
        vendor: { isActive: true, isBusy: false, operatingHours: [] },
        orderItems: [],
      });

      await expect(
        orderService.validateReorder('customer-a', { previousOrderId: 'order-1' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows reorder validation if customer owns the previous order', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'customer-a',
        vendor: { id: 'vendor-1', name: 'Vendor 1', isActive: true, isBusy: false, operatingHours: [] },
        orderItems: [],
      });

      const result = await orderService.validateReorder('customer-a', { previousOrderId: 'order-1' });
      expect(result.isStoreOperational).toBe(true);
      expect(result.vendorId).toBe('vendor-1');
    });

    it('flags unavailable items when a variant is out of stock', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        customerId: 'customer-a',
        vendor: { id: 'vendor-1', name: 'Vendor 1', isActive: true, isBusy: false, operatingHours: [] },
        orderItems: [
          {
            productId: 'p-1',
            productNameSnapshot: 'Burger',
            quantity: 1,
            variantSnapshot: { id: 'v-cheese', name: 'Double Patty' },
          },
        ],
      });
      prisma.product.findUnique.mockResolvedValue({
        id: 'p-1',
        name: 'Burger',
        basePrice: '150.00',
        isInStock: true,
        variants: [{ id: 'v-cheese', name: 'Double Patty', isInStock: false }],
      });

      const result = await orderService.validateReorder('customer-a', { previousOrderId: 'order-1' });
      expect(result.hasStockChanges).toBe(true);
      expect(result.unavailableItems).toHaveLength(1);
      expect(result.unavailableItems[0].reason).toContain('Selected variant is currently sold out');
      expect(result.validItems).toHaveLength(0);
    });

    it('throws NotFoundException if previous order does not exist', async () => {
      prisma.order.findUnique.mockResolvedValue(null);

      await expect(
        orderService.validateReorder('customer-a', { previousOrderId: 'order-none' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Step 1.4: getOrderById & getLiveTracking (BOLA Prevention)', () => {
    const mockOrder = {
      id: 'order-100',
      orderNumber: 'ORD-100',
      customerId: 'customer-1',
      vendorId: 'vendor-1',
      riderId: 'rider-1',
      vendor: { id: 'vendor-1', brandId: 'brand-1', name: 'Vendor 1' },
      rider: { id: 'rider-1', userId: 'user-rider-1' },
      commission: { grossAmount: 100, commissionAmount: 15 },
      deliveryAddressSnapshot: { latitude: 23.7, longitude: 90.4 },
    };

    it('denies customer access to another customer order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        orderService.getOrderById('order-100', 'customer-2', UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows customer access to own order and scrubs internal commission ledger', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...mockOrder });

      const result = await orderService.getOrderById('order-100', 'customer-1', UserRole.CUSTOMER);
      expect(result.id).toBe('order-100');
      expect((result as Record<string, unknown>).commission).toBeUndefined();
    });

    it('denies rider access if order is not assigned to them', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        orderService.getOrderById('order-100', 'other-rider-user', UserRole.RIDER),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows assigned rider access to the order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await orderService.getOrderById('order-100', 'user-rider-1', UserRole.RIDER);
      expect(result.id).toBe('order-100');
    });

    it('denies vendor staff access if staff does not belong to vendor outlet or brand', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.vendorStaff.findMany.mockResolvedValue([
        { scope: PermissionScope.PARTICULAR_OUTLET, vendorId: 'vendor-other', isActive: true },
      ]);

      await expect(
        orderService.getOrderById('order-100', 'staff-user-1', UserRole.VENDOR_ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows vendor staff access if assigned to matching outlet', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.vendorStaff.findMany.mockResolvedValue([
        { scope: PermissionScope.PARTICULAR_OUTLET, vendorId: 'vendor-1', isActive: true },
      ]);

      const result = await orderService.getOrderById('order-100', 'staff-user-1', UserRole.VENDOR_ADMIN);
      expect(result.id).toBe('order-100');
    });

    it('allows SUPER_ADMIN access to any order', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      const result = await orderService.getOrderById('order-100', 'admin-1', UserRole.SUPER_ADMIN);
      expect(result.id).toBe('order-100');
    });
  });

  describe('Step 1.1: performCancellation (State Claim Precedes Gateway Refund)', () => {
    it('aborts cancellation and avoids refunding if order is concurrently delivered (DB claim count 0)', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-1',
        customerId: 'customer-1',
        paymentStatus: PaymentStatus.PAID,
        status: OrderStatus.PLACED,
        riderId: null,
      });

      // updateMany returns 0 matches because a concurrent transition marked it DELIVERED
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        orderService.cancelCustomerOrder('customer-1', 'order-1', { reason: 'Changed mind' }),
      ).rejects.toThrow(ConflictException);

      // Invariant: external gateway refund must NEVER be invoked if DB claim failed
      expect(paymentsService.refundForOrder).not.toHaveBeenCalled();
    });

    it('claims DB state first and fires gateway refund if status is cancellable', async () => {
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-1',
        customerId: 'customer-1',
        paymentStatus: PaymentStatus.PAID,
        status: OrderStatus.PLACED,
        riderId: null,
      });

      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.update.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.CANCELLED,
      });

      const result = await orderService.cancelCustomerOrder('customer-1', 'order-1', { reason: 'Changed mind' });

      expect(result.status).toBe(OrderStatus.CANCELLED);
      expect(paymentsService.refundForOrder).toHaveBeenCalledWith('order-1', 'Changed mind');
    });
  });

  describe('Step 1.7: refund honesty (REFUNDED only after gateway confirmation)', () => {
    const paidPlacedOrder = {
      id: 'order-1',
      orderNumber: 'ORD-1',
      customerId: 'customer-1',
      vendorId: 'vendor-1',
      paymentMethod: 'ONLINE_GATEWAY',
      paymentStatus: PaymentStatus.PAID,
      status: OrderStatus.PLACED,
      riderId: null,
      couponId: null,
    };

    function primeClaimableCancellation() {
      prisma.order.findUnique.mockResolvedValue(paidPlacedOrder);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        ...paidPlacedOrder,
        ...data,
        cancelledAt: new Date(),
        orderItems: [],
        vendor: { id: 'vendor-1', name: 'V' },
        customer: { id: 'customer-1', fullName: 'C', phone: 'p' },
      }));
    }

    it('does NOT mark payments REFUNDED inside the transaction — only after the gateway succeeds', async () => {
      primeClaimableCancellation();
      paymentsService.refundForOrder.mockResolvedValue({ success: true, refundId: 'ref-1', raw: {} });

      const result = await orderService.cancelCustomerOrder('customer-1', 'order-1', { reason: 'R' });

      // The in-tx reconcile must never touch PAID payment rows
      expect(prisma.payment.updateMany).not.toHaveBeenCalled();
      expect(paymentsService.refundForOrder).toHaveBeenCalledWith('order-1', 'R');
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { paymentStatus: PaymentStatus.REFUNDED } }),
      );
      expect(result.paymentStatus).toBe(PaymentStatus.REFUNDED);
    });

    it('keeps the order honestly PAID when the gateway refund fails', async () => {
      primeClaimableCancellation();
      paymentsService.refundForOrder.mockResolvedValue({ success: false, refundId: null, raw: { error: 'x' } });

      const result = await orderService.cancelCustomerOrder('customer-1', 'order-1', { reason: 'R' });

      expect(prisma.order.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: { paymentStatus: PaymentStatus.REFUNDED } }),
      );
      expect(result.paymentStatus).toBe(PaymentStatus.PAID);
    });

    it('still fails PENDING payment sessions inside the transaction', async () => {
      prisma.order.findUnique.mockResolvedValue({ ...paidPlacedOrder, paymentStatus: PaymentStatus.PENDING });
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        ...paidPlacedOrder,
        ...data,
        cancelledAt: new Date(),
        orderItems: [],
        vendor: { id: 'vendor-1', name: 'V' },
        customer: { id: 'customer-1', fullName: 'C', phone: 'p' },
      }));

      await orderService.cancelCustomerOrder('customer-1', 'order-1', { reason: 'R' });

      expect(prisma.payment.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.FAILED }) }),
      );
      expect(paymentsService.refundForOrder).not.toHaveBeenCalled();
    });
  });

  describe('Step 1.8: sweepStaleOrders (leader-elected stale order reaper)', () => {
    it('auto-cancels kitchen-unaccepted orders older than the configured TTL', async () => {
      orderFlowService = {
        getDispatchConfig: jest
          .fn()
          .mockResolvedValue({ riderSearchTimeoutSeconds: 90, staleOrderTtlMinutes: 60 }),
        releaseRiderActiveTrip: jest.fn().mockResolvedValue(undefined),
      };
      orderService = new OrderService(
        prisma as never,
        {} as never,
        {} as never,
        trackingGateway as never,
        orderFlowService as never,
        redis as never,
        notificationsService as never,
        paymentsService as never,
      );

      prisma.order.findMany.mockResolvedValue([
        {
          ...{
            id: 'order-stale',
            orderNumber: 'ORD-STALE',
            customerId: 'customer-1',
            vendorId: 'vendor-1',
            riderId: null,
            couponId: null,
            paymentMethod: 'CASH_ON_DELIVERY',
            paymentStatus: PaymentStatus.PENDING,
            status: OrderStatus.PLACED,
          },
          vendor: { id: 'vendor-1' },
          rider: null,
          payments: [],
        },
      ]);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.update.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'order-stale',
        ...data,
        cancelledAt: new Date(),
        orderItems: [],
        vendor: { id: 'vendor-1', name: 'V' },
        customer: { id: 'customer-1', fullName: 'C', phone: 'p' },
      }));

      await orderService.sweepStaleOrders();

      expect(prisma.order.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ id: 'order-stale' }) }),
      );
      expect(prisma.commissionLedger.deleteMany).toHaveBeenCalled();
    });

    it('is a no-op when no stale orders exist', async () => {
      orderFlowService = {
        getDispatchConfig: jest
          .fn()
          .mockResolvedValue({ riderSearchTimeoutSeconds: 90, staleOrderTtlMinutes: 60 }),
      };
      orderService = new OrderService(
        prisma as never,
        {} as never,
        {} as never,
        trackingGateway as never,
        orderFlowService as never,
        redis as never,
        notificationsService as never,
        paymentsService as never,
      );
      prisma.order.findMany.mockResolvedValue([]);

      await orderService.sweepStaleOrders();

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });
  });
});
