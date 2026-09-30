import { PermissionScope, UserRole } from '@prisma/client';
import { AdminService } from './admin.service';

type MockPrisma = {
  vendor: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock; update: jest.Mock };
  vendorStaff: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
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
