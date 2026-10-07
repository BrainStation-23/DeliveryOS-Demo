import { Prisma, SettlementStatus } from '@prisma/client';
import {
  AdminFinanceService,
  buildLedgerWhere,
  FinanceLedgerRow,
  LEDGER_CSV_HEADER,
  ledgerRowToCsvLine,
} from './admin-finance.service';
import { GetFinanceLedgerQueryDto } from './dto/admin-insights.dto';

describe('buildLedgerWhere', () => {
  it('returns an empty filter when no query params are set', () => {
    expect(buildLedgerWhere(new GetFinanceLedgerQueryDto())).toEqual({});
  });

  it('bounds the ledger by order placedAt and settlement status', () => {
    const query = new GetFinanceLedgerQueryDto();
    query.dateFrom = '2026-09-01T00:00:00.000Z';
    query.dateTo = '2026-09-30T23:59:59.999Z';
    query.settlementStatus = SettlementStatus.SETTLED;

    expect(buildLedgerWhere(query)).toEqual({
      order: {
        placedAt: {
          gte: new Date('2026-09-01T00:00:00.000Z'),
          lte: new Date('2026-09-30T23:59:59.999Z'),
        },
      },
      settlementStatus: SettlementStatus.SETTLED,
    });
  });

  it('searches across order number, outlet, brand, and rider name', () => {
    const query = new GetFinanceLedgerQueryDto();
    query.search = 'kacchi';
    const where = buildLedgerWhere(query);

    expect(where.OR).toHaveLength(4);
    expect(where.OR).toContainEqual({
      order: { orderNumber: { contains: 'kacchi', mode: 'insensitive' } },
    });
    expect(where.OR).toContainEqual({
      order: { rider: { user: { fullName: { contains: 'kacchi', mode: 'insensitive' } } } },
    });
  });
});

describe('AdminFinanceService.getFinanceLedger', () => {
  let service: AdminFinanceService;
  let prisma: {
    commissionLedger: { findMany: jest.Mock; count: jest.Mock; aggregate: jest.Mock };
    riderTripLedger: { findMany: jest.Mock; aggregate: jest.Mock };
    $transaction: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      commissionLedger: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ledger-1',
            orderId: 'order-1',
            grossAmount: new Prisma.Decimal('500'),
            commissionRate: new Prisma.Decimal('15'),
            commissionAmount: new Prisma.Decimal('75'),
            netVendorPayable: new Prisma.Decimal('425'),
            settlementStatus: SettlementStatus.SETTLED,
            settledAt: new Date('2026-10-01T00:00:00.000Z'),
            order: {
              orderNumber: 'ORD-20260930-0001',
              placedAt: new Date('2026-09-30T18:00:00.000Z'),
              rider: { user: { fullName: 'Karim Rider' } },
            },
            vendor: { name: 'Kacchi Bhai', brand: { name: 'Kacchi House' } },
            settlementBatch: { batchNumber: 'BATCH-001' },
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({
          _count: { _all: 1 },
          _sum: {
            grossAmount: new Prisma.Decimal('500'),
            commissionAmount: new Prisma.Decimal('75'),
            netVendorPayable: new Prisma.Decimal('425'),
          },
        }),
      },
      riderTripLedger: {
        findMany: jest.fn().mockResolvedValue([
          {
            orderId: 'order-1',
            deliveryEarnings: new Prisma.Decimal('40'),
            codCollected: new Prisma.Decimal('500'),
          },
        ]),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { deliveryEarnings: new Prisma.Decimal('40'), codCollected: new Prisma.Decimal('500') },
        }),
      },
          $transaction: jest.fn(),
    };
    prisma.$transaction = jest.fn().mockImplementation((ops: unknown[]) => Promise.all(ops));
    service = new AdminFinanceService(prisma as never);
  });

  it('joins commission and rider trip entries per order with page-spanning summary totals', async () => {
    const result = await service.getFinanceLedger(new GetFinanceLedgerQueryDto());

    expect(result.items[0]).toEqual({
      id: 'ledger-1',
      orderId: 'order-1',
      orderNumber: 'ORD-20260930-0001',
      placedAt: new Date('2026-09-30T18:00:00.000Z'),
      vendorId: undefined,
      vendorName: 'Kacchi Bhai',
      brandName: 'Kacchi House',
      riderName: 'Karim Rider',
      grossAmount: 500,
      commissionRate: 15,
      commissionAmount: 75,
      netVendorPayable: 425,
      riderEarnings: 40,
      codCollected: 500,
      settlementStatus: SettlementStatus.SETTLED,
      batchNumber: 'BATCH-001',
      settledAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(result.summary).toEqual({
      orders: 1,
      grossSales: 500,
      platformCommission: 75,
      netVendorPayable: 425,
      riderPayouts: 40,
      codCollected: 500,
    });
  });

  it('keeps rider earnings null for orders that never dispatched a courier', async () => {
    prisma.riderTripLedger.findMany.mockResolvedValue([]);
    const result = await service.getFinanceLedger(new GetFinanceLedgerQueryDto());
    expect(result.items[0].riderEarnings).toBeNull();
    expect(result.items[0].codCollected).toBeNull();
  });
});

describe('AdminFinanceService.streamFinanceLedgerRows', () => {
  const ledger = (id: string, placedAt: string) => ({
    id,
    orderId: `order-${id}`,
    vendorId: 'v1',
    grossAmount: new Prisma.Decimal('100'),
    commissionRate: new Prisma.Decimal('15'),
    commissionAmount: new Prisma.Decimal('15'),
    netVendorPayable: new Prisma.Decimal('85'),
    settlementStatus: SettlementStatus.PENDING,
    settledAt: null,
    order: { orderNumber: `ORD-${id}`, placedAt: new Date(placedAt), rider: null },
    vendor: { name: 'Kacchi Bhai', brand: { name: null } },
    settlementBatch: null,
  });

  it('yields every filtered row across keyset batches without skipping ties', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([ledger('a', '2026-10-02T10:00:00.000Z'), ledger('b', '2026-10-02T10:00:00.000Z')])
      .mockResolvedValueOnce([ledger('c', '2026-10-01T09:00:00.000Z')])
      .mockResolvedValueOnce([]);
    const prisma = {
      commissionLedger: { findMany, count: jest.fn(), aggregate: jest.fn() },
      riderTripLedger: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn() },
    };
    const service = new AdminFinanceService(prisma as never);

    const rows: FinanceLedgerRow[] = [];
    for await (const row of service.streamFinanceLedgerRows(new GetFinanceLedgerQueryDto(), 2)) {
      rows.push(row);
    }

    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
    // Full batch → one more fetch; the partial second batch ends the stream
    // without a third round-trip.
    expect(findMany).toHaveBeenCalledTimes(2);
    // Second fetch must resume strictly after the last yielded (placedAt, id)
    // pair, including the equal-timestamp tie broken by id.
    const secondWhere = findMany.mock.calls[1][0].where;
    expect(secondWhere.AND[1].OR).toEqual([
      { order: { placedAt: { lt: new Date('2026-10-02T10:00:00.000Z') } } },
      { AND: [{ order: { placedAt: new Date('2026-10-02T10:00:00.000Z') } }, { id: { gt: 'b' } }] },
    ]);
  });

  it('stops after a partial batch without an extra round-trip', async () => {
    const findMany = jest.fn().mockResolvedValue([ledger('a', '2026-10-02T10:00:00.000Z')]);
    const prisma = {
      commissionLedger: { findMany, count: jest.fn(), aggregate: jest.fn() },
      riderTripLedger: { findMany: jest.fn().mockResolvedValue([]), aggregate: jest.fn() },
    };
    const service = new AdminFinanceService(prisma as never);

    const rows: FinanceLedgerRow[] = [];
    for await (const row of service.streamFinanceLedgerRows(new GetFinanceLedgerQueryDto(), 2)) {
      rows.push(row);
    }

    expect(rows).toHaveLength(1);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});

describe('AdminFinanceService.generateLedgerCsv', () => {
  const service = new AdminFinanceService({} as never);

  const row: FinanceLedgerRow = {
    id: 'ledger-1',
    orderId: 'order-1',
    orderNumber: 'ORD-1',
    placedAt: new Date('2026-09-30T18:00:00.000Z'),
    vendorId: 'v1',
    vendorName: 'Kacchi, Bhai',
    brandName: null,
    riderName: null,
    grossAmount: 500,
    commissionRate: 15,
    commissionAmount: 75,
    netVendorPayable: 425,
    riderEarnings: null,
    codCollected: null,
    settlementStatus: SettlementStatus.PENDING,
    batchNumber: null,
    settledAt: null,
  };

  it('emits a header plus one RFC 4180 row with escaped commas', () => {
    const csv = service.generateLedgerCsv([row]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('Order Number');
    expect(lines[1]).toContain('"Kacchi, Bhai"');
    expect(lines[1]).toContain('500.00');
    expect(lines[1]).toContain('PENDING');
  });

  it('renders missing rider/batch values as em-dashes', () => {
    const csv = service.generateLedgerCsv([row]);
    expect(csv).toContain('—');
  });
});

describe('ledgerRowToCsvLine', () => {
  it('matches the header column order and escapes embedded quotes', () => {
    const line = ledgerRowToCsvLine({
      id: 'l1',
      orderId: 'o1',
      orderNumber: 'ORD-"1"',
      placedAt: new Date('2026-09-30T18:00:00.000Z'),
      vendorId: 'v1',
      vendorName: 'Store',
      brandName: 'Brand',
      riderName: 'Karim',
      grossAmount: 100,
      commissionRate: 15,
      commissionAmount: 15,
      netVendorPayable: 85,
      riderEarnings: 12.5,
      codCollected: 0,
      settlementStatus: SettlementStatus.SETTLED,
      batchNumber: 'B-1',
      settledAt: new Date('2026-10-01T00:00:00.000Z'),
    });
    expect(line.startsWith('"ORD-""1"""')).toBe(true);
    expect(line.split(',')).toHaveLength(LEDGER_CSV_HEADER.split(',').length);
  });
});
