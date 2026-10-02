import React from 'react';
import { UserCheck, Eye, XCircle, Bike } from 'lucide-react';
import { AdminOrder } from '../../../../services/adminApi';
import { Table, Column } from '../../../../components/ui/Table';
import { OrderStatusBadge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';

interface OrdersTableProps {
  orders: AdminOrder[];
  page: number;
  totalPages: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onViewDetails: (order: AdminOrder) => void;
  onAssign: (order: AdminOrder) => void;
  onCancel: (order: AdminOrder) => void;
}

export const OrdersTable: React.FC<OrdersTableProps> = ({
  orders,
  page,
  totalPages,
  totalItems,
  onPageChange,
  onViewDetails,
  onAssign,
  onCancel,
}) => {
  const columns: Column<AdminOrder>[] = [
    {
      key: 'orderNumber',
      header: 'Order #',
      render: (order) => (
        <div>
          <button
            onClick={() => onViewDetails(order)}
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
            onClick={() => onViewDetails(order)}
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
                onClick={() => onAssign(order)}
                leftIcon={<UserCheck className="h-3.5 w-3.5 text-primary-600" />}
              >
                {order.riderId ? 'Reassign' : 'Force Assign'}
              </Button>
              {order.status !== 'DISPATCHED' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 px-2 border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40"
                  onClick={() => onCancel(order)}
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
    <Table
      data={orders}
      columns={columns}
      keyExtractor={(o) => o.id}
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      onPageChange={onPageChange}
    />
  );
};
