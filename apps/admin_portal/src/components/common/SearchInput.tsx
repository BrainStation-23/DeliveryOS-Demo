import React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Shared debounced-search style input (callers own the debounce timer). */
export const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = 'Search...', className }) => (
  <div className={cn('relative w-full sm:w-80', className)}>
    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
    <input
      type="text"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    />
    {value && (
      <button
        onClick={() => onChange('')}
        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
        aria-label="Clear search"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);
