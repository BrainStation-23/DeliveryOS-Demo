import React from 'react';
import { Clock, X } from 'lucide-react';

interface OrderDeepLinkBannerProps {
  orderNumber: string;
  onClear: () => void;
}

export const OrderDeepLinkBanner: React.FC<OrderDeepLinkBannerProps> = ({ orderNumber, onClear }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-200">
    <div className="flex items-center gap-2">
      <Clock className="h-4 w-4 text-amber-600 shrink-0" />
      <span>
        Direct link filter active for Order: <strong className="font-semibold">{orderNumber}</strong>
      </span>
    </div>
    <button
      onClick={onClear}
      className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-white underline"
    >
      <X className="h-3.5 w-3.5" />
      Clear Filter & View All
    </button>
  </div>
);
