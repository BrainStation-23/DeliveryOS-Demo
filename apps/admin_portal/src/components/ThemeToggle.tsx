import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Moon, Sun } from 'lucide-react';
import { Theme, currentTheme, persistTheme, toggleTheme } from '../utils/theme';

export const ThemeToggle: React.FC = () => {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>(() => currentTheme());

  const handleToggle = () => {
    const next = toggleTheme(theme);
    setTheme(next);
    persistTheme(next);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={t('common.theme')}
      aria-label={t('common.theme')}
      aria-pressed={theme === 'dark'}
      className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:border-slate-700 dark:hover:text-white shadow-xs transition-colors cursor-pointer"
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
};
