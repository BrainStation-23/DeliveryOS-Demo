import React from 'react';
import { Bike } from 'lucide-react';
import { RiderRosterRow } from '../../../../services/adminApi';
import { Badge, OrderStatusBadge } from '../../../../components/ui/Badge';
import { Table, Column } from '../../../../components/ui/Table';
import { SearchInput } from '../../../../components/common/SearchInput';

export type FleetRosterStatusFilter = 'ALL' | 'ONLINE' | 'ON_TRIP' | 'OFFLINE';
export type FleetRosterApprovalFilter = 'ALL' | 'PENDING' | 'APPROVED';

export interface FleetRosterTableProps {
  rows: RiderRosterRow[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  searchQuery: string;
  statusFilter: FleetRosterStatusFilter;
  approvalFilter: FleetRosterApprovalFilter;
  pendingApplicantsCount: number;
  onSearchQueryChange: (value: string) => void;
  onStatusFilterChange: (status: FleetRosterStatusFilter) => void;
  onApprovalFilterChange: (approval: FleetRosterApprovalFilter) => void;
  onPageChange: (page: number) => void;
  onOpenDetails: (riderId: string) => void;
}

const STATUS_BADGE_VARIANT: Record<RiderRosterRow['status'], 'success' | 'info' | 'default'> = {
  ONLINE: 'success',
  ON_TRIP: 'info',
  OFFLINE: 'default',
};

const STATUS_FILTERS: Array<{ id: FleetRosterStatusFilter; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'ONLINE', label: 'Online' },
  { id: 'ON_TRIP', label: 'On Trip' },
  { id: 'OFFLINE', label: 'Offline' },
];

/** Server-paginated courier roster with derived status, performance metrics,
 *  and cash-safety warnings. Row click opens the unified rider details drawer. */
export const FleetRosterTable: React.FC<FleetRosterTableProps> = ({
  rows,
  total,
  page,
  totalPages,
  isLoading,
  searchQuery,
  statusFilter,
  approvalFilter,
  pendingApplicantsCount,
  onSearchQueryChange,
  onStatusFilterChange,
  onApprovalFilterChange,
  onPageChange,
  onOpenDetails,
}) => {
  const columns: Column<RiderRosterRow>[] = [
    {
      key: 'courier',
      header: 'Courier',
      render: (row) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-900 dark:text-slate-100">{row.fullName}</span>
            {!row.isApproved && <Badge variant="warning">Pending</Badge>}
            {row.userStatus !== 'ACTIVE' && <Badge variant="danger">Suspended Acct</Badge>}
          </div>
          <div className="text-[11px] text-slate-500">
            {row.phone} · <span className="inline-flex items-center gap-1"><Bike className="h-3 w-3" />{row.vehicleType}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <Badge variant={STATUS_BADGE_VARIANT[row.status]}>{row.status.replace('_', ' ')}</Badge>,
    },
    {
      key: 'cash',
      header: 'Cash in Hand',
      render: (row) => (
        <div>
          <span className={row.cashSafetyWarning ? 'font-bold text-rose-600 dark:text-rose-400' : 'font-semibold'}>
            ৳ {row.cashInHand.toLocaleString()}
          </span>
          <div className="text-[11px] text-slate-500">limit ৳ {row.maxCashLimit.toLocaleString()}</div>
        </div>
      ),
    },
    {
      key: 'deliveries',
      header: 'Deliveries',
      render: (row) => <span className="font-semibold">{row.totalDeliveries.toLocaleString()}</span>,
    },
    {
      key: 'earnings30d',
      header: 'Earnings (30d)',
      render: (row) => <span>৳ {row.earnings30d.toLocaleString()}</span>,
    },
    {
      key: 'activeOrder',
      header: 'Active Order',
      render: (row) =>
        row.activeOrder ? (
          <div>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{row.activeOrder.orderNumber}</span>
            <div className="mt-0.5"><OrderStatusBadge status={row.activeOrder.status} /></div>
          </div>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(row.id);
          }}
          className="text-xs font-semibold text-primary-600 hover:underline cursor-pointer dark:text-primary-400"
        >
          View Details
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchInput
          value={searchQuery}
          onChange={onSearchQueryChange}
          placeholder="Search couriers by name, phone, or vehicle..."
          className="sm:w-72"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onStatusFilterChange(filter.id)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                statusFilter === filter.id
                  ? 'bg-primary-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {filter.label}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" />
          <button
            type="button"
            onClick={() => onApprovalFilterChange(approvalFilter === 'PENDING' ? 'ALL' : 'PENDING')}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              approvalFilter === 'PENDING'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            Applicants ({pendingApplicantsCount})
          </button>
        </div>
      </div>

      <Table
        columns={columns}
        data={rows}
        keyExtractor={(row) => row.id}
        isLoading={isLoading}
        emptyMessage="No couriers match the current filters."
        page={page}
        totalPages={totalPages}
        totalItems={total}
        onPageChange={onPageChange}
        onRowClick={(row) => onOpenDetails(row.id)}
      />
    </div>
  );
};
