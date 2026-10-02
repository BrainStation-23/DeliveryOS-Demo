import apiClient, { Paginated, toPaginated, unwrapData } from './shared';

export interface SettlementStatement {
  vendorId: string;
  vendorName: string;
  brandName: string;
  totalOrders: number;
  grossSales: number;
  platformCommission: number;
  netVendorPayable: number;
  settlementStatus: string;
}

export interface SettlementBatchItem {
  id: string;
  batchNumber: string;
  startDate: string;
  endDate: string;
  totalOrders: number;
  totalVendorPayout: number;
  totalRiderPayout: number;
  totalPlatformMargin: number;
  status: string;
  executedByUserId: string;
  executedAt: string;
}

export interface CashDepositItem {
  id: string;
  riderId: string;
  amount: number;
  paymentMethod: string;
  status: 'PENDING_APPROVAL' | 'VERIFIED' | 'REJECTED';
  transactionReference: string;
  slipUrl?: string | null;
  depositedAt: string;
  verifiedAt?: string | null;
  notes?: string | null;
  rider: {
    id: string;
    cashInHand: number;
    maxCashLimit: number;
    isApproved: boolean;
    user: {
      id: string;
      fullName: string;
      phone: string;
    };
  };
}

export interface FinanceLedgerRow {
  id: string;
  orderId: string;
  orderNumber: string;
  placedAt: string;
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
  settlementStatus: 'PENDING' | 'PROCESSING' | 'SETTLED';
  batchNumber: string | null;
  settledAt: string | null;
}

export interface FinanceLedgerSummary {
  orders: number;
  grossSales: number;
  platformCommission: number;
  netVendorPayable: number;
  riderPayouts: number;
  codCollected: number;
}

export interface FinanceLedgerResult extends Paginated<FinanceLedgerRow> {
  summary: FinanceLedgerSummary;
}

export interface LedgerParams {
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  settlementStatus?: 'PENDING' | 'PROCESSING' | 'SETTLED';
}

export const financeApi = {
  async getSettlementStatements(): Promise<SettlementStatement[]> {
    const res = await apiClient.get('/api/v1/admin/finance/settlement-export', {
      params: { format: 'json' },
    });
    const payload = res.data?.data || res.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  },

  async exportSettlementCsv(): Promise<Blob> {
    const res = await apiClient.get('/api/v1/admin/finance/settlement-export', {
      params: { format: 'csv' },
      responseType: 'blob',
    });
    return res.data;
  },

  async executeSettlementCycle(notes?: string): Promise<{ message: string; batch: SettlementBatchItem; settledOrdersCount: number }> {
    const res = await apiClient.post('/api/v1/admin/finance/settle-cycle', { notes });
    return unwrapData<{ message: string; batch: SettlementBatchItem; settledOrdersCount: number }>(res);
  },

  async getSettlementBatches(): Promise<SettlementBatchItem[]> {
    const res = await apiClient.get('/api/v1/admin/finance/settlement-batches');
    const payload = res.data?.data || res.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  },

  async getLedger(params: LedgerParams): Promise<FinanceLedgerResult> {
    const res = await apiClient.get('/api/v1/admin/finance/ledger', {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 20,
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
        ...(params.settlementStatus ? { settlementStatus: params.settlementStatus } : {}),
      },
    });
    const body = unwrapData<FinanceLedgerResult>(res);
    const page = toPaginated<FinanceLedgerRow>(body, params.page ?? 1, params.limit ?? 20);
    return {
      ...page,
      summary:
        body?.summary ?? {
          orders: 0,
          grossSales: 0,
          platformCommission: 0,
          netVendorPayable: 0,
          riderPayouts: 0,
          codCollected: 0,
        },
    };
  },

  async exportLedgerCsv(params: Omit<LedgerParams, 'page' | 'limit'>): Promise<Blob> {
    const res = await apiClient.get('/api/v1/admin/finance/ledger/export', {
      params: {
        ...(params.search?.trim() ? { search: params.search.trim() } : {}),
        ...(params.dateFrom ? { dateFrom: params.dateFrom } : {}),
        ...(params.dateTo ? { dateTo: params.dateTo } : {}),
        ...(params.settlementStatus ? { settlementStatus: params.settlementStatus } : {}),
      },
      responseType: 'blob',
    });
    return res.data;
  },

  async getCashDeposits(status?: string): Promise<CashDepositItem[]> {
    const res = await apiClient.get('/api/v1/admin/finance/cash-deposits', {
      params: status ? { status } : undefined,
    });
    const payload = res.data?.data || res.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    return [];
  },

  async verifyCashDeposit(
    depositId: string,
    action: 'APPROVE' | 'REJECT',
    notes?: string,
  ): Promise<{ message: string; data?: unknown }> {
    const res = await apiClient.patch(`/api/v1/admin/finance/cash-deposits/${depositId}/verify`, {
      action,
      notes,
    });
    return unwrapData<{ message: string; data?: unknown }>(res);
  },
};
