import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle, ShieldCheck, Banknote } from 'lucide-react';
import adminApi, { CashDepositItem } from '../../services/adminApi';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert } from '../ui/Alert';
import { Modal } from '../ui/Modal';
import { Table, Column } from '../ui/Table';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { extractApiError } from '../../utils/apiError';

const PAGE_SIZE = 15;

export const CashDepositsSection: React.FC = () => {
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState<string>('PENDING_APPROVAL');
  const [page, setPage] = useState(1);
  const [selectedDeposit, setSelectedDeposit] = useState<CashDepositItem | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [verificationNotes, setVerificationNotes] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const {
    data: deposits = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-cash-deposits', filterStatus],
    queryFn: () => adminApi.getCashDeposits(filterStatus === 'ALL' ? undefined : filterStatus),
  });

  const safeDeposits = Array.isArray(deposits) ? deposits : [];

  const verifyMutation = useMutation({
    mutationFn: ({ id, action, notes }: { id: string; action: 'APPROVE' | 'REJECT'; notes?: string }) =>
      adminApi.verifyCashDeposit(id, action, notes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-cash-deposits'] });
      queryClient.invalidateQueries({ queryKey: ['admin-fleet'] });
      setActionSuccess(data?.message || `Deposit successfully ${actionType === 'APPROVE' ? 'verified' : 'rejected'}.`);
      setTimeout(() => {
        setSelectedDeposit(null);
        setActionSuccess(null);
        setVerificationNotes('');
      }, 1500);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to process deposit verification.')),
  });

  const pendingCount = safeDeposits.filter((d) => d?.status === 'PENDING_APPROVAL').length;

  const handleOpenVerify = (deposit: CashDepositItem, action: 'APPROVE' | 'REJECT') => {
    setSelectedDeposit(deposit);
    setActionType(action);
    setVerificationNotes(action === 'APPROVE' ? 'Deposit verified against bank statement' : '');
    setActionError(null);
    setActionSuccess(null);
  };

  const handleConfirmAction = () => {
    if (!selectedDeposit) return;
    verifyMutation.mutate({
      id: selectedDeposit.id,
      action: actionType,
      notes: verificationNotes.trim() || undefined,
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                Courier Cash Deposits Governance
              </h3>
              {pendingCount > 0 && (
                <Badge variant="warning">
                  {pendingCount} Pending
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify courier cash drops to unlock COD limits and reconcile platform cash custody.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-800/50">
            <button
              type="button"
              onClick={() => {
                setFilterStatus('PENDING_APPROVAL');
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterStatus === 'PENDING_APPROVAL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Pending Approval
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterStatus('ALL');
                setPage(1);
              }}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterStatus === 'ALL'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              All Records
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </div>

      {actionError && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <Alert type="error" title="Action Error" message={actionError} onDismiss={() => setActionError(null)} />
        </div>
      )}

      {isError && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <Alert
            type="error"
            title="Failed to Load Cash Deposits"
            message={extractApiError(error, 'Could not retrieve cash deposit list.')}
          />
        </div>
      )}

      {(() => {
        const totalPages = Math.max(1, Math.ceil(safeDeposits.length / PAGE_SIZE));
        const paginatedDeposits = safeDeposits.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

        const columns: Column<CashDepositItem>[] = [
          {
            key: 'courier',
            header: 'Courier',
            render: (deposit) => (
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">{deposit.rider?.user?.fullName || 'Courier'}</div>
                <div className="text-[11px] text-slate-400">{deposit.rider?.user?.phone || '—'}</div>
              </div>
            ),
          },
          {
            key: 'amount',
            header: 'Amount',
            render: (deposit) => (
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(deposit.amount, { decimals: true })}
              </span>
            ),
          },
          {
            key: 'paymentMethod',
            header: 'Payment Method',
            render: (deposit) => (
              <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {deposit.paymentMethod}
              </span>
            ),
          },
          {
            key: 'reference',
            header: 'Reference',
            render: (deposit) => (
              <span className="text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                {deposit.transactionReference || '—'}
              </span>
            ),
          },
          {
            key: 'cashInHand',
            header: 'Cash-in-Hand',
            render: (deposit) => (
              <div>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  {formatCurrency(deposit.rider?.cashInHand || 0)}
                </span>
                <span className="text-slate-400 text-[11px]"> / {formatCurrency(deposit.rider?.maxCashLimit || 0)}</span>
              </div>
            ),
          },
          {
            key: 'status',
            header: 'Status',
            render: (deposit) => (
              deposit.status === 'PENDING_APPROVAL' ? (
                <Badge variant="warning">Pending Approval</Badge>
              ) : deposit.status === 'VERIFIED' ? (
                <Badge variant="success">Verified</Badge>
              ) : (
                <Badge variant="danger">Rejected</Badge>
              )
            ),
          },
          {
            key: 'depositedAt',
            header: 'Deposited At',
            render: (deposit) => (
              <span className="text-slate-500 text-xs">
                {formatDateTime(deposit.depositedAt)}
              </span>
            ),
          },
          {
            key: 'action',
            header: 'Action',
            headerClassName: 'text-right',
            className: 'text-right',
            render: (deposit) => (
              deposit.status === 'PENDING_APPROVAL' ? (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7 px-2.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenVerify(deposit, 'APPROVE');
                    }}
                  >
                    Verify
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-rose-600 hover:text-rose-700 border-rose-200 text-xs h-7 px-2.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenVerify(deposit, 'REJECT');
                    }}
                  >
                    Reject
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-slate-400">
                  {deposit.verifiedAt ? `Verified ${formatDateTime(deposit.verifiedAt, 'date')}` : '—'}
                </span>
              )
            ),
          },
        ];

        return (
          <Table
            columns={columns}
            data={paginatedDeposits}
            keyExtractor={(d) => d.id}
            isLoading={isLoading}
            emptyMessage={
              filterStatus === 'PENDING_APPROVAL'
                ? 'No pending deposits awaiting verification.'
                : 'No deposit records found.'
            }
            page={page}
            totalPages={totalPages}
            totalItems={safeDeposits.length}
            onPageChange={setPage}
          />
        );
      })()}

      <Modal
        isOpen={selectedDeposit !== null}
        onClose={() => !verifyMutation.isPending && setSelectedDeposit(null)}
        title={actionType === 'APPROVE' ? 'Verify Courier Cash Deposit' : 'Reject Courier Cash Deposit'}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              disabled={verifyMutation.isPending}
              onClick={() => setSelectedDeposit(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className={
                actionType === 'APPROVE'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }
              isLoading={verifyMutation.isPending}
              onClick={handleConfirmAction}
            >
              {actionType === 'APPROVE' ? 'Confirm & Approve Deposit' : 'Reject Deposit'}
            </Button>
          </div>
        }
      >
        {selectedDeposit && (
          <div className="space-y-4 text-xs">
            {actionSuccess && (
              <Alert type="success" title="Success" message={actionSuccess} />
            )}

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg space-y-2 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Courier:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  {selectedDeposit.rider?.user?.fullName || 'Courier'} ({selectedDeposit.rider?.user?.phone || '—'})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Deposit Amount:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  ৳{Number(selectedDeposit.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Channel:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 font-mono">
                  {selectedDeposit.paymentMethod}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference / Trx ID:</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {selectedDeposit.transactionReference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Cash in Hand:</span>
                <span className="font-medium text-amber-600 dark:text-amber-400">
                  ৳{Number(selectedDeposit.rider?.cashInHand || 0).toFixed(0)} (Limit: ৳{selectedDeposit.rider?.maxCashLimit || 0})
                </span>
              </div>
            </div>

            {actionType === 'APPROVE' ? (
              <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  Approving this deposit will automatically credit the courier’s custody balance and deduct ৳{Number(selectedDeposit.amount).toFixed(2)} from their Cash-in-Hand, unblocking them if they reached their cash safety limit.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300">
                <XCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                  Rejecting this deposit will leave the courier’s Cash-in-Hand unchanged. Please provide a clear reason for the audit log.
                </p>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Verification / Audit Note
              </label>
              <Input
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="e.g. Bank credit confirmed or invalid reference number"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
