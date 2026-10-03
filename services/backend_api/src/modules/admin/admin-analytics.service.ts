import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OrderStatus } from '@prisma/client';
import {
  GetAnalyticsOverviewQueryDto,
  GetOrdersSummaryQueryDto,
} from './dto/admin-insights.dto';

export const MAX_ANALYTICS_SPAN_DAYS = 90;
export const MAX_HOUR_GRANULARITY_SPAN_DAYS = 7;

export interface AnalyticsWindow {
  from: Date;
  to: Date;
  prevFrom: Date;
  prevTo: Date;
}

export interface TimeseriesPoint {
  bucketStart: string;
  orders: number;
  revenue: number;
  cancelled: number;
}

interface OrderFact {
  placedAt: Date;
  status: OrderStatus;
  totalAmount: Prisma.Decimal;
}

/** Resolves the requested analytics window and the equal-length preceding
 *  window used for trend deltas. Open bounds default to the trailing 30 days. */
export function resolveAnalyticsWindow(query: GetAnalyticsOverviewQueryDto, now = new Date()): AnalyticsWindow {
  const to = query.dateTo ? new Date(query.dateTo) : now;
  const from = query.dateFrom
    ? new Date(query.dateFrom)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException('dateFrom/dateTo must be valid ISO-8601 timestamps');
  }
  if (from >= to) {
    throw new BadRequestException('dateFrom must be before dateTo');
  }

  const spanMs = to.getTime() - from.getTime();
  if (spanMs > MAX_ANALYTICS_SPAN_DAYS * 24 * 60 * 60 * 1000) {
    throw new BadRequestException(`Analytics windows are capped at ${MAX_ANALYTICS_SPAN_DAYS} days`);
  }

  return { from, to, prevFrom: new Date(from.getTime() - spanMs), prevTo: from };
}

export function percentDelta(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Buckets raw order facts into equal time buckets for charting. Pure — the
 *  caller pre-fetches only placedAt/status/totalAmount for the window. */
export function bucketOrderTimeseries(
  orders: OrderFact[],
  window: AnalyticsWindow,
  granularity: 'day' | 'hour',
): TimeseriesPoint[] {
  const bucketMs = granularity === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const points: TimeseriesPoint[] = [];

  for (
    let bucketStart = window.from.getTime();
    bucketStart < window.to.getTime();
    bucketStart += bucketMs
  ) {
    const bucketEnd = bucketStart + bucketMs;
    const inBucket = orders.filter((o) => {
      const t = o.placedAt.getTime();
      return t >= bucketStart && t < bucketEnd && t < window.to.getTime();
    });
    points.push({
      bucketStart: new Date(bucketStart).toISOString(),
      orders: inBucket.length,
      revenue:
        Math.round(
          inBucket
            .filter((o) => o.status !== OrderStatus.CANCELLED)
            .reduce((sum, o) => sum + Number(o.totalAmount), 0) * 100,
        ) / 100,
      cancelled: inBucket.filter((o) => o.status === OrderStatus.CANCELLED).length,
    });
  }

  return points;
}

interface WindowMetrics {
  totalOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  grossVolume: number;
  commission: number;
  deliveryFees: number;
  avgOrderValue: number;
  avgDeliveryMinutes: number | null;
  newCustomers: number;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalyticsOverview(query: GetAnalyticsOverviewQueryDto) {
    const window = resolveAnalyticsWindow(query);
    const granularity = query.granularity || 'day';
    if (
      granularity === 'hour' &&
      window.to.getTime() - window.from.getTime() > MAX_HOUR_GRANULARITY_SPAN_DAYS * 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException(
        `Hourly granularity requires a window of at most ${MAX_HOUR_GRANULARITY_SPAN_DAYS} days`,
      );
    }

    const current = await this.collectWindowMetrics(window.from, window.to);
    const previous = await this.collectWindowMetrics(window.prevFrom, window.prevTo);

    const [statusCountsRaw, orderFacts, topOutletsRaw, topRidersRaw, activeOutlets, onlineRiders] =
      await Promise.all([
        this.prisma.order.groupBy({
          by: ['status'],
          where: { placedAt: { gte: window.from, lte: window.to } },
          _count: { _all: true },
        }),
        this.prisma.order.findMany({
          where: { placedAt: { gte: window.from, lte: window.to } },
          select: { placedAt: true, status: true, totalAmount: true },
        }),
        this.prisma.order.groupBy({
          by: ['vendorId'],
          where: {
            placedAt: { gte: window.from, lte: window.to },
            status: { not: OrderStatus.CANCELLED },
          },
          _count: { _all: true },
          _sum: { totalAmount: true },
          orderBy: { _count: { vendorId: 'desc' } },
          take: 5,
        }),
        this.prisma.riderTripLedger.groupBy({
          by: ['riderId'],
          where: { order: { placedAt: { gte: window.from, lte: window.to } } },
          _count: { _all: true },
          _sum: { deliveryEarnings: true, codCollected: true },
          orderBy: { _count: { riderId: 'desc' } },
          take: 5,
        }),
        this.prisma.vendor.count({ where: { isActive: true } }),
        this.prisma.rider.count({ where: { isOnline: true, isApproved: true } }),
      ]);

    const [outletNames, riderNames] = await Promise.all([
      topOutletsRaw.length
        ? this.prisma.vendor.findMany({
            where: { id: { in: topOutletsRaw.map((o) => o.vendorId) } },
            select: { id: true, name: true, brand: { select: { name: true } } },
          })
        : Promise.resolve([]),
      topRidersRaw.length
        ? this.prisma.rider.findMany({
            where: { id: { in: topRidersRaw.map((r) => r.riderId) } },
            select: { id: true, user: { select: { fullName: true, phone: true } } },
          })
        : Promise.resolve([]),
    ]);

    const outletNameById = new Map(outletNames.map((v) => [v.id, v]));
    const riderNameById = new Map(riderNames.map((r) => [r.id, r]));

    const statusCounts = Object.fromEntries(
      Object.values(OrderStatus).map((status) => [
        status,
        statusCountsRaw.find((s) => s.status === status)?._count._all ?? 0,
      ]),
    );

    return {
      window: { from: window.from.toISOString(), to: window.to.toISOString() },
      cards: {
        totalOrders: this.withDelta(current.totalOrders, previous.totalOrders),
        deliveredOrders: this.withDelta(current.deliveredOrders, previous.deliveredOrders),
        cancelledOrders: this.withDelta(current.cancelledOrders, previous.cancelledOrders),
        cancellationRate: this.withDelta(
          this.rate(current.cancelledOrders, current.totalOrders),
          this.rate(previous.cancelledOrders, previous.totalOrders),
          'percentagePoints',
        ),
        grossVolume: this.withDelta(current.grossVolume, previous.grossVolume),
        commission: this.withDelta(current.commission, previous.commission),
        deliveryFees: this.withDelta(current.deliveryFees, previous.deliveryFees),
        avgOrderValue: this.withDelta(current.avgOrderValue, previous.avgOrderValue),
        avgDeliveryMinutes: {
          value: current.avgDeliveryMinutes,
          delta: percentDelta(current.avgDeliveryMinutes ?? 0, previous.avgDeliveryMinutes ?? 0),
        },
        newCustomers: this.withDelta(current.newCustomers, previous.newCustomers),
      },
      snapshots: { activeOutlets, onlineRiders },
      statusCounts,
      timeseries: bucketOrderTimeseries(orderFacts, window, granularity),
      topOutlets: topOutletsRaw.map((o) => ({
        vendorId: o.vendorId,
        vendorName: outletNameById.get(o.vendorId)?.name || 'Store',
        brandName: outletNameById.get(o.vendorId)?.brand?.name || null,
        orders: o._count._all,
        grossVolume: Math.round(Number(o._sum.totalAmount ?? 0) * 100) / 100,
      })),
      topRiders: topRidersRaw.map((r) => ({
        riderId: r.riderId,
        riderName: riderNameById.get(r.riderId)?.user?.fullName || 'Courier Partner',
        phone: riderNameById.get(r.riderId)?.user?.phone || null,
        trips: r._count._all,
        earnings: Math.round(Number(r._sum.deliveryEarnings ?? 0) * 100) / 100,
        codCollected: Math.round(Number(r._sum.codCollected ?? 0) * 100) / 100,
      })),
    };
  }

  /** Status-count summary powering the Order History glance cards; honors the
   *  same date/search/assignment semantics as GET /admin/orders minus the
   *  status filter. Also returns the live dispatch queue size so the console
   *  can badge the "Unassigned" toggle. */
  async getOrdersSummary(query: GetOrdersSummaryQueryDto) {
    const where = this.buildOrderSummaryWhere(query);

    const [grouped, unassignedCount] = await Promise.all([
      this.prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.order.count({
        where: {
          ...this.buildOrderSummaryWhere({ ...query, assignment: undefined }),
          riderId: null,
          status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] },
        },
      }),
    ]);

    const counts = Object.fromEntries(
      Object.values(OrderStatus).map((status) => [
        status,
        grouped.find((s) => s.status === status)?._count._all ?? 0,
      ]),
    );

    return {
      counts,
      total: grouped.reduce((sum, s) => sum + s._count._all, 0),
      unassignedCount,
    };
  }

  private buildOrderSummaryWhere(query: GetOrdersSummaryQueryDto): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {};
    if (query.dateFrom || query.dateTo) {
      where.placedAt = {
        ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
        ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
      };
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { orderNumber: { contains: term, mode: 'insensitive' } },
        { customer: { phone: { contains: term } } },
        { customer: { fullName: { contains: term, mode: 'insensitive' } } },
      ];
    }
    if (query.assignment === 'UNASSIGNED') {
      where.riderId = null;
      if (!where.status) {
        where.status = { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] };
      }
    } else if (query.assignment === 'ASSIGNED') {
      where.riderId = { not: null };
    }
    return where;
  }

  private async collectWindowMetrics(from: Date, to: Date): Promise<WindowMetrics> {
    const placedAt: Prisma.DateTimeFilter = { gte: from, lte: to };
    const notCancelled = { placedAt, status: { not: OrderStatus.CANCELLED } };

    const [totalOrders, deliveredRaw, cancelled, volumeRaw, ledgers, deliveredPairs, newCustomers] =
      await Promise.all([
        this.prisma.order.count({ where: { placedAt } }),
        this.prisma.order.aggregate({
          where: { placedAt, status: OrderStatus.DELIVERED },
          _count: { _all: true },
        }),
        this.prisma.order.count({ where: { placedAt, status: OrderStatus.CANCELLED } }),
        this.prisma.order.aggregate({ where: notCancelled, _sum: { totalAmount: true, deliveryFee: true } }),
        this.prisma.commissionLedger.aggregate({
          where: { createdAt: { gte: from, lte: to } },
          _sum: { commissionAmount: true },
        }),
        this.prisma.order.findMany({
          where: { placedAt, status: OrderStatus.DELIVERED },
          select: { placedAt: true, deliveredAt: true },
        }),
        this.prisma.user.count({
          where: { role: 'CUSTOMER', createdAt: { gte: from, lte: to } },
        }),
      ]);

    const deliveredOrders = deliveredRaw._count._all;
    const nonCancelledOrders = totalOrders - cancelled;
    const grossVolume = Math.round(Number(volumeRaw._sum.totalAmount ?? 0) * 100) / 100;
    const deliveryMinutes = deliveredPairs
      .filter((o) => o.deliveredAt)
      .map((o) => (o.deliveredAt as Date).getTime() - o.placedAt.getTime());

    return {
      totalOrders,
      deliveredOrders,
      cancelledOrders: cancelled,
      grossVolume,
      commission: Math.round(Number(ledgers._sum.commissionAmount ?? 0) * 100) / 100,
      deliveryFees: Math.round(Number(volumeRaw._sum.deliveryFee ?? 0) * 100) / 100,
      avgOrderValue: nonCancelledOrders > 0 ? Math.round((grossVolume / nonCancelledOrders) * 100) / 100 : 0,
      avgDeliveryMinutes:
        deliveryMinutes.length > 0
          ? Math.round(
              (deliveryMinutes.reduce((sum, ms) => sum + ms, 0) / deliveryMinutes.length / 60000) * 10,
            ) / 10
          : null,
      newCustomers,
    };
  }

  private withDelta(
    value: number,
    previous: number,
    mode: 'percent' | 'percentagePoints' = 'percent',
  ): { value: number; delta: number | null } {
    if (mode === 'percentagePoints') {
      const delta = Math.round((value - previous) * 10) / 10;
      return { value, delta };
    }
    return { value, delta: percentDelta(value, previous) };
  }

  private rate(numerator: number, denominator: number): number {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 1000) / 10;
  }
}
