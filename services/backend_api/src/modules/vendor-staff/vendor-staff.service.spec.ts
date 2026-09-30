import { ForbiddenException } from '@nestjs/common';
import { PermissionScope, User, UserRole } from '@prisma/client';
import { VendorStaffService } from './vendor-staff.service';

type MockPrisma = {
  vendorStaff: { findMany: jest.Mock };
  vendor: { findMany: jest.Mock };
  order: { findMany: jest.Mock };
};

describe('VendorStaffService - Step 1.5: Safe Live Orders Scoping', () => {
  let service: VendorStaffService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = {
      vendorStaff: {
        findMany: jest.fn(),
      },
      vendor: {
        findMany: jest.fn(),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new VendorStaffService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  const mockUser: User = {
    id: 'user-staff-1',
    phone: '+8801700000002',
    fullName: 'Staff User',
    email: null,
    fcmToken: null,
    devicePlatform: null,
    role: UserRole.VENDOR_ADMIN,
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('fails close: returns empty array [] if non-super-admin staff has 0 resolved outlets', async () => {
    // Staff record with ALL_OUTLETS_MASTER on a brand that has 0 outlets
    prisma.vendorStaff.findMany.mockResolvedValue([
      { scope: PermissionScope.ALL_OUTLETS_MASTER, brandId: 'brand-empty', isActive: true },
    ]);
    prisma.vendor.findMany.mockResolvedValue([]); // 0 brand outlets

    const result = await service.getLiveOrders(mockUser);

    expect(result).toEqual([]);
    // prisma.order.findMany should never be called when targetVendorIds is empty
    expect(prisma.order.findMany).not.toHaveBeenCalled();
  });

  it('queries orders filtered by targetVendorIds when staff has assigned outlets', async () => {
    prisma.vendorStaff.findMany.mockResolvedValue([
      { scope: PermissionScope.PARTICULAR_OUTLET, vendorId: 'vendor-1', isActive: true },
    ]);

    await service.getLiveOrders(mockUser);

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendorId: { in: ['vendor-1'] },
        }),
      }),
    );
  });

  it('throws ForbiddenException if staff has no active staff records at all', async () => {
    prisma.vendorStaff.findMany.mockResolvedValue([]);

    await expect(service.getLiveOrders(mockUser)).rejects.toThrow(ForbiddenException);
  });

  it('allows super admin to query without vendorId restriction or with specific vendorId', async () => {
    const superAdminUser: User = {
      ...mockUser,
      id: 'admin-1',
      role: UserRole.SUPER_ADMIN,
    };

    await service.getLiveOrders(superAdminUser, 'vendor-10');

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          vendorId: { in: ['vendor-10'] },
        }),
      }),
    );
  });
});
