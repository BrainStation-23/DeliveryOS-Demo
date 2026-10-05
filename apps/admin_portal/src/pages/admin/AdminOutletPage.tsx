import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  Pencil,
  Power,
  Plus,
  UserRound,
  Flame,
  PauseCircle,
  PlayCircle,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import adminApi, { AdminCatalogProduct, AdminStaffAssignment } from '../../services/adminApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { extractApiError } from '../../utils/apiError';
import { canDeleteOutlet } from '../../utils/outletDeletionGuard';
import { useSocketQueryInvalidation } from '../../hooks/useSocketSubscription';
import { StaffProfileDialog } from './components/staff/StaffProfileDialog';
import { ProductDialog } from './components/products/ProductDialog';
import { OperatingHoursEditor } from './components/outlets/OperatingHoursEditor';
import { OutletInfoDialog } from './components/outlets/OutletInfoDialog';
import { GoogleMapsLink } from '../../components/common/GoogleMapsLink';
import { OutletCatalogSection } from './components/outlets/OutletCatalogSection';
import { CategoryDialog } from './components/outlets/CategoryDialog';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AdminOutletPage: React.FC = () => {
  const { outletId } = useParams<{ outletId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [actionError, setActionError] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [staffDialogAssignment, setStaffDialogAssignment] = useState<AdminStaffAssignment | null>(null);
  const [isStaffDialogOpen, setIsStaffDialogOpen] = useState(false);
  const [productDialogTarget, setProductDialogTarget] = useState<AdminCatalogProduct | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [productCreateCategory, setProductCreateCategory] = useState<string | undefined>(undefined);
  const [isHoursEditorOpen, setIsHoursEditorOpen] = useState(false);
  const [deleteProductTarget, setDeleteProductTarget] = useState<AdminCatalogProduct | null>(null);
  const [isSuspendConfirmOpen, setIsSuspendConfirmOpen] = useState(false);
  const [isDeleteOutletConfirmOpen, setIsDeleteOutletConfirmOpen] = useState(false);
  const [categoryDialogTarget, setCategoryDialogTarget] = useState<{ id: string; name: string } | null>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<{ id: string; name: string } | null>(null);

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

  useSocketQueryInvalidation(
    ['vendor:status:changed', 'order:new', 'order:status:changed'],
    [['admin-outlet-detail', outletId], ['admin-vendors']],
  );

  const toggleStatusMutation = useMutation({
    mutationFn: (isActive: boolean) => adminApi.toggleVendorStatus(outletId as string, isActive),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail', outletId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update outlet status.')),
  });

  const togglePauseMutation = useMutation({
    mutationFn: (isBusy: boolean) => adminApi.toggleVendorPause(outletId as string, isBusy),
    onSuccess: () => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail', outletId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update order intake status.')),
  });

  const updateOutletMutation = useMutation({
    mutationFn: (data: Parameters<typeof adminApi.updateVendor>[1]) =>
      adminApi.updateVendor(outletId as string, data),
    onSuccess: () => {
      setActionError(null);
      setIsEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail', outletId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update outlet.')),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => adminApi.deleteCategory(categoryId),
    onSuccess: () => {
      setActionError(null);
      setDeleteCategoryTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail', outletId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to delete the category.')),
  });

  const deleteProductMutation = useMutation({
    mutationFn: (productId: string) => adminApi.deleteProduct(productId),
    onSuccess: () => {
      setActionError(null);
      setDeleteProductTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail', outletId] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to delete the product.')),
  });

  const deleteOutletMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteVendor(id),
    onSuccess: () => {
      setActionError(null);
      setIsDeleteOutletConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      navigate('/vendors');
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to delete the outlet.')),
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

  const taggedStaffCount = vendor.totalStaff ?? outlet.staff.length;
  const categoryCount = vendor.totalCategories ?? outlet.categories.length;
  const itemCount =
    vendor.totalProducts ??
    outlet.categories.reduce((acc, cat) => acc + (cat.products?.length || 0), 0);

  const isOutletDeletable = canDeleteOutlet({
    staffCount: taggedStaffCount,
    categoryCount,
    itemCount,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={vendor.brandName ? `${vendor.brandName} — ${vendor.name}` : vendor.name}
        leading={
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 rounded-full"
            onClick={() => navigate('/vendors')}
            aria-label="Back to Brands"
            title="Back to Brands"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
        badge={
          <div className="flex items-center gap-2 flex-wrap">
            {vendor.isActive ? (
              <Badge variant="success">Operational</Badge>
            ) : (
              <Badge variant="danger" className="font-bold">Suspended</Badge>
            )}
            {vendor.isBusy ? (
              <Badge variant="warning" className="font-bold animate-pulse">
                <AlertTriangle className="h-3 w-3 mr-1 inline text-amber-700 dark:text-amber-300" />
                Intake: Inactive
              </Badge>
            ) : (
              <Badge variant="default" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800">
                <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                Intake: Active
              </Badge>
            )}
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditDialogOpen(true)}
              leftIcon={<Pencil className="h-3.5 w-3.5" />}
            >
              Edit Info
            </Button>

            {/* Mode 2: Order Intake Active / Inactive Toggle — Synchronized with Vendor Portal */}
            {vendor.isBusy ? (
              <Button
                variant="success"
                size="sm"
                isLoading={togglePauseMutation.isPending}
                onClick={() => togglePauseMutation.mutate(false)}
                leftIcon={<PlayCircle className="h-3.5 w-3.5" />}
                title="Set order intake to Active (accept incoming orders)"
              >
                Set Active
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50"
                isLoading={togglePauseMutation.isPending}
                onClick={() => togglePauseMutation.mutate(true)}
                leftIcon={<PauseCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
                title="Set order intake to Inactive (halt incoming orders)"
              >
                Set Inactive
              </Button>
            )}

            {/* Mode 1: Platform Suspension Governance */}
            {vendor.isActive ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsSuspendConfirmOpen(true)}
                leftIcon={<Power className="h-3.5 w-3.5" />}
                title="Suspend outlet from platform"
              >
                Suspend Outlet
              </Button>
            ) : (
              <Button
                variant="success"
                size="sm"
                isLoading={toggleStatusMutation.isPending}
                onClick={() => toggleStatusMutation.mutate(true)}
                leftIcon={<Power className="h-3.5 w-3.5" />}
                title="Withdraw outlet suspension"
              >
                Withdraw Suspension
              </Button>
            )}

            {/* Permanent Outlet Deletion — strictly invisible until tagged staff, categories, and items are all 0 */}
            {isOutletDeletable && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setIsDeleteOutletConfirmOpen(true)}
                leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                title="Permanently delete outlet (0 staff, 0 categories, 0 items)"
              >
                Delete Outlet
              </Button>
            )}
          </div>
        }
      />

      {/* Mode 1: Platform Suspension Banner */}
      {!vendor.isActive && (
        <div className="rounded-xl border border-rose-300 bg-rose-50/80 p-3.5 dark:border-rose-900/60 dark:bg-rose-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-rose-950 dark:text-rose-200">
                Outlet Suspended by Platform Administration
              </p>
              <p className="text-[11px] text-rose-800 dark:text-rose-300/90 mt-0.5">
                This outlet is suspended. Vendor portal access is locked, and no kitchen operations or orders can be processed until suspension is withdrawn.
              </p>
            </div>
          </div>
          <Button
            variant="success"
            size="sm"
            className="shrink-0"
            isLoading={toggleStatusMutation.isPending}
            onClick={() => toggleStatusMutation.mutate(true)}
            leftIcon={<Power className="h-3.5 w-3.5" />}
          >
            Withdraw Suspension
          </Button>
        </div>
      )}

      {/* Mode 2: Order Intake Inactive Banner */}
      {vendor.isActive && vendor.isBusy && (
        <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 dark:border-amber-900/60 dark:bg-amber-950/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <p className="text-xs font-bold text-amber-950 dark:text-amber-200">
                Order Intake is Inactive
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300/90 mt-0.5">
                New customer orders will not proceed for {vendor.name}. Kitchen staff can fulfill existing orders. Click 'Set Active' to reopen intake.
              </p>
            </div>
          </div>
          <Button
            variant="success"
            size="sm"
            className="shrink-0"
            isLoading={togglePauseMutation.isPending}
            onClick={() => togglePauseMutation.mutate(false)}
            leftIcon={<PlayCircle className="h-3.5 w-3.5" />}
          >
            Set Active
          </Button>
        </div>
      )}

      {actionError && <QueryErrorBanner error={{ message: actionError } as never} onRetry={() => setActionError(null)} />}

      {/* Outlet cover image — the customer-app banner */}
      {vendor.bannerUrl && (
        <div className="relative h-36 sm:h-44 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <img src={resolveMediaUrl(vendor.bannerUrl)} alt={`${vendor.name} cover`} className="h-full w-full object-cover" />
        </div>
      )}

      {/* Compact info strip — the name lives in the page title only */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center text-xs">
          <InfoCell label="Phone" value={vendor.contactPhone} />
          <InfoCell label="Outlet Type" value={vendor.type?.name || '—'} />
          <InfoCell label="Flow Mode" value={vendor.orderFlowMode === 'VENDOR_FIRST' ? 'Vendor First' : 'Rider First'} />
          <div className="min-w-0">
            <span className="text-slate-400 block text-[10px] mb-0.5">Street Address</span>
            <div className="flex items-center justify-center gap-1 font-bold text-slate-900 dark:text-slate-100">
              <span className="truncate" title={vendor.addressText}>{vendor.addressText}</span>
              <GoogleMapsLink
                variant="icon"
                latitude={vendor.latitude}
                longitude={vendor.longitude}
                addressFallback={vendor.addressText}
                title="Open on Google Maps"
              />
            </div>
          </div>
          <InfoCell label="Commission" value={`${vendor.commissionRate}%`} />
          <InfoCell label="Prep Time" value={`${vendor.defaultPrepTimeMinutes} min`} />
          <InfoCell label="Radius" value={`${vendor.deliveryRadiusKm} km`} />
        </div>
      </div>

      {/* Catalog is the main surface; staff + schedule stack compactly beside it */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <OutletCatalogSection
            categories={outlet.categories}
            onEditProduct={(product) => openProductDialog(product)}
            onCreateProduct={(categoryId) => openProductDialog(null, categoryId)}
            onDeleteProduct={(product) => setDeleteProductTarget(product)}
            onCreateCategory={() => {
              setCategoryDialogTarget(null);
              setIsCategoryDialogOpen(true);
            }}
            onEditCategory={(category) => {
              setCategoryDialogTarget(category);
              setIsCategoryDialogOpen(true);
            }}
            onDeleteCategory={(category) => setDeleteCategoryTarget(category)}
          />
        </div>

        <div className="space-y-6">
          {/* Staff — compact */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <UserRound className="h-4 w-4 text-primary-600" /> Staff ({outlet.staff.length})
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
              <p className="text-xs text-slate-400 italic py-3 text-center">
                No staff assigned — managers are attached here, owners from the brand card.
              </p>
            ) : (
              <div className="space-y-1.5">
                {outlet.staff.map((staff) => (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => openStaffDialog(staff)}
                    className="w-full text-left rounded-lg border border-slate-100 px-2.5 py-2 flex items-center gap-2.5 hover:border-primary-300 transition-colors cursor-pointer dark:border-slate-800"
                    title="View / edit staff profile"
                  >
                    <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 flex items-center justify-center font-bold text-[11px] shrink-0">
                      {staff.fullName.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {staff.fullName}
                        </span>
                        {!staff.isActive && <Badge variant="danger">Inactive</Badge>}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{staff.phone}</div>
                    </div>
                    {staff.scope === 'ALL_OUTLETS_MASTER' ? (
                      <Badge variant="purple">Owner</Badge>
                    ) : (
                      <Badge variant="info">Manager</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-400 mt-3">Click a profile to view or edit.</p>
          </section>

          {/* Operating hours — compact */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-primary-600" /> Hours
              </h3>
              <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setIsHoursEditorOpen(true)}>
                Edit
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
              {DAYS.map((day, index) => {
                const hours = outlet.operatingHours.find((h) => h.dayOfWeek === index);
                return (
                  <div
                    key={day}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-2.5 py-1.5 dark:border-slate-800"
                  >
                    <span className="font-bold text-slate-600 dark:text-slate-300">{day}</span>
                    <span className={hours?.isClosed ? 'text-rose-500' : 'text-slate-600 dark:text-slate-400'}>
                      {hours && !hours.isClosed ? `${hours.openTime}–${hours.closeTime}` : 'Closed'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isSuspendConfirmOpen}
        title="Suspend Outlet?"
        variant="danger"
        confirmLabel="Suspend Outlet"
        message={
          <>
            <p>
              Suspend <strong className="text-slate-900 dark:text-slate-100">{vendor.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Suspending this outlet makes it completely inaccessible in the vendor portal and system. Staff cannot process orders, catalog, or settings until suspension is withdrawn. New incoming orders will be blocked immediately.
            </p>
          </>
        }
        isPending={toggleStatusMutation.isPending}
        onConfirm={() => {
          toggleStatusMutation.mutate(false);
          setIsSuspendConfirmOpen(false);
        }}
        onCancel={() => setIsSuspendConfirmOpen(false)}
      />

      <ConfirmDialog
        isOpen={isDeleteOutletConfirmOpen}
        title="Delete Outlet?"
        variant="danger"
        confirmLabel="Delete Outlet"
        message={
          <>
            <p>
              Permanently delete outlet <strong className="text-slate-900 dark:text-slate-100">{vendor.name}</strong>?
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This action is permanent and cannot be undone. All operating hours and outlet configurations will be removed.
            </p>
          </>
        }
        isPending={deleteOutletMutation.isPending}
        onConfirm={() => {
          if (!isOutletDeletable) {
            setActionError('Cannot delete outlet: tagged staff, categories, and items must all be zero first.');
            setIsDeleteOutletConfirmOpen(false);
            return;
          }
          deleteOutletMutation.mutate(vendor.id);
        }}
        onCancel={() => setIsDeleteOutletConfirmOpen(false)}
      />

      <CategoryDialog
        isOpen={isCategoryDialogOpen}
        vendorId={vendor.id}
        editing={categoryDialogTarget}
        onClose={() => {
          setIsCategoryDialogOpen(false);
          setCategoryDialogTarget(null);
        }}
        onError={setActionError}
      />

      <ConfirmDialog
        isOpen={!!deleteCategoryTarget}
        title="Delete Category?"
        variant="danger"
        confirmLabel="Delete Category"
        message={
          deleteCategoryTarget && (
            <>
              <p>
                Delete the empty category{' '}
                <strong className="text-slate-900 dark:text-slate-100">{deleteCategoryTarget.name}</strong>?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Categories holding products cannot be deleted — move or remove the products first.
              </p>
            </>
          )
        }
        isPending={deleteCategoryMutation.isPending}
        onConfirm={() => {
          if (deleteCategoryTarget) {
            deleteCategoryMutation.mutate(deleteCategoryTarget.id);
          }
        }}
        onCancel={() => setDeleteCategoryTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!deleteProductTarget}
        title="Delete Product?"
        variant="danger"
        confirmLabel="Delete Product"
        message={
          deleteProductTarget && (
            <>
              <p>
                Permanently delete{' '}
                <strong className="text-slate-900 dark:text-slate-100">{deleteProductTarget.name}</strong> and all its
                variations and add-ons?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Products that already appear on customer orders cannot be deleted — mark them out of stock instead.
              </p>
            </>
          )
        }
        isPending={deleteProductMutation.isPending}
        onConfirm={() => {
          if (deleteProductTarget) {
            deleteProductMutation.mutate(deleteProductTarget.id);
          }
        }}
        onCancel={() => setDeleteProductTarget(null)}
      />

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
        createContext={{
          vendorId: vendor.id,
          categoryId: productCreateCategory,
          categories: outlet.categories.map((category) => ({ id: category.id, name: category.name })),
        }}
        onClose={() => setIsProductDialogOpen(false)}
      />

      <OperatingHoursEditor
        isOpen={isHoursEditorOpen}
        vendorId={vendor.id}
        hours={outlet.operatingHours}
        onClose={() => setIsHoursEditorOpen(false)}
      />

      <OutletInfoDialog
        isOpen={isEditDialogOpen}
        isSubmitting={updateOutletMutation.isPending}
        editing={{ id: vendor.id, name: vendor.name }}
        brandName={vendor.brandName || undefined}
        initial={{
          name: vendor.name,
          typeId: vendor.typeId,
          orderFlowMode: vendor.orderFlowMode,
          contactPhone: vendor.contactPhone,
          addressText: vendor.addressText,
          bannerUrl: vendor.bannerUrl || undefined,
          commissionRate: vendor.commissionRate,
          defaultPrepTimeMinutes: vendor.defaultPrepTimeMinutes,
          deliveryRadiusKm: vendor.deliveryRadiusKm,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
        }}
        onClose={() => setIsEditDialogOpen(false)}
        onSubmit={(payload) => updateOutletMutation.mutate(payload)}
      />
    </div>
  );
};

const InfoCell: React.FC<{ label: string; value: React.ReactNode; truncate?: boolean }> = ({ label, value, truncate }) => (
  <div className="min-w-0">
    <span className="text-slate-400 block text-[10px] mb-0.5">{label}</span>
    <div
      className={`font-bold text-slate-900 dark:text-slate-100 flex items-center justify-center ${truncate ? 'truncate' : ''}`}
      title={typeof value === 'string' && truncate ? value : undefined}
    >
      {value}
    </div>
  </div>
);

