import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';

export interface LanguageOption {
  code: string;
  label: string;
  native: string;
  dir: 'ltr' | 'rtl';
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', native: 'English', dir: 'ltr' },
  { code: 'ar', label: 'Arabic', native: 'العربية', dir: 'rtl' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', dir: 'ltr' },
];

export interface LanguageSelectorProps {
  className?: string;
  variant?: 'default' | 'dark';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className,
  variant,
}) => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Auto-detect dark mode if variant is not explicitly specified
  const isDark =
    variant === 'dark' ||
    (variant === undefined &&
      (className?.includes('bg-slate-') ||
        className?.includes('dark') ||
        className?.includes('text-white')));

  const currentLang =
    SUPPORTED_LANGUAGES.find((lang) =>
      i18n.language ? i18n.language.startsWith(lang.code) : false
    ) || SUPPORTED_LANGUAGES[0];

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const triggerClasses = isDark
    ? 'border-slate-700/80 bg-slate-900/80 text-slate-200 hover:bg-slate-800/90 hover:border-slate-600 hover:text-white shadow-sm backdrop-blur-md'
    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-700 dark:hover:text-white shadow-sm';

  const menuClasses = isDark
    ? 'border-slate-700/80 bg-slate-900/95 text-slate-200 shadow-2xl backdrop-blur-xl'
    : 'border-slate-200 bg-white text-slate-800 shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100';

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-flex items-center text-xs ${className || ''}`}
    >
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Select Language"
        className={`h-9 px-2.5 sm:px-3 inline-flex items-center gap-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${triggerClasses} ${
          isOpen ? 'ring-2 ring-primary-500/40 border-primary-500/80' : ''
        }`}
      >
        <Globe className="h-4 w-4 text-primary-500 shrink-0" />
        <span className="font-semibold">{currentLang.native}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-primary-500' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Available Languages"
          className={`absolute right-0 top-full mt-1.5 w-48 rounded-xl border p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 ${menuClasses}`}
        >
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Select Language
          </div>
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = lang.code === currentLang.code;
            const itemClasses = isDark
              ? isSelected
                ? 'bg-primary-500/15 text-primary-300 font-bold border border-primary-500/30'
                : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
              : isSelected
              ? 'bg-primary-50 text-primary-700 font-bold dark:bg-primary-950/40 dark:text-primary-300 border border-primary-200 dark:border-primary-900/50'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100';

            return (
              <button
                key={lang.code}
                role="option"
                aria-selected={isSelected}
                type="button"
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer ${itemClasses}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold">{lang.native}</span>
                  {lang.native !== lang.label && (
                    <span className="text-[11px] opacity-70">
                      ({lang.label})
                    </span>
                  )}
                </div>
                {isSelected && (
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isDark ? 'text-primary-400' : 'text-primary-600 dark:text-primary-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
