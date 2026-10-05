import React from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut } from 'lucide-react';

interface LogoutButtonProps {
  onLogout: () => void;
  /** `expanded` renders the labeled full-width button; `icon` the collapsed-rail square. */
  variant?: 'expanded' | 'icon';
}

export const LogoutButton: React.FC<LogoutButtonProps> = ({ onLogout, variant = 'expanded' }) => {
  const { t } = useTranslation();

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={onLogout}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200/80 bg-rose-50/50 text-rose-600 hover:bg-rose-100/70 hover:border-rose-300 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
        title={t('common.logout')}
        aria-label={t('common.logout')}
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
      </button>
    );
  }

  return (
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
  );
};
