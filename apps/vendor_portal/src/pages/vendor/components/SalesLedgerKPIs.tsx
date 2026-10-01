import React from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, DollarSign, Receipt, FileCheck2 } from 'lucide-react';
import { StatCard } from '../../../components/common/StatCard';
import { formatCurrency } from '../../../utils/formatters';

interface SalesSummary {
  totalOrders: number;
  grossSales: number;
  commissionDeducted: number;
  netVendorPayable: number;
}

interface SalesLedgerKPIsProps {
  summary: SalesSummary;
}

export const SalesLedgerKPIs: React.FC<SalesLedgerKPIsProps> = ({ summary }) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title={t('orders.completedOrders')}
        value={summary.totalOrders}
        icon={<TrendingUp className="h-4 w-4" />}
        iconBgColor="bg-amber-50 dark:bg-amber-950/50"
        iconTextColor="text-amber-600 dark:text-amber-400"
      />

      <StatCard
        title={t('orders.grossSalesVolume')}
        value={formatCurrency(summary.grossSales)}
        icon={<DollarSign className="h-4 w-4" />}
        iconBgColor="bg-slate-100 dark:bg-slate-800"
        iconTextColor="text-slate-700 dark:text-slate-300"
      />

      <StatCard
        title={t('orders.platformCommission')}
        value={`-${formatCurrency(summary.commissionDeducted)}`}
        icon={<Receipt className="h-4 w-4" />}
        iconBgColor="bg-rose-50 dark:bg-rose-950/50"
        iconTextColor="text-rose-600 dark:text-rose-400"
        valueColor="text-rose-600 dark:text-rose-400"
      />

      <StatCard
        title={t('orders.netVendorPayable')}
        value={formatCurrency(summary.netVendorPayable)}
        icon={<FileCheck2 className="h-4 w-4" />}
        iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
        iconTextColor="text-emerald-600 dark:text-emerald-400"
        valueColor="text-emerald-600 dark:text-emerald-400"
      />
    </div>
  );
};
