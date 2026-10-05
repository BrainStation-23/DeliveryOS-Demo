import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Search, RefreshCw, X } from 'lucide-react';
import adminApi, { AdminOrder } from '../../services/adminApi';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';
import { getSocket } from '../../services/socket';
import { useSocketQueryInvalidation } from '../../hooks/useSocketSubscription';
import { OrderDetailsModal } from '../../components/orders/OrderDetailsModal';
import { ForceAssignModal } from '../../components/orders/ForceAssignModal';
import { CancelOrderModal } from '../../components/orders/CancelOrderModal';
import { OrderLifecycleStageId } from './components/orders/orderFilters';
import { DatePreset, resolveDateRange } from '../../utils/dateRange';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { OrderLifecycleTabs } from './components/orders/OrderLifecycleTabs';
import { DateRangeFilterToolbar } from '../../components/common/DateRangeFilterToolbar';
import { OrderStatusCards } from './components/orders/OrderStatusCards';
import { OrderDeepLinkBanner } from './components/orders/OrderDeepLinkBanner';
import { OrdersTable } from './components/orders/OrdersTable';

const ORDER_SOCKET_EVENTS = ['order:new', 'order:status:changed', 'order:delivery_failed'];
const ORDER_QUERY_KEYS = [['admin-orders']];

export const AdminOrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderNumberParam = searchParams.get('orderNumber');

  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState(orderNumberParam || '');
  // Deep links must resolve regardless of order age, so they bypass the default TODAY window.
  const [datePreset, setDatePreset] = useState<DatePreset>(orderNumberParam ? 'ALL_TIME' : 'TODAY');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState<AdminOrder | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<AdminOrder | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [autoHandledOrderNumber, setAutoHandledOrderNumber] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  const { dateFromIso, dateToIso } = useMemo(
    () => resolveDateRange(datePreset, customStartDate, customEndDate),
    [datePreset, customStartDate, customEndDate],
  );

  const debouncedSearch = useDebouncedValue(searchQuery);

  const assignmentFilter = unassignedOnly ? ('UNASSIGNED' as const) : undefined;

  const { data: ordersData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-orders', selectedStatus, page, debouncedSearch, datePreset, dateFromIso, dateToIso, assignmentFilter],
    queryFn: () =>
      adminApi.getOrders(selectedStatus, page, 20, debouncedSearch, dateFromIso, dateToIso, assignmentFilter),
    refetchInterval: 30000,
    placeholderData: (previous) => previous,
  });
  // Status-mix cards honor the same date window + search as the list itself.
  const { data: statusSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['admin-orders-summary', debouncedSearch, datePreset, dateFromIso, dateToIso, assignmentFilter],
    queryFn: () =>
      adminApi.getOrdersStatusSummary({
        dateFrom: dateFromIso,
        dateTo: dateToIso,
        search: debouncedSearch,
        assignment: assignmentFilter,
      }),
    placeholderData: (previous) => previous,
  });
  useSocketQueryInvalidation(ORDER_SOCKET_EVENTS, [['admin-orders-summary']]);

  const orders: AdminOrder[] = Array.isArray(ordersData)
    ? ordersData
    : (Array.isArray(ordersData?.items) ? ordersData.items : []);
  const totalPages = typeof ordersData?.totalPages === 'number' ? ordersData.totalPages : 1;
  const totalOrders = typeof ordersData?.total === 'number' ? ordersData.total : orders.length;

  useSocketQueryInvalidation(ORDER_SOCKET_EVENTS, ORDER_QUERY_KEYS);

  const { data: fleet = [] } = useQuery({
    queryKey: ['admin-fleet'],
    queryFn: adminApi.getFleet,
  });

  const safeFleet = Array.isArray(fleet) ? fleet : [];

  const safeOrders = Array.isArray(orders) ? orders : [];

  useEffect(() => {
    if (orderNumberParam) {
      setSearchQuery(orderNumberParam);
    }
  }, [orderNumberParam]);

  useEffect(() => {
    if (orderNumberParam && safeOrders.length > 0 && autoHandledOrderNumber !== orderNumberParam) {
      const matched = safeOrders.find(
        (o) => o && (o.orderNumber || '').toLowerCase() === orderNumberParam.toLowerCase()
      );
      if (matched) {
        setAutoHandledOrderNumber(orderNumberParam);
        if (matched.status !== 'DELIVERED' && matched.status !== 'CANCELLED') {
          openAssignModal(matched);
        } else {
          setDetailsOrder(matched);
          setIsDetailsModalOpen(true);
        }
      }
    }
  }, [orderNumberParam, safeOrders, autoHandledOrderNumber]);

  useEffect(() => {
    const socket = getSocket();
    const handleDeliveryFailed = (payload: { data?: { orderId?: string; orderNumber?: string; reason?: string } }) => {
      if (payload?.data?.orderNumber) {
        setActionError(`Doorstep delivery failure reported for order ${payload.data.orderNumber}: ${payload.data.reason || 'Customer unreachable / delivery rejected'}`);
      }
    };
    socket.on('order:delivery_failed', handleDeliveryFailed);
    return () => {
      socket.off('order:delivery_failed', handleDeliveryFailed);
    };
  }, []);

  const forceAssignMutation = useMutation({
    mutationFn: ({ orderId, riderId }: { orderId: string; riderId: string }) =>
      adminApi.forceAssignRider(orderId, riderId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-fleet'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders-summary'] });
      setIsAssignModalOpen(false);
      setSelectedOrder(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Force-assign failed. Please retry.')),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      adminApi.cancelOrder(orderId, reason),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setIsCancelModalOpen(false);
      setCancelTargetOrder(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Order cancellation failed. Please retry.')),
  });

  const openAssignModal = (order: AdminOrder) => {
    setSelectedOrder(order);
    setIsAssignModalOpen(true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPage(1);
    if (orderNumberParam) {
      searchParams.delete('orderNumber');
      setSearchParams(searchParams);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order History"
        subtitle="Complete order records with live status updates, stage and date filters, and manual dispatch overrides"
        icon={ClipboardList}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh Queue
          </Button>
        }
      />

      <OrderStatusCards
        counts={statusSummary?.counts ?? {}}
        total={statusSummary?.total ?? 0}
        selected={selectedStatus}
        onSelect={(status) => {
          setPage(1);
          setSelectedStatus(status);
        }}
        isLoading={isSummaryLoading}
      />

      <OrderLifecycleTabs
        selected={selectedStatus}
        onChange={(stage: OrderLifecycleStageId) => {
          setPage(1);
          setSelectedStatus(stage);
        }}
      />

      <DateRangeFilterToolbar
        datePreset={datePreset}
        onDatePresetChange={(preset) => {
          setPage(1);
          setDatePreset(preset);
        }}
        customStartDate={customStartDate}
        onCustomStartDateChange={(val) => {
          setPage(1);
          setCustomStartDate(val);
        }}
        customEndDate={customEndDate}
        onCustomEndDateChange={(val) => {
          setPage(1);
          setCustomEndDate(val);
        }}
        onClearCustomDates={() => {
          setCustomStartDate('');
          setCustomEndDate('');
        }}
      />

      {orderNumberParam && <OrderDeepLinkBanner orderNumber={orderNumberParam} onClear={clearSearch} />}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by Order #, Store, Customer, Courier..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-8 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setUnassignedOnly((prev) => !prev);
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer h-8 ${
                unassignedOnly
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
              title="Show only active orders with no courier assigned"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${unassignedOnly ? 'bg-white' : 'bg-amber-500'}`}
              />
              Unassigned Only
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                  unassignedOnly ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                }`}
              >
                {statusSummary?.unassignedCount ?? 0}
              </span>
            </button>
            <div className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{safeOrders.length}</span> of{' '}
              <span className="font-semibold text-slate-900 dark:text-slate-100">{totalOrders}</span> live orders
            </div>
          </div>
        </div>

        {actionError && (
          <div className="px-4 pt-3">
            <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />
          </div>
        )}

        {isError ? (
          <div className="p-4">
            <QueryErrorBanner error={error} onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <div className="py-16 text-center">
            <LoadingSpinner size="lg" label="Synchronizing order lifecycle stream..." />
          </div>
        ) : (
          <OrdersTable
            orders={safeOrders}
            page={page}
            totalPages={totalPages}
            totalItems={totalOrders}
            onPageChange={setPage}
            emptyMessage="No orders match the selected lifecycle criteria."
            onViewDetails={(row) => {
              setDetailsOrder(row as AdminOrder);
              setIsDetailsModalOpen(true);
            }}
            onAssign={(row) => openAssignModal(row as AdminOrder)}
            onCancel={(row) => {
              setCancelTargetOrder(row as AdminOrder);
              setIsCancelModalOpen(true);
            }}
          />
        )}
      </div>

      <OrderDetailsModal
        isOpen={isDetailsModalOpen}
        order={detailsOrder}
        onClose={() => setIsDetailsModalOpen(false)}
        onOpenCancel={(order) => {
          setCancelTargetOrder(order);
          setIsCancelModalOpen(true);
        }}
        onOpenAssign={openAssignModal}
      />

      <ForceAssignModal
        isOpen={isAssignModalOpen}
        order={selectedOrder}
        fleet={safeFleet}
        isPending={forceAssignMutation.isPending}
        onClose={() => setIsAssignModalOpen(false)}
        onConfirm={(riderId) => {
          if (selectedOrder) {
            forceAssignMutation.mutate({ orderId: selectedOrder.id, riderId });
          }
        }}
      />

      <CancelOrderModal
        isOpen={isCancelModalOpen}
        order={cancelTargetOrder}
        isPending={cancelMutation.isPending}
        onClose={() => setIsCancelModalOpen(false)}
        onConfirm={(reason) => {
          if (cancelTargetOrder) {
            cancelMutation.mutate({
              orderId: cancelTargetOrder.id,
              reason,
            });
          }
        }}
      />
    </div>
  );
};
