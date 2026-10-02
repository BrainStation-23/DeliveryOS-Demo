import React from 'react';
import { Image as ImageIcon, Percent } from 'lucide-react';

export type PromotionsTab = 'BANNERS' | 'COUPONS';

interface PromotionsTabBarProps {
  activeTab: PromotionsTab;
  onChange: (tab: PromotionsTab) => void;
  bannersCount: number;
  couponsCount: number;
}

export const PromotionsTabBar: React.FC<PromotionsTabBarProps> = ({
  activeTab,
  onChange,
  bannersCount,
  couponsCount,
}) => (
  <div className="flex border-b border-slate-200 dark:border-slate-800">
    <button
      onClick={() => onChange('BANNERS')}
      className={`flex items-center gap-2 border-b-2 py-3 px-4 sm:px-5 text-sm font-semibold transition-all ${
        activeTab === 'BANNERS'
          ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
      }`}
    >
      <ImageIcon className="h-4 w-4 shrink-0" />
      <span>Promotional Banners ({bannersCount})</span>
    </button>
    <button
      onClick={() => onChange('COUPONS')}
      className={`flex items-center gap-2 border-b-2 py-3 px-4 sm:px-5 text-sm font-semibold transition-all ${
        activeTab === 'COUPONS'
          ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
      }`}
    >
      <Percent className="h-4 w-4 shrink-0" />
      <span>Discount Coupons ({couponsCount})</span>
    </button>
  </div>
);
