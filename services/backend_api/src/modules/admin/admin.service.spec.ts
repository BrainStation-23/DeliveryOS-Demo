import { OrderStatus, PaymentMethod, PaymentStatus, PermissionScope, Prisma, UserRole } from '@prisma/client';
import { AdminService } from './admin.service';
import { GetLiveOrdersQueryDto } from './dto/admin-governance.dto';

type MockPrisma = {
  vendor: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; update: jest.Mock };
  vendorStaff: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
  order: { findUnique: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
  rider: { findUnique: jest.Mock; findMany: jest.Mock };
};

type MockRedis = {
  del: jest.Mock;
};

describe('AdminService - Step 1.6: Idempotent Staff Assignment & Cache Invalidation', () => {
  let service: AdminService;
  let prisma: MockPrisma;
  let redis: MockRedis;

  beforeEach(() => {
    prisma = {
      vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: 'vendor-1', brandId: 'brand-1' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', role: UserRole.CUSTOMER }),
        update: jest.fn().mockResolvedValue({ id: 'user-1', role: UserRole.VENDOR_ADMIN }),
      },
      vendorStaff: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      order: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      rider: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    redis = {
      del: jest.fn().mockResolvedValue(1),
    };

    service = new AdminService(
      prisma as never,
      redis as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { sendToUser: jest.fn().mockResolvedValue(true) } as never,
    );
  });

  it('creates new vendor staff record and invalidates user session cache in Redis', async () => {
    prisma.vendorStaff.findFirst.mockResolvedValue(null);
    prisma.vendorStaff.create.mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      vendorId: 'vendor-1',
      scope: PermissionScope.PARTICULAR_OUTLET,
    });

    const result = await service.assignVendorStaff('vendor-1', {
      userId: 'user-1',
      scope: PermissionScope.PARTICULAR_OUTLET,
    });

    expect(result.id).toBe('staff-1');
    expect(prisma.vendorStaff.create).toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: UserRole.VENDOR_ADMIN },
    });
    // Invariant: auth:user:${userId} must be deleted on role/scope mutation
    expect(redis.del).toHaveBeenCalledWith('auth:user:user-1');
  });

  it('idempotently updates existing vendor staff record without throwing unique constraint error', async () => {
    prisma.vendorStaff.findFirst.mockResolvedValue({
      id: 'staff-existing',
      userId: 'user-1',
      vendorId: 'vendor-1',
      scope: PermissionScope.PARTICULAR_OUTLET,
    });
    prisma.vendorStaff.update.mockResolvedValue({
      id: 'staff-existing',
      userId: 'user-1',
      vendorId: 'vendor-1',
      scope: PermissionScope.ALL_OUTLETS_MASTER,
      brandId: 'brand-1',
    });

    const result = await service.assignVendorStaff('vendor-1', {
      userId: 'user-1',
      scope: PermissionScope.ALL_OUTLETS_MASTER,
    });

    expect(result.id).toBe('staff-existing');
    expect(prisma.vendorStaff.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'staff-existing' },
        data: expect.objectContaining({
          scope: PermissionScope.ALL_OUTLETS_MASTER,
          brandId: 'brand-1',
        }),
      }),
    );
    expect(prisma.vendorStaff.create).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('auth:user:user-1');
  });
});

describe('AdminService - forceAssignRider fleet governance guards', () => {
  let service: AdminService;
  let prisma: MockPrisma;
  let redis: { del: jest.Mock; set: jest.Mock };

  const mockOrder = {
    id: 'order-1',
    orderNumber: 'ORD-1',
    customerId: 'customer-1',
    vendorId: 'vendor-1',
    riderId: null as string | null,
    status: OrderStatus.PLACED,
    paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
    paymentStatus: PaymentStatus.PENDING,
    vendor: { id: 'vendor-1', name: 'V' },
    orderItems: [],
    customer: { fullName: 'C', phone: 'p' },
  };

  const mockRider = {
    id: 'rider-1',
    userId: 'user-rider-1',
    isApproved: true,
    isOnline: true,
    user: { id: 'user-rider-1', fullName: 'Rider One', phone: 'p1', status: 'ACTIVE' },
  };

  beforeEach(() => {
    prisma = {
      vendor: { findUnique: jest.fn().mockResolvedValue({ id: 'vendor-1', brandId: 'brand-1' }) },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', role: UserRole.CUSTOMER }),
        update: jest.fn().mockResolvedValue({ id: 'user-1', role: UserRole.VENDOR_ADMIN }),
      },
      vendorStaff: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      order: {
        findUnique: jest.fn().mockResolvedValue(mockOrder),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          ...mockOrder,
          ...data,
          customer: { fullName: 'C', phone: 'p' },
          vendor: { id: 'vendor-1', name: 'V' },
          orderItems: [],
        })),
      },
      rider: { findUnique: jest.fn().mockResolvedValue(mockRider), findMany: jest.fn().mockResolvedValue([]) },
    };

    redis = {
      del: jest.fn().mockResolvedValue(1),
      set: jest.fn().mockResolvedValue('OK'),
    };

    service = new AdminService(
      prisma as never,
      redis as never,
      {
        notifyOrderStatusChanged: jest.fn(),
        server: { to: jest.fn().mockReturnThis(), emit: jest.fn() },
      } as never,
      {} as never,
      {} as never,
      {} as never,
      { sendToUser: jest.fn().mockResolvedValue(true) } as never,
    );
  });

  it('assigns an approved, online courier and marks them busy in Redis', async () => {
    const result = await service.forceAssignRider('order-1', 'rider-1');

    expect(result.status).toBe(OrderStatus.RIDER_ASSIGNED);
    expect(redis.set).toHaveBeenCalledWith('rider:active_order:rider-1', 'order-1');
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', status: OrderStatus.PLACED } }),
    );
  });

  it('rejects an unapproved courier', async () => {
    prisma.rider.findUnique.mockResolvedValue({ ...mockRider, isApproved: false });

    await expect(service.forceAssignRider('order-1', 'rider-1')).rejects.toThrow(
      'unapproved or suspended',
    );
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('rejects an offline courier', async () => {
    prisma.rider.findUnique.mockResolvedValue({ ...mockRider, isOnline: false });

    await expect(service.forceAssignRider('order-1', 'rider-1')).rejects.toThrow(
      'currently offline',
    );
  });

  it('rejects assignment of an unpaid ONLINE_GATEWAY order (payment invariant)', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...mockOrder,
      paymentMethod: PaymentMethod.ONLINE_GATEWAY,
      paymentStatus: PaymentStatus.PENDING,
    });

    await expect(service.forceAssignRider('order-1', 'rider-1')).rejects.toThrow(
      'awaiting online payment confirmation',
    );
  });

  it('rejects a courier who is already mid-trip on another order (DB busy backstop)', async () => {
    prisma.order.findFirst.mockResolvedValue({ orderNumber: 'ORD-OTHER' });

    await expect(service.forceAssignRider('order-1', 'rider-1')).rejects.toThrow(
      'already mid-trip',
    );
  });

  it('surfaces a lost assignment race as a ConflictException', async () => {
    prisma.order.update.mockImplementation(() => {
      throw new Prisma.PrismaClientKnownRequestError('record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
    });

    await expect(service.forceAssignRider('order-1', 'rider-1')).rejects.toThrow(
      'Order state changed before the assignment could be applied',
    );
  });
});

describe('AdminService - getLiveOrders date-wise filtering', () => {
  let service: AdminService;
  let prisma: {
    order: { findMany: jest.Mock; findUnique: jest.Mock; count: jest.Mock };
    $transaction: jest.Mock;
  };

  const query = (overrides: Partial<GetLiveOrdersQueryDto> = {}) =>
    ({ page: 1, limit: 20, skip: 0, ...overrides }) as GetLiveOrdersQueryDto;

  const wherePassedToFindMany = (callIndex = 0) => prisma.order.findMany.mock.calls[callIndex][0].where;

  beforeEach(() => {
    prisma = {
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };

    service = new AdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { sendToUser: jest.fn().mockResolvedValue(true) } as never,
    );
  });

  it('applies an inclusive placedAt gte/lte window when both bounds are provided', async () => {
    const result = await service.getLiveOrders('ALL', query({
      dateFrom: '2026-10-01T00:00:00.000Z',
      dateTo: '2026-10-01T23:59:59.999Z',
    }));

    expect(wherePassedToFindMany()).toEqual({
      placedAt: { gte: new Date('2026-10-01T00:00:00.000Z'), lte: new Date('2026-10-01T23:59:59.999Z') },
    });
    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
  });

  it('supports open-ended ranges with a single bound', async () => {
    await service.getLiveOrders('ALL', query({ dateFrom: '2026-10-01T00:00:00.000Z' }));
    expect(wherePassedToFindMany()).toEqual({
      placedAt: { gte: new Date('2026-10-01T00:00:00.000Z') },
    });

    await service.getLiveOrders('ALL', query({ dateTo: '2026-10-01T23:59:59.999Z' }));
    expect(wherePassedToFindMany(1)).toEqual({
      placedAt: { lte: new Date('2026-10-01T23:59:59.999Z') },
    });
  });

  it('omits the placedAt filter entirely when no dates are provided', async () => {
    await service.getLiveOrders('ALL', query());

    expect(wherePassedToFindMany()).toEqual({});
    expect(prisma.order.count).toHaveBeenCalledWith({ where: {} });
  });

  it('combines the date window with status and search filters', async () => {
    await service.getLiveOrders('PLACED', query({
      search: 'ORD-42',
      dateFrom: '2026-09-01T00:00:00.000Z',
      dateTo: '2026-09-30T23:59:59.999Z',
    }));

    expect(wherePassedToFindMany()).toEqual({
      status: OrderStatus.PLACED,
      placedAt: {
        gte: new Date('2026-09-01T00:00:00.000Z'),
        lte: new Date('2026-09-30T23:59:59.999Z'),
      },
      OR: [
        { orderNumber: { contains: 'ORD-42', mode: 'insensitive' } },
        { customer: { phone: { contains: 'ORD-42' } } },
        { customer: { fullName: { contains: 'ORD-42', mode: 'insensitive' } } },
      ],
    });
  });

  it('getOrderById returns the enriched detail view with money breakdown and lifecycle timestamps', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'order-1',
      orderNumber: 'ORD-20261002-0001',
      vendorId: 'vendor-1',
      customerId: 'customer-1',
      riderId: null,
      status: OrderStatus.DELIVERED,
      paymentMethod: PaymentMethod.CASH_ON_DELIVERY,
      paymentStatus: PaymentStatus.PAID,
      totalAmount: { valueOf: () => 550 },
      deliveryFee: { valueOf: () => 50 },
      subtotal: { valueOf: () => 560 },
      couponDiscount: { valueOf: () => 60 },
      taxAmount: { valueOf: () => 0 },
      placedAt: new Date('2026-10-02T10:00:00.000Z'),
      acceptedAt: new Date('2026-10-02T10:02:00.000Z'),
      prepTimeMinutes: 20,
      pickedUpAt: new Date('2026-10-02T10:25:00.000Z'),
      deliveredAt: new Date('2026-10-02T10:50:00.000Z'),
      cancelledAt: null,
      rejectionReason: null,
      customerNotes: null,
      customer: { fullName: 'Nusrat Jahan', phone: '+8801700000005' },
      vendor: { id: 'vendor-1', name: 'Burger Point', addressText: 'Gulshan', latitude: 23.8, longitude: 90.4 },
      rider: null,
      orderItems: [{ id: 'i1', productNameSnapshot: 'Classic Burger', quantity: 2, unitPrice: { valueOf: () => 250 } }],
      deliveryAddressSnapshot: { addressLine: 'Road 11, Banani' },
    });

    const view = await service.getOrderById('order-1');

    expect(view).toMatchObject({
      orderNumber: 'ORD-20261002-0001',
      subtotal: 560,
      couponDiscount: 60,
      totalAmount: 550,
      status: OrderStatus.DELIVERED,
      items: [{ id: 'i1', name: 'Classic Burger', quantity: 2, unitPrice: 250 }],
      deliveryAddress: 'Road 11, Banani',
    });
    expect(view.pickedUpAt).toEqual(new Date('2026-10-02T10:25:00.000Z'));
    expect(view.deliveredAt).toEqual(new Date('2026-10-02T10:50:00.000Z'));
  });

  it('getOrderById rejects unknown ids with 404', async () => {
    await expect(service.getOrderById('missing')).rejects.toThrow('Order not found');
  });
});

describe('AdminService - brand & staff account governance', () => {
  let service: AdminService;
  let prisma: {
    vendorBrand: { findMany: jest.Mock; findFirst: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    user: { findMany: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    vendorStaff: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      count: jest.Mock;
    };
    vendor: { findUnique: jest.Mock };
    redis: { del: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      vendorBrand: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'brand-1', name: 'Burger Point' }),
        update: jest.fn().mockResolvedValue({ id: 'brand-1', name: 'Burger Point Deluxe' }),
        delete: jest.fn().mockResolvedValue({ id: 'brand-1' }),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'user-9', phone: '+8801712345678', role: 'VENDOR_ADMIN' }),
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
      vendorStaff: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'staff-1' }),
        update: jest.fn().mockResolvedValue({ id: 'staff-1' }),
        delete: jest.fn().mockResolvedValue({ id: 'staff-1' }),
        count: jest.fn().mockResolvedValue(0),
      },
      vendor: { findUnique: jest.fn().mockResolvedValue(null) },
      redis: { del: jest.fn().mockResolvedValue(1) },
    };

    service = new AdminService(
      { ...({} as object), ...prisma } as never,
      prisma.redis as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { sendToUser: jest.fn().mockResolvedValue(true) } as never,
    );
  });

  it('creates a brand after confirming the name is unused', async () => {
    await service.createBrand({ name: 'Burger Point' });
    expect(prisma.vendorBrand.findFirst).toHaveBeenCalledWith({ where: { name: 'Burger Point' } });
    expect(prisma.vendorBrand.create).toHaveBeenCalledWith({
      data: { name: 'Burger Point', logoUrl: null },
    });
  });

  it('rejects duplicate brand names with 409', async () => {
    prisma.vendorBrand.findFirst.mockResolvedValue({ id: 'brand-2', name: 'Burger Point' });
    await expect(service.createBrand({ name: 'Burger Point' })).rejects.toThrow('already exists');
  });

  it('blocks brand deletion while outlets or staff remain assigned', async () => {
    prisma.vendorBrand.findUnique.mockResolvedValue({
      id: 'brand-1',
      name: 'Burger Point',
      _count: { outlets: 2, staff: 1 },
    });
    await expect(service.deleteBrand('brand-1')).rejects.toThrow('still operates 2 outlet(s)');
    expect(prisma.vendorBrand.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty brand', async () => {
    prisma.vendorBrand.findUnique.mockResolvedValue({
      id: 'brand-1',
      name: 'Ghost Brand',
      _count: { outlets: 0, staff: 0 },
    });
    await expect(service.deleteBrand('brand-1')).resolves.toBeUndefined();
    expect(prisma.vendorBrand.delete).toHaveBeenCalledWith({ where: { id: 'brand-1' } });
  });

  it('searches users only for phone fragments of meaningful length', async () => {
    await service.searchUsersByPhone('17');
    expect(prisma.user.findMany).not.toHaveBeenCalled();

    await service.searchUsersByPhone('+88017123');
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { phone: { contains: '+88017123' } }, take: 10 }),
    );
  });

  it('provisions a VENDOR_ADMIN account and rejects duplicate phones with 409', async () => {
    await service.createStaffUser({ phone: '+8801712345678', fullName: ' Rahim Uddin ' });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        phone: '+8801712345678',
        fullName: 'Rahim Uddin',
        role: UserRole.VENDOR_ADMIN,
        status: 'ACTIVE',
      },
      select: expect.anything(),
    });

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', phone: '+8801712345678', role: UserRole.CUSTOMER });
    await expect(
      service.createStaffUser({ phone: '+8801712345678', fullName: 'Duplicate' }),
    ).rejects.toThrow('already exists');
  });

  it('removes a staff assignment, demotes last-assignment accounts, and purges the session cache', async () => {
    prisma.vendorStaff.findUnique.mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      user: { id: 'user-1', role: UserRole.VENDOR_ADMIN },
    });
    prisma.vendorStaff.count.mockResolvedValue(0);

    const result = await service.removeVendorStaff('staff-1');

    expect(prisma.vendorStaff.delete).toHaveBeenCalledWith({ where: { id: 'staff-1' } });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { role: UserRole.CUSTOMER },
    });
    expect(prisma.redis.del).toHaveBeenCalledWith('auth:user:user-1');
    expect(result).toEqual({ removed: true, demoted: true });
  });

  it('keeps the role when the user still holds other staff assignments', async () => {
    prisma.vendorStaff.findUnique.mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      user: { id: 'user-1', role: UserRole.VENDOR_ADMIN },
    });
    prisma.vendorStaff.count.mockResolvedValue(2);

    const result = await service.removeVendorStaff('staff-1');
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(result.demoted).toBe(false);
  });

  it('rejects removal of unknown staff assignments with 404', async () => {
    await expect(service.removeVendorStaff('missing')).rejects.toThrow('Staff assignment not found');
  });

  it('blocks assigning a user who already holds an active assignment elsewhere', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ id: 'vendor-1', brandId: 'brand-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: UserRole.VENDOR_ADMIN });
    prisma.vendorStaff.findFirst.mockResolvedValue({
      id: 'other',
      vendorId: 'vendor-9',
      brandId: null,
      scope: PermissionScope.PARTICULAR_OUTLET,
    });

    await expect(
      service.assignVendorStaff('vendor-1', { userId: 'user-1', scope: PermissionScope.PARTICULAR_OUTLET }),
    ).rejects.toThrow('already holds an active assignment');
    expect(prisma.vendorStaff.create).not.toHaveBeenCalled();
  });

  it('allows re-assigning within the same outlet row (scope upsert path)', async () => {
    prisma.vendor.findUnique.mockResolvedValue({ id: 'vendor-1', brandId: 'brand-1' });
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: UserRole.VENDOR_ADMIN });
    prisma.vendorStaff.findFirst.mockResolvedValue({
      id: 'existing',
      vendorId: 'vendor-1',
      brandId: null,
      scope: PermissionScope.PARTICULAR_OUTLET,
    });
    prisma.vendorStaff.update.mockResolvedValue({ id: 'existing' });

    await expect(
      service.assignVendorStaff('vendor-1', { userId: 'user-1', scope: PermissionScope.PARTICULAR_OUTLET }),
    ).resolves.toBeDefined();
  });
});

describe('AdminService - product save with absolute variation pricing', () => {
  let service: AdminService;
  let prisma: {
    product: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    productVariant: { findMany: jest.Mock; delete: jest.Mock; update: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
  };

  const variations = [
    { name: 'Single', price: 320, isInStock: true },
    { name: 'Double', price: 440, isInStock: true },
  ];

  const baseInput = {
    vendorId: 'vendor-1',
    categoryId: 'cat-1',
    name: 'Beef Burger',
    variations,
  };

  beforeEach(() => {
    prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'prod-1' }),
        create: jest.fn().mockResolvedValue({ id: 'prod-new' }),
      },
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'v1', name: 'Old', price: { valueOf: () => 100 } },
          { id: 'v2', name: 'Kept', price: { valueOf: () => 200 } },
        ]),
        delete: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(),
    };

    service = new AdminService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { sendToUser: jest.fn().mockResolvedValue(true) } as never,
    );
  });

  it('rejects products without at least one variation', async () => {
    await expect(service.saveProduct({ ...baseInput, variations: [] })).rejects.toThrow(
      'at least one variation',
    );
    await expect(
      service.saveProduct({ ...baseInput, variations: [{ name: '  ', price: 10, isInStock: true }] }),
    ).rejects.toThrow('at least one variation');
  });

  it('creates a product with ordered variations and the first price as base', async () => {
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        product: prisma.product,
        productVariant: prisma.productVariant,
      }),
    );

    await service.saveProduct(baseInput);

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          basePrice: 320,
          variants: {
            create: [
              expect.objectContaining({ name: 'Single', price: 320, sortOrder: 1 }),
              expect.objectContaining({ name: 'Double', price: 440, sortOrder: 2 }),
            ],
          },
        }),
      }),
    );
  });

  it('updates by replacing missing variations and re-syncing the product price to the new first variation', async () => {
    prisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: 'Beef Burger' });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        product: prisma.product,
        productVariant: prisma.productVariant,
      }),
    );

    await service.saveProduct(
      {
        ...baseInput,
        variations: [{ id: 'v2', name: 'Kept', price: 500, isInStock: false }, ...variations.slice(1)],
      },
      'prod-1',
    );

    // v1 was not kept in the payload -> deleted (safe: snapshots are JSONB)
    expect(prisma.productVariant.delete).toHaveBeenCalledWith({ where: { id: 'v1' } });
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 'v2' },
      data: expect.objectContaining({ price: 500, sortOrder: 1 }),
    });
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ basePrice: 500 }),
      }),
    );
  });

  it('requires vendorId when creating', async () => {
    const { vendorId: _vendorId, ...withoutVendor } = baseInput;
    await expect(service.saveProduct(withoutVendor)).rejects.toThrow('vendorId is required');
  });
});

describe('AdminService - staff assignment & account edits', () => {
  let service: AdminService;
  let prisma: {
    vendorStaff: { findUnique: jest.Mock; update: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock };
  };
  let redis: { del: jest.Mock };

  beforeEach(() => {
    prisma = {
      vendorStaff: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'user-1' }),
      },
    };
    redis = { del: jest.fn().mockResolvedValue(1) };

    service = new AdminService(
      prisma as never,
      redis as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { sendToUser: jest.fn().mockResolvedValue(true) } as never,
    );
  });

  it('switches a manager to brand-owner scope bound to the outlet brand and purges the session', async () => {
    prisma.vendorStaff.findUnique.mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      scope: PermissionScope.PARTICULAR_OUTLET,
      vendorId: 'vendor-1',
      brandId: null,
      vendor: { brandId: 'brand-9' },
    });

    await service.updateVendorStaffAssignment('staff-1', { scope: PermissionScope.ALL_OUTLETS_MASTER });

    expect(prisma.vendorStaff.update).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      data: expect.objectContaining({
        scope: PermissionScope.ALL_OUTLETS_MASTER,
        brandId: 'brand-9',
        vendorId: null,
      }),
    });
    expect(redis.del).toHaveBeenCalledWith('auth:user:user-1');
  });

  it('toggles assignment active state without touching scope', async () => {
    prisma.vendorStaff.findUnique.mockResolvedValue({
      id: 'staff-1',
      userId: 'user-1',
      scope: PermissionScope.PARTICULAR_OUTLET,
      vendorId: 'vendor-1',
      brandId: null,
      vendor: { brandId: 'brand-9' },
    });

    await service.updateVendorStaffAssignment('staff-1', { isActive: false });

    expect(prisma.vendorStaff.update).toHaveBeenCalledWith({
      where: { id: 'staff-1' },
      data: { isActive: false },
    });
  });

  it('rejects unknown assignments with 404', async () => {
    await expect(service.updateVendorStaffAssignment('missing', { isActive: false })).rejects.toThrow(
      'Staff assignment not found',
    );
  });

  it('edits account name/phone with duplicate-phone protection and cache purge', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-1', phone: '+8801711111111' });
    prisma.user.findUnique.mockResolvedValueOnce({ id: 'user-2', phone: '+8801722222222' });

    await expect(
      service.updateStaffAccount('user-1', { phone: '+8801722222222' }),
    ).rejects.toThrow('already exists');
    expect(prisma.user.update).not.toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', phone: '+8801711111111' });
    await service.updateStaffAccount('user-1', { fullName: ' New Name ' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { fullName: 'New Name' } }),
    );
    expect(redis.del).toHaveBeenCalledWith('auth:user:user-1');
  });
});
