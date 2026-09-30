import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderStatus, PaymentStatus, PermissionScope, UserRole } from '@prisma/client';
import { OrderService } from './order.service';

type MockPrisma = {
  order: { findUnique: jest.Mock; updateMany: jest.Mock; update: jest.Mock };
  payment: { updateMany: jest.Mock };
  commissionLedger: { deleteMany: jest.Mock };
  riderTripLedger: { deleteMany: jest.Mock };
  coupon: { updateMany: jest.Mock };
  user: { findUnique: jest.Mock };
  vendorStaff: { findMany: jest.Mock };
  $transaction: jest.Mock;
};

type MockPaymentsService = {
  refundForOrder: jest.Mock;
};

type MockRedis = {
  del: jest.Mock;
  set: jest.Mock;
  get: jest.Mock;
  acquireLock: jest.Mock;
  releaseLock: jest.Mock;
};

type MockTrackingGateway = {
  emitToOrderRoom: jest.Mock;
  emitToAdmin: jest.Mock;
  notifyOrderStatusChanged?: jest.Mock;
};

describe('OrderService - Security Scoping & Cancellation State Claims', () => {
  let orderService: OrderService;
  let prisma: MockPrisma;
  let paymentsService: MockPaymentsService;
  let redis: MockRedis;
  let trackingGateway: MockTrackingGateway;
  let notificationsService: { sendToUser: jest.Mock };
  let orderFlowService: Record<string, unknown>;

  beforeEach(() => {
    prisma = {
      order: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
      },
      payment: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      commissionLedger: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
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
      vendorStaff: {
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (fn: (tx: MockPrisma) => Promise<unknown>) => fn(prisma)),
    };

    paymentsService = {
      refundForOrder: jest.fn().mockResolvedValue({ success: true, refundId: 'ref-1', raw: {} }),
    };

    redis = {
      del: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
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

    orderFlowService = {};

    orderService = new OrderService(
      prisma as never,
      {} as never, // couponService
      {} as never, // deliveryFeeService
      trackingGateway as never,
      orderFlowService as never,
      redis as never,
      notificationsService as never,
      paymentsService as never,
    );
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

    it('denies unauthorized users from viewing live tracking', async () => {
      prisma.order.findUnique.mockResolvedValue(mockOrder);

      await expect(
        orderService.getLiveTracking('order-100', 'customer-other', UserRole.CUSTOMER),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        orderService.getLiveTracking('order-100', 'rider-other-user', UserRole.RIDER),
      ).rejects.toThrow(ForbiddenException);
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
});
