import React from 'react';
import { useTranslation } from 'react-i18next';
import { Ban, ShieldAlert, Store, ArrowRight, AlertTriangle } from 'lucide-react';
import { AccessibleOutlet } from '../../stores/useVendorOutletStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';

interface OutletSuspendedScreenProps {
  outlet: AccessibleOutlet;
  outlets: AccessibleOutlet[];
  onSelectOutlet: (outletId: string) => void;
}

export const OutletSuspendedScreen: React.FC<OutletSuspendedScreenProps> = ({
  outlet,
  outlets,
  onSelectOutlet,
}) => {
  const { t } = useTranslation();

  const otherActiveOutlets = outlets.filter(
    (o) => o.id !== outlet.id && o.id !== 'ALL' && o.isActive !== false,
  );

  return (
    <div className="mx-auto max-w-3xl py-8 sm:py-12 px-4">
      <div className="rounded-2xl border border-rose-200 bg-white p-6 sm:p-8 shadow-sm dark:border-rose-900/60 dark:bg-slate-900">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/70 dark:text-rose-400 mb-4 shadow-xs">
            <Ban className="h-9 w-9" />
          </div>

          <div className="inline-flex items-center gap-1.5 mb-2">
            <Badge variant="danger" size="md" className="font-bold">
              {t('outlet.suspendedBadge', { defaultValue: 'Suspended' })}
            </Badge>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {t('outlet.suspendedTitle', { defaultValue: 'Outlet Suspended by Platform Administration' })}
          </h2>

          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            {t('outlet.suspendedDescription', {
              name: outlet.name,
              defaultValue: `${outlet.name} is currently suspended by platform administration. Store operations, incoming customer orders, kitchen processing, and catalog changes are completely locked until platform administration withdraws the suspension.`,
            })}
          </p>
        </div>

        {/* Lockout Details Card */}
        <div className="mt-8 rounded-xl bg-rose-50/70 border border-rose-200/80 p-4 sm:p-5 dark:bg-rose-950/30 dark:border-rose-900/40 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-900 dark:text-rose-200 uppercase tracking-wide">
            <ShieldAlert className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{t('outlet.suspendedNotice', { defaultValue: 'Platform Governance Enforcement' })}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
            <div className="rounded-lg bg-white/80 dark:bg-slate-900/80 p-3 border border-rose-100 dark:border-rose-900/40">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium">Status</span>
              <span className="font-bold text-rose-700 dark:text-rose-300">Suspended</span>
            </div>
            <div className="rounded-lg bg-white/80 dark:bg-slate-900/80 p-3 border border-rose-100 dark:border-rose-900/40">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium">Operations</span>
              <span className="font-bold text-rose-700 dark:text-rose-300">Completely Locked</span>
            </div>
            <div className="rounded-lg bg-white/80 dark:bg-slate-900/80 p-3 border border-rose-100 dark:border-rose-900/40">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-medium">Customer Discovery</span>
              <span className="font-bold text-rose-700 dark:text-rose-300">Hidden / Blocked</span>
            </div>
          </div>
          <p className="text-xs text-rose-800 dark:text-rose-300/90 pt-1">
            Please contact DeliveryOS platform administration or your corporate account manager to withdraw the suspension for this outlet.
          </p>
        </div>

        {/* Multi-branch fallback navigation */}
        {otherActiveOutlets.length > 0 ? (
          <div className="mt-8 border-t border-slate-100 dark:border-slate-800 pt-6">
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-3">
              {t('outlet.switchActiveOutlet', { defaultValue: 'Switch to an Active Outlet' })}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {otherActiveOutlets.map((other) => (
                <button
                  key={other.id}
                  type="button"
                  onClick={() => onSelectOutlet(other.id)}
                  className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-amber-400 hover:ring-2 hover:ring-amber-500/20 bg-slate-50/50 hover:bg-white dark:border-slate-800 dark:bg-slate-800/50 dark:hover:bg-slate-800 transition-all text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Store className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 truncate">
                        {other.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {other.addressText || 'Operational Branch'}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-amber-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-5">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>{t('outlet.noActiveOutlets', { defaultValue: 'No other active branches available under your account.' })}</span>
          </div>
        )}
      </div>
    </div>
  );
};
