import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Landmark, FileSpreadsheet, Banknote, BookOpen } from 'lucide-react';
import adminApi from '../../services/adminApi';
import { Alert } from '../../components/ui/Alert';
import { Tabs } from '../../components/ui/Tabs';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';
import { CashDepositsSection } from '../../components/finance/CashDepositsSection';
import { FinanceLedgerSection } from '../../components/finance/FinanceLedgerSection';
import { VendorSettlementsSection } from '../../components/settings/VendorSettlementsSection';

export type FinanceTabId = 'ledger' | 'settlements' | 'deposits';

export const AdminFinancePage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab') as FinanceTabId | null;
  const activeTab: FinanceTabId =
    tabParam === 'deposits' || tabParam === 'settlements' ? tabParam : 'ledger';

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
        if (newTab === 'ledger') {
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

      <Tabs
        aria-label="Financial governance sections"
        items={[
          { id: 'ledger', label: 'Unified Ledger', icon: <BookOpen className="h-4 w-4" /> },
          { id: 'settlements', label: 'Vendor Settlements', icon: <FileSpreadsheet className="h-4 w-4" /> },
          {
            id: 'deposits',
            label: 'Courier Cash Drops',
            icon: <Banknote className="h-4 w-4" />,
            count: pendingDepositsCount > 0 ? pendingDepositsCount : undefined,
          },
        ]}
        selected={activeTab}
        onChange={handleTabChange}
      />

      {/* Tab Panels */}
      {/* 0. Unified Per-Order Ledger Panel */}
      {activeTab === 'ledger' && (
        <div role="tabpanel" id="tabpanel-ledger" aria-labelledby="tab-ledger" className="space-y-6">
          <FinanceLedgerSection onError={setActionError} />
        </div>
      )}

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
