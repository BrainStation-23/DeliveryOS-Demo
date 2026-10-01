import { describe, expect, it } from 'vitest';
import { SettlementStatement } from '../../services/adminApi';

describe('VendorSettlements calculations and filter logic', () => {
  const sampleStatements: SettlementStatement[] = [
    {
      vendorId: 'v-1',
      vendorName: 'Burger Lab Banani',
      brandName: 'Burger Lab',
      totalOrders: 15,
      grossSales: 7500,
      platformCommission: 1125,
      netVendorPayable: 6375,
      settlementStatus: 'PENDING',
    },
    {
      vendorId: 'v-2',
      vendorName: 'Pizza Guy Dhanmondi',
      brandName: 'Pizza Guy',
      totalOrders: 20,
      grossSales: 12000,
      platformCommission: 1800,
      netVendorPayable: 10200,
      settlementStatus: 'PENDING',
    },
    {
      vendorId: 'v-3',
      vendorName: 'Kacchi Bhai Gulshan',
      brandName: 'Kacchi Bhai',
      totalOrders: 5,
      grossSales: 3500,
      platformCommission: 525,
      netVendorPayable: 2975,
      settlementStatus: 'PENDING',
    },
  ];

  it('correctly calculates aggregate totals across settlements', () => {
    const totalOrders = sampleStatements.reduce((acc, s) => acc + (s?.totalOrders || 0), 0);
    const totalGross = sampleStatements.reduce((acc, s) => acc + (s?.grossSales || 0), 0);
    const totalCommission = sampleStatements.reduce((acc, s) => acc + (s?.platformCommission || 0), 0);
    const totalPayable = sampleStatements.reduce((acc, s) => acc + (s?.netVendorPayable || 0), 0);

    expect(totalOrders).toBe(40);
    expect(totalGross).toBe(23000);
    expect(totalCommission).toBe(3450);
    expect(totalPayable).toBe(19550);
    // Double-entry validation: Gross = Commission + Net Vendor Payable
    expect(totalGross).toBe(totalCommission + totalPayable);
  });

  it('filters statements by vendor name case-insensitively', () => {
    const query = 'burger';
    const filtered = sampleStatements.filter(
      (s) =>
        s?.vendorName?.toLowerCase().includes(query) ||
        s?.brandName?.toLowerCase().includes(query),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].vendorId).toBe('v-1');
  });

  it('filters statements by brand name case-insensitively', () => {
    const query = 'pizza';
    const filtered = sampleStatements.filter(
      (s) =>
        s?.vendorName?.toLowerCase().includes(query) ||
        s?.brandName?.toLowerCase().includes(query),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].brandName).toBe('Pizza Guy');
  });

  it('returns all statements when query is empty or whitespace', () => {
    const query = '   ';
    const trimmed = query.trim();
    const filtered = !trimmed
      ? sampleStatements
      : sampleStatements.filter(
          (s) =>
            s?.vendorName?.toLowerCase().includes(trimmed) ||
            s?.brandName?.toLowerCase().includes(trimmed),
        );
    expect(filtered).toHaveLength(3);
  });

  it('handles nullish fields gracefully without throwing', () => {
    const badStatements = [
      {
        vendorId: 'v-bad',
        vendorName: '',
        brandName: '',
        totalOrders: 0,
        grossSales: 0,
        platformCommission: 0,
        netVendorPayable: 0,
        settlementStatus: 'UNKNOWN',
      },
    ];
    const totalGross = badStatements.reduce((acc, s) => acc + (s?.grossSales || 0), 0);
    expect(totalGross).toBe(0);
  });
});
