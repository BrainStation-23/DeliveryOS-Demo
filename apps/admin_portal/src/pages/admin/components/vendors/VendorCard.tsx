import React from 'react';
import { Users, Edit2, Power } from 'lucide-react';
import { AdminVendor } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';

interface VendorCardProps {
  vendor: AdminVendor;
  isTogglePending: boolean;
  onEdit: (vendor: AdminVendor) => void;
  onToggleStatus: (vendor: AdminVendor) => void;
  onAssignStaff: (vendor: AdminVendor) => void;
}

export const VendorCard: React.FC<VendorCardProps> = ({
  vendor,
  isTogglePending,
  onEdit,
  onToggleStatus,
  onAssignStaff,
}) => {
  const safeStaff = Array.isArray(vendor.staff) ? vendor.staff : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{vendor.name}</h3>
            {vendor.brandName && (
              <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                Brand: {vendor.brandName}
              </span>
            )}
            <p className="mt-1 text-xs text-slate-500">{vendor.addressText}</p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {vendor.isActive ? (
              <Badge variant="success">Active</Badge>
            ) : (
              <Badge variant="default">Inactive</Badge>
            )}
            {vendor.isBusy && <Badge variant="warning">Rush Paused</Badge>}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center text-xs dark:bg-slate-800/50">
          <div>
            <span className="text-slate-400 block text-[10px]">Commission</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{vendor.commissionRate}%</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Avg Prep Time</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{vendor.defaultPrepTimeMinutes} mins</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px]">Lifetime Orders</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{vendor.totalOrders}</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              Assigned Management Staff ({safeStaff.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2 text-primary-600 dark:text-primary-400"
              onClick={() => onAssignStaff(vendor)}
            >
              + Assign Staff
            </Button>
          </div>

          {safeStaff.length === 0 ? (
            <div className="text-[11px] text-slate-400 italic py-1">No staff members assigned yet.</div>
          ) : (
            <div className="space-y-1.5">
              {safeStaff.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div>
                    <span className="font-semibold text-slate-900 dark:text-slate-100">{s.fullName}</span>
                    <span className="text-slate-400 ml-2">{s.phone}</span>
                  </div>
                  <div>
                    {s.scope === 'ALL_OUTLETS_MASTER' ? (
                      <Badge variant="purple">Brand Owner (Master)</Badge>
                    ) : (
                      <Badge variant="info">Branch Manager (Locked)</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 dark:border-slate-800">
        <div className="text-[11px] text-slate-400">
          <span>Phone: {vendor.contactPhone}</span>
          <span className="mx-2">•</span>
          <span>{vendor.totalProducts} Catalog Dishes</span>
        </div>
        <div className="inline-flex items-center gap-1.5 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onEdit(vendor)}
            leftIcon={<Edit2 className="h-3 w-3" />}
          >
            Edit
          </Button>
          <Button
            variant={vendor.isActive ? 'outline' : 'primary'}
            size="sm"
            className={`h-7 px-2 text-xs ${
              vendor.isActive
                ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
            }`}
            isLoading={isTogglePending}
            onClick={() => onToggleStatus(vendor)}
            leftIcon={<Power className="h-3 w-3" />}
          >
            {vendor.isActive ? 'Suspend' : 'Activate'}
          </Button>
        </div>
      </div>
    </div>
  );
};
