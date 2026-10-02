import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, RefreshCw } from 'lucide-react';
import adminApi, { FinanceLedgerRow } from '../../services/adminApi';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Table, Column } from '../ui/Table';
import { StatCard } from '../common/StatCard';
import { SearchInput } from '../common/SearchInput';
import { DateRangeFilterToolbar } from '../common/DateRangeFilterToolbar';
import { DatePreset, resolveDateRange } from '../../utils/dateRange';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { extractApiError } from '../../utils/apiError';

const CURRENCY = '৳';
const PAGE_SIZE = 20;

type LedgerStatusFilter = 'ALL' | 'PENDING' | 'PROCESSING' | 'SETTLED';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Unified per-order financial ledger: commission + rider payout entries joined
 *  per order, with window/status filters and CSV export of the filtered set. */
export const FinanceLedgerSection: React.FC<{ onError: (message: string) => void }> = ({ onError }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LedgerStatusFilter>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebouncedValue(searchQuery);

  const { dateFromIso, dateToIso } = useMemo(
    () => resolveDateRange(datePreset, customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate],
  );

  const filters = {
    dateFrom: datePreset === 'ALL_TIME' ? undefined : dateFromIso,
    dateTo: datePreset === 'ALL_TIME' ? undefined : dateToIso,
    search: debouncedSearch,
    ...(statusFilter !== 'ALL' ? { settlementStatus: statusFilter as 'PENDING' | 'PROCESSING' | 'SETTLED' } : {}),
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-finance-ledger', page, debouncedSearch, statusFilter, datePreset, dateFromIso, dateToIso],
    queryFn: () => adminApi.getLedger({ ...filters, page, limit: PAGE_SIZE }),
    placeholderData: (previous) => previous,
  });

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const blob = await adminApi.exportLedgerCsv(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      onError(extractApiError(err, 'Failed to download the financial ledger CSV.'));
    } finally {
      setIsExporting(false);
    }
  };

  const summary = data?.summary;

  const columns: Column<FinanceLedgerRow>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.orderNumber}</span>
          <div className="text-[11px] text-slate-500">{formatDateTime(row.placedAt)}</div>
        </div>
      ),
    },
    {
      key: 'outlet',
      header: 'Outlet / Brand',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800 dark:text-slate-200">{row.vendorName}</div>
          <div className="text-[11px] text-slate-500">{row.brandName || 'Independent'}</div>
        </div>
      ),
    },
    { key: 'riderName', header: 'Courier', render: (row) => row.riderName || <span className="text-slate-400">—</span> },
    {
      key: 'gross',
      header: 'Gross',
      render: (row) => <span className="font-semibold">{CURRENCY} {row.grossAmount.toLocaleString()}</span>,
    },
    {
      key: 'commission',
      header: 'Commission',
      render: (row) => (
        <div>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            {CURRENCY} {row.commissionAmount.toLocaleString()}
          </span>
          <div className="text-[11px] text-slate-500">{row.commissionRate}%</div>
        </div>
      ),
    },
    {
      key: 'netVendor',
      header: 'Net Vendor',
      render: (row) => <span>{CURRENCY} {row.netVendorPayable.toLocaleString()}</span>,
    },
    {
      key: 'riderEarnings',
      header: 'Rider Payout',
      render: (row) =>
        row.riderEarnings !== null ? (
          <div>
            <span>{CURRENCY} {row.riderEarnings.toLocaleString()}</span>
            {row.codCollected ? (
              <div className="text-[11px] text-slate-500">COD {CURRENCY} {row.codCollected.toLocaleString()}</div>
            ) : null}
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'settlement',
      header: 'Settlement',
      render: (row) => (
        <div>
          <Badge
            variant={
              row.settlementStatus === 'SETTLED' ? 'success' : row.settlementStatus === 'PENDING' ? 'warning' : 'info'
            }
          >
            {row.settlementStatus}
          </Badge>
          {row.batchNumber && <div className="text-[11px] text-slate-500 mt-0.5">{row.batchNumber}</div>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Summary cards span the whole filtered window */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Ledger Orders" value={(summary?.orders ?? 0).toLocaleString()} isLoading={isLoading} />
        <StatCard title="Gross Sales" value={`${CURRENCY} ${(summary?.grossSales ?? 0).toLocaleString()}`} isLoading={isLoading} />
        <StatCard title="Commission" value={`${CURRENCY} ${(summary?.platformCommission ?? 0).toLocaleString()}`} isLoading={isLoading} />
        <StatCard title="Net Vendor Payable" value={`${CURRENCY} ${(summary?.netVendorPayable ?? 0).toLocaleString()}`} isLoading={isLoading} />
        <StatCard title="Rider Payouts" value={`${CURRENCY} ${(summary?.riderPayouts ?? 0).toLocaleString()}`} isLoading={isLoading} />
        <StatCard title="COD Collected" value={`${CURRENCY} ${(summary?.codCollected ?? 0).toLocaleString()}`} isLoading={isLoading} />
      </div>

      <DateRangeFilterToolbar
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
        }}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search by order #, outlet, brand, or courier..."
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'PENDING', 'PROCESSING', 'SETTLED'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === status
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {status === 'ALL' ? 'All' : status.charAt(0) + status.slice(1).toLowerCase()}
            </button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            isLoading={isExporting}
            leftIcon={<Download className="h-3.5 w-3.5" />}
          >
            Export CSV
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          Failed to load the financial ledger: {(error as Error)?.message || 'unknown error'}
          <button onClick={() => refetch()} className="ml-2 font-semibold underline cursor-pointer">
            Retry
          </button>
        </div>
      ) : (
        <Table
          columns={columns}
          data={data?.items ?? []}
          keyExtractor={(row) => row.id}
          isLoading={isLoading}
          emptyMessage="No ledger entries match the current window."
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          totalItems={data?.total ?? 0}
          onPageChange={setPage}
        />
      )}
    </div>
  );
};
