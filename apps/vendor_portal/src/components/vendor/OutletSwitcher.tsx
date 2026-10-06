import React from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Lock } from 'lucide-react';
import { useVendorOutlet } from '../../contexts/VendorOutletContext';
import { outletLabel } from '../../utils/outletDisplayName';

export const OutletSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const { outlets, activeOutletId, setActiveOutletId, isMultiBranch, activeOutlet } =
    useVendorOutlet();

  if (outlets.length === 0) return null;

  if (!isMultiBranch) {
    const outletName = activeOutlet
      ? outletLabel(activeOutlet)
      : outlets[0]
        ? outletLabel(outlets[0])
        : t('outlet.primaryStore');
    return (
      <div
        className={`inline-flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 sm:px-3 h-9 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-200 shrink-0 shadow-sm ${
          className || ''
        }`}
        title={t('outlet.physicalBranch', { name: outletName })}
      >
        <Store className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span className="truncate max-w-[130px] sm:max-w-[220px] md:max-w-[300px]">{outletName}</span>
        <Lock className="h-3 w-3 text-slate-400 shrink-0" />
      </div>
    );
  }

  const currentSelectionLabel =
    activeOutletId === 'ALL'
      ? t('outlet.allOutletsConsolidated')
      : activeOutlet
      ? outletLabel(activeOutlet)
      : t('outlet.selectedBranch');

  return (
    <div className={`relative inline-flex items-center gap-1.5 shrink-0 ${className || ''}`}>
      <div className="flex items-center gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400 shrink-0">
        <Store className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="hidden sm:inline">{t('outlet.label')}</span>
      </div>

      <select
        value={activeOutletId}
        onChange={(e) => setActiveOutletId(e.target.value)}
        className="h-9 max-w-[140px] sm:max-w-[220px] md:max-w-[300px] rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer truncate"
        aria-label="Select Outlet Branch"
        title={currentSelectionLabel}
      >
        <option
          value="ALL"
          className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-1"
        >
          {t('outlet.allOutletsConsolidated')}
        </option>
        {outlets.map((outlet) => (
          <option
            key={outlet.id}
            value={outlet.id}
            className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 py-1"
          >
            {outletLabel(outlet)}{' '}
            {outlet.isActive === false
              ? `(${t('outlet.suspendedBadge', { defaultValue: 'Suspended' })})`
              : outlet.isBusy
              ? `(${t('outlet.intakeInactive', { defaultValue: 'Inactive' })})`
              : `(${t('outlet.intakeActive', { defaultValue: 'Active' })})`}
          </option>
        ))}
      </select>
    </div>
  );
};
