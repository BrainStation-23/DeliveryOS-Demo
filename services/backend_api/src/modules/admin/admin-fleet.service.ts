import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { OrderStatus, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { outletDisplayName } from '../../common/utils/outlet-display-name';
import { PaginatedResult, toPaginatedResult } from '../../common/dto/pagination.dto';
import { GetRidersQueryDto } from './dto/admin-governance.dto';

import { IN_FLIGHT_STATUSES } from '../../common/constants/order.constants';
export { IN_FLIGHT_STATUSES };

export type FleetRosterStatus = 'ONLINE' | 'ON_TRIP' | 'OFFLINE';

export interface RiderRow {
  id: string;
  userId: string;
  fullName: string;
  phone: string;
  email: string | null;
  vehicleType: string;
  isOnline: boolean;
  isApproved: boolean;
  userStatus: string;
  status: FleetRosterStatus;
  cashInHand: number;
  maxCashLimit: number;
  cashSafetyWarning: boolean;
  latitude: number | null;
  longitude: number | null;
  totalDeliveries: number;
  earnings30d: number;
  activeOrder: { id: string; orderNumber: string; status: OrderStatus; vendorName: string | null } | null;
  joinedAt: Date;
}

/** Computes the derived roster status; riders without a GPS fix keep null
 *  coordinates so the map never plots a fabricated position. */
export function deriveFleetStatus(
  isOnline: boolean,
  hasActiveOrder: boolean,
): FleetRosterStatus {
  return isOnline ? (hasActiveOrder ? 'ON_TRIP' : 'ONLINE') : 'OFFLINE';
}

@Injectable()
export class AdminFleetService {
  constructor(private readonly prisma: PrismaService) {}

  async getRidersPage(query: GetRidersQueryDto): Promise<PaginatedResult<RiderRow>> {
    const where: Prisma.RiderWhereInput = {};

    // The applicant queue is its own dimension: pending couriers can never
    // hold duty, so any duty-status filter is meaningless there and is
    // deliberately ignored — Applicants always shows every applicant.
    if (query.approvalStatus === 'PENDING') {
      where.isApproved = false;
    } else {
      if (query.approvalStatus === 'APPROVED') {
        where.isApproved = true;
      }

      // Derived duty status: ONLINE = on duty without an in-flight order,
      // ON_TRIP = on duty with one, OFFLINE = not on duty. Falls back to the
      // legacy isOnline boolean when no derived status is requested.
      if (query.status === 'OFFLINE') {
        where.isOnline = false;
      } else if (query.status === 'ONLINE') {
        where.isOnline = true;
        where.orders = { none: { status: { in: [...IN_FLIGHT_STATUSES] } } };
      } else if (query.status === 'ON_TRIP') {
        where.isOnline = true;
        where.orders = { some: { status: { in: [...IN_FLIGHT_STATUSES] } } };
      } else if (query.isOnlineParsed !== undefined) {
        where.isOnline = query.isOnlineParsed;
      }
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { user: { fullName: { contains: term, mode: 'insensitive' } } },
        { user: { phone: { contains: term } } },
        { vehicleType: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [riders, total] = await this.prisma.$transaction([
      this.prisma.rider.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, phone: true, email: true, status: true, createdAt: true } },
          _count: { select: { orders: true, trips: true } },
        },
        orderBy: [{ isOnline: 'desc' }, { updatedAt: 'desc' }],
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.rider.count({ where }),
    ]);

    const riderIds = riders.map((r) => r.id);

    // Batched per-row enrichment — never N+1: three grouped queries per page.
    const [deliveries, earnings, activeOrders] = await Promise.all([
      riderIds.length
        ? this.prisma.order.groupBy({
            by: ['riderId'],
            where: { riderId: { in: riderIds }, status: OrderStatus.DELIVERED },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      riderIds.length
        ? this.prisma.riderTripLedger.groupBy({
            by: ['riderId'],
            where: { riderId: { in: riderIds }, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
            _sum: { deliveryEarnings: true },
          })
        : Promise.resolve([]),
      this.prisma.order.findMany({
        where: { riderId: { in: riderIds }, status: { in: [...IN_FLIGHT_STATUSES] } },
        select: { riderId: true, id: true, orderNumber: true, status: true, vendor: { select: { name: true, brand: { select: { name: true } } } } },
        orderBy: { placedAt: 'desc' },
      }),
    ]);

    const deliveriesByRider = new Map(deliveries.map((d) => [d.riderId, d._count._all]));
    const earningsByRider = new Map(earnings.map((e) => [e.riderId, Number(e._sum.deliveryEarnings ?? 0)]));
    const activeOrderByRider = new Map<string, (typeof activeOrders)[number]>();
    for (const order of activeOrders) {
      if (order.riderId && !activeOrderByRider.has(order.riderId)) {
        activeOrderByRider.set(order.riderId, order);
      }
    }

    const items: RiderRow[] = riders.map((r) => {
      const active = activeOrderByRider.get(r.id);
      return {
        id: r.id,
        userId: r.userId,
        fullName: r.user.fullName || 'Courier Partner',
        phone: r.user.phone,
        email: r.user.email,
        vehicleType: r.vehicleType,
        isOnline: r.isOnline,
        isApproved: r.isApproved ?? true,
        userStatus: r.user.status,
        status: deriveFleetStatus(r.isOnline, !!active),
        cashInHand: Number(r.cashInHand),
        maxCashLimit: Number(r.maxCashLimit),
        cashSafetyWarning: Number(r.cashInHand) >= Number(r.maxCashLimit) * 0.9,
        latitude: r.latitude ?? null,
        longitude: r.longitude ?? null,
        totalDeliveries: deliveriesByRider.get(r.id) ?? 0,
        earnings30d: Math.round((earningsByRider.get(r.id) ?? 0) * 100) / 100,
        activeOrder: active
          ? {
              id: active.id,
              orderNumber: active.orderNumber,
              status: active.status,
              vendorName: outletDisplayName(active.vendor?.brand?.name, active.vendor?.name),
            }
          : null,
        joinedAt: r.user.createdAt,
      };
    });

    return toPaginatedResult(items, total, query);
  }

  async getRiderDetail(riderId: string) {
    const rider = await this.prisma.rider.findUnique({
      where: { id: riderId },
      include: { user: { select: { id: true, fullName: true, phone: true, email: true, status: true, createdAt: true } } },
    });
    if (!rider) throw new NotFoundException('Rider not found');

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [totalDeliveries, lifetimeEarnings, earnings30d, activeOrders, recentOrders, recentDeposits] =
      await Promise.all([
        this.prisma.order.count({ where: { riderId, status: OrderStatus.DELIVERED } }),
        this.prisma.riderTripLedger.aggregate({
          where: { riderId },
          _sum: { deliveryEarnings: true, codCollected: true },
          _count: { _all: true },
        }),
        this.prisma.riderTripLedger.aggregate({
          where: { riderId, createdAt: { gte: thirtyDaysAgo } },
          _sum: { deliveryEarnings: true },
        }),
        this.prisma.order.findFirst({
          where: { riderId, status: { in: [...IN_FLIGHT_STATUSES] } },
          select: { id: true, orderNumber: true, status: true, vendor: { select: { name: true, brand: { select: { name: true } } } } },
          orderBy: { placedAt: 'desc' },
        }),
        this.prisma.order.findMany({
          where: { riderId },
          orderBy: { placedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            paymentMethod: true,
            placedAt: true,
            vendor: { select: { name: true, brand: { select: { name: true } } } },
          },
        }),
        this.prisma.cashDeposit.findMany({
          where: { riderId },
          orderBy: { depositedAt: 'desc' },
          take: 5,
          select: { id: true, amount: true, status: true, depositedAt: true, referenceNo: true, note: true },
        }),
      ]);

    return {
      rider: {
        id: rider.id,
        userId: rider.userId,
        fullName: rider.user.fullName || 'Courier Partner',
        phone: rider.user.phone,
        email: rider.user.email,
        userStatus: rider.user.status,
        vehicleType: rider.vehicleType,
        isOnline: rider.isOnline,
        isApproved: rider.isApproved ?? true,
        cashInHand: Number(rider.cashInHand),
        maxCashLimit: Number(rider.maxCashLimit),
        cashSafetyWarning: Number(rider.cashInHand) >= Number(rider.maxCashLimit) * 0.9,
        latitude: rider.latitude ?? null,
        longitude: rider.longitude ?? null,
        joinedAt: rider.user.createdAt,
        lastSeenAt: rider.updatedAt,
      },
      status: deriveFleetStatus(rider.isOnline, !!activeOrders),
      stats: {
        totalDeliveries,
        totalTrips: lifetimeEarnings._count._all,
        lifetimeEarnings: Math.round(Number(lifetimeEarnings._sum.deliveryEarnings ?? 0) * 100) / 100,
        lifetimeCodCollected: Math.round(Number(lifetimeEarnings._sum.codCollected ?? 0) * 100) / 100,
        earnings30d: Math.round(Number(earnings30d._sum.deliveryEarnings ?? 0) * 100) / 100,
      },
      activeOrder: activeOrders
        ? {
            id: activeOrders.id,
            orderNumber: activeOrders.orderNumber,
            status: activeOrders.status,
            vendorName: outletDisplayName(activeOrders.vendor?.brand?.name, activeOrders.vendor?.name),
          }
        : null,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        vendorName: outletDisplayName(o.vendor?.brand?.name, o.vendor?.name),
        totalAmount: Number(o.totalAmount),
        paymentMethod: o.paymentMethod,
        placedAt: o.placedAt,
      })),
      recentDeposits: recentDeposits.map((d) => ({
        id: d.id,
        amount: Number(d.amount),
        status: d.status as SettlementStatus | string,
        depositedAt: d.depositedAt,
        referenceNo: d.referenceNo,
        note: d.note,
      })),
    };
  }
}
