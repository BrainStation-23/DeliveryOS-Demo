import React from 'react';
import { Pencil, Tag, Plus, Trash2 } from 'lucide-react';
import { AdminCoupon } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { LoadingSpinner } from '../../../../components/ui/LoadingSpinner';
import { EmptyState } from '../../../../components/common/EmptyState';
import { QueryErrorBanner } from '../../../../components/common/QueryErrorBanner';

interface CouponTableProps {
  coupons: AdminCoupon[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onToggle: (coupon: AdminCoupon) => void;
  onEdit: (coupon: AdminCoupon) => void;
  onDelete: (coupon: AdminCoupon) => void;
  onAdd: () => void;
}

export const CouponTable: React.FC<CouponTableProps> = ({
  coupons,
  isLoading,
  error,
  onRetry,
  onToggle,
  onEdit,
  onDelete,
  onAdd,
}) => {
  let content: React.ReactNode;

  if (isLoading) {
    content = (
      <div className="py-16 text-center">
        <LoadingSpinner size="lg" label="Loading coupons..." />
      </div>
    );
  } else if (error) {
    content = <QueryErrorBanner error={error} onRetry={onRetry} />;
  } else if (coupons.length === 0) {
    content = (
      <EmptyState
        icon={Tag}
        title="No coupon codes"
        message="No promo coupon codes created yet. Create codes like WELCOME50 for customers."
        action={
          <Button size="sm" onClick={onAdd} leftIcon={<Plus className="h-4 w-4" />}>
            Create Coupon
          </Button>
        }
        className="m-4"
      />
    );
  } else {
    content = (
      <div className="overflow-x-auto">
        <table className="min-w-[640px] w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
            <tr>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Promo Code</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Discount Rule</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Min Spend</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Max Cap</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Usage</th>
              <th className="py-3 px-4 font-semibold whitespace-nowrap">Status</th>
              <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {coupons.map((coupon) => (
              <tr key={coupon.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="py-3.5 px-4 font-bold tracking-wider text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  {coupon.code}
                  {coupon.description && (
                    <div className="text-[11px] font-normal text-slate-500">{coupon.description}</div>
                  )}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="font-semibold text-primary-600 dark:text-primary-400">
                    {coupon.discountType === 'PERCENTAGE'
                      ? `${coupon.discountValue}% OFF`
                      : `৳${coupon.discountValue} FLAT`}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  ৳{coupon.minOrderAmount}
                </td>
                <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  {coupon.maxDiscountAmount ? `৳${coupon.maxDiscountAmount}` : 'No Cap'}
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{coupon.currentUses}</span>
                  <span className="text-slate-400"> / {coupon.usageLimit}</span>
                </td>
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {coupon.isActive ? (
                    <Badge variant="success">Active</Badge>
                  ) : (
                    <Badge variant="default">Paused</Badge>
                  )}
                </td>
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2"
                      onClick={() => onToggle(coupon)}
                    >
                      {coupon.isActive ? 'Pause' : 'Activate'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2 text-primary-600 hover:bg-primary-50 dark:text-primary-400 dark:hover:bg-primary-950/40"
                      onClick={() => onEdit(coupon)}
                      leftIcon={<Pencil className="h-3.5 w-3.5" />}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      onClick={() => onDelete(coupon)}
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
      {content}
    </div>
  );
};
