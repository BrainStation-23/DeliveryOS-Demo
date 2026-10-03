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

  it('UNASSIGNED narrows to active orders without a courier and excludes terminal statuses', async () => {
    const query = new GetLiveOrdersQueryDto();
    query.assignment = 'UNASSIGNED';

    await service.getLiveOrders(undefined, query);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          riderId: null,
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        }),
      }),
    );
  });

  it('UNASSIGNED keeps an explicit status filter instead of the terminal exclusion', async () => {
    const query = new GetLiveOrdersQueryDto();
    query.assignment = 'UNASSIGNED';
    query.status = OrderStatus.READY_FOR_PICKUP;

    await service.getLiveOrders(query.status, query);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ riderId: null, status: OrderStatus.READY_FOR_PICKUP }),
      }),
    );
  });

  it('ASSIGNED keeps only orders with a courier', async () => {
    const query = new GetLiveOrdersQueryDto();
    query.assignment = 'ASSIGNED';

    await service.getLiveOrders(undefined, query);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ riderId: { not: null } }),
      }),
    );
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
    vendor: { findUnique: jest.Mock; delete: jest.Mock };
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
      vendor: { findUnique: jest.fn().mockResolvedValue(null), delete: jest.fn().mockResolvedValue({ id: 'vendor-1' }) },
      redis: { del: jest.fn().mockResolvedValue(1) },
    };

    service = new AdminService(
      { ...({} as object), ...prisma } as never,
      prisma.redis as never,
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

  it('blocks outlet deletion while tagged staff remain assigned', async () => {
    prisma.vendor.findUnique.mockResolvedValue({
      id: 'vendor-1',
      name: 'Burger Point Gulshan',
      _count: { staff: 2, categories: 0, products: 0, orders: 0 },
    });
    await expect(service.deleteVendor('vendor-1')).rejects.toThrow('still has 2 tagged staff');
    expect(prisma.vendor.delete).not.toHaveBeenCalled();
  });

  it('blocks outlet deletion while categories remain attached', async () => {
    prisma.vendor.findUnique.mockResolvedValue({
      id: 'vendor-1',
      name: 'Burger Point Gulshan',
      _count: { staff: 0, categories: 3, products: 0, orders: 0 },
    });
    await expect(service.deleteVendor('vendor-1')).rejects.toThrow('still has 3 category/categories');
    expect(prisma.vendor.delete).not.toHaveBeenCalled();
  });

  it('blocks outlet deletion while items/products remain attached', async () => {
    prisma.vendor.findUnique.mockResolvedValue({
      id: 'vendor-1',
      name: 'Burger Point Gulshan',
      _count: { staff: 0, categories: 0, products: 5, orders: 0 },
    });
    await expect(service.deleteVendor('vendor-1')).rejects.toThrow('still has 5 item/product(s)');
    expect(prisma.vendor.delete).not.toHaveBeenCalled();
  });

  it('blocks outlet deletion while historical orders exist', async () => {
    prisma.vendor.findUnique.mockResolvedValue({
      id: 'vendor-1',
      name: 'Burger Point Gulshan',
      _count: { staff: 0, categories: 0, products: 0, orders: 12 },
    });
    await expect(service.deleteVendor('vendor-1')).rejects.toThrow('has 12 order(s)');
    expect(prisma.vendor.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty outlet successfully', async () => {
    prisma.vendor.findUnique.mockResolvedValue({
      id: 'vendor-1',
      name: 'Empty Gulshan Outlet',
      _count: { staff: 0, categories: 0, products: 0, orders: 0 },
    });
    await expect(service.deleteVendor('vendor-1')).resolves.toEqual({
      id: 'vendor-1',
      name: 'Empty Gulshan Outlet',
    });
    expect(prisma.vendor.delete).toHaveBeenCalledWith({ where: { id: 'vendor-1' } });
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

describe('AdminService - catalog deletion guard', () => {
  let service: AdminService;
  let prisma: Record<string, Record<string, jest.Mock>>;

  beforeEach(() => {
    prisma = {
      product: { findUnique: jest.fn(), delete: jest.fn().mockResolvedValue({ id: 'product-1' }) },
      productAddon: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productAddonGroup: { findMany: jest.fn().mockResolvedValue([]), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
      productVariant: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    // The transaction helper simply invokes the callback with the same mock.
    const tx = prisma;
    (prisma as { $transaction?: jest.Mock }).$transaction = jest.fn((fn: (client: unknown) => unknown) => fn(tx));

    service = new AdminService(
      prisma as never,
      { del: jest.fn() } as never,
      {} as never,
      {} as never,
      { invalidateCache: jest.fn() } as never,
      { sendToUser: jest.fn() } as never,
    );
  });

  it('blocks deletion with 409 while order history references the product', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Burger',
      _count: { orderItems: 3 },
    });

    await expect(service.deleteProduct('product-1')).rejects.toThrow('cannot be deleted');
    expect(prisma.productVariant.deleteMany).not.toHaveBeenCalled();
  });

  it('hard-deletes an unreferenced product together with its variants and add-ons', async () => {
    prisma.product.findUnique.mockResolvedValue({
      id: 'product-1',
      name: 'Burger',
      _count: { orderItems: 0 },
    });
    prisma.productAddonGroup.findMany.mockResolvedValue([{ id: 'group-1' }]);

    const result = await service.deleteProduct('product-1');

    expect(result).toEqual({ id: 'product-1', name: 'Burger' });
    expect(prisma.productAddon.deleteMany).toHaveBeenCalledWith({
      where: { addonGroupId: { in: ['group-1'] } },
    });
    expect(prisma.productVariant.deleteMany).toHaveBeenCalledWith({ where: { productId: 'product-1' } });
  });

  it('rejects unknown product ids with 404', async () => {
    prisma.product.findUnique.mockResolvedValue(null);
    await expect(service.deleteProduct('missing')).rejects.toThrow('Product not found');
  });
});

describe('AdminService - banner deeplink integrity', () => {
  let service: AdminService;
  let prisma: { vendor: { findUnique: jest.Mock }; category: { findUnique: jest.Mock }; banner: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock } };

  beforeEach(() => {
    prisma = {
      vendor: { findUnique: jest.fn().mockResolvedValue({ id: 'vendor-1' }) },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 'category-1' }) },
      banner: {
        create: jest.fn().mockResolvedValue({ id: 'banner-1' }),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({ id: 'banner-1' }),
      },
    };

    service = new AdminService(
      prisma as never,
      { del: jest.fn() } as never,
      {} as never,
      {} as never,
      { invalidateCache: jest.fn() } as never,
      { sendToUser: jest.fn() } as never,
    );
  });

  it('creates an EXTERNAL banner when an absolute http(s) URL is provided', async () => {
    await service.createBanner({
      title: 'Ramadan Deal',
      imageUrl: '/uploads/a.png',
      linkType: 'EXTERNAL' as never,
      targetUrl: 'https://example.com/promo',
    });

    expect(prisma.banner.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkType: 'EXTERNAL', targetUrl: 'https://example.com/promo' }),
      }),
    );
  });

  it('creates an INTERNAL banner when an internal targetUrl is provided', async () => {
    await service.createBanner({
      title: 'Search Burger Deal',
      imageUrl: '/uploads/a.png',
      linkType: 'INTERNAL' as never,
      targetUrl: '/search?q=burger',
    });

    expect(prisma.banner.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ linkType: 'INTERNAL', targetUrl: '/search?q=burger' }),
      }),
    );
  });

  it('rejects INTERNAL banners without a targetUrl', async () => {
    await expect(
      service.createBanner({
        title: 'Bad Internal',
        imageUrl: '/uploads/a.png',
        linkType: 'INTERNAL' as never,
        targetUrl: '',
      }),
    ).rejects.toThrow('targetUrl');
  });

  it('rejects EXTERNAL banners without an absolute http(s) URL', async () => {
    await expect(
      service.createBanner({
        title: 'Bad',
        imageUrl: '/uploads/a.png',
        linkType: 'EXTERNAL' as never,
        targetUrl: 'example.com/promo',
      }),
    ).rejects.toThrow('targetUrl');
  });

  it('rejects OUTLET banners pointing at a nonexistent outlet', async () => {
    prisma.vendor.findUnique.mockResolvedValue(null);
    await expect(
      service.createBanner({
        title: 'Bad',
        imageUrl: '/uploads/a.png',
        linkType: 'OUTLET' as never,
        targetId: 'ghost-outlet',
      }),
    ).rejects.toThrow('target outlet does not exist');
  });

  it('validates updates against the merged effective target', async () => {
    prisma.banner.findUnique.mockResolvedValue({
      id: 'banner-1',
      linkType: 'OUTLET',
      targetId: 'vendor-1',
      targetUrl: null,
    });

    // Switching to EXTERNAL without supplying a URL must fail even though the
    // stored row still carries the old OUTLET target.
    await expect(
      service.updateBanner('banner-1', { linkType: 'EXTERNAL' as never }),
    ).rejects.toThrow('targetUrl');
    expect(prisma.banner.update).not.toHaveBeenCalled();
  });
});

describe('AdminService - delivery economics settings', () => {
  let service: AdminService;
  let prisma: { systemSetting: { findUnique: jest.Mock; upsert: jest.Mock } };
  let feeService: { invalidateCache: jest.Mock };

  beforeEach(() => {
    prisma = {
      systemSetting: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ value: {} }),
      },
    };
    feeService = { invalidateCache: jest.fn() };

    service = new AdminService(
      prisma as never,
      { del: jest.fn() } as never,
      {} as never,
      {} as never,
      feeService as never,
      { sendToUser: jest.fn() } as never,
    );
  });

  it('upserts delivery_economics and invalidates the pricing cache', async () => {
    const payload = await service.updateDeliveryEconomics({
      riderSharePercent: 75,
      etaAvgSpeedKmh: 30,
      etaFallbackMinutes: 12,
    });

    expect(payload).toEqual({
      rider_share_percent: 75,
      eta_avg_speed_kmh: 30,
      eta_fallback_minutes: 12,
    });
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'delivery_economics' } }),
    );
    expect(feeService.invalidateCache).toHaveBeenCalledTimes(1);
  });

  it('exposes stored economics and defaults when the key is absent', async () => {
    prisma.systemSetting.findUnique.mockImplementation(({ where }: { where: { key: string } }) =>
      where.key === 'delivery_economics'
        ? { value: { rider_share_percent: 70, eta_avg_speed_kmh: 20, eta_fallback_minutes: 8 } }
        : null,
    );

    const settings = await service.getSystemSettings();
    expect(settings.deliveryEconomics).toEqual({
      rider_share_percent: 70,
      eta_avg_speed_kmh: 20,
      eta_fallback_minutes: 8,
    });

    prisma.systemSetting.findUnique.mockResolvedValue(null);
    const defaults = await service.getSystemSettings();
    expect(defaults.deliveryEconomics).toEqual({
      rider_share_percent: 80,
      eta_avg_speed_kmh: 25,
      eta_fallback_minutes: 10,
    });
  });
});

describe('AdminService - brand owner governance (setBrandOwner)', () => {
  let service: AdminService;
  let prisma: Record<string, Record<string, jest.Mock>> & { $transaction: jest.Mock };
  let redis: { del: jest.Mock };

  const ownerRow = (userId: string) => ({
    id: 'staff-old-owner',
    userId,
    scope: 'ALL_OUTLETS_MASTER',
    isActive: true,
    brandId: 'brand-1',
    user: { id: userId, fullName: 'Previous Owner', phone: '+8801700000099', role: 'VENDOR_ADMIN' },
  });

  const makePristine = () => ({
    vendorBrand: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'brand-1',
        name: 'Kacchi House',
        staff: [ownerRow('user-old-owner')],
      }),
    },
    vendorStaff: {
      delete: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({ id: 'staff-new', scope: 'ALL_OUTLETS_MASTER' }),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-new-owner',
        fullName: 'New Owner',
        phone: '+8801700000088',
        role: 'CUSTOMER',
      }),
      update: jest.fn().mockResolvedValue({}),
    },
  });

  beforeEach(() => {
    prisma = makePristine() as never;
    (prisma as { $transaction?: jest.Mock }).$transaction = jest.fn((fn: (client: unknown) => unknown) => fn(prisma));
    redis = { del: jest.fn().mockResolvedValue(1) };

    service = new AdminService(
      prisma as never,
      redis as never,
      {} as never,
      {} as never,
      { invalidateCache: jest.fn() } as never,
      { sendToUser: jest.fn() } as never,
    );
  });

  it('replaces the owner: old master removed and demoted, candidate promoted and cached sessions purged', async () => {
    const result = await service.setBrandOwner('brand-1', 'user-new-owner');

    expect(result.owner).toMatchObject({ userId: 'user-new-owner', fullName: 'New Owner', isActive: true });
    expect(result.demotedCount).toBe(1);
    expect(prisma.vendorStaff.delete).toHaveBeenCalledWith({ where: { id: 'staff-old-owner' } });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-old-owner' },
      data: { role: 'CUSTOMER' },
    });
    expect(prisma.vendorStaff.create).toHaveBeenCalledWith({
      data: { userId: 'user-new-owner', brandId: 'brand-1', scope: 'ALL_OUTLETS_MASTER', isActive: true },
    });
    // Promote + role guard for both the demoted old owner and the new owner
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-new-owner' },
      data: { role: 'VENDOR_ADMIN' },
    });
    expect(redis.del).toHaveBeenCalledWith('auth:user:user-old-owner');
    expect(redis.del).toHaveBeenCalledWith('auth:user:user-new-owner');
  });

  it('clears ownership when no user id is given and demotes a last-tie owner', async () => {
    const result = await service.setBrandOwner('brand-1', null);

    expect(result).toEqual({ owner: null, demotedCount: 1 });
    expect(prisma.vendorStaff.create).not.toHaveBeenCalled();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-old-owner' },
      data: { role: 'CUSTOMER' },
    });
  });

  it('keeps the previous owner role when they still hold other assignments', async () => {
    prisma.vendorStaff.count.mockResolvedValue(2);
    const result = await service.setBrandOwner('brand-1', 'user-new-owner');

    expect(result.demotedCount).toBe(0);
    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-old-owner' } }),
    );
  });

  it('rejects a candidate holding an active assignment elsewhere with 409', async () => {
    prisma.vendorStaff.findFirst.mockResolvedValue({ id: 'other-assignment', vendorId: 'vendor-9' });

    await expect(service.setBrandOwner('brand-1', 'user-new-owner')).rejects.toThrow('active assignment');
    expect(prisma.vendorStaff.create).not.toHaveBeenCalled();
  });

  it('rejects unknown brands and unknown owner users with 404', async () => {
    prisma.vendorBrand.findUnique.mockResolvedValue(null);
    await expect(service.setBrandOwner('ghost', 'user-new-owner')).rejects.toThrow('Brand not found');

    prisma.vendorBrand.findUnique.mockResolvedValue({ id: 'brand-1', name: 'B', staff: [] });
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.setBrandOwner('brand-1', 'ghost-user')).rejects.toThrow('Owner user not found');
  });
});

describe('AdminService - outlet GPS edit passthrough', () => {
  const prisma = {
    vendor: { findUnique: jest.fn().mockResolvedValue({ id: 'vendor-1' }), update: jest.fn().mockResolvedValue({ id: 'vendor-1' }) },
  };
  const service = new AdminService(
    prisma as never,
    { del: jest.fn() } as never,
    {} as never,
    {} as never,
    { invalidateCache: jest.fn() } as never,
    { sendToUser: jest.fn() } as never,
  );

  it('updates the outlet pin when coordinates are provided', async () => {
    await service.updateVendor('vendor-1', { latitude: 23.8759, longitude: 90.3796 });
    expect(prisma.vendor.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ latitude: 23.8759, longitude: 90.3796 }) }),
    );
  });

  it('leaves coordinates untouched when they are not part of the patch', async () => {
    prisma.vendor.update.mockClear();
    await service.updateVendor('vendor-1', { contactPhone: '+8801700000099' });
    const data = prisma.vendor.update.mock.calls[0][0].data;
    expect(data.latitude).toBeUndefined();
    expect(data.longitude).toBeUndefined();
  });
});

describe('AdminService - category deletion guard', () => {
  const prisma = {
    category: {
      findUnique: jest.fn(),
      delete: jest.fn().mockResolvedValue({ id: 'cat-1' }),
    },
  };
  const service = new AdminService(
    prisma as never,
    { del: jest.fn() } as never,
    {} as never,
    {} as never,
    { invalidateCache: jest.fn() } as never,
    { sendToUser: jest.fn() } as never,
  );

  it('deletes a product-less category', async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Sides', _count: { products: 0 } });
    const result = await service.deleteCategory('cat-1');
    expect(result).toEqual({ id: 'cat-1', name: 'Sides' });
    expect(prisma.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } });
  });

  it('blocks deletion with 409 while products are attached', async () => {
    prisma.category.delete.mockClear();
    prisma.category.findUnique.mockResolvedValue({ id: 'cat-1', name: 'Sides', _count: { products: 3 } });
    await expect(service.deleteCategory('cat-1')).rejects.toThrow('product(s) attached');
    expect(prisma.category.delete).not.toHaveBeenCalledWith({ where: { id: 'cat-1' } });
  });

  it('rejects unknown categories with 404', async () => {
    prisma.category.findUnique.mockResolvedValue(null);
    await expect(service.deleteCategory('ghost')).rejects.toThrow('Category not found');
  });
});
