import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccountStatus, OrderFlowMode, OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@prisma/client';
import { OrderFlowService } from './order-flow.service';


type MockTx = {
  order: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany?: jest.Mock;
    findUniqueOrThrow?: jest.Mock;
  };
};

describe('OrderFlowService - claimOrder', () => {
  let service: OrderFlowService;
  let mockPrisma: {
    rider: { findUnique: jest.Mock };
    systemSetting: { findUnique: jest.Mock; upsert?: jest.Mock };
    $transaction: jest.Mock;
  };
  let mockRedis: {
    get: jest.Mock;
    mget?: jest.Mock;
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
    orderFlowMode: OrderFlowMode.RIDER_FIRST,
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
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
              ...defaultOrder,
              ...data,
            })),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({
              ...defaultOrder,
              status: OrderStatus.RIDER_ASSIGNED,
              riderId: 'rider-uuid-1',
            }),
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

  it('rejects claim via the DB backstop when the rider has an in-flight order but the Redis marker was lost', async () => {
    // The Redis busy key can be evicted or lost across a crash between commit
    // and SET — the database check inside the transaction must still refuse.
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: MockTx) => Promise<unknown>) => {
      const tx: MockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({ ...defaultOrder }),
          findFirst: jest.fn().mockResolvedValue({ orderNumber: 'ORD-OLD-1' }),
          update: jest.fn(),
        },
      };
      return cb(tx);
    });

    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      'You already have an active delivery trip (Order #ORD-OLD-1)',
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
          findFirst: jest.fn().mockResolvedValue(null),
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
          findFirst: jest.fn().mockResolvedValue(null),
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
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
            ...defaultOrder,
            paymentMethod: PaymentMethod.ONLINE_GATEWAY,
            paymentStatus: PaymentStatus.PAID,
            ...data,
          })),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            ...defaultOrder,
            paymentMethod: PaymentMethod.ONLINE_GATEWAY,
            paymentStatus: PaymentStatus.PAID,
            riderId: 'rider-uuid-1',
            status: OrderStatus.RIDER_ASSIGNED,
          }),
        },
      };
      return cb(tx);
    });

    const result = await service.claimOrder('user-uuid-1', 'order-uuid-1');
    expect(result.riderId).toBe('rider-uuid-1');
    expect(mockRedis.set).toHaveBeenCalledWith('rider:active_order:rider-uuid-1', 'order-uuid-1');
  });

  it('throws ConflictException if concurrent racer claims order first (updateMany count 0)', async () => {
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: MockTx) => Promise<unknown>) => {
      const tx: MockTx = {
        order: {
          findUnique: jest.fn().mockResolvedValue({ ...defaultOrder }),
          findFirst: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
          findUniqueOrThrow: jest.fn(),
        },
      };
      return cb(tx);
    });

    await expect(service.claimOrder('user-uuid-1', 'order-uuid-1')).rejects.toThrow(
      'This order has already been secured by another delivery rider.',
    );
  });

  it('setDispatchConfig returns camelCase config matching frontend expectations', async () => {
    mockPrisma.systemSetting.upsert = jest.fn().mockResolvedValue({
      value: {
        rider_search_timeout_seconds: 120,
        stale_order_ttl_minutes: 45,
      },
    });

    const result = await service.setDispatchConfig({
      riderSearchTimeoutSeconds: 120,
      staleOrderTtlMinutes: 45,
    });

    expect(result).toEqual({
      riderSearchTimeoutSeconds: 120,
      staleOrderTtlMinutes: 45,
    });
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

function buildDispatchService(options: {
  flowMode?: OrderFlowMode;
  riderSearchTimeoutSeconds?: number;
  order?: Record<string, unknown> | null;
}) {
  const placedOrder = {
    id: 'order-uuid-1',
    orderNumber: 'ORD-1001',
    customerId: 'cust-uuid-1',
    vendorId: 'vendor-uuid-1',
    riderId: null as string | null,
    status: OrderStatus.PLACED,
    orderFlowMode: options.flowMode ?? OrderFlowMode.RIDER_FIRST,
    paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    paymentStatus: PaymentStatus.PENDING,
    totalAmount: 1500.0,
    deliveryFee: 60.0,
    customerNotes: null,
    placedAt: new Date(),
    deliveryAddressSnapshot: {
      addressLine: 'House 10, Road 5, Dhanmondi',
      latitude: 23.7461,
      longitude: 90.376,
    },
    vendor: {
      id: 'vendor-uuid-1',
      name: 'Tasty Burger',
      addressText: 'Dhanmondi',
      latitude: 23.7925,
      longitude: 90.4141,
    },
    orderItems: [{ productNameSnapshot: 'Burger', quantity: 2 }],
    couponId: null,
  };

  const prisma = {
    order: {
      findUnique: jest.fn().mockResolvedValue(
        options.order === undefined ? placedOrder : { ...placedOrder, ...options.order },
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
    rider: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    systemSetting: {
      findUnique: jest.fn().mockResolvedValue({
        value: {
          rider_search_timeout_seconds: options.riderSearchTimeoutSeconds ?? 90,
          stale_order_ttl_minutes: 60,
        },
      }),
    },
  };
  const redis = {
    get: jest.fn().mockResolvedValue(null),
    mget: jest.fn().mockResolvedValue([]),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    geoadd: jest.fn().mockResolvedValue(1),
    geosearch: jest.fn().mockResolvedValue([]),
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(1),
  };
  const trackingGateway = {
    notifyOrderStatusChanged: jest.fn(),
    notifyNewOrder: jest.fn(),
    broadcastDispatch: jest.fn(),
    notifyDispatchEscalated: jest.fn(),
  };
  const deliveryFeeService = {
    getEconomicsConfig: jest.fn().mockResolvedValue({ rider_share_percent: 80 }),
  };
  const notificationsService = {
    sendToUser: jest.fn().mockResolvedValue(true),
    sendToUsers: jest.fn().mockResolvedValue(1),
    sendToRole: jest.fn().mockResolvedValue(1),
  };

  const service = new OrderFlowService(
    prisma as never,
    redis as never,
    trackingGateway as never,
    deliveryFeeService as never,
    notificationsService as never,
  );

  return { service, prisma, redis, trackingGateway, deliveryFeeService, notificationsService, placedOrder };
}

describe('OrderFlowService - handleOrderPlaced dispatch routing', () => {
  afterEach(() => {
    serviceTeardown();
  });

  let activeService: OrderFlowService | null = null;
  function serviceTeardown() {
    activeService?.onModuleDestroy();
    activeService = null;
  }
  function track(service: OrderFlowService) {
    activeService = service;
    return service;
  }

  it('ignores orders that are no longer PLACED (idempotent re-delivery)', async () => {
    const built = buildDispatchService({
      order: { status: OrderStatus.RIDER_ASSIGNED, paymentMethod: PaymentMethod.CASH_ON_DELIVERY },
    });
    track(built.service);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
    expect(built.trackingGateway.notifyNewOrder).not.toHaveBeenCalled();
  });

  it('withholds all dispatch for unpaid ONLINE_GATEWAY orders until the webhook confirms', async () => {
    const built = buildDispatchService({
      order: { paymentMethod: PaymentMethod.ONLINE_GATEWAY, paymentStatus: PaymentStatus.PENDING },
    });
    track(built.service);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
    expect(built.trackingGateway.notifyNewOrder).not.toHaveBeenCalled();
    expect(built.notificationsService.sendToRole).not.toHaveBeenCalled();
  });

  it('routes TAKEAWAY orders to the kitchen only and never broadcasts to riders', async () => {
    const built = buildDispatchService({
      order: {
        deliveryAddressSnapshot: { deliveryMethod: 'TAKEAWAY' },
      },
    });
    track(built.service);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.trackingGateway.notifyNewOrder).toHaveBeenCalledTimes(1);
    expect(built.trackingGateway.notifyNewOrder).toHaveBeenCalledWith('vendor-uuid-1', expect.anything());
    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
  });

  it('recognizes legacy takeaway snapshots that only carry the `type` field', async () => {
    // Regression: snapshots written before `deliveryMethod` existed only set
    // `type: 'TAKEAWAY'` — the dispatch engine must still honor them.
    const built = buildDispatchService({
      order: {
        deliveryAddressSnapshot: { type: 'TAKEAWAY', vendorAddress: 'Road 12' },
      },
    });
    track(built.service);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.trackingGateway.notifyNewOrder).toHaveBeenCalledTimes(1);
    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
  });

  it('recognizes the exact snapshot shape checkout writes (type + deliveryMethod)', async () => {
    const built = buildDispatchService({
      order: {
        deliveryAddressSnapshot: {
          type: 'TAKEAWAY',
          deliveryMethod: 'TAKEAWAY',
          vendorAddress: 'House 5, Road 12',
        },
      },
    });
    track(built.service);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.trackingGateway.notifyNewOrder).toHaveBeenCalledTimes(1);
    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
  });

  it('sends courier push to nearby riders only when the geo index has candidates', async () => {
    const built = buildDispatchService({});
    track(built.service);
    built.redis.geosearch.mockResolvedValue([['rider-near', '1.4']]);
    built.prisma.rider.findUnique.mockResolvedValue({ isOnline: true });
    built.prisma.rider.findMany.mockResolvedValue([{ id: 'rider-near', userId: 'user-near' }]);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.notificationsService.sendToUsers).toHaveBeenCalledWith(
      ['user-near'],
      expect.objectContaining({ data: expect.objectContaining({ orderId: 'order-uuid-1' }) }),
    );
    expect(built.notificationsService.sendToRole).not.toHaveBeenCalled();
  });

  it('falls back to a role-wide courier push when the geo index is empty', async () => {
    const built = buildDispatchService({});
    track(built.service);
    built.redis.geosearch.mockResolvedValue([]);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.notificationsService.sendToRole).toHaveBeenCalledWith(
      UserRole.RIDER,
      expect.objectContaining({ data: expect.objectContaining({ orderId: 'order-uuid-1' }) }),
    );
    expect(built.notificationsService.sendToUsers).not.toHaveBeenCalled();
  });

  it('RIDER_FIRST: broadcasts to the rider pool with server-computed earnings and holds the vendor chime', async () => {
    const built = buildDispatchService({});
    track(built.service);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.trackingGateway.broadcastDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order-uuid-1',
        riderEarnings: 48, // 60 BDT fee × 80% rider share
        timeoutSeconds: 90,
        isCod: true,
        distanceKm: 6.5,
      }),
    );
    expect(built.trackingGateway.notifyNewOrder).not.toHaveBeenCalled();
    expect(built.notificationsService.sendToRole).toHaveBeenCalledWith(
      UserRole.RIDER,
      expect.objectContaining({ data: { orderId: 'order-uuid-1', type: 'DISPATCH_BROADCAST' } }),
    );
  });

  it('RIDER_FIRST: omits distanceKm when the address snapshot has no coordinates', async () => {
    const built = buildDispatchService({
      order: { deliveryAddressSnapshot: { addressLine: 'No coords' } },
    });
    track(built.service);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.trackingGateway.broadcastDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ deliveryArea: 'No coords' }),
    );
    const call = built.trackingGateway.broadcastDispatch.mock.calls[0][0] as Record<string, unknown>;
    expect(call.distanceKm).toBeUndefined();
  });

  it('VENDOR_FIRST: alerts the kitchen immediately without rider broadcast', async () => {
    const built = buildDispatchService({ flowMode: OrderFlowMode.VENDOR_FIRST });
    track(built.service);

    await built.service.handleOrderPlaced('order-uuid-1');

    expect(built.trackingGateway.notifyNewOrder).toHaveBeenCalledTimes(1);
    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
  });

  it('survives push-notification failure without breaking dispatch broadcast', async () => {
    const built = buildDispatchService({});
    track(built.service);
    built.notificationsService.sendToRole.mockRejectedValue(new Error('FCM down'));

    await expect(built.service.handleOrderPlaced('order-uuid-1')).resolves.toBeUndefined();
    expect(built.trackingGateway.broadcastDispatch).toHaveBeenCalledTimes(1);
  });
});

describe('OrderFlowService - handleOrderReady (VENDOR_FIRST rider broadcast)', () => {
  it('broadcasts to riders only in VENDOR_FIRST mode when no rider is assigned', async () => {
    const built = buildDispatchService({
      flowMode: OrderFlowMode.VENDOR_FIRST,
      order: { status: OrderStatus.READY_FOR_PICKUP },
    });
    built.service.onModuleInit();

    await built.service.handleOrderReady('order-uuid-1');
    built.service.onModuleDestroy();

    expect(built.trackingGateway.broadcastDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-uuid-1', riderEarnings: 48 }),
    );
  });

  it('skips broadcast when a rider is already assigned', async () => {
    const built = buildDispatchService({
      flowMode: OrderFlowMode.VENDOR_FIRST,
      order: { status: OrderStatus.READY_FOR_PICKUP, riderId: 'rider-1' },
    });
    built.service.onModuleInit();

    await built.service.handleOrderReady('order-uuid-1');
    built.service.onModuleDestroy();

    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
  });

  it('skips TAKEAWAY orders on ready', async () => {
    const built = buildDispatchService({
      flowMode: OrderFlowMode.VENDOR_FIRST,
      order: {
        status: OrderStatus.READY_FOR_PICKUP,
        deliveryAddressSnapshot: { deliveryMethod: 'TAKEAWAY' },
      },
    });
    built.service.onModuleInit();

    await built.service.handleOrderReady('order-uuid-1');
    built.service.onModuleDestroy();

    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
  });

  it('does not rebroadcast in RIDER_FIRST mode (broadcast already happened at placement)', async () => {
    const built = buildDispatchService({ flowMode: OrderFlowMode.RIDER_FIRST });
    built.service.onModuleInit();

    await built.service.handleOrderReady('order-uuid-1');
    built.service.onModuleDestroy();

    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
  });
});

describe('OrderFlowService - dispatch timing config and rider proximity', () => {
  it('defaults to a 90s search timeout and 60min stale TTL when no setting exists', async () => {
    const built = buildDispatchService({});
    built.prisma.systemSetting.findUnique.mockResolvedValue(null);
    built.service.onModuleInit();

    const config = await built.service.getDispatchConfig();
    built.service.onModuleDestroy();

    expect(config).toEqual({
      riderSearchTimeoutSeconds: 90,
      staleOrderTtlMinutes: 60,
    });
  });

  it('filters nearby riders by busy state and database online flag', async () => {
    const built = buildDispatchService({});
    built.service.onModuleInit();
    built.redis.geosearch.mockResolvedValue([
      ['rider-free', '1.2'],
      ['rider-busy', '0.5'],
      ['rider-offline', '2.0'],
    ]);
    built.redis.mget.mockImplementation(async (keys: string[]) =>
      keys.map((k) => (k === 'rider:active_order:rider-busy' ? 'order-x' : null)),
    );
    built.prisma.rider.findMany.mockResolvedValue([
      { id: 'rider-free' },
    ]);

    const riders = await built.service.findNearbyAvailableRiders(23.7925, 90.4141, 5);
    built.service.onModuleDestroy();

    expect(riders).toEqual([{ riderId: 'rider-free', distanceKm: 1.2 }]);
  });

  it('updates the Redis spatial index for rider GPS ticks', async () => {
    const built = buildDispatchService({});
    built.service.onModuleInit();

    await built.service.updateRiderLocation('rider-1', 23.7925, 90.4141);
    built.service.onModuleDestroy();

    expect(built.redis.geoadd).toHaveBeenCalledWith('riders:locations:active', 90.4141, 23.7925, 'rider-1');
  });
});

describe('OrderFlowService - evaluateDispatchEscalations (Tier 1 & Tier 2)', () => {
  function buildEscalation(options: {
    agingSeconds: number;
    tier1Key?: string | null;
    tier2Key?: string | null;
    riderSearchTimeoutSeconds?: number;
  }) {
    const built = buildDispatchService({
      riderSearchTimeoutSeconds: options.riderSearchTimeoutSeconds ?? 90,
    });
    const agedOrder = {
      ...built.placedOrder,
      placedAt: new Date(Date.now() - options.agingSeconds * 1000),
    };
    built.prisma.order.findMany.mockResolvedValue([agedOrder]);
    built.redis.get.mockImplementation(async (key: string) => {
      if (key === 'dispatch:escalated:order-uuid-1:tier1') return options.tier1Key ?? null;
      if (key === 'dispatch:escalated:order-uuid-1:tier2') return options.tier2Key ?? null;
      return null;
    });
    built.service.onModuleInit();
    return { ...built, agedOrder };
  }

  it('emits Tier 1 (radius expansion) once for an order aging past the timeout', async () => {
    const built = buildEscalation({ agingSeconds: 100, tier1Key: null });

    await built.service.evaluateDispatchEscalations();
    built.service.onModuleDestroy();

    expect(built.trackingGateway.broadcastDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 'order-uuid-1', searchRadiusKm: 6 }),
    );
    expect(built.trackingGateway.notifyDispatchEscalated).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 1, searchRadiusKm: 6 }),
    );
    // Dedup marker written before broadcasting so replays cannot double-fire
    expect(built.redis.set).toHaveBeenCalledWith('dispatch:escalated:order-uuid-1:tier1', '1', 3600);
  });

  it('does not re-emit Tier 1 when the escalation marker already exists', async () => {
    const built = buildEscalation({ agingSeconds: 100, tier1Key: '1' });

    await built.service.evaluateDispatchEscalations();
    built.service.onModuleDestroy();

    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
    expect(built.trackingGateway.notifyDispatchEscalated).not.toHaveBeenCalled();
  });

  it('emits Tier 2 (admin critical alert) once past double the timeout', async () => {
    const built = buildEscalation({ agingSeconds: 200, tier1Key: '1', tier2Key: null });

    await built.service.evaluateDispatchEscalations();
    built.service.onModuleDestroy();

    expect(built.trackingGateway.notifyDispatchEscalated).toHaveBeenCalledWith(
      expect.objectContaining({ tier: 2, searchRadiusKm: 10 }),
    );
    expect(built.redis.set).toHaveBeenCalledWith('dispatch:escalated:order-uuid-1:tier2', '1', 3600);
  });

  it('skips TAKEAWAY orders entirely during escalation sweeps', async () => {
    const built = buildDispatchService({ riderSearchTimeoutSeconds: 90 });
    built.prisma.order.findMany.mockResolvedValue([
      { ...built.placedOrder, deliveryAddressSnapshot: { deliveryMethod: 'TAKEAWAY' } },
    ]);
    built.service.onModuleInit();

    await built.service.evaluateDispatchEscalations();
    built.service.onModuleDestroy();

    expect(built.redis.set).not.toHaveBeenCalled();
    expect(built.trackingGateway.notifyDispatchEscalated).not.toHaveBeenCalled();
  });

  it('leaves orders within the timeout window untouched', async () => {
    const built = buildEscalation({ agingSeconds: 30 });

    await built.service.evaluateDispatchEscalations();
    built.service.onModuleDestroy();

    expect(built.trackingGateway.broadcastDispatch).not.toHaveBeenCalled();
    expect(built.trackingGateway.notifyDispatchEscalated).not.toHaveBeenCalled();
  });
});
