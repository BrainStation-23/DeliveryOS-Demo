import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Ban,
  Briefcase,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  ExternalLink,
  Home,
  Mail,
  MapPin,
  Navigation,
  Phone,
  Receipt,
  ShoppingBag,
  Store,
  Tag,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import adminApi from '../../../../services/adminApi';
import { Badge, OrderStatusBadge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Drawer } from '../../../../components/ui/Drawer';
import { Modal } from '../../../../components/ui/Modal';
import { extractApiError } from '../../../../utils/apiError';
import { cn } from '../../../../utils/cn';

export interface CustomerDetailsDrawerProps {
  customerId: string | null;
  onClose: () => void;
}

const CURRENCY = '৳';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPaymentMethod(method: string | null | undefined): string {
  if (!method) return 'Unknown';
  switch (method.toUpperCase()) {
    case 'CASH_ON_DELIVERY':
      return 'Cash on Delivery (COD)';
    case 'BKASH':
      return 'bKash';
    case 'NAGAD':
      return 'Nagad';
    case 'ROCKET':
      return 'Rocket';
    case 'CARD':
    case 'CREDIT_CARD':
    case 'DEBIT_CARD':
      return 'Card Payment';
    case 'DIGITAL_WALLET':
      return 'Digital Wallet';
    default:
      return method.replace(/_/g, ' ');
  }
}

export function getAddressIcon(label: string | undefined) {
  const norm = (label || '').toLowerCase();
  if (norm.includes('home')) {
    return <Home className="h-4 w-4 text-primary-600 dark:text-primary-400 shrink-0" />;
  }
  if (norm.includes('work') || norm.includes('office')) {
    return <Briefcase className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />;
  }
  return <MapPin className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />;
}

export function getInitials(name: string | undefined): string {
  if (!name) return 'CU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Read-only unified customer view: profile, saved addresses, lifetime order
 *  metrics, recent orders, and account suspend/unsuspend controls. */
export const CustomerDetailsDrawer: React.FC<CustomerDetailsDrawerProps> = ({ customerId, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Suspension & modal states
  const [isSuspendModalOpen, setIsSuspendModalOpen] = useState(false);
  const [isReactivateConfirmOpen, setIsReactivateConfirmOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendReasonError, setSuspendReasonError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Section-level collapsible states
  const [isAddressesSectionOpen, setIsAddressesSectionOpen] = useState(true);
  const [isOrdersSectionOpen, setIsOrdersSectionOpen] = useState(true);

  // Item-level collapsible / accordion sets
  const [expandedAddressIds, setExpandedAddressIds] = useState<Set<string>>(new Set());
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Copy feedback states
  const [copiedAddressId, setCopiedAddressId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['admin-customer-detail', customerId],
    queryFn: () => adminApi.getCustomerDetail(customerId as string),
    enabled: !!customerId,
  });

  const customer = detail?.customer;
  const metrics = detail?.metrics;
  const addresses = customer?.addresses ?? [];
  const recentOrders = detail?.recentOrders ?? [];

  const statusMutation = useMutation({
    mutationFn: ({ nextStatus, reason }: { nextStatus: 'ACTIVE' | 'SUSPENDED'; reason?: string }) =>
      adminApi.updateCustomerStatus(customerId as string, nextStatus, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-customer-detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['admin-customers'] });
      setIsSuspendModalOpen(false);
      setIsReactivateConfirmOpen(false);
      setSuspendReason('');
      setSuspendReasonError(null);
      setActionError(null);
    },
    onError: (err) => {
      setActionError(extractApiError(err));
    },
  });

  const toggleAddressExpand = (id: string) => {
    setExpandedAddressIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllAddresses = (e: React.MouseEvent, expand: boolean) => {
    e.stopPropagation();
    if (expand) {
      setExpandedAddressIds(new Set(addresses.map((a) => a.id)));
    } else {
      setExpandedAddressIds(new Set());
    }
  };

  const toggleOrderExpand = (id: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOrders = (e: React.MouseEvent, expand: boolean) => {
    e.stopPropagation();
    if (expand) {
      setExpandedOrderIds(new Set(recentOrders.map((o) => o.id)));
    } else {
      setExpandedOrderIds(new Set());
    }
  };

  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleCopyCoords = (e: React.MouseEvent, addressId: string, lat: number, lng: number) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${lat}, ${lng}`);
    setCopiedAddressId(addressId);
    setTimeout(() => setCopiedAddressId(null), 2000);
  };

  const allAddressesExpanded = addresses.length > 0 && expandedAddressIds.size === addresses.length;
  const allOrdersExpanded = recentOrders.length > 0 && expandedOrderIds.size === recentOrders.length;

  return (
    <Drawer
      isOpen={!!customerId}
      onClose={onClose}
      title={customer ? customer.fullName : 'Customer Details'}
      description={customer?.phone}
    >
      {isLoading || !detail ? (
        <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent mb-3" />
          <p>Loading customer profile...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {actionError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300 flex items-center justify-between">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="font-semibold underline cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Customer Profile Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white font-bold text-sm shadow-sm shrink-0">
                  {getInitials(customer?.fullName)}
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                    {customer?.fullName}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                      {customer?.phone}
                    </span>
                    <button
                      type="button"
                      onClick={() => customer?.phone && handleCopyPhone(customer.phone)}
                      className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors cursor-pointer"
                      title="Copy phone number"
                    >
                      {copiedPhone ? (
                        <Check className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                  {customer?.email && (
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Mail className="h-3 w-3 shrink-0 text-slate-400" />
                      <a
                        href={`mailto:${customer.email}`}
                        className="truncate hover:text-primary-600 dark:hover:text-primary-400"
                      >
                        {customer.email}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Badge & Actions */}
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <Badge
                  variant={
                    customer?.status === 'ACTIVE'
                      ? 'success'
                      : customer?.status === 'SUSPENDED'
                      ? 'danger'
                      : 'warning'
                  }
                >
                  {customer?.status?.replace('_', ' ')}
                </Badge>
                <span className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Calendar className="h-3 w-3 text-slate-400" />
                  joined {formatDate(customer?.createdAt)}
                </span>
                {customer?.status === 'ACTIVE' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Ban className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />}
                    className="mt-1 text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 cursor-pointer whitespace-nowrap text-xs"
                    onClick={() => {
                      setActionError(null);
                      setSuspendReason('');
                      setSuspendReasonError(null);
                      setIsSuspendModalOpen(true);
                    }}
                  >
                    Suspend
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                    className="mt-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-400 cursor-pointer whitespace-nowrap text-xs"
                    onClick={() => {
                      setActionError(null);
                      setIsReactivateConfirmOpen(true);
                    }}
                  >
                    Withdraw Suspend
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Account Suspension Warning Card */}
          {customer?.status === 'SUSPENDED' && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              <div className="flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-300">
                <Ban className="h-4 w-4 shrink-0" />
                <span>Account Suspended</span>
              </div>
              <div className="mt-1.5 space-y-1 text-slate-700 dark:text-slate-300">
                <p>
                  <span className="font-semibold text-rose-900 dark:text-rose-200">Reason:</span>{' '}
                  {customer.suspensionReason || 'Violation of platform policies'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Customer is immediately logged out on all devices and blocked from placing orders.
                </p>
              </div>
            </div>
          )}

          {/* Customer Lifetime Metrics Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Lifetime Orders
                </span>
                <ShoppingBag className="h-3.5 w-3.5 text-primary-500" />
              </div>
              <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                {(metrics?.totalOrders ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">
                {metrics?.statusCounts?.CANCELLED ?? 0} cancelled
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Lifetime Spend
                </span>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
              </div>
              <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                {CURRENCY} {(metrics?.lifetimeSpend ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">
                across {metrics?.orderCount ?? 0} effective orders
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Avg Order Value
                </span>
                <Receipt className="h-3.5 w-3.5 text-sky-500" />
              </div>
              <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                {CURRENCY} {(metrics?.avgOrderValue ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">per completed order</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Coupon Savings
                </span>
                <Tag className="h-3.5 w-3.5 text-purple-500" />
              </div>
              <p className="mt-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
                {CURRENCY} {(metrics?.totalCouponSavings ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] text-slate-500">
                + {CURRENCY} {(metrics?.totalDeliveryFees ?? 0).toLocaleString()} delivery fees
              </p>
            </div>
          </div>

          {/* Collapsible Saved Addresses Section */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900/60">
            {/* Section Header */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsAddressesSectionOpen((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsAddressesSectionOpen((prev) => !prev);
                }
              }}
              className="flex items-center justify-between gap-2 px-3.5 py-3 bg-slate-50/80 hover:bg-slate-100/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors border-b border-transparent data-[open=true]:border-slate-200 dark:data-[open=true]:border-slate-800"
              data-open={isAddressesSectionOpen}
              aria-expanded={isAddressesSectionOpen}
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin className="h-4 w-4 text-primary-600 dark:text-primary-400 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Saved Addresses
                </h4>
                <Badge variant="default" size="sm" className="font-semibold text-[10px]">
                  {addresses.length}
                </Badge>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {addresses.length > 1 && isAddressesSectionOpen && (
                  <button
                    type="button"
                    onClick={(e) => toggleAllAddresses(e, !allAddressesExpanded)}
                    className="text-[11px] font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-primary-50 dark:hover:bg-primary-950/40"
                  >
                    {allAddressesExpanded ? 'Collapse All' : 'Expand All'}
                  </button>
                )}
                <div
                  className={cn(
                    'p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-transform duration-200',
                    isAddressesSectionOpen ? 'rotate-0' : '-rotate-90'
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Collapsible Content */}
            {isAddressesSectionOpen && (
              <div className="p-3 space-y-2">
                {addresses.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <MapPin className="h-7 w-7 text-slate-300 dark:text-slate-600 mb-1.5" />
                    <p className="text-xs font-medium text-slate-500">No saved addresses</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      This customer has not saved any delivery locations yet.
                    </p>
                  </div>
                ) : (
                  addresses.map((address) => {
                    const isExpanded = expandedAddressIds.has(address.id);
                    return (
                      <div
                        key={address.id}
                        className={cn(
                          'rounded-lg border transition-all duration-200 overflow-hidden',
                          isExpanded
                            ? 'border-primary-200 bg-primary-50/20 dark:border-primary-900/60 dark:bg-primary-950/20'
                            : 'border-slate-100 bg-slate-50/40 hover:border-slate-200 dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:border-slate-700'
                        )}
                      >
                        {/* Address Summary Bar (Collapsible Header) */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleAddressExpand(address.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleAddressExpand(address.id);
                            }
                          }}
                          className="flex items-center justify-between gap-2.5 px-3 py-2.5 cursor-pointer select-none"
                          aria-expanded={isExpanded}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {getAddressIcon(address.label)}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {address.label}
                                </span>
                                {address.isDefault && (
                                  <Badge variant="primary" size="sm" className="text-[10px]">
                                    Default
                                  </Badge>
                                )}
                              </div>
                              {/* Truncated line preview in collapsed state */}
                              {!isExpanded && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {address.addressLine}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-400">
                              {isExpanded ? 'Hide' : 'Details'}
                            </span>
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
                                isExpanded ? 'rotate-180' : 'rotate-0'
                              )}
                            />
                          </div>
                        </div>

                        {/* Expanded Details Panel */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-1 border-t border-slate-100/80 dark:border-slate-800/60 space-y-2.5">
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Full Address
                              </span>
                              <p className="text-xs text-slate-800 dark:text-slate-200 mt-0.5 leading-relaxed font-medium">
                                {address.addressLine}
                              </p>
                            </div>

                            {/* Coordinates and Location Actions */}
                            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white p-2 border border-slate-200/80 dark:bg-slate-900/80 dark:border-slate-800">
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                                <Navigation className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>
                                  {address.latitude.toFixed(5)}, {address.longitude.toFixed(5)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={(e) =>
                                    handleCopyCoords(e, address.id, address.latitude, address.longitude)
                                  }
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Copy GPS coordinates"
                                >
                                  {copiedAddressId === address.id ? (
                                    <>
                                      <Check className="h-3 w-3 text-emerald-500" />
                                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                        Copied
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3 w-3" />
                                      <span>Copy</span>
                                    </>
                                  )}
                                </button>

                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${address.latitude},${address.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 px-2 py-0.5 rounded border border-primary-200 dark:border-primary-800/80 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors cursor-pointer"
                                >
                                  <span>View on Maps</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Collapsible Recent Orders Section */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-slate-800 dark:bg-slate-900/60">
            {/* Section Header */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setIsOrdersSectionOpen((prev) => !prev)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsOrdersSectionOpen((prev) => !prev);
                }
              }}
              className="flex items-center justify-between gap-2 px-3.5 py-3 bg-slate-50/80 hover:bg-slate-100/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/60 cursor-pointer select-none transition-colors border-b border-transparent data-[open=true]:border-slate-200 dark:data-[open=true]:border-slate-800"
              data-open={isOrdersSectionOpen}
              aria-expanded={isOrdersSectionOpen}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ShoppingBag className="h-4 w-4 text-primary-600 dark:text-primary-400 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
                  Recent Orders
                </h4>
                <Badge variant="default" size="sm" className="font-semibold text-[10px]">
                  {recentOrders.length}
                </Badge>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {recentOrders.length > 1 && isOrdersSectionOpen && (
                  <button
                    type="button"
                    onClick={(e) => toggleAllOrders(e, !allOrdersExpanded)}
                    className="text-[11px] font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-primary-50 dark:hover:bg-primary-950/40"
                  >
                    {allOrdersExpanded ? 'Collapse All' : 'Expand All'}
                  </button>
                )}
                <div
                  className={cn(
                    'p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-transform duration-200',
                    isOrdersSectionOpen ? 'rotate-0' : '-rotate-90'
                  )}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Collapsible Content */}
            {isOrdersSectionOpen && (
              <div className="p-3 space-y-2">
                {recentOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <ShoppingBag className="h-7 w-7 text-slate-300 dark:text-slate-600 mb-1.5" />
                    <p className="text-xs font-medium text-slate-500">No orders placed yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Customer has not completed any orders in the system.
                    </p>
                  </div>
                ) : (
                  recentOrders.map((order) => {
                    const isExpanded = expandedOrderIds.has(order.id);
                    return (
                      <div
                        key={order.id}
                        className={cn(
                          'rounded-lg border transition-all duration-200 overflow-hidden',
                          isExpanded
                            ? 'border-primary-200 bg-primary-50/20 dark:border-primary-900/60 dark:bg-primary-950/20'
                            : 'border-slate-100 bg-slate-50/40 hover:border-slate-200 dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:border-slate-700'
                        )}
                      >
                        {/* Order Header Summary Bar (Click to toggle) */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggleOrderExpand(order.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggleOrderExpand(order.id);
                            }
                          }}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 cursor-pointer select-none"
                          aria-expanded={isExpanded}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                                {order.orderNumber}
                              </span>
                              <span className="text-slate-400 text-xs">·</span>
                              <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                                {order.vendorName}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {formatDateTime(order.placedAt)}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {CURRENCY} {order.totalAmount.toLocaleString()}
                            </span>
                            <OrderStatusBadge status={order.status} />
                            <ChevronDown
                              className={cn(
                                'h-3.5 w-3.5 text-slate-400 transition-transform duration-200',
                                isExpanded ? 'rotate-180' : 'rotate-0'
                              )}
                            />
                          </div>
                        </div>

                        {/* Expanded Order Breakdown & Deep-link Action */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-2 border-t border-slate-100/80 dark:border-slate-800/60 space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="rounded-md bg-white p-2 border border-slate-100 dark:bg-slate-900/80 dark:border-slate-800 space-y-0.5">
                                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                  <Store className="h-3 w-3" /> Vendor Outlet
                                </span>
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {order.vendorName}
                                </p>
                              </div>

                              <div className="rounded-md bg-white p-2 border border-slate-100 dark:bg-slate-900/80 dark:border-slate-800 space-y-0.5">
                                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                  <Clock className="h-3 w-3" /> Placed Date
                                </span>
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {formatDate(order.placedAt)}
                                </p>
                              </div>

                              <div className="rounded-md bg-white p-2 border border-slate-100 dark:bg-slate-900/80 dark:border-slate-800 space-y-0.5">
                                <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                                  <CreditCard className="h-3 w-3" /> Payment Method
                                </span>
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {formatPaymentMethod(order.paymentMethod)}
                                </p>
                              </div>

                              <div className="rounded-md bg-white p-2 border border-slate-100 dark:bg-slate-900/80 dark:border-slate-800 space-y-0.5">
                                <span className="text-[10px] uppercase font-bold text-slate-400">
                                  Payment Status
                                </span>
                                <div>
                                  <Badge
                                    size="sm"
                                    variant={
                                      order.paymentStatus === 'PAID'
                                        ? 'success'
                                        : order.paymentStatus === 'FAILED'
                                        ? 'danger'
                                        : 'warning'
                                    }
                                  >
                                    {order.paymentStatus}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {/* Direct Navigation Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full justify-center text-xs h-8 border-slate-200 hover:border-primary-400 hover:text-primary-600 dark:border-slate-700 dark:hover:border-primary-600 cursor-pointer"
                              leftIcon={<ExternalLink className="h-3.5 w-3.5" />}
                              onClick={() => {
                                onClose();
                                navigate(`/orders?orderNumber=${encodeURIComponent(order.orderNumber)}`);
                              }}
                            >
                              Open Full Order in Console
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suspend Modal with mandatory Reason Input */}
      <Modal
        isOpen={isSuspendModalOpen}
        onClose={() => {
          setIsSuspendModalOpen(false);
          setSuspendReason('');
          setSuspendReasonError(null);
          setActionError(null);
        }}
        title="Suspend Customer Account"
        description={`Restrict access for ${customer?.fullName} (${customer?.phone})`}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsSuspendModalOpen(false);
                setSuspendReason('');
                setSuspendReasonError(null);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="danger"
              isLoading={statusMutation.isPending}
              leftIcon={<Ban className="h-3.5 w-3.5 shrink-0" />}
              onClick={() => {
                if (!suspendReason.trim()) {
                  setSuspendReasonError('Please provide a reason for the account suspension.');
                  return;
                }
                statusMutation.mutate({
                  nextStatus: 'SUSPENDED',
                  reason: suspendReason.trim(),
                });
              }}
            >
              Suspend Account
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Immediate access restriction</p>
              <p className="text-slate-600 dark:text-slate-300">
                The customer will be immediately logged out on their next network request, active refresh tokens will be revoked, and further logins or orders will be blocked.
              </p>
            </div>
          </div>

          <div>
            <label htmlFor="suspendReason" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Reason for Suspension <span className="text-rose-500">*</span>
            </label>
            <textarea
              id="suspendReason"
              rows={3}
              value={suspendReason}
              onChange={(e) => {
                setSuspendReason(e.target.value);
                if (suspendReasonError && e.target.value.trim()) {
                  setSuspendReasonError(null);
                }
              }}
              placeholder="e.g., Payment fraud / disputed charge, abusive behavior, spam orders, policy violation..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
            />
            {suspendReasonError ? (
              <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">{suspendReasonError}</p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                This reason will be presented to the customer if they attempt to log in or use the platform.
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Reactivate Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isReactivateConfirmOpen}
        title="Withdraw Suspension"
        message={`Reactivate ${customer?.fullName}'s account? The customer will be able to log in and use the platform again.`}
        confirmLabel="Reactivate Account"
        variant="primary"
        isPending={statusMutation.isPending}
        onConfirm={() => {
          statusMutation.mutate({ nextStatus: 'ACTIVE' });
        }}
        onCancel={() => {
          setIsReactivateConfirmOpen(false);
          setActionError(null);
        }}
      />
    </Drawer>
  );
};
