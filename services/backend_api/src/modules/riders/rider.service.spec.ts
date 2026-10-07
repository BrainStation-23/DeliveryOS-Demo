import { OrderStatus, PaymentMethod, PaymentStatus, Prisma, SettlementStatus } from '@prisma/client';
import { startOfRegionToday } from '../../common/utils/region-time';
import { RiderService } from './rider.service';

type MockPrisma = {
  rider: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  order: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
    findUniqueOrThrow: jest.Mock;
    count: jest.Mock;
  };
  riderTripLedger: {
    upsert: jest.Mock;
    aggregate: jest.Mock;
  };
  $transaction: jest.Mock;
};

type MockRedis = {
  get: jest.Mock;
  set: jest.Mock;
  del: jest.Mock;
  geoadd: jest.Mock;
  zrem: jest.Mock;
};

type MockTrackingGateway = {
  notifyOrderStatusChanged: jest.Mock;
  server: {
    to: jest.Mock;
  };
};

type MockOrderFlowService = {
  handleOrderReady: jest.Mock;
  releaseRiderActiveTrip: jest.Mock;
};

type MockDeliveryFeeService = {
  getEconomicsConfig: jest.Mock;
};

describe('RiderService - Phase 2 Operations & Dispatch Integrity', () => {
  let service: RiderService;
  let prisma: MockPrisma;
  let redis: MockRedis;
  let trackingGateway: MockTrackingGateway;
  let orderFlowService: MockOrderFlowService;
  let deliveryFeeService: MockDeliveryFeeService;
  let mockEmit: jest.Mock;

  beforeEach(() => {
    prisma = {
      rider: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      riderTripLedger: {
        upsert: jest.fn(),
        aggregate: jest.fn().mockResolvedValue({ _sum: { deliveryEarnings: 0 } }),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prisma)),
    };

    redis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn().mockResolvedValue(1),
      geoadd: jest.fn().mockResolvedValue(1),
      zrem: jest.fn().mockResolvedValue(1),
    };

    mockEmit = jest.fn();
    trackingGateway = {
      notifyOrderStatusChanged: jest.fn(),
      server: {
        to: jest.fn().mockReturnValue({ emit: mockEmit }),
      },
    };

    orderFlowService = {
      handleOrderReady: jest.fn().mockResolvedValue(undefined),
      releaseRiderActiveTrip: jest.fn().mockResolvedValue(undefined),
    };

    deliveryFeeService = {
      getEconomicsConfig: jest.fn().mockResolvedValue({ rider_share_percent: 80 }),
    };

    service = new RiderService(
      prisma as never,
      redis as never,
      trackingGateway as never,
      orderFlowService as never,
      deliveryFeeService as never,
    );
  });

  describe('Step 2.1: reportDeliveryIssue (Dead-End DISPATCHED Order Recovery)', () => {
    it('reverts order to READY_FOR_PICKUP, clears riderId, logs reason, and triggers re-dispatch', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        user: { fullName: 'Rahim Courier', status: 'ACTIVE' },
      });

      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-101',
        status: OrderStatus.DISPATCHED,
        riderId: 'rider-1',
        customerId: 'customer-1',
        vendorId: 'vendor-1',
      });

      prisma.order.update.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-101',
        status: OrderStatus.READY_FOR_PICKUP,
        riderId: null,
      });

      const result = await service.reportDeliveryIssue(
        'user-rider-1',
        'order-1',
        'Flat tire on vehicle',
      );

      expect(result.order.status).toBe(OrderStatus.READY_FOR_PICKUP);
      expect(prisma.order.update).toHaveBeenCalledWith({
        // Conditional on the observed status: a concurrent cancellation wins
        // (P2025) instead of being resurrected by a stale issue report.
        where: { id: 'order-1', status: OrderStatus.DISPATCHED },
        data: {
          riderId: null,
          status: OrderStatus.READY_FOR_PICKUP,
          rejectionReason: 'Delivery issue reported by rider Rahim Courier: Flat tire on vehicle',
        },
      });

      // Verify Redis busy lock is released
      expect(orderFlowService.releaseRiderActiveTrip).toHaveBeenCalledWith('rider-1');

      // Verify realtime status change broadcast
      expect(trackingGateway.notifyOrderStatusChanged).toHaveBeenCalledWith(
        'order-1',
        'customer-1',
        OrderStatus.DISPATCHED,
        OrderStatus.READY_FOR_PICKUP,
        {
          reason: 'Flat tire on vehicle',
          riderId: null,
          vendorId: 'vendor-1',
        },
      );

      // Verify admin dispatch room notification
      expect(trackingGateway.server.to).toHaveBeenCalledWith('admin_hq');
      expect(mockEmit).toHaveBeenCalledWith('order:delivery_failed', expect.objectContaining({
        orderId: 'order-1',
        orderNumber: 'ORD-101',
        riderName: 'Rahim Courier',
        reason: 'Flat tire on vehicle',
      }));

      // Verify re-dispatch to riders pool
      expect(orderFlowService.handleOrderReady).toHaveBeenCalledWith('order-1');
    });
  });

  describe('Step 2.2: getActiveTrip (In-Flight Trip Rehydration)', () => {
    it('returns the active order for the authenticated courier', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
      });

      prisma.order.findFirst.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-101',
        status: OrderStatus.DISPATCHED,
        riderId: 'rider-1',
        totalAmount: 500,
        deliveryFee: 60,
        vendor: { id: 'vendor-1', name: "Kacchi Bhai" },
        customer: { fullName: 'Imam Hossain', phone: '+8801700000000' },
      });

      const activeTrip = await service.getActiveTrip('user-rider-1');

      expect(activeTrip).toBeDefined();
      expect(activeTrip?.id).toBe('order-1');
      expect(prisma.order.findFirst).toHaveBeenCalledWith({
        where: {
          riderId: 'rider-1',
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
          customer: { select: { fullName: true, phone: true } },
          orderItems: {
            select: {
              id: true,
              productNameSnapshot: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
        orderBy: { placedAt: 'desc' },
      });
    });

    it('returns null if courier has no in-flight orders', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
      });

      prisma.order.findFirst.mockResolvedValue(null);

      const activeTrip = await service.getActiveTrip('user-rider-1');
      expect(activeTrip).toBeNull();
    });
  });

  describe('Step 2.4: toggleDuty (Telemetry Sync)', () => {
    it('updates duty state and records GPS coordinates in DB and Redis Geospatial index', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        isApproved: true,
        user: { status: 'ACTIVE' },
      });

      prisma.rider.update.mockResolvedValue({
        id: 'rider-1',
        isOnline: true,
        latitude: 23.7925,
        longitude: 90.4078,
      });

      const updated = await service.toggleDuty('user-rider-1', {
        isOnline: true,
        latitude: 23.7925,
        longitude: 90.4078,
        speed: 15.5,
      });

      expect(updated.isOnline).toBe(true);
      expect(prisma.rider.update).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        data: {
          isOnline: true,
          latitude: 23.7925,
          longitude: 90.4078,
        },
      });

      // Verify Redis geospatial index update
      expect(redis.geoadd).toHaveBeenCalledWith(
        'riders:locations:active',
        90.4078,
        23.7925,
        'rider-1',
      );
    });

    it('removes rider from riders:locations:active when toggled offline', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        isApproved: true,
        user: { status: 'ACTIVE' },
      });

      prisma.rider.update.mockResolvedValue({
        id: 'rider-1',
        isOnline: false,
      });

      const updated = await service.toggleDuty('user-rider-1', { isOnline: false });

      expect(updated.isOnline).toBe(false);
      expect(redis.zrem).toHaveBeenCalledWith('riders:locations:active', 'rider-1');
    });
  });

  describe('Step 2.5: pickupOrder (assignment guard + conditional update)', () => {
    it('rejects pickup when the order has no assigned rider (scoop guard)', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        user: { fullName: 'Rahim Courier', status: 'ACTIVE' },
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.READY_FOR_PICKUP,
        riderId: null,
      });

      await expect(service.pickupOrder('user-rider-1', 'order-1')).rejects.toThrow(
        'You are not the assigned rider for this order',
      );
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('rejects pickup when the order belongs to another rider', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        user: { fullName: 'Rahim Courier', status: 'ACTIVE' },
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.READY_FOR_PICKUP,
        riderId: 'rider-2',
      });

      await expect(service.pickupOrder('user-rider-1', 'order-1')).rejects.toThrow(
        'You are not the assigned rider for this order',
      );
      expect(prisma.order.update).not.toHaveBeenCalled();
    });

    it('confirms pickup for the assigned rider with a status-conditional update', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        user: { fullName: 'Rahim Courier', status: 'ACTIVE' },
      });
      prisma.order.findUnique.mockResolvedValue({
        id: 'order-1',
        orderNumber: 'ORD-101',
        status: OrderStatus.READY_FOR_PICKUP,
        riderId: 'rider-1',
        customerId: 'customer-1',
        vendorId: 'vendor-1',
      });
      prisma.order.update.mockResolvedValue({
        id: 'order-1',
        status: OrderStatus.DISPATCHED,
      });

      const updated = await service.pickupOrder('user-rider-1', 'order-1');
      expect(updated.status).toBe(OrderStatus.DISPATCHED);
      expect(prisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order-1', status: OrderStatus.READY_FOR_PICKUP },
        }),
      );
    });
  });

  describe('Step 2.6: toggleDuty offline lock (full in-flight set)', () => {
    it('blocks going offline while an assigned order is still PREPARING', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        isApproved: true,
        isOnline: true,
        user: { status: 'ACTIVE' },
      });
      prisma.order.findFirst.mockResolvedValue({
        id: 'order-9',
        orderNumber: 'ORD-909',
        status: OrderStatus.PREPARING,
      });

      await expect(
        service.toggleDuty('user-rider-1', { isOnline: false }),
      ).rejects.toThrow('Cannot go offline while you have an active in-flight delivery');
      expect(prisma.rider.update).not.toHaveBeenCalled();
    });
  });

  describe('deliverOrder (COD Collection & Settlement)', () => {
    const mockOrder = {
      id: 'order-1',
      orderNumber: 'ORD-101',
      riderId: 'rider-1',
      status: OrderStatus.DISPATCHED,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      paymentStatus: PaymentStatus.PENDING,
      totalAmount: 500.0,
      deliveryFee: 50.0,
      customerId: 'customer-1',
      vendorId: 'vendor-1',
    };

    beforeEach(() => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        isApproved: true,
        user: { status: 'ACTIVE' },
      });
      prisma.order.findUnique.mockResolvedValue(mockOrder);
      prisma.order.updateMany.mockResolvedValue({ count: 1 });
      prisma.order.findUniqueOrThrow.mockResolvedValue({
        ...mockOrder,
        status: OrderStatus.DELIVERED,
        paymentStatus: PaymentStatus.PAID,
      });
      prisma.riderTripLedger.upsert.mockResolvedValue({
        orderId: 'order-1',
        riderId: 'rider-1',
        deliveryEarnings: 40,
        codCollected: 500,
        status: SettlementStatus.PENDING,
      });
    });

    it('marks order DELIVERED, marks payment PAID, and increments rider cashInHand on valid COD collection', async () => {
      const result = await service.deliverOrder('user-rider-1', 'order-1', {
        codCashCollected: true,
        amountCollected: 500.0,
      });

      expect(result.order.status).toBe(OrderStatus.DELIVERED);
      expect(prisma.order.updateMany).toHaveBeenCalledWith({
        where: { id: 'order-1', status: OrderStatus.DISPATCHED },
        data: expect.objectContaining({
          status: OrderStatus.DELIVERED,
          paymentStatus: PaymentStatus.PAID,
        }),
      });
      expect(prisma.rider.update).toHaveBeenCalledWith({
        where: { id: 'rider-1' },
        data: {
          cashInHand: { increment: 500 },
        },
      });
      expect(orderFlowService.releaseRiderActiveTrip).toHaveBeenCalledWith('rider-1');
      expect(trackingGateway.notifyOrderStatusChanged).toHaveBeenCalledWith(
        'order-1',
        'customer-1',
        OrderStatus.DISPATCHED,
        OrderStatus.DELIVERED,
        expect.objectContaining({ codCollected: 500 }),
      );
    });

    it('rejects delivery with BadRequestException if codCashCollected is false or 0 on positive COD order', async () => {
      await expect(
        service.deliverOrder('user-rider-1', 'order-1', {
          codCashCollected: false,
        }),
      ).rejects.toThrow('Cash on Delivery orders require positive cash collection confirmation');

      await expect(
        service.deliverOrder('user-rider-1', 'order-1', {
          codCashCollected: true,
          amountCollected: 0,
        }),
      ).rejects.toThrow('Cash on Delivery orders require positive cash collection confirmation');

      expect(prisma.order.updateMany).not.toHaveBeenCalled();
    });

    it('throws ConflictException if order is already delivered (concurrent claim count 0)', async () => {
      prisma.order.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.deliverOrder('user-rider-1', 'order-1', {
          codCashCollected: true,
          amountCollected: 500.0,
        }),
      ).rejects.toThrow('Order is not awaiting delivery confirmation');
    });
  });

  describe('getEarningsSummary (server-truth today/week earnings)', () => {
    it('aggregates today and trailing-7-day windows from trip ledgers over delivered orders', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        user: { fullName: 'Rahim Courier', status: 'ACTIVE' },
      });

      const todayStart = startOfRegionToday();
      const weekStart = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

      prisma.riderTripLedger.aggregate.mockImplementation(
        async (args: { where: { riderId: string; order?: { deliveredAt: { gte: Date } } } }) => {
          if (!args.where.order) {
            // lifetime aggregate from getRiderProfile
            return { _sum: { deliveryEarnings: new Prisma.Decimal('1000') } };
          }
          // The week window opens strictly before today's window.
          if (args.where.order.deliveredAt.gte.getTime() < todayStart.getTime()) {
            return {
              _count: { _all: 21 },
              _sum: { deliveryEarnings: new Prisma.Decimal('845.55'), codCollected: new Prisma.Decimal('3200') },
            };
          }
          return {
            _count: { _all: 3 },
            _sum: { deliveryEarnings: new Prisma.Decimal('120.25'), codCollected: new Prisma.Decimal('500') },
          };
        },
      );

      const summary = await service.getEarningsSummary('user-rider-1');

      expect(summary.today).toEqual({ earnings: 120.25, trips: 3, codCollected: 500 });
      expect(summary.week.earnings).toBe(845.55);
      expect(summary.week.trips).toBe(21);
      expect(summary.week.codCollected).toBe(3200);
      // startOfRegionToday() carries sub-second offset drift between two calls,
      // so compare the service's window origin within a one-second tolerance.
      expect(Math.abs(new Date(summary.week.from).getTime() - weekStart.getTime())).toBeLessThan(1000);
      expect(new Date(summary.week.to).getTime()).toBeLessThanOrEqual(Date.now());
      expect(prisma.riderTripLedger.aggregate).toHaveBeenCalledTimes(3);
    });

    it('returns zeros when the rider has no delivered trips in either window', async () => {
      prisma.rider.findUnique.mockResolvedValue({
        id: 'rider-1',
        userId: 'user-rider-1',
        user: { fullName: 'Rahim Courier', status: 'ACTIVE' },
      });
      prisma.riderTripLedger.aggregate.mockResolvedValue({
        _count: { _all: 0 },
        _sum: { deliveryEarnings: null, codCollected: null },
      });

      const summary = await service.getEarningsSummary('user-rider-1');

      expect(summary.today).toEqual({ earnings: 0, trips: 0, codCollected: 0 });
      expect(summary.week).toMatchObject({ earnings: 0, trips: 0, codCollected: 0 });
    });
  });
});
