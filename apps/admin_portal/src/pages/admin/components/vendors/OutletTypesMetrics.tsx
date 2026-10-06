import React from 'react';
import { Eye, EyeOff, Layers, Store } from 'lucide-react';
import { OutletTypeStats } from './outletTypeHelpers';

export interface OutletTypesMetricsProps {
  stats: OutletTypeStats;
}

export const OutletTypesMetrics: React.FC<OutletTypesMetricsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-slate-400" /> Total Categories
        </span>
        <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{stats.total}</p>
      </div>

      <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5" /> Visible in App
        </span>
        <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
          {stats.visibleCount}
        </p>
      </div>

      <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-3.5 shadow-2xs dark:border-amber-900/40 dark:bg-amber-950/20">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
          <EyeOff className="h-3.5 w-3.5" /> Hidden from App
        </span>
        <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
          {stats.hiddenCount}
        </p>
      </div>

      <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3.5 shadow-2xs dark:border-indigo-900/40 dark:bg-indigo-950/20">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
          <Store className="h-3.5 w-3.5" /> Assigned Outlets
        </span>
        <p className="mt-1 text-xl font-bold text-indigo-700 dark:text-indigo-300">
          {stats.totalAssignedOutlets}
        </p>
      </div>
    </div>
  );
};
