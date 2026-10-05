import React from 'react';
import { Store, MapPin, Phone, Percent, ShieldCheck } from 'lucide-react';
import { Badge } from '../../../../components/ui/Badge';
import { AccessibleOutlet } from '../../../../contexts/VendorOutletContext';
import { cn } from '../../../../utils/cn';

interface OutletProfileWidgetProps {
  outlet: {
    id: string;
    name: string;
    addressText?: string | null;
    contactPhone?: string | null;
    commissionRate?: number | null;
    isActive?: boolean;
    type?: { id: string; name: string; slug: string; isActive: boolean } | null;
    brand?: { id: string; name: string } | null;
  };
  outlets?: AccessibleOutlet[];
  activeOutletId?: string;
  onSelectOutlet?: (outletId: string) => void;
}

export const OutletProfileWidget: React.FC<OutletProfileWidgetProps> = ({
  outlet,
  outlets = [],
  activeOutletId,
  onSelectOutlet,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3.5 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shrink-0">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {outlet.name}
              </h3>
              <Badge variant={outlet.isActive !== false ? 'success' : 'danger'} size="sm">
                {outlet.isActive !== false ? 'Active Store' : 'Inactive'}
              </Badge>
            </div>
            {(outlet.brand?.name || outlet.type?.name) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                {outlet.brand?.name}
                {outlet.brand?.name && outlet.type?.name ? ' · ' : ''}
                {outlet.type?.name}
                {outlet.type && outlet.type.isActive === false ? ' (hidden from customers)' : ''}
              </p>
            )}
          </div>
        </div>

        {outlet.commissionRate !== undefined && outlet.commissionRate !== null && (
          <div className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/80">
            <Percent className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">Commission Rate:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {Number(outlet.commissionRate)}%
            </span>
          </div>
        )}
      </div>

      {/* Outlet Switcher Tabs if multiple outlets exist */}
      {outlets.length > 1 && onSelectOutlet && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
          <span className="text-xs font-semibold text-slate-400 shrink-0 mr-1">Switch Branch:</span>
          {outlets.map((o) => {
            const isSelected = (activeOutletId === o.id) || (activeOutletId === 'ALL' && outlet.id === o.id);
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelectOutlet(o.id)}
                className={cn(
                  'h-7 px-3 rounded-lg text-xs font-semibold transition-all select-none cursor-pointer shrink-0 border',
                  isSelected
                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                )}
              >
                {o.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Details Row: Address, Phone, Security */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
        <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
          <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-slate-400 block text-[11px] font-medium">Physical Address</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {outlet.addressText || 'Standard Merchant Premises'}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
          <Phone className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-slate-400 block text-[11px] font-medium">Merchant Hotline</span>
            <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
              {outlet.contactPhone || 'No direct phone configured'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
