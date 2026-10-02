import { NotFoundException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { AdminCustomersService } from './admin-customers.service';
import { GetCustomersQueryDto } from './dto/admin-insights.dto';

describe('AdminCustomersService.getCustomersPage', () => {
  let service: AdminCustomersService;
  let prisma: {
    user: { findMany: jest.Mock; count: jest.Mock };
    order: { groupBy: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'customer-1',
            fullName: 'Rahim Uddin',
            phone: '+8801711111111',
            email: null,
            status: 'ACTIVE',
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      order: {
        groupBy: jest.fn().mockResolvedValue([
          {
            customerId: 'customer-1',
            _count: { _all: 4 },
            _sum: { totalAmount: new Prisma.Decimal('1250.75') },
            _max: { placedAt: new Date('2026-10-01T12:00:00.000Z') },
          },
        ]),
      },
          $transaction: jest.fn(),
    };
    prisma.$transaction = jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops));
    service = new AdminCustomersService(prisma as never);
  });

  it('returns customer rows enriched with order aggregates in one grouped query', async () => {
    const query = new GetCustomersQueryDto();
    query.search = 'rahim';
    query.status = 'ACTIVE';

    const page = await service.getCustomersPage(query);

    expect(page.items[0]).toEqual({
      id: 'customer-1',
      fullName: 'Rahim Uddin',
      phone: '+8801711111111',
      email: null,
      status: 'ACTIVE',
      createdAt: new Date('2026-09-01T00:00:00.000Z'),
      orderCount: 4,
      lifetimeSpend: 1250.75,
      lastOrderAt: new Date('2026-10-01T12:00:00.000Z'),
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'CUSTOMER',
          status: 'ACTIVE',
          OR: expect.any(Array),
        }),
        skip: 0,
        take: 20,
      }),
    );
  });

  it('scopes the directory to CUSTOMER role accounts only', async () => {
    await service.getCustomersPage(new GetCustomersQueryDto());
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.role).toBe('CUSTOMER');
  });

  it('defaults aggregates to zero for customers without orders', async () => {
    prisma.order.groupBy.mockResolvedValue([]);
    const page = await service.getCustomersPage(new GetCustomersQueryDto());
    expect(page.items[0]).toMatchObject({ orderCount: 0, lifetimeSpend: 0, lastOrderAt: null });
  });
});

describe('AdminCustomersService.getCustomerDetail', () => {
  let service: AdminCustomersService;
  let prisma: {
    user: { findFirst: jest.Mock };
    order: { groupBy: jest.Mock; aggregate: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'customer-1',
          fullName: 'Rahim Uddin',
          phone: '+8801711111111',
          email: 'rahim@example.com',
          status: 'ACTIVE',
          createdAt: new Date('2026-09-01T00:00:00.000Z'),
          addresses: [
            { id: 'addr-1', label: 'Home', addressLine: 'House 12, Road 3', latitude: 23.8, longitude: 90.4, isDefault: true },
          ],
        }),
      },
      order: {
        groupBy: jest.fn().mockResolvedValue([
          { status: OrderStatus.DELIVERED, _count: { _all: 4 } },
          { status: OrderStatus.CANCELLED, _count: { _all: 1 } },
        ]),
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 4 },
          _sum: {
            totalAmount: new Prisma.Decimal('1000'),
            deliveryFee: new Prisma.Decimal('200'),
            couponDiscount: new Prisma.Decimal('50'),
          },
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'order-1',
            orderNumber: 'ORD-20261001-0001',
            status: OrderStatus.DELIVERED,
            totalAmount: new Prisma.Decimal('250'),
            paymentMethod: 'CASH_ON_DELIVERY',
            paymentStatus: 'PAID',
            placedAt: new Date('2026-10-01T12:00:00.000Z'),
            vendor: { name: 'Kacchi Bhai' },
          },
        ]),
      },
    };
    service = new AdminCustomersService(prisma as never);
  });

  it('returns profile, addresses, metrics, and recent orders', async () => {
    const detail = await service.getCustomerDetail('customer-1');

    expect(detail.customer.addresses).toHaveLength(1);
    expect(detail.metrics).toEqual({
      statusCounts: expect.objectContaining({ DELIVERED: 4, CANCELLED: 1, PLACED: 0 }),
      totalOrders: 5,
      orderCount: 4,
      lifetimeSpend: 1000,
      totalDeliveryFees: 200,
      totalCouponSavings: 50,
      avgOrderValue: 250,
    });
    expect(detail.recentOrders[0]).toMatchObject({
      orderNumber: 'ORD-20261001-0001',
      vendorName: 'Kacchi Bhai',
      totalAmount: 250,
    });
  });

  it('never surfaces non-customer accounts even when the id exists', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(service.getCustomerDetail('super-admin-id')).rejects.toThrow(NotFoundException);
  });
});
