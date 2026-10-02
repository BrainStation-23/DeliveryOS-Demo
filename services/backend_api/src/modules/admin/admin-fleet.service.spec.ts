import { NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { AdminFleetService, deriveFleetStatus } from './admin-fleet.service';
import { GetRidersQueryDto } from './dto/admin-governance.dto';

describe('deriveFleetStatus', () => {
  it('maps online couriers with an active order to ON_TRIP', () => {
    expect(deriveFleetStatus(true, true)).toBe('ON_TRIP');
  });
  it('maps online couriers without an active order to ONLINE', () => {
    expect(deriveFleetStatus(true, false)).toBe('ONLINE');
  });
  it('maps offline couriers to OFFLINE regardless of stale order rows', () => {
    expect(deriveFleetStatus(false, true)).toBe('OFFLINE');
  });
});

describe('AdminFleetService.getRidersPage', () => {
  let service: AdminFleetService;
  let prisma: {
    rider: { findMany: jest.Mock; count: jest.Mock };
    order: { groupBy: jest.Mock; findMany: jest.Mock };
    riderTripLedger: { groupBy: jest.Mock };
    $transaction: jest.Mock;
  };

  const riderRow = {
    id: 'rider-1',
    userId: 'user-1',
    vehicleType: 'motorbike',
    isOnline: true,
    isApproved: true,
    cashInHand: new Prisma.Decimal('4700'),
    maxCashLimit: new Prisma.Decimal('5000'),
    latitude: 23.8103,
    longitude: 90.4125,
    updatedAt: new Date('2026-10-01T10:00:00.000Z'),
    user: {
      id: 'user-1',
      fullName: 'Karim Rider',
      phone: '+8801700000099',
      email: 'karim@example.com',
      status: 'ACTIVE',
      createdAt: new Date('2026-08-01T00:00:00.000Z'),
    },
    _count: { orders: 12, trips: 10 },
  };

  beforeEach(() => {
    prisma = {
      rider: {
        findMany: jest.fn().mockResolvedValue([riderRow]),
        count: jest.fn().mockResolvedValue(1),
      },
      order: {
        groupBy: jest.fn().mockResolvedValue([{ riderId: 'rider-1', _count: { _all: 9 } }]),
        findMany: jest.fn().mockResolvedValue([
          {
            riderId: 'rider-1',
            id: 'order-1',
            orderNumber: 'ORD-20261002-0001',
            status: OrderStatus.DISPATCHED,
            vendor: { name: 'Kacchi Bhai' },
          },
        ]),
      },
      riderTripLedger: {
        groupBy: jest.fn().mockResolvedValue([
          { riderId: 'rider-1', _sum: { deliveryEarnings: new Prisma.Decimal('250.5') } },
        ]),
      },
          $transaction: jest.fn(),
    };
    prisma.$transaction = jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops));
    service = new AdminFleetService(prisma as never);
  });

  it('returns an enriched, paginated roster with derived status', async () => {
    const query = new GetRidersQueryDto();
    query.page = 2;
    query.limit = 20;
    query.search = 'karim';

    const page = await service.getRidersPage(query);

    expect(page.total).toBe(1);
    expect(page.totalPages).toBe(1);
    expect(page.items[0]).toMatchObject({
      id: 'rider-1',
      fullName: 'Karim Rider',
      status: 'ON_TRIP',
      cashInHand: 4700,
      cashSafetyWarning: true,
      totalDeliveries: 9,
      earnings30d: 250.5,
      activeOrder: { orderNumber: 'ORD-20261002-0001', vendorName: 'Kacchi Bhai' },
    });
    expect(prisma.rider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        where: expect.objectContaining({
          OR: expect.arrayContaining([expect.objectContaining({ user: expect.any(Object) })]),
        }),
      }),
    );
  });

  it('keeps the pending-applicant filter semantics', async () => {
    const query = new GetRidersQueryDto();
    query.approvalStatus = 'PENDING';
    await service.getRidersPage(query);
    expect(prisma.rider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isApproved: false }) }),
    );
  });

  it('leaves riders without a GPS fix unpositioned instead of defaulting', async () => {
    prisma.rider.findMany.mockResolvedValue([{ ...riderRow, latitude: null, longitude: null }]);
    const page = await service.getRidersPage(new GetRidersQueryDto());
    expect(page.items[0].latitude).toBeNull();
    expect(page.items[0].longitude).toBeNull();
  });
});

describe('AdminFleetService.getRiderDetail', () => {
  let service: AdminFleetService;
  let prisma: {
    rider: { findUnique: jest.Mock };
    order: { count: jest.Mock; findFirst: jest.Mock; findMany: jest.Mock };
    riderTripLedger: { aggregate: jest.Mock };
    cashDeposit: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      rider: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'rider-1',
          userId: 'user-1',
          vehicleType: 'motorbike',
          isOnline: true,
          isApproved: true,
          cashInHand: new Prisma.Decimal('300'),
          maxCashLimit: new Prisma.Decimal('5000'),
          latitude: 23.8,
          longitude: 90.4,
          updatedAt: new Date('2026-10-02T09:00:00.000Z'),
          user: {
            id: 'user-1',
            fullName: 'Karim Rider',
            phone: '+8801700000099',
            email: null,
            status: 'ACTIVE',
            createdAt: new Date('2026-08-01T00:00:00.000Z'),
          },
        }),
      },
      order: {
        count: jest.fn().mockResolvedValue(42),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-9',
            orderNumber: 'ORD-20261002-0009',
            status: OrderStatus.DELIVERED,
            totalAmount: new Prisma.Decimal('550'),
            paymentMethod: 'CASH_ON_DELIVERY',
            placedAt: new Date('2026-10-01T18:00:00.000Z'),
            vendor: { name: 'Kacchi Bhai' },
          },
        ]),
      },
      riderTripLedger: {
        aggregate: jest.fn().mockImplementation((args: { where: { createdAt?: unknown } }) =>
          args.where.createdAt
            ? { _sum: { deliveryEarnings: new Prisma.Decimal('120') } }
            : {
                _count: { _all: 40 },
                _sum: {
                  deliveryEarnings: new Prisma.Decimal('480.75'),
                  codCollected: new Prisma.Decimal('9000'),
                },
              },
        ),
      },
      cashDeposit: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'deposit-1',
            amount: new Prisma.Decimal('500'),
            status: 'PENDING_APPROVAL',
            depositedAt: new Date('2026-10-02T08:00:00.000Z'),
            referenceNo: 'DEP-001',
            note: null,
          },
        ]),
      },
    };
    service = new AdminFleetService(prisma as never);
  });

  it('returns the unified courier profile with lifetime stats and history', async () => {
    const detail = await service.getRiderDetail('rider-1');

    expect(detail.status).toBe('ONLINE');
    expect(detail.rider).toMatchObject({ fullName: 'Karim Rider', cashInHand: 300 });
    expect(detail.stats).toEqual({
      totalDeliveries: 42,
      totalTrips: 40,
      lifetimeEarnings: 480.75,
      lifetimeCodCollected: 9000,
      earnings30d: 120,
    });
    expect(detail.recentOrders[0]).toMatchObject({
      orderNumber: 'ORD-20261002-0009',
      vendorName: 'Kacchi Bhai',
      totalAmount: 550,
    });
    expect(detail.recentDeposits[0]).toMatchObject({ referenceNo: 'DEP-001', amount: 500 });
  });

  it('rejects unknown rider ids with 404', async () => {
    prisma.rider.findUnique.mockResolvedValue(null);
    await expect(service.getRiderDetail('missing')).rejects.toThrow(NotFoundException);
  });
});
