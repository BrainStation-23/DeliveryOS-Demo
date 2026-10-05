import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Store, Trash2, Users } from 'lucide-react';
import adminApi, { AdminStaffAssignment, AdminVendorStaffRow } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../components/common/EmptyState';
import { QueryErrorBanner } from '../../../../components/common/QueryErrorBanner';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { SearchInput } from '../../../../components/common/SearchInput';
import { extractApiError } from '../../../../utils/apiError';
import { StaffProfileDialog } from '../staff/StaffProfileDialog';

interface StaffAccountsTabProps {
  onError: (message: string) => void;
}

/** Cross-outlet registry of every owner/staff account — click a row for the unified profile dialog. */
export const StaffAccountsTab: React.FC<StaffAccountsTabProps> = ({ onError }) => {
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<AdminStaffAssignment | null>(null);
  const [toggleTarget, setToggleTarget] = useState<{ row: AdminVendorStaffRow; nextActive: boolean } | null>(null);
  const [profileTarget, setProfileTarget] = useState<AdminStaffAssignment | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ALL_OUTLETS_MASTER' | 'PARTICULAR_OUTLET'>('ALL');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const { data: staffRows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-vendor-staff'],
    queryFn: adminApi.getVendorStaff,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ staffId, isActive }: { staffId: string; isActive: boolean }) =>
      adminApi.updateVendorStaff(staffId, { isActive }),
    onSuccess: () => {
      setToggleTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-vendor-staff'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
    },
    onError: (err) => onError(extractApiError(err, 'Status change failed.')),
  });

  const removeMutation = useMutation({
    mutationFn: (staffId: string) => adminApi.removeVendorStaff(staffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendor-staff'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      setRemoveTarget(null);
    },
    onError: (err) => onError(extractApiError(err, 'Staff removal failed.')),
  });

  const term = searchQuery.trim().toLowerCase();
  const safeRows = (Array.isArray(staffRows) ? staffRows : []).filter(
    (row) =>
      (roleFilter === 'ALL' || row.scope === roleFilter) &&
      (!term ||
        row.fullName.toLowerCase().includes(term) ||
        row.phone.includes(term) ||
        (row.brandName || '').toLowerCase().includes(term) ||
        (row.vendorName || '').toLowerCase().includes(term)),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <SearchInput
          value={searchQuery}
          onChange={(val) => {
            setSearchQuery(val);
            setPage(1);
          }}
          placeholder="Search staff by name, phone, outlet, or brand..."
          className="sm:w-96"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            { id: 'ALL' as const, label: 'All' },
            { id: 'ALL_OUTLETS_MASTER' as const, label: 'Owners' },
            { id: 'PARTICULAR_OUTLET' as const, label: 'Managers' },
          ]).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                setRoleFilter(option.id);
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                roleFilter === option.id
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {option.label}
            </button>
          ))}
          <span className="text-[11px] text-slate-400 ml-1">
            {safeRows.length} of {(Array.isArray(staffRows) ? staffRows : []).length} accounts
          </span>
        </div>
      </div>

      {isError ? (
        <QueryErrorBanner error={error} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="py-16 text-center">
          <LoadingSpinner size="lg" label="Loading staff accounts..." />
        </div>
      ) : safeRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff accounts yet"
          message="Assign owners and branch managers from an outlet's Staff manager to see them here."
        />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {safeRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 hover:border-primary-300 hover:ring-2 hover:ring-primary-500/10 transition-all"
              >
                <button
                  type="button"
                  onClick={() => {
                    setProfileTarget(row);
                    setIsProfileOpen(true);
                  }}
                  className="w-full text-left flex items-center gap-3 cursor-pointer"
                  title="View / edit staff profile"
                >
                  <div className="h-11 w-11 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 flex items-center justify-center font-bold text-sm shrink-0">
                    {row.fullName.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{row.fullName}</span>
                      {row.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{row.phone}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {row.scope === 'ALL_OUTLETS_MASTER' ? (
                        <Badge variant="purple">Brand Owner</Badge>
                      ) : (
                        <Badge variant="info">Branch Manager</Badge>
                      )}
                      <span className="text-[10px] text-slate-400 inline-flex items-center gap-1 truncate">
                        <Store className="h-3 w-3 shrink-0" />
                        {row.scope === 'ALL_OUTLETS_MASTER' ? row.brandName || '—' : row.vendorName || '—'}
                      </span>
                    </div>
                  </div>
                </button>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                    {([true, false]).map((value) => (
                      <button
                        key={String(value)}
                        type="button"
                        disabled={toggleStatusMutation.isPending || row.isActive === value}
                        onClick={() => setToggleTarget({ row, nextActive: value })}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                          row.isActive === value
                            ? value
                              ? 'bg-emerald-500 text-white'
                              : 'bg-slate-500 text-white'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer'
                        }`}
                        title={value ? 'Grant vendor-portal access' : 'Lock vendor-portal access immediately'}
                      >
                        {value ? 'Active' : 'Inactive'}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                    onClick={() => setRemoveTarget(row)}
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {safeRows.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 gap-2">
              <span>Total {safeRows.length} staff accounts</span>
              {Math.ceil(safeRows.length / PAGE_SIZE) > 1 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg px-2.5 py-1 font-medium hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Previous
                  </button>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {page} / {Math.ceil(safeRows.length / PAGE_SIZE)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(Math.ceil(safeRows.length / PAGE_SIZE), p + 1))}
                    disabled={page >= Math.ceil(safeRows.length / PAGE_SIZE)}
                    className="rounded-lg px-2.5 py-1 font-medium hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <StaffProfileDialog
        assignment={profileTarget}
        isOpen={isProfileOpen}
        createScope={null}
        onClose={() => setIsProfileOpen(false)}
      />

      <ConfirmDialog
        isOpen={!!toggleTarget}
        title={toggleTarget?.nextActive ? 'Activate Staff Access?' : 'Deactivate Staff Access?'}
        variant={toggleTarget?.nextActive ? 'primary' : 'danger'}
        confirmLabel={toggleTarget?.nextActive ? 'Activate' : 'Deactivate'}
        message={
          toggleTarget && (
            <>
              <p>
                {toggleTarget.nextActive ? 'Restore vendor-portal access for ' : 'Deactivate '}
                <strong className="text-slate-900 dark:text-slate-100">{toggleTarget.row.fullName}</strong>
                {toggleTarget.nextActive ? '?' : '?'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {toggleTarget.nextActive
                  ? 'The account regains access to the vendor portal on their next sign-in.'
                  : 'They lose vendor-portal access immediately — active sessions are locked out on the spot. The assignment itself is kept.'}
              </p>
            </>
          )
        }
        isPending={toggleStatusMutation.isPending}
        onConfirm={() => {
          if (toggleTarget) {
            toggleStatusMutation.mutate({ staffId: toggleTarget.row.id, isActive: toggleTarget.nextActive });
          }
        }}
        onCancel={() => setToggleTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!removeTarget}
        title="Remove Staff Assignment?"
        variant="danger"
        confirmLabel="Remove Assignment"
        message={
          removeTarget && (
            <>
              <p>
                Remove <strong className="text-slate-900 dark:text-slate-100">{removeTarget.fullName}</strong> ({removeTarget.phone}) from{' '}
                {removeTarget.scope === 'ALL_OUTLETS_MASTER' ? `brand ${removeTarget.brandName}` : `outlet ${removeTarget.vendorName}`}?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                If this is their only assignment, the account demotes to CUSTOMER and loses vendor portal access
                immediately.
              </p>
            </>
          )
        }
        isPending={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget) {
            removeMutation.mutate(removeTarget.id);
          }
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
};
