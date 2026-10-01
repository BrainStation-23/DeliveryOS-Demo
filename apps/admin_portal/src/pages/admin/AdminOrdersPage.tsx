import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Search,
  RefreshCw,
  UserCheck,
  Bike,
  Clock,
  Eye,
  XCircle,
  X,
} from 'lucide-react';
import adminApi, { AdminOrder } from '../../services/adminApi';
import { Table, Column } from '../../components/ui/Table';
import { Badge, OrderStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';
import { useSocketQueryInvalidation } from '../../hooks/useSocketSubscription';
import { OrderDetailsModal } from '../../components/orders/OrderDetailsModal';
import { ForceAssignModal } from '../../components/orders/ForceAssignModal';
import { CancelOrderModal } from '../../components/orders/CancelOrderModal';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

const ORDER_SOCKET_EVENTS = ['order:new', 'order:status:changed'];
const ORDER_QUERY_KEYS = [['admin-orders']];

export const AdminOrdersPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const orderNumberParam = searchParams.get('orderNumber');

  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState(orderNumberParam || '');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedRiderId, setSelectedRiderId] = useState<string>('');
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelTargetOrder, setCancelTargetOrder] = useState<AdminOrder | null>(null);

  const [detailsOrder, setDetailsOrder] = useState<AdminOrder | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [autoHandledOrderNumber, setAutoHandledOrderNumber] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: ordersData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-orders', selectedStatus, page, searchQuery],
    queryFn: () => adminApi.getOrders(selectedStatus, page, 20, searchQuery),
    refetchInterval: 30000,
    placeholderData: (previous) => previous,
  });
  const orders = ordersData?.items ?? [];
  const totalPages = ordersData?.totalPages ?? 1;
  const totalOrders = ordersData?.total ?? 0;

  useSocketQueryInvalidation(ORDER_SOCKET_EVENTS, ORDER_QUERY_KEYS);

  const { data: fleet = [] } = useQuery({
    queryKey: ['admin-fleet-assignable'],
    queryFn: adminApi.getFleet,
  });

  const availableRiders = fleet.filter((r) => r.isOnline);

  useEffect(() => {
    if (orderNumberParam) {
      setSearchQuery(orderNumberParam);
    }
  }, [orderNumberParam]);

  useEffect(() => {
    if (orderNumberParam && orders.length > 0 && autoHandledOrderNumber !== orderNumberParam) {
      const matched = orders.find(
        (o) => o.orderNumber.toLowerCase() === orderNumberParam.toLowerCase()
      );
      if (matched) {
        setAutoHandledOrderNumber(orderNumberParam);
        if (matched.status !== 'DELIVERED' && matched.status !== 'CANCELLED') {
          setSelectedOrder(matched);
          setSelectedRiderId(matched.riderId || (availableRiders[0]?.id ?? ''));
          setIsAssignModalOpen(true);
        } else {
          setDetailsOrder(matched);
          setIsDetailsModalOpen(true);
        }
      }
    }
  }, [orderNumberParam, orders, autoHandledOrderNumber, availableRiders]);

  const forceAssignMutation = useMutation({
    mutationFn: ({ orderId, riderId }: { orderId: string; riderId: string }) =>
      adminApi.forceAssignRider(orderId, riderId),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-fleet'] });
      setIsAssignModalOpen(false);
      setSelectedOrder(null);
      setSelectedRiderId('');
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

  const filteredOrders = orders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      o.orderNumber.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.vendorName.toLowerCase().includes(q) ||
      (o.riderName && o.riderName.toLowerCase().includes(q)) ||
      (o.customerPhone && o.customerPhone.includes(q));
    return matchesSearch;
  });

  const clearSearch = () => {
    setSearchQuery('');
    setPage(1);
    if (orderNumberParam) {
      searchParams.delete('orderNumber');
      setSearchParams(searchParams);
    }
  };

  const columns: Column<AdminOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (order) => (
        <div>
          <button
            onClick={() => {
              setDetailsOrder(order);
              setIsDetailsModalOpen(true);
            }}
            className="font-semibold text-primary-600 hover:text-primary-700 hover:underline dark:text-primary-400 text-left"
            title="Click to view line items & details"
          >
            {order.orderNumber}
          </button>
          <div className="text-[11px] text-slate-500">
            {new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      ),
    },
    {
      key: 'vendorName',
      header: 'Store Outlet',
      render: (order) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{order.vendorName}</div>
          <div className="text-[11px] text-slate-500 truncate max-w-[160px]">{order.vendorAddress}</div>
          <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
            <span>{order.items?.length || 0} item{order.items?.length === 1 ? '' : 's'}</span>
            {order.customerNotes && (
              <span className="inline-flex items-center text-amber-600 dark:text-amber-400 font-semibold" title={order.customerNotes}>
                • Note
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      render: (order) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{order.customerName}</div>
          <div className="text-[11px] text-slate-500">{order.customerPhone}</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: 'riderName',
      header: 'Assigned Courier',
      render: (order) =>
        order.riderName ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300">
            <Bike className="h-3.5 w-3.5 text-primary-600 shrink-0" />
            <div>
              <span className="font-medium">{order.riderName}</span>
              <div className="text-[10px] text-slate-400">{order.riderPhone}</div>
            </div>
          </div>
        ) : (
          <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px] italic">
            Unassigned
          </span>
        ),
    },
    {
      key: 'totalAmount',
      header: 'Total',
      render: (order) => (
        <div className="text-right">
          <span className="font-semibold text-slate-900 dark:text-slate-100">৳{order.totalAmount}</span>
          <div className="text-[10px] text-slate-400">{order.paymentMethod}</div>
        </div>
      ),
    },
    {
      key: 'id',
      header: 'Action',
      render: (order) => (
        <div className="inline-flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 px-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => {
              setDetailsOrder(order);
              setIsDetailsModalOpen(true);
            }}
            leftIcon={<Eye className="h-3.5 w-3.5" />}
          >
            Details
          </Button>

          {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7 px-2.5"
                onClick={() => {
                  setSelectedOrder(order);
                  setSelectedRiderId(order.riderId || (availableRiders[0]?.id ?? ''));
                  setIsAssignModalOpen(true);
                }}
                leftIcon={<UserCheck className="h-3.5 w-3.5 text-primary-600" />}
              >
                {order.riderId ? 'Reassign' : 'Force Assign'}
              </Button>
              {order.status !== 'DISPATCHED' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onClick={() => {
                    setCancelTargetOrder(order);
                    setIsCancelModalOpen(true);
                  }}
                  leftIcon={<XCircle className="h-3.5 w-3.5 text-rose-500" />}
                >
                  Cancel
                </Button>
              )}
            </>
          ) : (
            <span className="text-slate-400 text-xs">—</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Order Lifecycle Monitor"
        subtitle="Real-time multi-stage order tracking with manual dispatch force-assignment override"
        icon={FileText}
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

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {[
          { id: 'ALL', label: 'All Orders' },
          { id: 'PLACED', label: '1. Placed' },
          { id: 'RIDER_ASSIGNED', label: '2. Courier Assigned' },
          { id: 'ACCEPTED', label: '3. Accepted' },
          { id: 'PREPARING', label: '4. Preparing' },
          { id: 'READY_FOR_PICKUP', label: '5. Ready for Pickup' },
          { id: 'DISPATCHED', label: '6. On Delivery' },
          { id: 'DELIVERED', label: '7. Delivered' },
        ].map((stage) => (
          <button
            key={stage.id}
            onClick={() => {
              setPage(1);
              setSelectedStatus(stage.id);
            }}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedStatus === stage.id
                ? 'bg-primary-600 text-white font-semibold shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            {stage.label}
          </button>
        ))}
      </div>

      {orderNumberParam && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              Direct link filter active for Order: <strong className="font-semibold">{orderNumberParam}</strong>
            </span>
          </div>
          <button
            onClick={clearSearch}
            className="flex items-center gap-1 text-[11px] font-semibold text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-white underline"
          >
            <X className="h-3.5 w-3.5" />
            Clear Filter & View All
          </button>
        </div>
      )}

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
          <div className="text-xs text-slate-500">
            Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{filteredOrders.length}</span> of{' '}
            <span className="font-semibold text-slate-900 dark:text-slate-100">{totalOrders}</span> live orders
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
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            message="No orders match the selected lifecycle criteria."
            className="m-4"
          />
        ) : (
          <Table
            data={filteredOrders}
            columns={columns}
            keyExtractor={(o) => o.id}
            page={page}
            totalPages={totalPages}
            totalItems={totalOrders}
            onPageChange={setPage}
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
        onOpenAssign={(order) => {
          setSelectedOrder(order);
          setSelectedRiderId(order.riderId || (availableRiders[0]?.id ?? ''));
          setIsAssignModalOpen(true);
        }}
      />

      <ForceAssignModal
        isOpen={isAssignModalOpen}
        order={selectedOrder}
        availableRiders={availableRiders}
        selectedRiderId={selectedRiderId}
        isPending={forceAssignMutation.isPending}
        onClose={() => setIsAssignModalOpen(false)}
        onSelectRider={setSelectedRiderId}
        onConfirm={() => {
          if (selectedOrder && selectedRiderId) {
            forceAssignMutation.mutate({
              orderId: selectedOrder.id,
              riderId: selectedRiderId,
            });
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
