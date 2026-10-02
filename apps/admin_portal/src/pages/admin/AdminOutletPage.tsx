import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Building2,
  Clock,
  Plus,
  Power,
  Store,
  UserRound,
  Users,
} from 'lucide-react';
import adminApi, { AdminCatalogProduct, AdminStaffAssignment } from '../../services/adminApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { formatCurrency } from '../../utils/formatters';
import { extractApiError } from '../../utils/apiError';
import { StaffProfileDialog } from './components/staff/StaffProfileDialog';
import { ProductDialog } from './components/products/ProductDialog';
import { OperatingHoursEditor } from './components/outlets/OperatingHoursEditor';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const AdminOutletPage: React.FC = () => {
  const { outletId } = useParams<{ outletId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditingOutlet, setIsEditingOutlet] = useState(false);
  const [staffDialogAssignment, setStaffDialogAssignment] = useState<AdminStaffAssignment | null>(null);
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [productDialogTarget, setProductDialogTarget] = useState<AdminCatalogProduct | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productCreateCategory, setProductCreateCategory] = useState<string | undefined>(undefined);
  const [isHoursEditorOpen, setIsHoursEditorOpen] = useState(false);

  const {
    data: outlet,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['admin-outlet-detail', outletId],
    queryFn: () => adminApi.getOutletDetail(outletId as string),
    enabled: !!outletId,
  });

  const toggleStatusMutation = useMutation({
    mutationFn: (isActive: boolean) => adminApi.toggleVendorStatus(outletId as string, isActive),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail', outletId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update outlet status.')),
  });

  const updateOutletMutation = useMutation({
    mutationFn: (data: Parameters<typeof adminApi.updateVendor>[1]) =>
      adminApi.updateVendor(outletId as string, data),
    onSuccess: () => {
      setActionError(null);
      setIsEditingOutlet(false);
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail', outletId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update outlet.')),
  });

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <LoadingSpinner size="lg" label="Loading outlet..." />
      </div>
    );
  }
  if (isError || !outlet) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/vendors')} leftIcon={<ArrowLeft className="h-4 w-4" />}>
          Back to Brands
        </Button>
        <QueryErrorBanner error={error} onRetry={() => refetch()} />
      </div>
    );
  }

  const vendor = outlet.vendor;
  const openStaffDialog = (assignment: AdminStaffAssignment | null) => {
    setStaffDialogAssignment(assignment);
    setIsStaffDialogOpen(true);
  };
  const openProductDialog = (product: AdminCatalogProduct | null, categoryId?: string) => {
    setProductDialogTarget(product);
    setProductCreateCategory(categoryId);
    setIsProductDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={vendor.name}
        subtitle={`Outlet of ${vendor.brandName || 'its brand'} · ${vendor.addressText}`}
        icon={Store}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/vendors')}
              leftIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to Brands
            </Button>
            <Button
              variant={vendor.isActive ? 'outline' : 'primary'}
              size="sm"
              isLoading={toggleStatusMutation.isPending}
              onClick={() => toggleStatusMutation.mutate(!vendor.isActive)}
              leftIcon={<Power className="h-3.5 w-3.5" />}
            >
              {vendor.isActive ? 'Suspend Outlet' : 'Activate Outlet'}
            </Button>
          </>
        }
      />

      {actionError && <QueryErrorBanner error={{ message: actionError } as never} onRetry={() => setActionError(null)} />}

      {/* Brand strip + outlet info */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-10 w-10 rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 flex items-center justify-center overflow-hidden shrink-0">
            {vendor.brandLogoUrl ? (
              <img src={resolveMediaUrl(vendor.brandLogoUrl)} alt={vendor.brandName || 'Brand'} className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{vendor.brandName}</div>
            <div className="text-[11px] text-slate-500">Brand (governs every linked outlet)</div>
          </div>
        </div>

        {isEditingOutlet ? (
          <OutletEditForm
            initial={{
              name: vendor.name,
              contactPhone: vendor.contactPhone,
              commissionRate: String(vendor.commissionRate),
              defaultPrepTimeMinutes: String(vendor.defaultPrepTimeMinutes),
              deliveryRadiusKm: String(vendor.deliveryRadiusKm),
            }}
            isSaving={updateOutletMutation.isPending}
            onSave={(data) => updateOutletMutation.mutate(data)}
            onCancel={() => setIsEditingOutlet(false)}
          />
        ) : (
          <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-center text-xs">
            <InfoCell label="Phone" value={vendor.contactPhone} />
            <InfoCell label="Commission" value={`${vendor.commissionRate}%`} />
            <InfoCell label="Prep Time" value={`${vendor.defaultPrepTimeMinutes} min`} />
            <InfoCell label="Radius" value={`${vendor.deliveryRadiusKm} km`} />
            <div>
              <span className="text-slate-400 block text-[10px] mb-0.5">Status</span>
              <div className="flex items-center justify-center gap-1.5">
                {vendor.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Suspended</Badge>}
                {vendor.isBusy && <Badge variant="warning">Rush</Badge>}
              </div>
            </div>
            <div className="col-span-2 sm:col-span-3 lg:col-span-5 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => setIsEditingOutlet(true)}
              >
                Edit Outlet Info
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Staff */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary-600" /> Staff ({outlet.staff.length})
            </h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 text-primary-600 dark:text-primary-400"
              onClick={() => openStaffDialog(null)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              New Staff
            </Button>
          </div>
          {outlet.staff.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No staff accounts bound to this outlet yet.</p>
          ) : (
            <div className="space-y-2">
              {outlet.staff.map((staff) => (
                <button
                  key={staff.id}
                  type="button"
                  onClick={() => openStaffDialog(staff)}
                  className="w-full text-left rounded-xl border border-slate-200 p-3 hover:border-primary-400 hover:ring-2 hover:ring-primary-500/20 transition-all cursor-pointer dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {staff.fullName}
                    </span>
                    {staff.scope === 'ALL_OUTLETS_MASTER' ? (
                      <Badge variant="purple">Owner</Badge>
                    ) : (
                      <Badge variant="info">Manager</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span className="text-[11px] text-slate-500">{staff.phone}</span>
                    {staff.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="danger">Inactive</Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] text-slate-400 mt-3 flex items-center gap-1">
            <UserRound className="h-3 w-3" /> Click a profile to view — edit from there.
          </p>
        </section>

        {/* Catalog */}
        <section className="xl:col-span-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Catalog</h3>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 text-primary-600 dark:text-primary-400"
              onClick={() => openProductDialog(null, outlet.categories[0]?.id)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              New Product
            </Button>
          </div>

          {outlet.categories.length === 0 ? (
            <EmptyState
              message="No menu categories yet — create the first product to get started."
              action={
                <Button size="sm" onClick={() => openProductDialog(null, undefined)} leftIcon={<Plus className="h-4 w-4" />}>
                  New Product
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {outlet.categories.map((category) => (
                <div key={category.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{category.name}</span>
                    <span className="text-[10px] text-slate-400">{category.products.length} items</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800 overflow-hidden">
                    {category.products.length === 0 ? (
                      <div className="px-3.5 py-3 text-xs text-slate-400 italic">No products in this category.</div>
                    ) : (
                      category.products.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => openProductDialog(product)}
                          className="w-full text-left px-3.5 py-2.5 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 flex items-center gap-2.5">
                            {product.imageUrl && (
                              <img
                                src={resolveMediaUrl(product.imageUrl)}
                                alt={product.name}
                                className="h-8 w-8 rounded-lg object-cover shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {product.name}
                                </span>
                                {!product.isInStock && <Badge variant="danger">Out</Badge>}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {product.variants.length} variation{product.variants.length === 1 ? '' : 's'}
                              </div>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100 shrink-0">
                            {formatCurrency(product.variants[0]?.price ?? 0)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Settings */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <Clock className="h-4 w-4 text-primary-600" /> Operating Hours
          </h3>
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setIsHoursEditorOpen(true)}>
            Edit Schedule
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center text-[11px]">
          {DAYS.map((day, index) => {
            const hours = outlet.operatingHours.find((h) => h.dayOfWeek === index);
            return (
              <div key={day} className="rounded-lg border border-slate-100 px-2 py-2 dark:border-slate-800">
                <div className="font-bold text-slate-700 dark:text-slate-300">{day.slice(0, 3)}</div>
                <div className={hours?.isClosed ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}>
                  {hours && !hours.isClosed ? `${hours.openTime}–${hours.closeTime}` : 'Closed'}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <StaffProfileDialog
        assignment={staffDialogAssignment}
        isOpen={isStaffDialogOpen}
        createScope={{
          vendorId: vendor.id,
          vendorName: vendor.name,
          brandId: vendor.brandId,
          brandName: vendor.brandName || '',
        }}
        onClose={() => setIsStaffDialogOpen(false)}
      />

      <ProductDialog
        product={productDialogTarget}
        isOpen={isProductDialogOpen}
        createContext={{ vendorId: vendor.id, categoryId: productCreateCategory }}
        onClose={() => setIsProductDialogOpen(false)}
      />

      <OperatingHoursEditor
        isOpen={isHoursEditorOpen}
        vendorId={vendor.id}
        hours={outlet.operatingHours}
        onClose={() => setIsHoursEditorOpen(false)}
      />
    </div>
  );
};

const InfoCell: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <span className="text-slate-400 block text-[10px] mb-0.5">{label}</span>
    <span className="font-bold text-slate-900 dark:text-slate-100">{value}</span>
  </div>
);

const OutletEditForm: React.FC<{
  initial: { name: string; contactPhone: string; commissionRate: string; defaultPrepTimeMinutes: string; deliveryRadiusKm: string };
  isSaving: boolean;
  onSave: (data: {
    name: string;
    contactPhone: string;
    commissionRate: number;
    defaultPrepTimeMinutes: number;
    deliveryRadiusKm: number;
  }) => void;
  onCancel: () => void;
}> = ({ initial, isSaving, onSave, onCancel }) => {
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.contactPhone);
  const [commission, setCommission] = useState(initial.commissionRate);
  const [prep, setPrep] = useState(initial.defaultPrepTimeMinutes);
  const [radius, setRadius] = useState(initial.deliveryRadiusKm);

  return (
    <div className="pt-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Outlet Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Commission %</label>
          <Input type="number" value={commission} onChange={(e) => setCommission(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Prep (min)</label>
          <Input type="number" value={prep} onChange={(e) => setPrep(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Radius (km)</label>
          <Input type="number" value={radius} onChange={(e) => setRadius(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          isLoading={isSaving}
          onClick={() =>
            onSave({
              name: name.trim(),
              contactPhone: phone.trim(),
              commissionRate: parseFloat(commission) || 15,
              defaultPrepTimeMinutes: parseInt(prep, 10) || 20,
              deliveryRadiusKm: parseFloat(radius) || 5,
            })
          }
        >
          Save Outlet
        </Button>
      </div>
    </div>
  );
};
