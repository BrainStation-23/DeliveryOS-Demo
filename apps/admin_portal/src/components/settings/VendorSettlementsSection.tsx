import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle2,
  Layers,
  Search,
  Building2,
  Store,
} from 'lucide-react';
import { SettlementStatement, SettlementBatchItem } from '../../services/adminApi';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';
import { Alert } from '../ui/Alert';
import { StatCard } from '../common/StatCard';

export interface VendorSettlementsSectionProps {
  settlements: SettlementStatement[];
  batches: SettlementBatchItem[];
  isExporting: boolean;
  onExportCsv: () => void;
  isExecutingSettlement: boolean;
  onExecuteSettlement: (notes?: string) => void;
  settleSuccessMessage: string | null;
  onClearSettleMessage: () => void;
}

export type SettlementSubView = 'STATEMENTS' | 'BATCHES';

export const VendorSettlementsSection: React.FC<VendorSettlementsSectionProps> = ({
  settlements,
  batches,
  isExporting,
  onExportCsv,
  isExecutingSettlement,
  onExecuteSettlement,
  settleSuccessMessage,
  onClearSettleMessage,
}) => {
  const [subView, setSubView] = useState<SettlementSubView>('STATEMENTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleNotes, setSettleNotes] = useState('');

  const safeSettlements = useMemo(() => (Array.isArray(settlements) ? settlements : []), [settlements]);
  const safeBatches = useMemo(() => (Array.isArray(batches) ? batches : []), [batches]);

  const filteredSettlements = useMemo(() => {
    if (!searchQuery.trim()) return safeSettlements;
    const query = searchQuery.toLowerCase().trim();
    return safeSettlements.filter(
      (s) =>
        s?.vendorName?.toLowerCase().includes(query) ||
        s?.brandName?.toLowerCase().includes(query),
    );
  }, [safeSettlements, searchQuery]);

  const totalGross = useMemo(
    () => safeSettlements.reduce((acc, s) => acc + (s?.grossSales || 0), 0),
    [safeSettlements],
  );
  const totalCommission = useMemo(
    () => safeSettlements.reduce((acc, s) => acc + (s?.platformCommission || 0), 0),
    [safeSettlements],
  );
  const totalPayable = useMemo(
    () => safeSettlements.reduce((acc, s) => acc + (s?.netVendorPayable || 0), 0),
    [safeSettlements],
  );
  const totalOrders = useMemo(
    () => safeSettlements.reduce((acc, s) => acc + (s?.totalOrders || 0), 0),
    [safeSettlements],
  );

  const handleOpenSettleModal = () => {
    onClearSettleMessage();
    setSettleNotes('');
    setIsSettleModalOpen(true);
  };

  const handleConfirmCycle = () => {
    onExecuteSettlement(settleNotes.trim() || undefined);
  };

  return (
    <div className="space-y-6">
      {/* Financial Overview StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Settled Orders"
          value={totalOrders}
          subtitle="lifecycle completed"
        />
        <StatCard
          title="Gross Sales Volume"
          value={`৳${totalGross.toFixed(2)}`}
          subtitle="total order revenue"
        />
        <StatCard
          title="Platform Cut (15%)"
          value={`৳${totalCommission.toFixed(2)}`}
          subtitle="platform earnings"
          iconColorClass="text-primary-600 bg-primary-50 dark:bg-primary-950/50"
        />
        <StatCard
          title="Net Vendor Payable"
          value={`৳${totalPayable.toFixed(2)}`}
          subtitle="pending disbursement"
          iconColorClass="text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50"
        />
      </div>

      {/* Main Container Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {/* Top Header & Action Bar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary-600" />
              Vendor Payout Settlements & Statements
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Platform commission ledger reconciliations (15% rate) and automated net payable disbursement batches.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              isLoading={isExporting}
              onClick={onExportCsv}
              leftIcon={<Download className="h-4 w-4" />}
            >
              Export CSV
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
              onClick={handleOpenSettleModal}
              leftIcon={<CheckCircle2 className="h-4 w-4" />}
            >
              Run Settlement Cycle
            </Button>
          </div>
        </div>

        {/* View Switcher Sub-Tabs & Search Toolbar */}
        <div className="p-4 sm:px-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Sub-view segmented tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 w-fit">
            <button
              type="button"
              onClick={() => setSubView('STATEMENTS')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                subView === 'STATEMENTS'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Store className="h-3.5 w-3.5 shrink-0" />
              <span>Store Payout Statements</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                subView === 'STATEMENTS'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {safeSettlements.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSubView('BATCHES')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                subView === 'BATCHES'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5 shrink-0" />
              <span>Batch Audit Trail</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                subView === 'BATCHES'
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
                  : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}>
                {safeBatches.length}
              </span>
            </button>
          </div>

          {/* Search Bar for Statements view */}
          {subView === 'STATEMENTS' && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search store or brand..."
                className="pl-9 h-8 text-xs w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Content View 1: Store Payout Statements */}
        {subView === 'STATEMENTS' && (
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Store Outlet</th>
                  <th className="py-3 px-3 font-semibold whitespace-nowrap">Brand</th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">Orders</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Gross Sales</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Commission (15%)</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Net Payable</th>
                  <th className="py-3 px-4 font-semibold text-center whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredSettlements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                      {searchQuery ? (
                        <div className="flex flex-col items-center justify-center gap-1">
                          <p>No stores matching &quot;{searchQuery}&quot;</p>
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="text-xs text-primary-600 hover:underline font-semibold"
                          >
                            Clear search
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <Building2 className="h-6 w-6 text-slate-300" />
                          <p>No ledger transactions recorded yet.</p>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredSettlements.map((statement) => (
                    <tr
                      key={statement.vendorId}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {statement.vendorName}
                      </td>
                      <td className="py-3.5 px-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {statement.brandName}
                      </td>
                      <td className="py-3.5 px-3 text-center font-medium whitespace-nowrap">
                        {statement.totalOrders}
                      </td>
                      <td className="py-3.5 px-3 text-right font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        ৳{statement.grossSales.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right text-rose-600 dark:text-rose-400 font-medium whitespace-nowrap">
                        -৳{statement.platformCommission.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ৳{statement.netVendorPayable.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Badge variant="success">Reconciled</Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Content View 2: Settlement Batch Audit Trail */}
        {subView === 'BATCHES' && (
          <div className="overflow-x-auto">
            <table className="min-w-[700px] w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">Batch Number</th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">Orders</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Vendor Payout</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Rider Payout</th>
                  <th className="py-3 px-3 font-semibold text-right whitespace-nowrap">Platform Margin</th>
                  <th className="py-3 px-3 font-semibold text-center whitespace-nowrap">Status</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Executed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {safeBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 italic">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Layers className="h-6 w-6 text-slate-300" />
                        <p>No settlement batches executed yet.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  safeBatches.map((batch) => (
                    <tr
                      key={batch.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-semibold text-primary-600 dark:text-primary-400 whitespace-nowrap">
                        {batch.batchNumber}
                      </td>
                      <td className="py-3 px-3 text-center font-medium whitespace-nowrap">
                        {batch.totalOrders}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                        ৳{Number(batch.totalVendorPayout).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-sky-600 dark:text-sky-400 whitespace-nowrap">
                        ৳{Number(batch.totalRiderPayout).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        ৳{Number(batch.totalPlatformMargin).toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <Badge variant="success">{batch.status}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500 whitespace-nowrap">
                        {new Date(batch.executedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Settlement Cycle Execution Modal */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Execute Financial Settlement Cycle"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSettleModalOpen(false)}
            >
              {settleSuccessMessage ? 'Close' : 'Cancel'}
            </Button>
            {!settleSuccessMessage && (
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent"
                isLoading={isExecutingSettlement}
                onClick={handleConfirmCycle}
              >
                Confirm & Run Cycle
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            This operation aggregates all delivered orders with pending commission and courier trip ledgers, validates double-entry balance, creates an immutable Settlement Batch, and transitions ledgers to SETTLED.
          </p>

          {settleSuccessMessage && (
            <Alert
              type="success"
              title="Settlement Cycle Complete"
              message={settleSuccessMessage}
            />
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Audit Notes (Optional)
            </label>
            <Input
              value={settleNotes}
              onChange={(e) => setSettleNotes(e.target.value)}
              placeholder="e.g. Weekly vendor payout cycle for Sep 24"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
