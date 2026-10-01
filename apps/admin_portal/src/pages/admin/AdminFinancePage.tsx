import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Landmark,
  FileSpreadsheet,
  Banknote,
  LucideIcon,
} from 'lucide-react';
import adminApi from '../../services/adminApi';
import { Alert } from '../../components/ui/Alert';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';
import { CashDepositsSection } from '../../components/finance/CashDepositsSection';
import { VendorSettlementsSection } from '../../components/settings/VendorSettlementsSection';

export type FinanceTabId = 'settlements' | 'deposits';

interface TabDefinition {
  id: FinanceTabId;
  label: string;
  icon: LucideIcon;
  badge?: number;
  badgeVariant?: 'primary' | 'warning';
}

export const AdminFinancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as FinanceTabId | null;
  const activeTab: FinanceTabId = tabParam === 'deposits' ? 'deposits' : 'settlements';

  const [isExporting, setIsExporting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [settleSuccessMessage, setSettleSuccessMessage] = useState<string | null>(null);

  // Settlements statements query
  const {
    data: settlements = [],
    isError: isSettlementsError,
    error: settlementsError,
    refetch: refetchSettlements,
  } = useQuery({
    queryKey: ['admin-settlements'],
    queryFn: adminApi.getSettlementStatements,
  });

  // Settlement batches query
  const {
    data: batches = [],
    isError: isBatchesError,
    error: batchesError,
    refetch: refetchBatches,
  } = useQuery({
    queryKey: ['admin-settlement-batches'],
    queryFn: adminApi.getSettlementBatches,
  });

  // Pending cash deposits count for tab badge
  const { data: pendingDeposits = [] } = useQuery({
    queryKey: ['admin-cash-deposits', 'PENDING_APPROVAL'],
    queryFn: () => adminApi.getCashDeposits('PENDING_APPROVAL'),
    staleTime: 30000,
  });

  const pendingDepositsCount = Array.isArray(pendingDeposits)
    ? pendingDeposits.filter((d) => d?.status === 'PENDING_APPROVAL').length
    : 0;

  // Mutations
  const executeSettlementMutation = useMutation({
    mutationFn: (notes?: string) => adminApi.executeSettlementCycle(notes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-settlement-batches'] });
      queryClient.invalidateQueries({ queryKey: ['admin-settlements'] });
      setSettleSuccessMessage(data?.message || 'Settlement cycle closed successfully.');
    },
    onError: (err) => setActionError(extractApiError(err, 'Settlement cycle execution failed.')),
  });

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const blob = await adminApi.exportSettlementCsv();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vendor-settlements-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download settlement CSV:', err);
      setActionError(extractApiError(err, 'Failed to download settlement statement CSV.'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleTabChange = (newTab: FinanceTabId) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (newTab === 'settlements') {
          next.delete('tab');
        } else {
          next.set('tab', newTab);
        }
        return next;
      },
      { replace: true },
    );
  };

  const safeSettlements = Array.isArray(settlements) ? settlements : [];
  const safeBatches = Array.isArray(batches) ? batches : [];

  const tabs: TabDefinition[] = [
    {
      id: 'settlements',
      label: 'Vendor Settlements & Ledgers',
      icon: FileSpreadsheet,
      badge: safeSettlements.length > 0 ? safeSettlements.length : undefined,
      badgeVariant: 'primary',
    },
    {
      id: 'deposits',
      label: 'Courier Cash Drops Governance',
      icon: Banknote,
      badge: pendingDepositsCount > 0 ? pendingDepositsCount : undefined,
      badgeVariant: 'warning',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Governance & Settlements"
        subtitle="Reconcile platform commission ledgers (15%), execute automated vendor payout cycles, and manage physical courier cash drops"
        icon={Landmark}
      />

      {actionError && (
        <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />
      )}

      {/* Accessible Tab Bar */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav
          className="-mb-px flex space-x-2 sm:space-x-6 overflow-x-auto scrollbar-none"
          role="tablist"
          aria-label="Financial governance sections"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                role="tab"
                id={`tab-${tab.id}`}
                aria-controls={`tabpanel-${tab.id}`}
                aria-selected={isActive}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap focus:outline-hidden ${
                  isActive
                    ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-700'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      tab.badgeVariant === 'warning'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-primary-50 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      {/* 1. Vendor Settlements Panel */}
      {activeTab === 'settlements' && (
        <div
          role="tabpanel"
          id="tabpanel-settlements"
          aria-labelledby="tab-settlements"
          className="space-y-6"
        >
          {isSettlementsError && (
            <QueryErrorBanner error={settlementsError} onRetry={() => refetchSettlements()} />
          )}
          {isBatchesError && (
            <QueryErrorBanner error={batchesError} onRetry={() => refetchBatches()} />
          )}

          <VendorSettlementsSection
            settlements={safeSettlements}
            batches={safeBatches}
            isExporting={isExporting}
            onExportCsv={handleExportCsv}
            isExecutingSettlement={executeSettlementMutation.isPending}
            onExecuteSettlement={(notes) => executeSettlementMutation.mutate(notes)}
            settleSuccessMessage={settleSuccessMessage}
            onClearSettleMessage={() => setSettleSuccessMessage(null)}
          />
        </div>
      )}

      {/* 2. Courier Cash Deposits Governance Panel */}
      {activeTab === 'deposits' && (
        <div
          role="tabpanel"
          id="tabpanel-deposits"
          aria-labelledby="tab-deposits"
          className="space-y-6"
        >
          <CashDepositsSection />
        </div>
      )}
    </div>
  );
};
