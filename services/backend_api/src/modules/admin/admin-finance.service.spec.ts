import { Prisma, SettlementStatus } from '@prisma/client';
import { AdminFinanceService, buildLedgerWhere, FinanceLedgerRow } from './admin-finance.service';
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
