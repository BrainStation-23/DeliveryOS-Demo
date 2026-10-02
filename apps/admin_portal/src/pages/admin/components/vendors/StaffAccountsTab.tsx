import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users, Trash2 } from 'lucide-react';
import adminApi, { AdminVendorStaffRow } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../components/common/EmptyState';
import { QueryErrorBanner } from '../../../../components/common/QueryErrorBanner';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { extractApiError } from '../../../../utils/apiError';

interface StaffAccountsTabProps {
  onError: (message: string) => void;
}

/** Cross-outlet registry of every owner/staff account with scope + removal. */
export const StaffAccountsTab: React.FC<StaffAccountsTabProps> = ({ onError }) => {
  const queryClient = useQueryClient();
  const [removeTarget, setRemoveTarget] = useState<AdminVendorStaffRow | null>(null);

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

  const safeRows = Array.isArray(staffRows) ? staffRows : [];
  const target = removeTarget;

  return (
    <div className="space-y-4">
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
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-x-auto overflow-hidden">
          <table className="min-w-full w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Account</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Scope</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">Outlet / Brand</th>
                <th className="py-3 px-4 font-semibold whitespace-nowrap">User Status</th>
                <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {safeRows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{row.fullName}</div>
                    <div className="text-[11px] text-slate-500">{row.phone}</div>
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {row.scope === 'ALL_OUTLETS_MASTER' ? (
                      <Badge variant="purple">Brand Owner</Badge>
                    ) : (
                      <Badge variant="info">Branch Manager</Badge>
                    )}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {row.scope === 'ALL_OUTLETS_MASTER'
                      ? row.brandName || '—'
                      : row.vendorName || '—'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    <Badge variant={row.userStatus === 'ACTIVE' ? 'success' : 'warning'}>{row.userStatus}</Badge>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      onClick={() => setRemoveTarget(row)}
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!target}
        title="Remove Staff Assignment?"
        variant="danger"
        confirmLabel="Remove Assignment"
        message={
          target && (
            <>
              <p>
                Remove <strong className="text-slate-900 dark:text-slate-100">{target.fullName}</strong> ({target.phone}) from{' '}
                {target.scope === 'ALL_OUTLETS_MASTER' ? `brand ${target.brandName}` : `outlet ${target.vendorName}`}?
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
          if (target) {
            removeMutation.mutate(target.id);
          }
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
};
