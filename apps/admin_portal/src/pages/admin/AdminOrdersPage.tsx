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
  XCircle,
  Eye,
  ShoppingBag,
  MessageSquare,
  X,
} from 'lucide-react';
import adminApi, { AdminOrder } from '../../services/adminApi';
import { getSocket } from '../../services/socket';
import { Table, Column } from '../../components/ui/Table';
import { Badge, OrderStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';

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
  const [cancelReason, setCancelReason] = useState('');

  const [detailsOrder, setDetailsOrder] = useState<AdminOrder | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [autoHandledOrderNumber, setAutoHandledOrderNumber] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: ordersData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-orders', selectedStatus, page],
    queryFn: () => adminApi.getOrders(selectedStatus, page, 20),
    refetchInterval: 30000,
    placeholderData: (previous) => previous,
  });
  const orders = ordersData?.items ?? [];
  const totalPages = ordersData?.totalPages ?? 1;
  const totalOrders = ordersData?.total ?? 0;

  useEffect(() => {
    const socket = getSocket();

    const handleOrderUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    };

    socket.on('order:new', handleOrderUpdate);
    socket.on('order:status:changed', handleOrderUpdate);

    return () => {
      socket.off('order:new', handleOrderUpdate);
      socket.off('order:status:changed', handleOrderUpdate);
    };
  }, [queryClient]);

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
      setCancelReason('');
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
                    setCancelReason('');
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
              onChange={(e) => setSearchQuery(e.target.value)}
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

      {isDetailsModalOpen && detailsOrder && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Order Details — #${detailsOrder.orderNumber}`}
          footer={
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsDetailsModalOpen(false)}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                {detailsOrder.status !== 'DELIVERED' && detailsOrder.status !== 'CANCELLED' && detailsOrder.status !== 'DISPATCHED' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      setCancelTargetOrder(detailsOrder);
                      setCancelReason('');
                      setIsCancelModalOpen(true);
                    }}
                    leftIcon={<XCircle className="h-3.5 w-3.5" />}
                  >
                    Force Cancel
                  </Button>
                )}
                {detailsOrder.status !== 'DELIVERED' && detailsOrder.status !== 'CANCELLED' && (
                  <Button
                    size="sm"
                    className="text-xs h-8"
                    onClick={() => {
                      setIsDetailsModalOpen(false);
                      setSelectedOrder(detailsOrder);
                      setSelectedRiderId(detailsOrder.riderId || (availableRiders[0]?.id ?? ''));
                      setIsAssignModalOpen(true);
                    }}
                    leftIcon={<UserCheck className="h-3.5 w-3.5" />}
                  >
                    {detailsOrder.riderId ? 'Reassign Courier' : 'Force Assign'}
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200 dark:bg-slate-800/60 dark:border-slate-700">
              <div>
                <span className="text-xs text-slate-500 block mb-0.5">Order Status</span>
                <OrderStatusBadge status={detailsOrder.status} />
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block mb-0.5">Placed At</span>
                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {new Date(detailsOrder.placedAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                  Store Outlet
                </span>
                <div className="font-medium text-slate-700 dark:text-slate-300">{detailsOrder.vendorName}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">{detailsOrder.vendorAddress}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                  Customer Details
                </span>
                <div className="font-medium text-slate-700 dark:text-slate-300">{detailsOrder.customerName}</div>
                <div className="text-slate-500 text-[11px]">{detailsOrder.customerPhone}</div>
                <div className="text-slate-500 text-[11px] mt-1">
                  <span className="font-medium text-slate-600 dark:text-slate-400">Delivery: </span>
                  {detailsOrder.deliveryAddress}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 p-3 text-xs dark:border-slate-800">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block mb-1">
                Assigned Delivery Courier
              </span>
              {detailsOrder.riderName ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bike className="h-4 w-4 text-primary-600" />
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">{detailsOrder.riderName}</div>
                      <div className="text-[11px] text-slate-500">{detailsOrder.riderPhone}</div>
                    </div>
                  </div>
                  <Badge variant="info">Assigned</Badge>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-600 dark:text-amber-400">
                  <span className="font-medium italic">No courier assigned yet (Waiting in dispatch pool)</span>
                  {detailsOrder.status !== 'DELIVERED' && detailsOrder.status !== 'CANCELLED' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7 px-2 self-start sm:self-auto"
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        setSelectedOrder(detailsOrder);
                        setSelectedRiderId(availableRiders[0]?.id ?? '');
                        setIsAssignModalOpen(true);
                      }}
                    >
                      Assign Now
                    </Button>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-amber-50/40 p-3 text-xs dark:border-amber-900/30 dark:bg-amber-950/20">
              <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-300 mb-1">
                <MessageSquare className="h-3.5 w-3.5" />
                Customer Special Cooking & Delivery Notes
              </div>
              <p className="text-slate-700 dark:text-slate-300 italic">
                {detailsOrder.customerNotes ? `"${detailsOrder.customerNotes}"` : 'No special notes specified by customer.'}
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
                <span className="flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-primary-600" />
                  Line Items ({detailsOrder.items?.length || 0})
                </span>
                <span className="text-slate-500 font-normal">Subtotal</span>
              </div>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800 overflow-hidden text-xs">
                {detailsOrder.items && detailsOrder.items.length > 0 ? (
                  detailsOrder.items.map((item) => (
                    <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{item.name}</span>
                        <div className="text-[11px] text-slate-500">
                          {item.quantity} x ৳{item.unitPrice}
                        </div>
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        ৳{item.quantity * item.unitPrice}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="p-3 text-center text-slate-400 italic">No line items recorded</div>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs space-y-1.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Items Subtotal:</span>
                <span>
                  ৳{detailsOrder.items?.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) || (detailsOrder.totalAmount - (detailsOrder.deliveryFee || 0))}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Delivery Fee:</span>
                <span>৳{detailsOrder.deliveryFee || 0}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-200 dark:border-slate-700">
                <span>Total Amount:</span>
                <span className="text-primary-600 dark:text-primary-400">৳{detailsOrder.totalAmount}</span>
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                <span>Payment Method & Status:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {detailsOrder.paymentMethod} • {detailsOrder.paymentStatus}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {selectedOrder && (
        <Modal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          title={`Manual Dispatch Override — #${selectedOrder.orderNumber}`}
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!selectedRiderId}
                isLoading={forceAssignMutation.isPending}
                onClick={() => {
                  if (selectedOrder && selectedRiderId) {
                    forceAssignMutation.mutate({
                      orderId: selectedOrder.id,
                      riderId: selectedRiderId,
                    });
                  }
                }}
              >
                Confirm Dispatch Override
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Alert
              type="warning"
              message="Manual assignment forces this order to the designated courier and transmits real-time telemetry updates to the customer app and store kitchen console."
            />

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs space-y-1.5 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex justify-between">
                <span className="text-slate-500">Store Outlet:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedOrder.vendorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer Drop-off:</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{selectedOrder.deliveryAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Gross Total:</span>
                <span className="font-semibold text-primary-600">৳{selectedOrder.totalAmount}</span>
              </div>

              {selectedOrder.items && selectedOrder.items.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block mb-1 font-semibold">
                    Items ({selectedOrder.items.length}):
                  </span>
                  <div className="space-y-0.5 text-slate-700 dark:text-slate-300">
                    {selectedOrder.items.map((i) => (
                      <div key={i.id} className="flex justify-between text-[11px]">
                        <span>{i.quantity}x {i.name}</span>
                        <span>৳{i.quantity * i.unitPrice}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedOrder.customerNotes && (
                <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400 text-[11px]">
                  <strong>Note:</strong> {selectedOrder.customerNotes}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Select Active Courier
              </label>
              {availableRiders.length === 0 ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20">
                  No couriers are currently online in the pilot zone.
                </div>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {availableRiders.map((rider) => (
                    <label
                      key={rider.id}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        selectedRiderId === rider.id
                          ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="dispatch_rider"
                          value={rider.id}
                          checked={selectedRiderId === rider.id}
                          onChange={() => setSelectedRiderId(rider.id)}
                          className="text-primary-600 focus:ring-primary-500"
                        />
                        <div>
                          <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {rider.riderName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {rider.phone} • {rider.vehicleType}
                          </div>
                        </div>
                      </div>
                      <div className="text-right text-[11px]">
                        {rider.status === 'ONLINE' ? (
                          <Badge variant="success">Idle</Badge>
                        ) : (
                          <Badge variant="info">On Trip</Badge>
                        )}
                        <div className="text-slate-400 mt-0.5">৳{rider.cashInHand} COD</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {isCancelModalOpen && cancelTargetOrder && (
        <Modal
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          title={`Force Cancel Order #${cancelTargetOrder.orderNumber}`}
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setIsCancelModalOpen(false)}>
                Dismiss
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={cancelReason.trim().length < 5}
                isLoading={cancelMutation.isPending}
                onClick={() => {
                  if (cancelTargetOrder) {
                    cancelMutation.mutate({
                      orderId: cancelTargetOrder.id,
                      reason: cancelReason.trim(),
                    });
                  }
                }}
              >
                Confirm Force Cancellation
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <Alert
              type="error"
              message="Force-cancelling an order reverses pending commission ledgers, releases assigned couriers, and refunds online payments. This action is permanently logged in audit trails."
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900/50 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {cancelTargetOrder.customerName} ({cancelTargetOrder.customerPhone})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Store Outlet:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">{cancelTargetOrder.vendorName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Amount:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">
                  ৳{cancelTargetOrder.totalAmount} ({cancelTargetOrder.paymentMethod})
                </span>
              </div>

              {cancelTargetOrder.items && cancelTargetOrder.items.length > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-slate-500 block mb-1 font-semibold">
                    Items to be cancelled:
                  </span>
                  <div className="space-y-0.5 text-slate-700 dark:text-slate-300">
                    {cancelTargetOrder.items.map((i) => (
                      <div key={i.id} className="flex justify-between text-[11px]">
                        <span>{i.quantity}x {i.name}</span>
                        <span>৳{i.quantity * i.unitPrice}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Mandatory Cancellation Audit Reason (min 5 chars)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer requested emergency cancellation via hotline"
                rows={3}
                className="w-full rounded-lg border border-slate-200 p-2.5 text-xs text-slate-900 focus:border-rose-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
