import React from 'react';
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
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Completed Orders"
        value={summary.totalOrders}
        subtitle="Audited completed orders"
        icon={<TrendingUp className="h-5 w-5" />}
        iconBgColor="bg-primary-50 dark:bg-primary-950/50"
        iconTextColor="text-primary-600 dark:text-primary-400"
      />

      <StatCard
        title="Gross Volume"
        value={formatCurrency(summary.grossSales)}
        subtitle="Before platform commissions"
        icon={<DollarSign className="h-5 w-5" />}
        iconBgColor="bg-amber-50 dark:bg-amber-950/50"
        iconTextColor="text-amber-600 dark:text-amber-400"
      />

      <StatCard
        title="Platform Fee (15%)"
        value={`-${formatCurrency(summary.commissionDeducted)}`}
        subtitle="Platform revenue share"
        icon={<Receipt className="h-5 w-5" />}
        iconBgColor="bg-rose-50 dark:bg-rose-950/50"
        iconTextColor="text-rose-600 dark:text-rose-400"
        valueColor="text-rose-600 dark:text-rose-400"
      />

      <StatCard
        title="Net Vendor Payable"
        value={formatCurrency(summary.netVendorPayable)}
        subtitle="Net merchant earnings"
        icon={<FileCheck2 className="h-5 w-5" />}
        iconBgColor="bg-emerald-50 dark:bg-emerald-950/50"
        iconTextColor="text-emerald-600 dark:text-emerald-400"
        valueColor="text-emerald-600 dark:text-emerald-400"
      />
    </div>
  );
};
