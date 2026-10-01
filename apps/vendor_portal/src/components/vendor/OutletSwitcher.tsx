import React from 'react';
import { Store, Lock, Building2 } from 'lucide-react';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';

export const OutletSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { outlets, activeOutletId, setActiveOutletId, isMultiBranch, activeOutlet } =
    useVendorOutlet();

  if (outlets.length === 0) return null;

  if (!isMultiBranch) {
    const outletName = activeOutlet?.name || outlets[0]?.name || 'Primary Store';
    return (
      <div
        className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 sm:px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200 min-h-[38px] ${
          className || ''
        }`}
        title={`Physical branch: ${outletName}`}
      >
        <Store className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="truncate max-w-[140px] sm:max-w-[240px] md:max-w-[320px]">{outletName}</span>
        <Lock className="h-3 w-3 text-slate-400 shrink-0" />
      </div>
    );
  }

  const currentSelectionLabel =
    activeOutletId === 'ALL'
      ? 'All Outlets (Consolidated)'
      : activeOutlet?.name || 'Selected Branch';

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className || ''}`}>
      <div className="flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
        <Building2 className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
        <span className="hidden md:inline">Branch:</span>
      </div>

      <select
        value={activeOutletId}
        onChange={(e) => setActiveOutletId(e.target.value)}
        className="h-9 min-h-[38px] max-w-[150px] sm:max-w-[260px] md:max-w-[340px] rounded-xl border border-purple-200 bg-purple-50/70 px-2.5 sm:px-3 py-1 text-xs font-bold text-purple-900 shadow-xs transition-colors hover:border-purple-300 focus:border-purple-500 focus:outline-none dark:border-purple-900/60 dark:bg-purple-950/40 dark:text-purple-300 cursor-pointer truncate"
        aria-label="Select Outlet Branch"
        title={currentSelectionLabel}
      >
        <option value="ALL">🏢 All Outlets (Consolidated)</option>
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name} {outlet.isBusy ? '(Paused)' : '(Open)'}
          </option>
        ))}
      </select>
    </div>
  );
};
