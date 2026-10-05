import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OrderStatus, PermissionScope, Prisma, User, UserRole } from '@prisma/client';
import { VendorStaffService } from './vendor-staff.service';
import { OrderFlowMode } from '@prisma/client';

type MockPrisma = {
  vendorStaff: { findMany: jest.Mock };
  vendor: { findUnique: jest.Mock; findMany: jest.Mock };
  order: { findMany: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
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
        findUnique: jest.fn().mockResolvedValue({ id: 'vendor-1', brandId: 'brand-1' }),
        findMany: jest.fn(),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
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
    suspensionReason: null,
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

describe('VendorStaffService - accept/handover flow-mode guards', () => {
  let service: VendorStaffService;
  let prisma: MockPrisma;
  let orderFlowService: { handleOrderReady: jest.Mock };

  const staffUser: User = {
    id: 'user-staff-1',
    phone: '+8801700000002',
    fullName: 'Staff User',
    email: null,
    fcmToken: null,
    devicePlatform: null,
    role: UserRole.VENDOR_ADMIN,
    status: 'ACTIVE',
    suspensionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const baseOrder = {
    id: 'order-1',
    orderNumber: 'ORD-1',
    customerId: 'customer-1',
    vendorId: 'vendor-1',
    status: OrderStatus.PLACED,
    orderFlowMode: OrderFlowMode.RIDER_FIRST,
    riderId: null as string | null,
    deliveryAddressSnapshot: {
      type: 'HOME_DELIVERY',
      deliveryMethod: 'HOME_DELIVERY',
      addressLine: 'Road 12',
    },
  };

  beforeEach(() => {
    prisma = {
      vendorStaff: {
        findMany: jest.fn().mockResolvedValue([
          { scope: PermissionScope.PARTICULAR_OUTLET, vendorId: 'vendor-1', isActive: true },
        ]),
      },
      vendor: {
        findUnique: jest.fn().mockResolvedValue({ id: 'vendor-1', brandId: 'brand-1', defaultPrepTimeMinutes: 20 }),
        findMany: jest.fn(),
      },
      order: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({ ...baseOrder, vendor: { defaultPrepTimeMinutes: 20 } }),
        update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
          ...baseOrder,
          ...data,
        })),
      },
    };

    orderFlowService = {
      handleOrderReady: jest.fn().mockResolvedValue(undefined),
    };

    service = new VendorStaffService(
      prisma as never,
      { notifyOrderStatusChanged: jest.fn() } as never,
      orderFlowService as never,
      {} as never,
    );
  });

  it('blocks accepting a PLACED order in RIDER_FIRST mode (courier must secure it first)', async () => {
    await expect(service.acceptOrder(staffUser, 'order-1', {})).rejects.toThrow(ConflictException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('allows accepting a PLACED order in VENDOR_FIRST mode with a status-conditional update', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      orderFlowMode: OrderFlowMode.VENDOR_FIRST,
      vendor: { defaultPrepTimeMinutes: 20 },
    });

    const result = await service.acceptOrder(staffUser, 'order-1', {});
    expect(result.status).toBe(OrderStatus.PREPARING);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', status: OrderStatus.PLACED } }),
    );
  });

  it('allows accepting in RIDER_FIRST once a rider has secured the order', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      status: OrderStatus.RIDER_ASSIGNED,
      riderId: 'rider-1',
      vendor: { defaultPrepTimeMinutes: 20 },
    });

    const result = await service.acceptOrder(staffUser, 'order-1', {});
    expect(result.status).toBe(OrderStatus.PREPARING);
  });

  it('rejects a lost accept race with a ConflictException instead of overwriting', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      orderFlowMode: OrderFlowMode.VENDOR_FIRST,
      vendor: { defaultPrepTimeMinutes: 20 },
    });
    prisma.order.update.mockImplementation(() => {
      throw new Prisma.PrismaClientKnownRequestError('record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
    });

    await expect(service.acceptOrder(staffUser, 'order-1', {})).rejects.toThrow(ConflictException);
  });

  it('blocks handover of a delivery order with no assigned courier (zombie DISPATCH guard)', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      status: OrderStatus.READY_FOR_PICKUP,
      riderId: null,
      vendor: { defaultPrepTimeMinutes: 20 },
    });

    await expect(service.handoverOrder(staffUser, 'order-1')).rejects.toThrow(BadRequestException);
    expect(prisma.order.update).not.toHaveBeenCalled();
  });

  it('allows takeaway handover to the customer without a courier', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      status: OrderStatus.READY_FOR_PICKUP,
      riderId: null,
      deliveryAddressSnapshot: { deliveryMethod: 'TAKEAWAY' },
      vendor: { defaultPrepTimeMinutes: 20 },
    });

    const result = await service.handoverOrder(staffUser, 'order-1');
    expect(result.status).toBe(OrderStatus.DISPATCHED);
  });

  it('marks ready with a status-conditional update', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...baseOrder,
      status: OrderStatus.PREPARING,
      vendor: { defaultPrepTimeMinutes: 20 },
    });

    const result = await service.markOrderReady(staffUser, 'order-1');
    expect(result.status).toBe(OrderStatus.READY_FOR_PICKUP);
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', status: OrderStatus.PREPARING } }),
    );
  });
});
