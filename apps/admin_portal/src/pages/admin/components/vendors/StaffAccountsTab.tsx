import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Store, Trash2, UserRound, Users } from 'lucide-react';
import adminApi, { AdminStaffAssignment } from '../../../../services/adminApi';
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
  const [profileTarget, setProfileTarget] = useState<AdminStaffAssignment | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: staffRows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-vendor-staff'],
    queryFn: adminApi.getVendorStaff,
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
      !term ||
      row.fullName.toLowerCase().includes(term) ||
      row.phone.includes(term) ||
      (row.brandName || '').toLowerCase().includes(term) ||
      (row.vendorName || '').toLowerCase().includes(term),
  );

  return (
    <div className="space-y-4">
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search staff by name, phone, brand, or outlet..."
      />

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {safeRows.map((row) => (
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
                    {!row.isActive && <Badge variant="danger">Inactive</Badge>}
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
              <div className="flex justify-end mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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
      )}

      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
        <UserRound className="h-3 w-3" /> Click an account to open its profile — view details or edit name, phone,
        status, and scope.
      </p>

      <StaffProfileDialog
        assignment={profileTarget}
        isOpen={isProfileOpen}
        createScope={null}
        onClose={() => setIsProfileOpen(false)}
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
