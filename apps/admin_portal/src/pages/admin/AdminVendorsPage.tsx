import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronRight, Plus, Search, Store, UserRound } from 'lucide-react';
import adminApi, { AdminBrand, AdminStaffAssignment, AdminVendor } from '../../services/adminApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { extractApiError } from '../../utils/apiError';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { BrandFormModal } from './components/vendors/BrandFormModal';
import { StaffAccountsTab } from './components/vendors/StaffAccountsTab';
import { StaffProfileDialog } from './components/staff/StaffProfileDialog';
import { OutletInfoDialog } from './components/outlets/OutletInfoDialog';

type VendorsTab = 'BRANDS' | 'STAFF';

/**
 * Unified Brand Page: every brand with search + creation. Brand cards expose
 * the owner (opens the staff profile dialog), a brand-locked outlet creator,
 * and the outlet list — clicking an outlet opens the Outlet Page.
 */
export const AdminVendorsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<VendorsTab>('BRANDS');
  const [brandSearch, setBrandSearch] = useState('');
  const [outletSearch, setOutletSearch] = useState('');
  const debouncedBrandSearch = useDebouncedValue(brandSearch);
  const debouncedOutletSearch = useDebouncedValue(outletSearch);

  const [isBrandFormOpen, setIsBrandFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [deleteBrandTarget, setDeleteBrandTarget] = useState<AdminBrand | null>(null);

  const [ownerDialogAssignment, setOwnerDialogAssignment] = useState<AdminStaffAssignment | null>(null);
  const [isOwnerDialogOpen, setIsOwnerDialogOpen] = useState(false);

  const [outletCreateBrand, setOutletCreateBrand] = useState<AdminBrand | null>(null);

  const [brandPage, setBrandPage] = useState(1);
  const { data: brandPageData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-brands', debouncedBrandSearch, brandPage],
    queryFn: () => adminApi.getBrands({ search: debouncedBrandSearch, page: brandPage, limit: 8 }),
    placeholderData: (previous) => previous,
  });
  const brands = brandPageData?.items ?? [];
  const brandTotalPages = brandPageData?.totalPages ?? 1;
  const brandTotal = brandPageData?.total ?? 0;
  const safeBrands = Array.isArray(brands) ? brands : [];

  const { data: vendors = [] } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: adminApi.getVendors,
  });

  const safeVendors = Array.isArray(vendors) ? vendors : [];
  const outletTerm = debouncedOutletSearch.trim().toLowerCase();
  const outletMatches = (v: AdminVendor) =>
    !outletTerm ||
    v.name.toLowerCase().includes(outletTerm) ||
    v.addressText.toLowerCase().includes(outletTerm);

  const createBrandMutation = useMutation({
    mutationFn: adminApi.createBrand,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      setIsBrandFormOpen(false);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to create brand.')),
  });

  const updateBrandMutation = useMutation({
    mutationFn: ({ brandId, data }: { brandId: string; data: { name?: string; logoUrl?: string } }) =>
      adminApi.updateBrand(brandId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      setIsBrandFormOpen(false);
      setEditingBrand(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update brand.')),
  });

  const deleteBrandMutation = useMutation({
    mutationFn: (brandId: string) => adminApi.deleteBrand(brandId),
    onSuccess: () => {
      setDeleteBrandTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to delete brand.')),
  });

  const createOutletMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.createVendor>[0]) => adminApi.createVendor(payload),
    onSuccess: () => {
      setActionError(null);
      setOutletCreateBrand(null);
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to create outlet.')),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Brands & Outlets"
        subtitle="Govern brand umbrellas, drill into any outlet's catalog, staff accounts, and operating settings"
        icon={Building2}
        actions={
          activeTab === 'BRANDS' ? (
            <Button
              size="sm"
              onClick={() => {
                setEditingBrand(null);
                setIsBrandFormOpen(true);
              }}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Brand
            </Button>
          ) : undefined
        }
      />

      {actionError && <QueryErrorBanner error={{ message: actionError } as never} onRetry={() => setActionError(null)} />}

      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {([
          { id: 'BRANDS' as const, label: `Brands (${brandTotal})`, icon: Building2 },
          { id: 'STAFF' as const, label: 'Staff Accounts', icon: UserRound },
        ]).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 py-3 px-4 sm:px-5 text-sm font-semibold transition-all ${
                isActive
                  ? 'border-primary-600 text-primary-600 dark:border-primary-400 dark:text-primary-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'BRANDS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search brands by name..."
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search outlets by name or area..."
                value={outletSearch}
                onChange={(e) => setOutletSearch(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" label="Loading brands..." />
            </div>
          ) : isError ? (
            <QueryErrorBanner error={error} onRetry={() => refetch()} />
          ) : safeBrands.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={debouncedBrandSearch ? 'No brands match your search' : 'No brands yet'}
              message={
                debouncedBrandSearch
                  ? `Nothing matches “${debouncedBrandSearch}” — try another name or create a new brand.`
                  : 'Brands group multi-branch chains under one owner scope. Create the first brand to link outlets to it.'
              }
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingBrand(null);
                    setIsBrandFormOpen(true);
                  }}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Create Brand
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {safeBrands.map((brand) => (
                <BrandCard
                  key={brand.id}
                  brand={brand}
                  outlets={safeVendors.filter((v) => v.brandId === brand.id && outletMatches(v))}
                  isDeleting={deleteBrandMutation.isPending}
                  onEdit={() => {
                    setEditingBrand(brand);
                    setIsBrandFormOpen(true);
                  }}
                  onRequestDelete={() => setDeleteBrandTarget(brand)}
                  onOpenOwner={(owner) => {
                    setOwnerDialogAssignment(owner);
                    setIsOwnerDialogOpen(true);
                  }}
                  onOpenOutlet={(outletId) => navigate(`/outlets/${outletId}`)}
                  onCreateOutlet={() => setOutletCreateBrand(brand)}
                />
              ))}
            </div>
          )}

          {brandTotalPages > 1 && (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <span>Total {brandTotal} brands</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBrandPage((p) => Math.max(1, p - 1))}
                  disabled={brandPage <= 1}
                  className="rounded-lg px-2.5 py-1 font-medium hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {brandPage} / {brandTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setBrandPage((p) => Math.min(brandTotalPages, p + 1))}
                  disabled={brandPage >= brandTotalPages}
                  className="rounded-lg px-2.5 py-1 font-medium hover:bg-slate-200 disabled:opacity-40 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'STAFF' && <StaffAccountsTab onError={setActionError} />}

      <BrandFormModal
        isOpen={isBrandFormOpen}
        isSubmitting={createBrandMutation.isPending || updateBrandMutation.isPending}
        editing={editingBrand}
        onClose={() => {
          setIsBrandFormOpen(false);
          setEditingBrand(null);
        }}
        onSubmit={(payload) => {
          if (editingBrand) {
            updateBrandMutation.mutate({ brandId: editingBrand.id, data: payload });
          } else {
            createBrandMutation.mutate(payload);
          }
        }}
      />

      <StaffProfileDialog
        assignment={ownerDialogAssignment}
        isOpen={isOwnerDialogOpen}
        createScope={null}
        onClose={() => setIsOwnerDialogOpen(false)}
      />

      <OutletInfoDialog
        isOpen={!!outletCreateBrand}
        isSubmitting={createOutletMutation.isPending}
        editing={null}
        brandName={outletCreateBrand?.name}
        onClose={() => setOutletCreateBrand(null)}
        onSubmit={(payload) => {
          if (outletCreateBrand) {
            createOutletMutation.mutate({
              ...payload,
              addressText: payload.addressText || '',
              brandId: outletCreateBrand.id,
            });
          }
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteBrandTarget}
        title="Delete Brand?"
        variant="danger"
        confirmLabel="Delete Brand"
        message={
          deleteBrandTarget && (
            <>
              <p>
                Permanently delete the brand{' '}
                <strong className="text-slate-900 dark:text-slate-100">{deleteBrandTarget.name}</strong>?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Blocked while any outlet or staff assignment still references the brand — reassign or remove them
                first.
              </p>
            </>
          )
        }
        isPending={deleteBrandMutation.isPending}
        onConfirm={() => {
          if (deleteBrandTarget) {
            deleteBrandMutation.mutate(deleteBrandTarget.id);
          }
        }}
        onCancel={() => setDeleteBrandTarget(null)}
      />
    </div>
  );
};

const BrandCard: React.FC<{
  brand: AdminBrand;
  outlets: AdminVendor[];
  isDeleting: boolean;
  onEdit: () => void;
  onRequestDelete: () => void;
  onOpenOwner: (owner: AdminStaffAssignment) => void;
  onOpenOutlet: (outletId: string) => void;
  onCreateOutlet: () => void;
}> = ({ brand, outlets, isDeleting, onEdit, onRequestDelete, onOpenOwner, onOpenOutlet, onCreateOutlet }) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col">
    {/* Brand header */}
    <div className="p-5 pb-4 flex items-start gap-4">
      <div className="h-14 w-14 rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 flex items-center justify-center shrink-0 overflow-hidden">
        {brand.logoUrl ? (
          <img src={resolveMediaUrl(brand.logoUrl)} alt={brand.name} className="h-full w-full object-cover" />
        ) : (
          <Building2 className="h-6 w-6" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{brand.name}</h3>
            <button
              type="button"
              onClick={() => brand.owner && onOpenOwner(brand.owner)}
              disabled={!brand.owner}
              className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
                brand.owner
                  ? 'border-primary-200 bg-primary-50/60 text-primary-700 hover:border-primary-400 hover:ring-2 hover:ring-primary-500/20 cursor-pointer dark:border-primary-900/60 dark:bg-primary-950/30 dark:text-primary-300'
                  : 'border-slate-200 text-slate-400 italic dark:border-slate-800'
              }`}
              title={brand.owner ? 'View owner profile' : 'No owner assigned yet'}
            >
              <UserRound className="h-3 w-3" />
              {brand.owner ? (
                <>
                  <span className="font-semibold">{brand.owner.fullName}</span>
                  <span className="opacity-70">· Owner</span>
                  {!brand.owner.isActive && <Badge variant="danger">Inactive</Badge>}
                </>
              ) : (
                'No owner assigned'
              )}
            </button>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onEdit}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              onClick={onRequestDelete}
              disabled={isDeleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>

    {/* Outlet list */}
    <div className="px-5 pb-2 flex items-center justify-between">
      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
        Outlets ({outlets.length}{brand.totalOutlets !== outlets.length ? ` of ${brand.totalOutlets}` : ''})
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="text-xs h-7 px-2 text-primary-600 dark:text-primary-400"
        onClick={onCreateOutlet}
        leftIcon={<Plus className="h-3.5 w-3.5" />}
      >
        New Outlet
      </Button>
    </div>

    <div className="px-4 pb-4 pt-1 space-y-2 bg-slate-50/60 dark:bg-slate-950/20 flex-1">
      {outlets.length === 0 ? (
        <button
          type="button"
          onClick={onCreateOutlet}
          className="w-full rounded-xl border-2 border-dashed border-slate-200 py-4 text-[11px] text-slate-400 hover:border-primary-400 hover:text-primary-500 transition-colors cursor-pointer dark:border-slate-800"
        >
          {brand.totalOutlets === 0
            ? 'No outlets yet — onboard the first one for this brand'
            : 'No outlets match the search in this brand'}
        </button>
      ) : (
        outlets.map((outlet) => (
          <button
            key={outlet.id}
            type="button"
            onClick={() => onOpenOutlet(outlet.id)}
            className="w-full text-left rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-center gap-3 hover:border-primary-400 hover:ring-2 hover:ring-primary-500/20 transition-all cursor-pointer dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-11 w-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0 overflow-hidden dark:bg-slate-800">
              {outlet.logoUrl ? (
                <img src={resolveMediaUrl(outlet.logoUrl)} alt={outlet.name} className="h-full w-full object-cover" />
              ) : (
                <Store className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{outlet.name}</span>
                {!outlet.isActive && <Badge variant="danger">Suspended</Badge>}
                {outlet.isBusy && <Badge variant="warning">Rush</Badge>}
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                {outlet.addressText} · {outlet.totalProducts} products · {outlet.totalOrders} orders
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        ))
      )}
    </div>
  </div>
);
