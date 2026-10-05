import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw, Receipt } from 'lucide-react';
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
import {
  OrderDateFilterToolbar,
  DatePreset,
} from './components/orders/OrderDateFilterToolbar';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export const VendorOrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { activeOutletId, activeOutlet, outlets } = useVendorOutlet();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<LedgerItem | null>(null);

  const PAGE_SIZE = 15;

  const { dateFromIso, dateToIso } = useMemo(() => {
    const now = new Date();

    if (datePreset === 'TODAY') {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { dateFromIso: from.toISOString(), dateToIso: to.toISOString() };
    }

    if (datePreset === 'YESTERDAY') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const from = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const to = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      return { dateFromIso: from.toISOString(), dateToIso: to.toISOString() };
    }

    if (datePreset === 'LAST_7_DAYS') {
      const past7 = new Date(now);
      past7.setDate(past7.getDate() - 6);
      const from = new Date(past7.getFullYear(), past7.getMonth(), past7.getDate(), 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { dateFromIso: from.toISOString(), dateToIso: to.toISOString() };
    }

    if (datePreset === 'THIS_MONTH') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return { dateFromIso: from.toISOString(), dateToIso: to.toISOString() };
    }

    if (datePreset === 'CUSTOM') {
      let fromIso: string | undefined;
      let toIso: string | undefined;

      if (customStartDate) {
        const [y, m, d] = customStartDate.split('-').map(Number);
        fromIso = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
      }
      if (customEndDate) {
        const [y, m, d] = customEndDate.split('-').map(Number);
        toIso = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
      }
      return { dateFromIso: fromIso, dateToIso: toIso };
    }

    return { dateFromIso: undefined, dateToIso: undefined };
  }, [datePreset, customStartDate, customEndDate]);

  const { data: salesData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['vendor-sales-ledger', activeOutletId, datePreset, dateFromIso, dateToIso],
    queryFn: () => kdsApi.getSalesLedger(activeOutletId, dateFromIso, dateToIso),
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
      (l.vendorName || '').toLowerCase().includes(q) ||
      (l.items || []).some((it) => (it.productName || '').toLowerCase().includes(q));
    const matchesStatus =
      statusFilter === 'ALL' || l.settlementStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLedgers.length / PAGE_SIZE));
  const paginatedLedgers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredLedgers.slice(start, start + PAGE_SIZE);
  }, [filteredLedgers, page, PAGE_SIZE]);

  useEffect(() => {
    setPage(1);
  }, [activeOutletId]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(1);
    }
  }, [page, totalPages]);

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return <Badge variant="success" size="sm">{t('orders.orderStatuses.DELIVERED')}</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" size="sm">{t('orders.orderStatuses.CANCELLED')}</Badge>;
      case 'DISPATCHED':
        return <Badge variant="primary" size="sm">{t('orders.orderStatuses.DISPATCHED')}</Badge>;
      case 'READY_FOR_PICKUP':
        return <Badge variant="warning" size="sm">{t('orders.orderStatuses.READY_FOR_PICKUP')}</Badge>;
      case 'PREPARING':
        return <Badge variant="warning" size="sm">{t('orders.orderStatuses.PREPARING')}</Badge>;
      case 'ACCEPTED':
        return <Badge variant="primary" size="sm">{t('orders.orderStatuses.ACCEPTED')}</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  const columns: Column<LedgerItem>[] = [
    {
      key: 'orderNumber',
      header: t('orders.table.orderNum'),
      render: (item) => (
        <span className="font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300">
          #{item.orderNumber}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('orders.table.dateTime'),
      render: (item) => (
        <span className="text-xs text-slate-500 font-medium">
          {formatDateTime(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'vendorName',
      header: t('orders.table.outletBranch'),
      render: (item) => <span className="text-xs font-semibold">{item.vendorName}</span>,
    },
    {
      key: 'orderStatus',
      header: t('orders.table.orderStatus'),
      render: (item) => getOrderStatusBadge(item.orderStatus),
    },
    {
      key: 'grossAmount',
      header: t('orders.table.grossTotal'),
      render: (item) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {formatCurrency(item.grossAmount)}
        </span>
      ),
    },
    {
      key: 'commissionAmount',
      header: t('orders.table.platformFee'),
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
      header: t('orders.table.netPayable'),
      render: (item) => (
        <span className="font-bold text-emerald-600 dark:text-emerald-400">
          {formatCurrency(item.netVendorPayable)}
        </span>
      ),
    },
    {
      key: 'settlementStatus',
      header: t('orders.table.settlement'),
      render: (item) =>
        item.settlementStatus === 'SETTLED' ? (
          <Badge variant="success" size="sm">
            {t('orders.settled')}
          </Badge>
        ) : (
          <Badge variant="warning" size="sm">
            {t('orders.pending')}
          </Badge>
        ),
    },
  ];

  const currentScopeTitle =
    activeOutletId === 'ALL'
      ? t('orders.allOutletsScope', { count: outlets.length })
      : activeOutlet?.name || t('outlet.primaryStore');

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={t('orders.title')}
        description={t('orders.description', { scope: currentScopeTitle })}
        icon={<Receipt className="h-5 w-5 text-amber-500" />}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            {t('common.refresh')}
          </Button>
        }
      />

      {isError && (
        <QueryErrorBanner error={error} onRetry={() => refetch()} />
      )}

      {/* Date Filtering Toolbar (Modular) */}
      <OrderDateFilterToolbar
        datePreset={datePreset}
        onDatePresetChange={(preset) => {
          setDatePreset(preset);
          setPage(1);
        }}
        customStartDate={customStartDate}
        onCustomStartDateChange={(val) => {
          setCustomStartDate(val);
          setPage(1);
        }}
        customEndDate={customEndDate}
        onCustomEndDateChange={(val) => {
          setCustomEndDate(val);
          setPage(1);
        }}
        onClearCustomDates={() => {
          setCustomStartDate('');
          setCustomEndDate('');
          setPage(1);
        }}
      />

      <SalesLedgerKPIs summary={summary} />

      {/* Search & Settlement Status Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-80">
          <Input
            placeholder={t('orders.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            leftIcon={<Search className="h-3.5 w-3.5" />}
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {(['ALL', 'PENDING', 'SETTLED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`inline-flex items-center justify-center rounded-lg px-3 text-xs font-semibold transition-all h-8 select-none cursor-pointer ${
                statusFilter === st
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {st === 'ALL'
                ? t('orders.allStatements')
                : st === 'PENDING'
                ? t('orders.pending')
                : t('orders.settled')}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <QueryErrorBanner error={error} onRetry={() => refetch()} />
      )}

      {isLoading ? (
        <div className="py-20">
          <LoadingSpinner size="lg" label={t('orders.loading')} />
        </div>
      ) : (
        <Table
          columns={columns}
          data={paginatedLedgers}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => setSelectedOrderForModal(item)}
          emptyMessage={t('orders.empty')}
          page={page}
          totalPages={totalPages}
          totalItems={filteredLedgers.length}
          onPageChange={setPage}
        />
      )}

      <SalesLedgerDetailModal
        order={selectedOrderForModal}
        onClose={() => setSelectedOrderForModal(null)}
      />
    </div>
  );
};
