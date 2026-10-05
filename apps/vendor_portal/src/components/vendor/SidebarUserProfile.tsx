import React from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';

interface SidebarUserProfileProps {
  displayName: string;
  roleTitle: string;
  phone?: string;
  onLogout: () => void;
  isCollapsed?: boolean;
}

export const SidebarUserProfile: React.FC<SidebarUserProfileProps> = ({
  displayName,
  roleTitle,
  phone,
  onLogout,
  isCollapsed = false,
}) => {
  const { t } = useTranslation();

  if (isCollapsed) {
    return (
      <div className="shrink-0 mt-auto border-t border-slate-100 p-2.5 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center gap-2">
        <div
          className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0 cursor-default"
          title={`${displayName}\n${roleTitle}${phone ? ` • ${phone}` : ''}`}
        >
          {displayName.charAt(0) || 'V'}
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50/50 text-rose-600 hover:bg-rose-100/70 hover:border-rose-300 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
          title={t('common.logout')}
          aria-label={t('common.logout')}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0 mt-auto border-t border-slate-100 p-3 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center font-bold text-xs shrink-0">
          {displayName.charAt(0) || 'V'}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate"
            title={displayName}
          >
            {displayName}
          </p>
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 truncate leading-tight">
            {roleTitle}
          </p>
          {phone && (
            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono mt-0.5">
              {phone}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200/80 bg-rose-50/50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100/70 hover:border-rose-300 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-colors shadow-sm cursor-pointer select-none whitespace-nowrap min-w-0"
        title={t('common.logout')}
        aria-label={t('common.logout')}
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{t('common.logout')}</span>
      </button>
    </div>
  );
};
