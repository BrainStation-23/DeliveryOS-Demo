import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, ChevronRight, Plus, UserRound } from 'lucide-react';
import adminApi, { AdminBrand, AdminStaffAssignment, AdminVendor } from '../../services/adminApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Tabs } from '../../components/ui/Tabs';
import { SearchInput } from '../../components/common/SearchInput';
import { extractApiError } from '../../utils/apiError';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useSocketQueryInvalidation } from '../../hooks/useSocketSubscription';
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
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  const [isBrandFormOpen, setIsBrandFormOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<AdminBrand | null>(null);
  const [deleteBrandTarget, setDeleteBrandTarget] = useState<AdminBrand | null>(null);

  const [ownerDialogAssignment, setOwnerDialogAssignment] = useState<AdminStaffAssignment | null>(null);
  const [isOwnerDialogOpen, setIsOwnerDialogOpen] = useState(false);

  const [outletCreateBrand, setOutletCreateBrand] = useState<AdminBrand | null>(null);

  const [brandPage, setBrandPage] = useState(1);
  // While searching, one term matches brands AND the outlets inside them, so
  // the whole catalogue is pulled (pilot scale) and matched client-side.
  const term = debouncedSearch.trim().toLowerCase();
  const isSearching = term.length > 0;
  const { data: brandPageData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-brands', brandPage, isSearching],
    queryFn: () =>
      adminApi.getBrands({ page: isSearching ? 1 : brandPage, limit: isSearching ? 100 : 8 }),
    placeholderData: (previous) => previous,
  });
  const brandTotalPages = brandPageData?.totalPages ?? 1;
  const brandTotal = brandPageData?.total ?? 0;

  const { data: vendors = [] } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: adminApi.getVendors,
  });

  useSocketQueryInvalidation(
    ['vendor:status:changed', 'order:new'],
    [['admin-vendors'], ['admin-brands']],
  );

  const safeVendors = Array.isArray(vendors) ? vendors : [];
  const outletsOf = (brandId: string) => safeVendors.filter((v) => v.brandId === brandId);
  const outletMatches = (v: AdminVendor) =>
    !isSearching ||
    v.name.toLowerCase().includes(term) ||
    v.addressText.toLowerCase().includes(term);
  const brandNameMatches = (brand: AdminBrand) => brand.name.toLowerCase().includes(term);

  // A brand surfaces when its own name matches OR any of its outlets do; a
  // name-matched brand keeps its full outlet list, an outlet-matched brand
  // narrows to the matching outlets only.
  const visibleBrands = (Array.isArray(brandPageData?.items) ? brandPageData.items : [])
    .map((brand) => {
      const outlets = outletsOf(brand.id);
      const nameMatch = !isSearching || brandNameMatches(brand);
      const matchedOutlets = nameMatch ? outlets : outlets.filter(outletMatches);
      return { brand, outlets: matchedOutlets, matched: nameMatch || outlets.some(outletMatches) };
    })
    .filter((entry) => entry.matched);

  // One orchestrated save: brand fields first, then the owner swap only when
  // the picker reports a change (create chains the owner onto the new brand).
  const saveBrandMutation = useMutation({
    mutationFn: async ({
      editing,
      payload,
    }: {
      editing: AdminBrand | null;
      payload: Parameters<typeof adminApi.createBrand>[0] & { owner: { userId: string | null; changed: boolean } };
    }) => {
      const brand = editing
        ? await adminApi.updateBrand(editing.id, { name: payload.name, logoUrl: payload.logoUrl })
        : await adminApi.createBrand({ name: payload.name, logoUrl: payload.logoUrl });
      if (payload.owner.changed) {
        await adminApi.setBrandOwner(brand.id, payload.owner.userId);
      }
      return brand;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      queryClient.invalidateQueries({ queryKey: ['admin-vendor-staff'] });
      setIsBrandFormOpen(false);
      setEditingBrand(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to save brand.')),
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

      <Tabs
        aria-label="Brands & outlets sections"
        items={[
          { id: 'BRANDS', label: 'Brands', icon: <Building2 className="h-4 w-4" /> },
          { id: 'STAFF', label: 'Staff Accounts', icon: <UserRound className="h-4 w-4" /> },
        ]}
        selected={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'BRANDS' && (
        <div className="space-y-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setBrandPage(1);
            }}
            placeholder="Search brands or outlets by name or area..."
            className="max-w-xl"
          />

          {isLoading ? (
            <div className="py-16 text-center">
              <LoadingSpinner size="lg" label="Loading brands..." />
            </div>
          ) : isError ? (
            <QueryErrorBanner error={error} onRetry={() => refetch()} />
          ) : visibleBrands.length === 0 ? (
            <EmptyState
              icon={Building2}
              title={isSearching ? 'No brands or outlets match your search' : 'No brands yet'}
              message={
                isSearching
                  ? `Nothing matches “${debouncedSearch.trim()}” — try a brand or outlet name.`
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
              {visibleBrands.map(({ brand, outlets }) => (
                <BrandCard
                  key={brand.id}
                  brand={brand}
                  outlets={outlets}
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

          {!isSearching && brandTotalPages > 1 && (
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
        isSubmitting={saveBrandMutation.isPending}
        editing={editingBrand}
        onClose={() => {
          setIsBrandFormOpen(false);
          setEditingBrand(null);
        }}
        onSubmit={(payload) => saveBrandMutation.mutate({ editing: editingBrand, payload })}
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
            if ((deleteBrandTarget.totalOutlets ?? 0) > 0) {
              setDeleteBrandTarget(null);
              return;
            }
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
            {brand.totalOutlets === 0 && outlets.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                onClick={onRequestDelete}
                disabled={isDeleting}
              >
                Delete
              </Button>
            )}
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{outlet.name}</span>
                {!outlet.isActive && <Badge variant="danger">Suspended</Badge>}
                {outlet.isActive && outlet.isBusy && <Badge variant="warning">Intake: Inactive</Badge>}
              </div>
              <div className="text-[10px] text-slate-500 truncate mt-0.5">
                {outlet.addressText}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
          </button>
        ))
      )}
    </div>
  </div>
);
