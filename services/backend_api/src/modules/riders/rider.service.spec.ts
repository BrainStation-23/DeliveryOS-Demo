import { OrderStatus } from '@prisma/client';
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
  };
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
      },
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
        where: { id: 'order-1' },
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
        'riders:locations',
        90.4078,
        23.7925,
        'rider-1',
      );
    });
  });
});
