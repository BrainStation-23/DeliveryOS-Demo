import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import adminApi from '../../services/adminApi';
import { Badge } from '../../components/ui/Badge';
import { Table, Column } from '../../components/ui/Table';
import { PageHeader } from '../../components/common/PageHeader';
import { SearchInput } from '../../components/common/SearchInput';
import { DateRangeFilterToolbar } from '../../components/common/DateRangeFilterToolbar';
import { CustomerDetailsDrawer } from './components/customers/CustomerDetailsDrawer';
import { CustomerRow } from '../../services/adminApi';
import { DatePreset, resolveDateRange } from '../../utils/dateRange';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { extractApiError } from '../../utils/apiError';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

const PAGE_SIZE = 20;

type CustomerStatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED';

/** Customer directory: search, account-status filter, registration date window,
 *  lifetime order aggregates per row, and suspend/unsuspend controls. */
export const AdminCustomersPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustomerStatusFilter>('ALL');
  const [datePreset, setDatePreset] = useState<DatePreset>('ALL_TIME');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [detailsCustomerId, setDetailsCustomerId] = useState<string | null>(null);

  const debouncedSearch = useDebouncedValue(searchQuery);

  const { dateFromIso, dateToIso } = useMemo(
    () => resolveDateRange(datePreset, customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate],
  );

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-customers', page, debouncedSearch, statusFilter, datePreset, dateFromIso, dateToIso],
    queryFn: () =>
      adminApi.getCustomers({
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        status: statusFilter,
        dateFrom: datePreset === 'ALL_TIME' ? undefined : dateFromIso,
        dateTo: datePreset === 'ALL_TIME' ? undefined : dateToIso,
      }),
    placeholderData: (previous) => previous,
  });

  const columns: Column<CustomerRow>[] = [
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{row.fullName}</span>
          <div className="text-[11px] text-slate-500">{row.phone}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <Badge variant={row.status === 'ACTIVE' ? 'success' : row.status === 'SUSPENDED' ? 'danger' : 'warning'}>
          {row.status.replace('_', ' ')}
        </Badge>
      ),
    },
    {
      key: 'orders',
      header: 'Orders',
      render: (row) => <span className="font-semibold">{row.orderCount.toLocaleString()}</span>,
    },
    {
      key: 'spend',
      header: 'Lifetime Spend',
      render: (row) => <span className="font-semibold">{formatCurrency(row.lifetimeSpend)}</span>,
    },
    { key: 'lastOrderAt', header: 'Last Order', render: (row) => formatDateTime(row.lastOrderAt) },
    { key: 'createdAt', header: 'Joined', render: (row) => formatDateTime(row.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Platform-wide customer directory with lifetime order value and delivery profiles"
        icon={Users}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput
          value={searchQuery}
          onChange={(value) => {
            setSearchQuery(value);
            setPage(1);
          }}
          placeholder="Search customers by name or phone..."
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {(['ALL', 'ACTIVE', 'SUSPENDED'] as const).map((status) => (
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
              {status === 'ALL' ? 'All' : status === 'ACTIVE' ? 'Active' : 'Suspended'}
            </button>
          ))}
        </div>
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

      {isError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          Failed to load customers: {(error as Error)?.message || 'unknown error'}
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
          emptyMessage="No customers match the current filters."
          page={data?.page ?? page}
          totalPages={data?.totalPages ?? 1}
          totalItems={data?.total ?? 0}
          onPageChange={setPage}
          onRowClick={(row) => setDetailsCustomerId(row.id)}
        />
      )}

      <CustomerDetailsDrawer
        customerId={detailsCustomerId}
        onClose={() => setDetailsCustomerId(null)}
      />
    </div>
  );
};
