import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  RefreshCw,
  Eye,
  Calendar,
  CalendarDays,
  Receipt,
} from 'lucide-react';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';
import kdsApi from '../../services/kdsApi';
import { Table, Column } from '../../components/ui/Table';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { LedgerItem } from '../../types/ledger';
import { SalesLedgerKPIs } from './components/SalesLedgerKPIs';
import { SalesLedgerDetailModal } from './components/SalesLedgerDetailModal';
import { formatCurrency, formatDateTime, isSameDay } from '../../utils/formatters';

export const VendorOrdersPage: React.FC = () => {
  const { activeOutletId, activeOutlet, outlets } = useVendorOutlet();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'ALL_TIME'>('TODAY');
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<LedgerItem | null>(null);

  const { data: salesData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-sales-ledger', activeOutletId],
    queryFn: () => kdsApi.getSalesLedger(activeOutletId),
  });

  const rawLedgers: LedgerItem[] = salesData?.ledgers || [];

  const dateScopedLedgers = useMemo(() => {
    if (dateFilter === 'TODAY') {
      const today = new Date();
      return rawLedgers.filter((l) => isSameDay(new Date(l.createdAt), today));
    }
    return rawLedgers;
  }, [rawLedgers, dateFilter]);

  const summary = useMemo(() => {
    if (dateFilter === 'ALL_TIME' && salesData?.summary) {
      return salesData.summary;
    }
    const totalOrders = dateScopedLedgers.length;
    const grossSales = dateScopedLedgers.reduce((acc, l) => acc + Number(l.grossAmount || 0), 0);
    const commissionDeducted =
      Math.round(dateScopedLedgers.reduce((acc, l) => acc + Number(l.commissionAmount || 0), 0) * 100) / 100;
    const netVendorPayable =
      Math.round(dateScopedLedgers.reduce((acc, l) => acc + Number(l.netVendorPayable || 0), 0) * 100) / 100;

    return {
      totalOrders,
      grossSales,
      commissionDeducted,
      netVendorPayable,
    };
  }, [salesData, dateScopedLedgers, dateFilter]);

  const filteredLedgers = dateScopedLedgers.filter((l) => {
    const matchesSearch =
      l.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.vendorName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === 'ALL' || l.settlementStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<LedgerItem>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (item) => (
        <span className="font-extrabold text-slate-900 dark:text-slate-100">
          #{item.orderNumber}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date & Time',
      render: (item) => (
        <span className="text-xs text-slate-500 font-medium">
          {formatDateTime(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'vendorName',
      header: 'Outlet Branch',
      render: (item) => <span className="text-xs font-semibold">{item.vendorName}</span>,
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (item) => <span className="text-xs font-medium">{item.customerName}</span>,
    },
    {
      key: 'grossAmount',
      header: 'Gross Total',
      render: (item) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {formatCurrency(item.grossAmount)}
        </span>
      ),
    },
    {
      key: 'commissionAmount',
      header: 'Platform Fee (15%)',
      render: (item) => (
        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
          -{formatCurrency(item.commissionAmount)}
        </span>
      ),
    },
    {
      key: 'netVendorPayable',
      header: 'Net Payable',
      render: (item) => (
        <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(item.netVendorPayable)}
        </span>
      ),
    },
    {
      key: 'settlementStatus',
      header: 'Settlement',
      render: (item) =>
        item.settlementStatus === 'SETTLED' ? (
          <Badge variant="success" size="sm">
            Settled
          </Badge>
        ) : (
          <Badge variant="warning" size="sm">
            Pending Payout
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Details',
      render: (item) => (
        <Button
          variant="outline"
          size="sm"
          className="min-h-[36px] rounded-lg text-xs"
          onClick={() => setSelectedOrderForModal(item)}
          leftIcon={<Eye className="h-3.5 w-3.5 text-primary-600" />}
        >
          View Items ({item.items?.length || 0})
        </Button>
      ),
    },
  ];

  const currentScopeTitle =
    activeOutletId === 'ALL'
      ? `All Outlets (Brand Consolidated — ${outlets.length} Branches)`
      : activeOutlet?.name || 'Store Branch';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Ledgers & Settlement"
        description={`Financial auditing and commission records for ${currentScopeTitle}`}
        icon={<Receipt className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />}
        actions={
          <>
            <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setDateFilter('TODAY')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all min-h-[36px] ${
                  dateFilter === 'TODAY'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Today</span>
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('ALL_TIME')}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all min-h-[36px] ${
                  dateFilter === 'ALL_TIME'
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>All Time</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="min-h-[38px] text-xs font-semibold"
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>
          </>
        }
      />

      <SalesLedgerKPIs summary={summary} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-80">
          <Input
            placeholder="Search by order #, branch, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-4 w-4" />}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['ALL', 'PENDING', 'SETTLED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-xl px-3.5 py-2 text-xs font-bold transition-all min-h-[38px] ${
                statusFilter === st
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {st === 'ALL' ? 'All Settlements' : st}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <QueryErrorBanner error={error} onRetry={() => refetch()} />
      )}

      {isLoading ? (
        <div className="py-24">
          <LoadingSpinner size="lg" label="Loading sales ledgers..." />
        </div>
      ) : (
        <Table
          columns={columns}
          data={filteredLedgers}
          keyExtractor={(item) => item.id}
          emptyMessage="No sales ledger records found for this selection"
        />
      )}

      <SalesLedgerDetailModal
        order={selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
      />
    </div>
  );
};
