import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccountStatus, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { OrderFlowService } from './order-flow.service';
import { OrderFlowMode } from './dto/update-order-flow.dto';

type MockTx = {
  order: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe('OrderFlowService - claimOrder', () => {
  let service: OrderFlowService;
  let mockPrisma: {
    rider: { findUnique: jest.Mock };
    systemSetting: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    acquireLock: jest.Mock;
    releaseLock: jest.Mock;
  };
  let mockTrackingGateway: {
    notifyOrderStatusChanged: jest.Mock;
    notifyNewOrder: jest.Mock;
    broadcastDispatch: jest.Mock;
  };
  let mockDeliveryFeeService: {
    getEconomicsConfig: jest.Mock;
  };
  let mockNotificationsService: {
    sendToUser: jest.Mock;
    sendToRole: jest.Mock;
  };

  const defaultRider = {
    id: 'rider-uuid-1',
    userId: 'user-uuid-1',
    isOnline: true,
    isApproved: true,
    cashInHand: 1000.0,
    maxCashLimit: 5000.0,
    user: {
      fullName: 'John Rider',
      phone: '+8801711111111',
      status: AccountStatus.ACTIVE,
    },
  };

  const defaultOrder = {
    id: 'order-uuid-1',
    orderNumber: 'ORD-1001',
    customerId: 'cust-uuid-1',
    vendorId: 'vendor-uuid-1',
    riderId: null as string | null,
    status: OrderStatus.PLACED,
    paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    paymentStatus: PaymentStatus.PENDING,
    totalAmount: 1500.0,
    deliveryFee: 60.0,
    customerNotes: 'Handle with care',
    placedAt: new Date(),
    vendor: { id: 'vendor-uuid-1', name: 'Tasty Burger', addressText: 'Dhanmondi' },
    orderItems: [{ productNameSnapshot: 'Burger', quantity: 2 }],
  };

  beforeEach(() => {
    mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      acquireLock: jest.fn().mockResolvedValue(true),
      releaseLock: jest.fn().mockResolvedValue(1),
    };

    mockTrackingGateway = {
      notifyOrderStatusChanged: jest.fn(),
      notifyNewOrder: jest.fn(),
      broadcastDispatch: jest.fn(),
    };

    mockDeliveryFeeService = {
      getEconomicsConfig: jest.fn().mockResolvedValue({ rider_share_percent: 80 }),
    };

    mockNotificationsService = {
      sendToUser: jest.fn().mockResolvedValue(true),
      sendToRole: jest.fn().mockResolvedValue(true),
    };

    mockPrisma = {
      rider: {
        findUnique: jest.fn().mockResolvedValue({ ...defaultRider }),
      },
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue({
          value: { mode: OrderFlowMode.RIDER_FIRST, rider_search_timeout_seconds: 45 },
        }),
      },
      $transaction: jest.fn(async (cb: (tx: MockTx) => Promise<unknown>) => {
        const tx: MockTx = {
          order: {
            findUnique: jest.fn().mockResolvedValue({ ...defaultOrder }),
            update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
              ...defaultOrder,
              ...data,
            })),
          },
        };
        return cb(tx);
      }),
    };

    service = new OrderFlowService(
      mockPrisma as never,
      mockRedis as never,
      mockTrackingGateway as never,
      mockDeliveryFeeService as never,
      mockNotificationsService as never,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('rejects claim if rider is offline', async () => {
    mockPrisma.rider.findUnique.mockResolvedValue({ ...defaultRider, isOnline: false });

    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects claim if rider is not approved by admin', async () => {
    mockPrisma.rider.findUnique.mockResolvedValue({ ...defaultRider, isApproved: false });

    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      'Rider account is pending admin approval',
    );
  });

  it('rejects claim if rider user account is suspended or inactive', async () => {
    mockPrisma.rider.findUnique.mockResolvedValue({
      ...defaultRider,
      user: { ...defaultRider.user, status: AccountStatus.SUSPENDED },
    });

    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      'Rider account is suspended or inactive',
    );
  });

  it('rejects claim if rider already has an active assigned delivery trip', async () => {
    mockRedis.get.mockResolvedValue('existing-order-id');

    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      'You already have an active assigned delivery trip',
    );
  });

  it('rejects claim if another rider holds the claim mutex lock', async () => {
    mockRedis.acquireLock.mockResolvedValue(false);

    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects claim if order is not found', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: MockTx) => Promise<unknown>) => {
      const tx: MockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      };
      return cb(tx);
    });

    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      NotFoundException,
    );
    expect(mockRedis.releaseLock).toHaveBeenCalledWith('lock:order_claim:order-uuid-1', 'rider-uuid-1');
  });

  it('rejects claim if order already has a rider assigned', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: MockTx) => Promise<unknown>) => {
      const tx: MockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({ ...defaultOrder, riderId: 'other-rider' }),
          update: jest.fn(),
        },
      };
      return cb(tx);
    });

    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects claim if order total would exceed rider maxCashLimit for CASH_ON_DELIVERY', async () => {
    mockPrisma.rider.findUnique.mockResolvedValue({
      ...defaultRider,
      cashInHand: 4500.0,
      maxCashLimit: 5000.0,
    });

    // defaultOrder total is 1500; 4500 + 1500 = 6000 > 5000
    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('allows claim if order exceeds cash limit but payment method is ONLINE_GATEWAY (prepaid)', async () => {
    mockPrisma.rider.findUnique.mockResolvedValue({
      ...defaultRider,
      cashInHand: 4500.0,
      maxCashLimit: 5000.0,
    });

    mockPrisma.$transaction.mockImplementation(async (cb: (tx: MockTx) => Promise<unknown>) => {
      const tx: MockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({
            ...defaultOrder,
            paymentMethod: PaymentMethod.ONLINE_GATEWAY,
            paymentStatus: PaymentStatus.PAID,
            totalAmount: 1500.0,
          }),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
            ...defaultOrder,
            paymentMethod: PaymentMethod.ONLINE_GATEWAY,
            paymentStatus: PaymentStatus.PAID,
            ...data,
          })),
        },
      };
      return cb(tx);
    });

    const result = await service.claimOrder('user-uuid-1', 'order-uuid-1');
    expect(result.riderId).toBe('rider-uuid-1');
    expect(mockRedis.set).toHaveBeenCalledWith('rider:active_order:rider-uuid-1', 'order-uuid-1');
  });

  it('successfully claims order in RIDER_FIRST mode, sets Redis key post-transaction, and notifies', async () => {
    const result = await service.claimOrder('user-uuid-1', 'order-uuid-1');

    expect(result.riderId).toBe('rider-uuid-1');
    expect(result.status).toBe(OrderStatus.RIDER_ASSIGNED);
    expect(mockRedis.set).toHaveBeenCalledWith('rider:active_order:rider-uuid-1', 'order-uuid-1');
    expect(mockTrackingGateway.notifyOrderStatusChanged).toHaveBeenCalled();
    expect(mockTrackingGateway.notifyNewOrder).toHaveBeenCalled();
    expect(mockNotificationsService.sendToUser).toHaveBeenCalled();
    expect(mockRedis.releaseLock).toHaveBeenCalledWith('lock:order_claim:order-uuid-1', 'rider-uuid-1');
  });
});
