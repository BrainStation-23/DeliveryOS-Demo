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
    service = new AdminCustomersService(prisma as never, {} as never);
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
      suspensionReason: null,
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
    service = new AdminCustomersService(prisma as never, {} as never);
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

describe('AdminCustomersService.updateCustomerStatus', () => {
  let service: AdminCustomersService;
  let prisma: {
    user: { findFirst: jest.Mock; update: jest.Mock };
  };
  let redis: {
    del: jest.Mock;
    getClient: jest.Mock;
  };
  let trackingGateway: {
    notifyUserStatusChanged: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'customer-1',
          role: 'CUSTOMER',
          status: 'ACTIVE',
        }),
        update: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'customer-1',
            fullName: 'Rahim Uddin',
            phone: '+8801711111111',
            email: null,
            status: data.status,
            suspensionReason: data.suspensionReason ?? null,
            createdAt: new Date('2026-09-01T00:00:00.000Z'),
          }),
        ),
      },
    };
    const mockRedisClient = {
      keys: jest.fn().mockResolvedValue(['auth:refresh:token-1', 'auth:refresh:token-2']),
      mget: jest.fn().mockResolvedValue(['customer-1', 'other-customer']),
      del: jest.fn().mockResolvedValue(1),
    };
    redis = {
      del: jest.fn().mockResolvedValue(1),
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };
    trackingGateway = {
      notifyUserStatusChanged: jest.fn(),
    };
    service = new AdminCustomersService(prisma as never, redis as never, trackingGateway as never);
  });

  it('suspends a customer with provided reason, invalidates Redis user cache and refresh tokens, and broadcasts status update', async () => {
    const result = await service.updateCustomerStatus('customer-1', 'SUSPENDED', 'Fraudulent orders');

    expect(result).toEqual({
      id: 'customer-1',
      fullName: 'Rahim Uddin',
      phone: '+8801711111111',
      status: 'SUSPENDED',
      suspensionReason: 'Fraudulent orders',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: { status: 'SUSPENDED', suspensionReason: 'Fraudulent orders', fcmToken: null },
      select: expect.any(Object),
    });
    expect(redis.del).toHaveBeenCalledWith('auth:user:customer-1');
    const client = redis.getClient();
    expect(client.keys).toHaveBeenCalledWith('auth:refresh:*');
    expect(client.del).toHaveBeenCalledWith('auth:refresh:token-1');
    expect(trackingGateway.notifyUserStatusChanged).toHaveBeenCalledWith('customer-1', {
      userId: 'customer-1',
      status: 'SUSPENDED',
      reason: 'Fraudulent orders',
    });
  });

  it('reactivates a customer and clears suspensionReason without token revocation scan', async () => {
    const result = await service.updateCustomerStatus('customer-1', 'ACTIVE');

    expect(result.status).toBe('ACTIVE');
    expect(result.suspensionReason).toBeNull();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'customer-1' },
      data: { status: 'ACTIVE', suspensionReason: null },
      select: expect.any(Object),
    });
    expect(redis.del).toHaveBeenCalledWith('auth:user:customer-1');
    expect(trackingGateway.notifyUserStatusChanged).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when customer does not exist or has non-CUSTOMER role', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.updateCustomerStatus('non-existent', 'SUSPENDED')).rejects.toThrow(
      NotFoundException,
    );
  });
});
