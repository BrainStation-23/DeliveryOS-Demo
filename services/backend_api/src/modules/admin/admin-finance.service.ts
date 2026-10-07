import { Injectable } from '@nestjs/common';
import { Prisma, SettlementStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PaginatedResult, toPaginatedResult } from '../../common/dto/pagination.dto';
import { GetFinanceLedgerQueryDto } from './dto/admin-insights.dto';

export interface FinanceLedgerRow {
  id: string;
  orderId: string;
  orderNumber: string;
  placedAt: Date;
  vendorId: string;
  vendorName: string;
  brandName: string | null;
  riderName: string | null;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netVendorPayable: number;
  riderEarnings: number | null;
  codCollected: number | null;
  settlementStatus: SettlementStatus;
  batchNumber: string | null;
  settledAt: Date | null;
}

export interface FinanceLedgerSummary {
  orders: number;
  grossSales: number;
  platformCommission: number;
  netVendorPayable: number;
  riderPayouts: number;
  codCollected: number;
}

/** Builds the shared where-clause for the unified ledger: date window on
 *  order.placedAt, settlement status, and cross-party search. */
export function buildLedgerWhere(query: GetFinanceLedgerQueryDto): Prisma.CommissionLedgerWhereInput {
  const where: Prisma.CommissionLedgerWhereInput = {};
  const placedAt: Prisma.DateTimeFilter = {};
  if (query.dateFrom) placedAt.gte = new Date(query.dateFrom);
  if (query.dateTo) placedAt.lte = new Date(query.dateTo);
  if (placedAt.gte || placedAt.lte) {
    where.order = { placedAt };
  }
  if (query.settlementStatus) {
    where.settlementStatus = query.settlementStatus;
  }
  if (query.search?.trim()) {
    const term = query.search.trim();
    const filters: Prisma.CommissionLedgerWhereInput[] = [
      { order: { orderNumber: { contains: term, mode: 'insensitive' } } },
      { vendor: { name: { contains: term, mode: 'insensitive' } } },
      { vendor: { brand: { name: { contains: term, mode: 'insensitive' } } } },
      { order: { rider: { user: { fullName: { contains: term, mode: 'insensitive' } } } } },
    ];
    where.OR = filters;
  }
  return where;
}

const LEDGER_INCLUDE = {
  order: {
    select: {
      orderNumber: true,
      placedAt: true,
      rider: { select: { user: { select: { fullName: true } } } },
    },
  },
  vendor: { select: { name: true, brand: { select: { name: true } } } },
  settlementBatch: { select: { batchNumber: true } },
} as const;

@Injectable()
export class AdminFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getFinanceLedger(query: GetFinanceLedgerQueryDto): Promise<
    PaginatedResult<FinanceLedgerRow> & { summary: FinanceLedgerSummary }
  > {
    const where = buildLedgerWhere(query);

    const [ledgers, total] = await this.prisma.$transaction([
      this.prisma.commissionLedger.findMany({
        where,
        // Secondary id sort makes page ordering deterministic for tied placedAt
        orderBy: [{ order: { placedAt: 'desc' } }, { id: 'asc' }],
        skip: query.skip,
        take: query.limit,
        include: LEDGER_INCLUDE,
      }),
      this.prisma.commissionLedger.count({ where }),
    ]);

    const tripByOrder = await this.tripLedgersByOrder(ledgers.map((l) => l.orderId));
    const items: FinanceLedgerRow[] = ledgers.map((l) =>
      this.mapLedgerRow(l, tripByOrder.get(l.orderId)),
    );

    // Summary spans the entire filtered set, not just the current page.
    const [commissionAgg, riderAgg] = await Promise.all([
      this.prisma.commissionLedger.aggregate({
        where,
        _count: { _all: true },
        _sum: { grossAmount: true, commissionAmount: true, netVendorPayable: true },
      }),
      this.prisma.riderTripLedger.aggregate({
        where: {
          ...(query.settlementStatus ? { status: query.settlementStatus } : {}),
          order: {
            ...(query.dateFrom || query.dateTo
              ? {
                  placedAt: {
                    ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
                    ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}),
                  },
                }
              : {}),
          },
        },
        _sum: { deliveryEarnings: true, codCollected: true },
      }),
    ]);

    const round = (value: number): number => Math.round(value * 100) / 100;

    return {
      ...toPaginatedResult(items, total, query),
      summary: {
        orders: commissionAgg._count._all,
        grossSales: round(Number(commissionAgg._sum.grossAmount ?? 0)),
        platformCommission: round(Number(commissionAgg._sum.commissionAmount ?? 0)),
        netVendorPayable: round(Number(commissionAgg._sum.netVendorPayable ?? 0)),
        riderPayouts: round(Number(riderAgg._sum.deliveryEarnings ?? 0)),
        codCollected: round(Number(riderAgg._sum.codCollected ?? 0)),
      },
    };
  }

  /** Keyset-paginated cursor stream of ledger rows for CSV export. Yields at
   *  most `batchSize` rows per database round-trip so exports of any size
   *  hold one batch in memory instead of the entire filtered set. */
  async *streamFinanceLedgerRows(
    query: GetFinanceLedgerQueryDto,
    batchSize = 500,
  ): AsyncGenerator<FinanceLedgerRow> {
    const baseWhere = buildLedgerWhere(query);
    let keyset: { placedAt: Date; id: string } | null = null;

    for (;;) {
      const where: Prisma.CommissionLedgerWhereInput = keyset
        ? {
            AND: [
              baseWhere,
              {
                OR: [
                  { order: { placedAt: { lt: keyset.placedAt } } },
                  { AND: [{ order: { placedAt: keyset.placedAt } }, { id: { gt: keyset.id } }] },
                ],
              },
            ],
          }
        : baseWhere;

      const ledgers = await this.prisma.commissionLedger.findMany({
        where,
        orderBy: [{ order: { placedAt: 'desc' } }, { id: 'asc' }],
        take: batchSize,
        include: LEDGER_INCLUDE,
      });
      if (ledgers.length === 0) return;

      const tripByOrder = await this.tripLedgersByOrder(ledgers.map((l) => l.orderId));
      for (const ledger of ledgers) {
        yield this.mapLedgerRow(ledger, tripByOrder.get(ledger.orderId));
      }
      if (ledgers.length < batchSize) return;

      const last = ledgers[ledgers.length - 1];
      keyset = { placedAt: last.order.placedAt, id: last.id };
    }
  }

  private async tripLedgersByOrder(orderIds: string[]) {
    if (orderIds.length === 0) return new Map<string, never>();
    const tripLedgers = await this.prisma.riderTripLedger.findMany({
      where: { orderId: { in: orderIds } },
      select: { orderId: true, deliveryEarnings: true, codCollected: true },
    });
    return new Map(tripLedgers.map((t) => [t.orderId, t]));
  }

  private mapLedgerRow(
    l: Prisma.CommissionLedgerGetPayload<{ include: typeof LEDGER_INCLUDE }>,
    trip: { orderId: string; deliveryEarnings: Prisma.Decimal; codCollected: Prisma.Decimal } | undefined,
  ): FinanceLedgerRow {
    return {
      id: l.id,
      orderId: l.orderId,
      orderNumber: l.order.orderNumber,
      placedAt: l.order.placedAt,
      vendorId: l.vendorId,
      vendorName: l.vendor?.name || 'Store',
      brandName: l.vendor?.brand?.name || null,
      riderName: l.order.rider?.user?.fullName || null,
      grossAmount: Number(l.grossAmount),
      commissionRate: Number(l.commissionRate),
      commissionAmount: Number(l.commissionAmount),
      netVendorPayable: Number(l.netVendorPayable),
      riderEarnings: trip ? Number(trip.deliveryEarnings) : null,
      codCollected: trip ? Number(trip.codCollected) : null,
      settlementStatus: l.settlementStatus,
      batchNumber: l.settlementBatch?.batchNumber || null,
      settledAt: l.settledAt,
    };
  }

  /** RFC 4180 CSV for the unified per-order ledger (mirrors settlement export). */
  generateLedgerCsv(rows: FinanceLedgerRow[]): string {
    return [LEDGER_CSV_HEADER, ...rows.map(ledgerRowToCsvLine)].join('\n');
  }
}

export const LEDGER_CSV_HEADER = [
  'Order Number',
  'Placed At',
  'Outlet',
  'Brand',
  'Rider',
  'Gross (BDT)',
  'Commission Rate (%)',
  'Commission (BDT)',
  'Net Vendor Payable (BDT)',
  'Rider Earnings (BDT)',
  'COD Collected (BDT)',
  'Settlement Status',
  'Batch',
  'Settled At',
].join(',');

export function ledgerRowToCsvLine(r: FinanceLedgerRow): string {
  const escape = (value: string): string => `"${value.replace(/"/g, '""')}"`;

  return [
    escape(r.orderNumber),
    escape(r.placedAt.toISOString()),
    escape(r.vendorName),
    escape(r.brandName || 'Independent'),
    escape(r.riderName || '—'),
    r.grossAmount.toFixed(2),
    r.commissionRate.toFixed(2),
    r.commissionAmount.toFixed(2),
    r.netVendorPayable.toFixed(2),
    r.riderEarnings !== null ? r.riderEarnings.toFixed(2) : '—',
    r.codCollected !== null ? r.codCollected.toFixed(2) : '—',
    escape(r.settlementStatus),
    escape(r.batchNumber || '—'),
    escape(r.settledAt ? r.settledAt.toISOString() : '—'),
  ].join(',');
}
