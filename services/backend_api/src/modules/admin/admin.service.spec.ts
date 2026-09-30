import { OrderStatus, PaymentMethod, PaymentStatus, PermissionScope, Prisma, UserRole } from '@prisma/client';
import { AdminService } from './admin.service';

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
