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
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export const VendorOrdersPage: React.FC = () => {
  const { activeOutletId, activeOutlet, outlets } = useVendorOutlet();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'ALL_TIME'>('TODAY');
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<LedgerItem | null>(null);

  const dateFromIso = useMemo(() => {
    if (dateFilter !== 'TODAY') return undefined;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }, [dateFilter]);

  const { data: salesData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-sales-ledger', activeOutletId, dateFilter],
    queryFn: () => kdsApi.getSalesLedger(activeOutletId, dateFromIso),
  });

  const rawLedgers: LedgerItem[] = Array.isArray(salesData?.ledgers) ? salesData.ledgers : [];

  const summary = useMemo(() => {
    if (salesData?.summary) {
      return salesData.summary;
    }
    const totalOrders = rawLedgers.length;
    const grossSales = rawLedgers.reduce((acc, l) => acc + Number(l?.grossAmount || 0), 0);
    const commissionDeducted =
      Math.round(rawLedgers.reduce((acc, l) => acc + Number(l?.commissionAmount || 0), 0) * 100) / 100;
    const netVendorPayable =
      Math.round(rawLedgers.reduce((acc, l) => acc + Number(l?.netVendorPayable || 0), 0) * 100) / 100;

    return {
      totalOrders,
      grossSales,
      commissionDeducted,
      netVendorPayable,
    };
  }, [salesData, rawLedgers]);

  const filteredLedgers = rawLedgers.filter((l) => {
    if (!l) return false;
    const q = (searchQuery || '').toLowerCase();
    const matchesSearch =
      (l.orderNumber || '').toLowerCase().includes(q) ||
      (l.customerName || '').toLowerCase().includes(q) ||
      (l.vendorName || '').toLowerCase().includes(q);
    const matchesStatus =
      statusFilter === 'ALL' || l.settlementStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns: Column<LedgerItem>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (item) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
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
      header: 'Platform Fee',
      render: (item) => {
        const rate =
          item.grossAmount > 0
            ? Math.round((item.commissionAmount / item.grossAmount) * 100)
            : null;
        return (
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              -{formatCurrency(item.commissionAmount)}
            </span>
            {rate !== null && rate > 0 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                ({rate}%)
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'netVendorPayable',
      header: 'Net Payable',
      render: (item) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
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
            Pending
          </Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item) => (
        <Button
          variant="outline"
          size="sm"
          className="font-semibold"
          onClick={() => setSelectedOrderForModal(item)}
          leftIcon={<Eye className="h-3 w-3 text-amber-600" />}
        >
          Items ({item.items?.length || 0})
        </Button>
      ),
    },
  ];

  const currentScopeTitle =
    activeOutletId === 'ALL'
      ? `All Outlets (${outlets.length} Branches)`
      : activeOutlet?.name || 'Store Branch';

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Sales Ledgers & Settlement"
        description={`Financial auditing and commission statements for ${currentScopeTitle}`}
        icon={<Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
        actions={
          <>
            <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setDateFilter('TODAY')}
                className={`flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all h-8 ${
                  dateFilter === 'TODAY'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="h-3 w-3" />
                <span>Today</span>
              </button>
              <button
                type="button"
                onClick={() => setDateFilter('ALL_TIME')}
                className={`flex items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all h-8 ${
                  dateFilter === 'ALL_TIME'
                    ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-slate-100'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <CalendarDays className="h-3 w-3" />
                <span>All Time</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
          </>
        }
      />

      <SalesLedgerKPIs summary={summary} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search order #, branch, or customer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {['ALL', 'PENDING', 'SETTLED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`inline-flex items-center justify-center rounded-lg px-3 text-xs font-semibold transition-all h-8 select-none ${
                statusFilter === st
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {st === 'ALL' ? 'All Statements' : st}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <QueryErrorBanner error={error} onRetry={() => refetch()} />
      )}

      {isLoading ? (
        <div className="py-20">
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
