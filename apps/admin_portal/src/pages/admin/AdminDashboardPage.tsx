import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  Users,
  Store,
  DollarSign,
  Shuffle,
  Eye,
  RefreshCw,
} from 'lucide-react';
import adminApi, { AdminOverview } from '../../services/adminApi';
import { getSocket } from '../../services/socket';
import { Badge, OrderStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Alert';
import { Modal } from '../../components/ui/Modal';
import { Table, Column } from '../../components/ui/Table';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { StatCard } from '../../components/common/StatCard';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';

type DashboardOrder = AdminOverview['recentOrders'][number];

export const AdminDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DashboardOrder | null>(null);

  const { data: overview, isLoading, isError, error, refetch } = useQuery<AdminOverview>({
    queryKey: ['admin-overview'],
    queryFn: adminApi.getOverview,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const socket = getSocket();

    const handleOrderEvent = () => {
      queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
    };

    socket.on('order:new', handleOrderEvent);
    socket.on('order:status:changed', handleOrderEvent);

    return () => {
      socket.off('order:new', handleOrderEvent);
      socket.off('order:status:changed', handleOrderEvent);
    };
  }, [queryClient]);

  const metrics = overview?.metrics;
  const recentOrders = Array.isArray(overview?.recentOrders) ? overview.recentOrders : [];

  const stats = [
    {
      title: t('admin.totalOrders'),
      value: metrics ? metrics.totalOrders.toLocaleString() : '0',
      icon: TrendingUp,
      change: metrics ? `${metrics.todayOrders} placed today` : '0 today',
      color: 'text-primary-600 bg-primary-50 dark:bg-primary-950/50',
    },
    {
      title: t('admin.activeRiders'),
      value: metrics ? metrics.activeRiders.toString() : '0',
      icon: Users,
      change: metrics ? `${metrics.ridersOnTrip} on delivery trip` : '0 active',
      color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/50',
    },
    {
      title: t('admin.onlineVendors'),
      value: metrics ? `${metrics.onlineVendors} / ${metrics.totalVendors}` : '0 / 0',
      icon: Store,
      change: metrics && metrics.totalVendors > 0
        ? `${Math.round((metrics.onlineVendors / metrics.totalVendors) * 100)}% online`
        : '0% online',
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50',
    },
    {
      title: t('admin.todayVolume'),
      value: metrics ? `৳ ${metrics.todayVolume.toLocaleString()}` : '৳ 0',
      icon: DollarSign,
      change: metrics ? `৳ ${metrics.todayCommission.toLocaleString()} commission` : '৳ 0 commission',
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/50',
    },
  ];

  const columns: Column<DashboardOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (order) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{order.orderNumber}</span>
          <div className="text-[11px] text-slate-500">
            {order.placedAt ? new Date(order.placedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
    },
    {
      key: 'outletName',
      header: 'Store Outlet',
    },
    {
      key: 'status',
      header: 'Status',
      render: (order) => <OrderStatusBadge status={order.status} />,
    },
    {
      key: 'totalAmount',
      header: 'Amount',
      render: (order) => <span className="font-medium">৳ {order.totalAmount}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (order) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedOrder(order);
            setIsModalOpen(true);
          }}
          leftIcon={<Eye className="h-3.5 w-3.5" />}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('admin.title')}
        subtitle={t('admin.subtitle')}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Refresh
            </Button>
            <Badge variant="purple" size="md">
              <Shuffle className="h-3 w-3 mr-1" />
              Dispatch: RIDER_FIRST
            </Badge>
          </>
        }
      />

      <Alert
        type="info"
        title="DeliveryOS Operational Readiness"
        message="Active multi-tenant cluster operating across Dhaka central zones. Redis Geospatial indexing and WebSocket tracking gateway active."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            subtitle={stat.change}
            icon={stat.icon}
            iconColorClass={stat.color}
            isLoading={isLoading}
          />
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">Recent Live Orders</h3>
          <span className="text-xs text-slate-500">Auto-updates in real time via WebSocket</span>
        </div>

        {isError ? (
          <QueryErrorBanner error={error} onRetry={() => refetch()} />
        ) : isLoading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 dark:border-slate-800 dark:bg-slate-900">
            <LoadingSpinner label="Loading live operational metrics..." />
          </div>
        ) : (
          <Table
            columns={columns}
            data={recentOrders}
            keyExtractor={(item) => item.id}
            emptyMessage="No orders recorded on the platform today yet."
          />
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedOrder?.orderNumber || 'Order Details'}
        description={`Audit record for ${selectedOrder?.customerName}`}
        footer={
          <Button variant="outline" onClick={() => setIsModalOpen(false)}>
            Close
          </Button>
        }
      >
        {selectedOrder && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-500">Outlet</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedOrder.outletName}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Status</span>
                <div className="mt-0.5">
                  <OrderStatusBadge status={selectedOrder.status} />
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500">Gross Total</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">৳ {selectedOrder.totalAmount}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Settlement</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedOrder.paymentMethod}</p>
              </div>
              {selectedOrder.riderName && (
                <div className="sm:col-span-2">
                  <span className="text-xs text-slate-500">Assigned Courier</span>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedOrder.riderName}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
