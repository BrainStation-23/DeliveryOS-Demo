import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  AdminAnalyticsService,
  assembleOrderTimeseries,
  MAX_ANALYTICS_SPAN_DAYS,
  percentDelta,
  resolveAnalyticsWindow,
} from './admin-analytics.service';
import { GetAnalyticsOverviewQueryDto, GetOrdersSummaryQueryDto } from './dto/admin-insights.dto';

describe('resolveAnalyticsWindow', () => {
  const now = new Date('2026-10-02T12:00:00.000Z');
  const DAY = 24 * 60 * 60 * 1000;

  it('defaults to the trailing 30 days when no bounds are given', () => {
    const window = resolveAnalyticsWindow({}, now);
    expect(window.to).toEqual(now);
    expect(window.from.getTime()).toBe(now.getTime() - 30 * DAY);
    expect(window.prevTo.getTime()).toBe(window.from.getTime());
    expect(window.prevFrom.getTime()).toBe(window.from.getTime() - 30 * DAY);
  });

  it('honors explicit bounds and derives the equal-length preceding window', () => {
    const from = new Date('2026-09-01T00:00:00.000Z');
    const to = new Date('2026-09-08T00:00:00.000Z');
    const window = resolveAnalyticsWindow(
      { dateFrom: from.toISOString(), dateTo: to.toISOString() },
      now,
    );
    expect(window.from).toEqual(from);
    expect(window.to).toEqual(to);
    expect(window.prevTo).toEqual(from);
    expect(window.prevFrom.getTime()).toBe(from.getTime() - 7 * DAY);
  });

  it('rejects inverted windows', () => {
    expect(() =>
      resolveAnalyticsWindow(
        { dateFrom: '2026-10-02T00:00:00.000Z', dateTo: '2026-10-01T00:00:00.000Z' },
        now,
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects windows longer than the 90-day cap', () => {
    expect(() =>
      resolveAnalyticsWindow(
        {
          dateFrom: new Date(now.getTime() - (MAX_ANALYTICS_SPAN_DAYS + 1) * DAY).toISOString(),
          dateTo: now.toISOString(),
        },
        now,
      ),
    ).toThrow(BadRequestException);
  });
});

describe('percentDelta', () => {
  it('returns null when the previous window is zero but the current is not', () => {
    expect(percentDelta(5, 0)).toBeNull();
  });

  it('returns 0 when both windows are zero', () => {
    expect(percentDelta(0, 0)).toBe(0);
  });

  it('computes a one-decimal rounded percentage change', () => {
    expect(percentDelta(115, 100)).toBe(15);
    expect(percentDelta(90, 100)).toBe(-10);
    expect(percentDelta(1, 3)).toBe(-66.7);
  });
});

describe('assembleOrderTimeseries', () => {
  const from = new Date('2026-10-01T00:00:00.000Z');
  const to = new Date('2026-10-03T00:00:00.000Z');
  const window = { from, to, prevFrom: from, prevTo: to };

  it('merges SQL aggregates onto dense day buckets with 2-decimal revenue', () => {
    const points = assembleOrderTimeseries(
      [
        { bucketStart: new Date('2026-10-01T00:00:00.000Z'), orders: 2, revenue: new Prisma.Decimal('100.506'), cancelled: 1 },
        { bucketStart: new Date('2026-10-02T00:00:00.000Z'), orders: 1, revenue: 200, cancelled: 0 },
      ],
      window,
      'day',
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ orders: 2, revenue: 100.51, cancelled: 1 });
    expect(points[1]).toMatchObject({ orders: 1, revenue: 200, cancelled: 0 });
  });

  it('produces one bucket per hour for hourly granularity and zeroes empties', () => {
    const points = assembleOrderTimeseries(
      [{ bucketStart: new Date('2026-10-01T10:00:00.000Z'), orders: 1, revenue: 100.5, cancelled: 0 }],
      window,
      'hour',
    );
    expect(points).toHaveLength(48);
    expect(points[10]).toMatchObject({ orders: 1, revenue: 100.5, cancelled: 0 });
    expect(points.reduce((sum, p) => sum + p.orders, 0)).toBe(1);
  });

  it('aligns the first bucket to the calendar boundary when the window opens mid-bucket', () => {
    const midDayWindow = { from: new Date('2026-10-01T12:30:00.000Z'), to, prevFrom: from, prevTo: to };
    const points = assembleOrderTimeseries([], midDayWindow, 'day');
    expect(points).toHaveLength(2);
    expect(points[0].bucketStart).toBe('2026-10-01T00:00:00.000Z');
    expect(points.every((p) => p.orders === 0)).toBe(true);
  });

  it('never emits buckets after the window end', () => {
    const points = assembleOrderTimeseries(
      [{ bucketStart: new Date('2026-10-05T00:00:00.000Z'), orders: 1, revenue: 1, cancelled: 0 }],
      window,
      'day',
    );
    expect(points).toHaveLength(2);
    expect(points.every((p) => p.orders === 0)).toBe(true);
  });
});

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let prisma: {
    $queryRaw: jest.Mock;
    order: { groupBy: jest.Mock; count: jest.Mock; aggregate: jest.Mock };
    riderTripLedger: { groupBy: jest.Mock };
    commissionLedger: { aggregate: jest.Mock };
    vendor: { count: jest.Mock; findMany: jest.Mock };
    rider: { count: jest.Mock; findMany: jest.Mock };
    user: { count: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      $queryRaw: jest.fn().mockImplementation((strings: readonly string[]) => {
        const sql = strings.join('');
        if (sql.includes('date_trunc')) {
          return [
            {
              bucket: new Date('2026-09-01T00:00:00.000Z'),
              orders: 1,
              revenue: new Prisma.Decimal('100'),
              cancelled: 0,
            },
          ];
        }
        return [{ avgMinutes: 60 }];
      }),
      order: {
        groupBy: jest.fn().mockImplementation((args: { by: string[] }) => {
          if (args.by[0] === 'status') {
            return [{ status: OrderStatus.DELIVERED, _count: { _all: 5 } }];
          }
          return [
            { vendorId: 'vendor-1', _count: { _all: 4 }, _sum: { totalAmount: new Prisma.Decimal('400') } },
          ];
        }),
        count: jest.fn().mockResolvedValue(6),
        aggregate: jest.fn().mockImplementation((args: { where: { status?: string } }) => {
          if (args.where.status === OrderStatus.DELIVERED) {
            return { _count: { _all: 5 }, _sum: {} };
          }
          return {
            _sum: {
              totalAmount: new Prisma.Decimal('600'),
              deliveryFee: new Prisma.Decimal('90'),
            },
          };
        }),
      },
      riderTripLedger: {
        groupBy: jest.fn().mockResolvedValue([
          {
            riderId: 'rider-1',
            _count: { _all: 3 },
            _sum: { deliveryEarnings: new Prisma.Decimal('120.25'), codCollected: new Prisma.Decimal('500') },
          },
        ]),
      },
      commissionLedger: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { commissionAmount: new Prisma.Decimal('90.125') },
        }),
      },
      vendor: {
        count: jest.fn().mockResolvedValue(4),
        findMany: jest.fn().mockResolvedValue([
          { id: 'vendor-1', name: 'Kacchi Bhai', brand: { name: 'Kacchi House' } },
        ]),
      },
      rider: {
        count: jest.fn().mockResolvedValue(2),
        findMany: jest.fn().mockResolvedValue([
          { id: 'rider-1', user: { fullName: 'Karim Rider', phone: '+8801700000099' } },
        ]),
      },
      user: { count: jest.fn().mockResolvedValue(7) },
    };
    service = new AdminAnalyticsService(prisma as never);
  });

  it('assembles cards, status counts, timeseries, and top performers', async () => {
    const result = await service.getAnalyticsOverview(
      new GetAnalyticsOverviewQueryDto(),
    );

    expect(result.cards.totalOrders).toEqual({ value: 6, delta: 0 });
    expect(result.cards.deliveredOrders.value).toBe(5);
    expect(result.cards.cancelledOrders.value).toBe(6);
    expect(result.cards.grossVolume.value).toBe(600);
    expect(result.cards.commission.value).toBe(90.13);
    expect(result.cards.avgDeliveryMinutes.value).toBe(60);
    expect(result.snapshots).toEqual({ activeOutlets: 4, onlineRiders: 2 });
    expect(result.statusCounts.DELIVERED).toBe(5);
    expect(result.statusCounts.PLACED).toBe(0);
    expect(result.timeseries.length).toBeGreaterThan(0);
    expect(result.topOutlets[0]).toMatchObject({
      vendorId: 'vendor-1',
      vendorName: 'Kacchi Bhai',
      brandName: 'Kacchi House',
      orders: 4,
      grossVolume: 400,
    });
    expect(result.topRiders[0]).toMatchObject({
      riderId: 'rider-1',
      riderName: 'Karim Rider',
      trips: 3,
      earnings: 120.25,
      codCollected: 500,
    });
  });

  it('rejects hourly granularity for windows beyond 7 days', async () => {
    const query = new GetAnalyticsOverviewQueryDto();
    query.dateFrom = '2026-09-01T00:00:00.000Z';
    query.dateTo = '2026-09-20T00:00:00.000Z';
    query.granularity = 'hour';
    await expect(service.getAnalyticsOverview(query)).rejects.toThrow(BadRequestException);
  });

  it('summarizes per-status counts honoring date and search filters', async () => {
    prisma.order.groupBy.mockResolvedValueOnce([
      { status: OrderStatus.PLACED, _count: { _all: 2 } },
      { status: OrderStatus.DELIVERED, _count: { _all: 3 } },
    ]);
    prisma.order.count.mockResolvedValueOnce(2);

    const query = new GetOrdersSummaryQueryDto();
    query.dateFrom = '2026-09-01T00:00:00.000Z';
    query.search = 'ORD-1';
    const summary = await service.getOrdersSummary(query);

    expect(summary).toEqual({
      counts: expect.objectContaining({ PLACED: 2, DELIVERED: 3, CANCELLED: 0 }),
      total: 5,
      unassignedCount: 2,
    });
    expect(prisma.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          placedAt: { gte: new Date('2026-09-01T00:00:00.000Z') },
          OR: expect.any(Array),
        }),
      }),
    );
    // The dispatch-queue badge always counts active riderless orders even when
    // the visible list is filtered another way.
    expect(prisma.order.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          riderId: null,
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        }),
      }),
    );
  });

  it('UNASSIGNED narrows the status counts to active riderless orders', async () => {
    prisma.order.groupBy.mockResolvedValueOnce([{ status: OrderStatus.PLACED, _count: { _all: 4 } }]);
    prisma.order.count.mockResolvedValueOnce(4);

    const query = new GetOrdersSummaryQueryDto();
    query.assignment = 'UNASSIGNED';
    const summary = await service.getOrdersSummary(query);

    expect(summary.total).toBe(4);
    expect(prisma.order.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          riderId: null,
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        }),
      }),
    );
  });
});
