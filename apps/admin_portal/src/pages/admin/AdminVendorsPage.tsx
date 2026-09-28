import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store,
  Plus,
  Users,
  Edit2,
  Power,
} from 'lucide-react';
import adminApi, { AdminVendor } from '../../services/adminApi';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Alert } from '../../components/ui/Alert';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';
import { PageHeader } from '../../components/common/PageHeader';
import { EmptyState } from '../../components/common/EmptyState';
import { QueryErrorBanner } from '../../components/common/QueryErrorBanner';
import { extractApiError } from '../../utils/apiError';

export const AdminVendorsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const [isCreateVendorModalOpen, setIsCreateVendorModalOpen] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [addressText, setAddressText] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [commissionRate, setCommissionRate] = useState('15');
  const [defaultPrepTime, setDefaultPrepTime] = useState('20');
  const [latitude, setLatitude] = useState('23.7925');
  const [longitude, setLongitude] = useState('90.4078');

  const [editingVendor, setEditingVendor] = useState<AdminVendor | null>(null);
  const [editName, setEditName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editCommissionRate, setEditCommissionRate] = useState('15');
  const [editDefaultPrepTime, setEditDefaultPrepTime] = useState('20');
  const [editDeliveryRadius, setEditDeliveryRadius] = useState('5');

  const [isAssignStaffModalOpen, setIsAssignStaffModalOpen] = useState(false);
  const [selectedVendorForStaff, setSelectedVendorForStaff] = useState<AdminVendor | null>(null);
  const [staffUserId, setStaffUserId] = useState('');
  const [staffScope, setStaffScope] = useState<'PARTICULAR_OUTLET' | 'ALL_OUTLETS_MASTER'>('PARTICULAR_OUTLET');

  const { data: vendors = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-vendors'],
    queryFn: adminApi.getVendors,
  });

  const createVendorMutation = useMutation({
    mutationFn: adminApi.createVendor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      setIsCreateVendorModalOpen(false);
      setVendorName('');
      setAddressText('');
      setContactPhone('');
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to create vendor outlet.')),
  });

  const updateVendorMutation = useMutation({
    mutationFn: ({
      vendorId,
      data,
    }: {
      vendorId: string;
      data: {
        name?: string;
        contactPhone?: string;
        commissionRate?: number;
        defaultPrepTimeMinutes?: number;
        deliveryRadiusKm?: number;
      };
    }) => adminApi.updateVendor(vendorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      setEditingVendor(null);
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update vendor outlet.')),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ vendorId, isActive }: { vendorId: string; isActive: boolean }) =>
      adminApi.toggleVendorStatus(vendorId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to update vendor status.')),
  });

  const assignStaffMutation = useMutation({
    mutationFn: ({
      vendorId,
      data,
    }: {
      vendorId: string;
      data: { userId: string; scope: 'ALL_OUTLETS_MASTER' | 'PARTICULAR_OUTLET'; brandId?: string };
    }) => adminApi.assignVendorStaff(vendorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
      setIsAssignStaffModalOpen(false);
      setSelectedVendorForStaff(null);
      setStaffUserId('');
    },
    onError: (err) => setActionError(extractApiError(err, 'Failed to assign staff member.')),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Merchant Outlets & Staff Governance"
        subtitle="Onboard new physical outlets, set commission terms, and assign multi-tier management scopes"
        icon={Store}
        actions={
          <Button
            size="sm"
            onClick={() => setIsCreateVendorModalOpen(true)}
            leftIcon={<Plus className="h-4 w-4" />}
          >
            Onboard New Outlet
          </Button>
        }
      />

      {actionError && (
        <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />
      )}

      {isLoading ? (
        <div className="py-16 text-center">
          <LoadingSpinner size="lg" label="Loading merchant outlets..." />
        </div>
      ) : isError ? (
        <QueryErrorBanner error={error} onRetry={() => refetch()} />
      ) : vendors.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No merchant outlets"
          message="No merchant outlets registered yet. Onboard your first outlet to start serving customers."
          action={
            <Button
              size="sm"
              onClick={() => setIsCreateVendorModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Onboard Outlet
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {vendors.map((vendor) => (
            <div
              key={vendor.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{vendor.name}</h3>
                    {vendor.brandName && (
                      <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">
                        Brand: {vendor.brandName}
                      </span>
                    )}
                    <p className="mt-1 text-xs text-slate-500">{vendor.addressText}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {vendor.isActive ? (
                      <Badge variant="success">Active</Badge>
                    ) : (
                      <Badge variant="default">Inactive</Badge>
                    )}
                    {vendor.isBusy && (
                      <Badge variant="warning">Rush Paused</Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center text-xs dark:bg-slate-800/50">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Commission</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{vendor.commissionRate}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Avg Prep Time</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{vendor.defaultPrepTimeMinutes} mins</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Lifetime Orders</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{vendor.totalOrders}</span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      Assigned Management Staff ({vendor.staff.length})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-6 px-2 text-primary-600 dark:text-primary-400"
                      onClick={() => {
                        setSelectedVendorForStaff(vendor);
                        setIsAssignStaffModalOpen(true);
                      }}
                    >
                      + Assign Staff
                    </Button>
                  </div>

                  {vendor.staff.length === 0 ? (
                    <div className="text-[11px] text-slate-400 italic py-1">No staff members assigned yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {vendor.staff.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-2 text-xs dark:border-slate-800 dark:bg-slate-900/50"
                        >
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-slate-100">{s.fullName}</span>
                            <span className="text-slate-400 ml-2">{s.phone}</span>
                          </div>
                          <div>
                            {s.scope === 'ALL_OUTLETS_MASTER' ? (
                              <Badge variant="purple">Brand Owner (Master)</Badge>
                            ) : (
                              <Badge variant="info">Branch Manager (Locked)</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 dark:border-slate-800">
                <div className="text-[11px] text-slate-400">
                  <span>Phone: {vendor.contactPhone}</span>
                  <span className="mx-2">•</span>
                  <span>{vendor.totalProducts} Catalog Dishes</span>
                </div>
                <div className="inline-flex items-center gap-1.5 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setEditingVendor(vendor);
                      setEditName(vendor.name);
                      setEditContactPhone(vendor.contactPhone);
                      setEditCommissionRate(String(vendor.commissionRate));
                      setEditDefaultPrepTime(String(vendor.defaultPrepTimeMinutes));
                      setEditDeliveryRadius(String(vendor.deliveryRadiusKm || 5));
                    }}
                    leftIcon={<Edit2 className="h-3 w-3" />}
                  >
                    Edit
                  </Button>
                  <Button
                    variant={vendor.isActive ? 'outline' : 'primary'}
                    size="sm"
                    className={`h-7 px-2 text-xs ${
                      vendor.isActive
                        ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-transparent'
                    }`}
                    isLoading={toggleStatusMutation.isPending && toggleStatusMutation.variables?.vendorId === vendor.id}
                    onClick={() =>
                      toggleStatusMutation.mutate({
                        vendorId: vendor.id,
                        isActive: !vendor.isActive,
                      })
                    }
                    leftIcon={<Power className="h-3 w-3" />}
                  >
                    {vendor.isActive ? 'Suspend' : 'Activate'}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={isCreateVendorModalOpen}
        onClose={() => setIsCreateVendorModalOpen(false)}
        title="Onboard New Merchant Outlet"
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={() => setIsCreateVendorModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!vendorName || !addressText || !contactPhone}
              isLoading={createVendorMutation.isPending}
              onClick={() =>
                createVendorMutation.mutate({
                  name: vendorName,
                  addressText,
                  contactPhone,
                  commissionRate: parseFloat(commissionRate) || 15,
                  defaultPrepTimeMinutes: parseInt(defaultPrepTime, 10) || 20,
                  latitude: parseFloat(latitude) || 23.7925,
                  longitude: parseFloat(longitude) || 90.4078,
                })
              }
            >
              Onboard Outlet
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Store / Branch Name
            </label>
            <Input
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="e.g. Burger Point — Uttara Branch"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Physical Street Address
            </label>
            <Input
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
              placeholder="e.g. Sector 4, Road 7, House 12, Uttara, Dhaka"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Store Phone
              </label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+8801700000000"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Platform Commission (%)
              </label>
              <Input
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="15"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                GPS Latitude
              </label>
              <Input
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="23.7925"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                GPS Longitude
              </label>
              <Input
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="90.4078"
              />
            </div>
          </div>
        </div>
      </Modal>

      {selectedVendorForStaff && (
        <Modal
          isOpen={isAssignStaffModalOpen}
          onClose={() => setIsAssignStaffModalOpen(false)}
          title={`Assign Staff User — ${selectedVendorForStaff.name}`}
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setIsAssignStaffModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!staffUserId}
                isLoading={assignStaffMutation.isPending}
                onClick={() =>
                  assignStaffMutation.mutate({
                    vendorId: selectedVendorForStaff.id,
                    data: {
                      userId: staffUserId,
                      scope: staffScope,
                    },
                  })
                }
              >
                Assign Staff Scope
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                User ID (UUID)
              </label>
              <Input
                value={staffUserId}
                onChange={(e) => setStaffUserId(e.target.value)}
                placeholder="User UUID from registered staff"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Permission Scope
              </label>
              <div className="space-y-2">
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    staffScope === 'PARTICULAR_OUTLET'
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope_choice"
                    value="PARTICULAR_OUTLET"
                    checked={staffScope === 'PARTICULAR_OUTLET'}
                    onChange={() => setStaffScope('PARTICULAR_OUTLET')}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      PARTICULAR_OUTLET (Branch Manager)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Strictly locked to this physical branch only. Cannot switch or view other stores.
                    </p>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    staffScope === 'ALL_OUTLETS_MASTER'
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="scope_choice"
                    value="ALL_OUTLETS_MASTER"
                    checked={staffScope === 'ALL_OUTLETS_MASTER'}
                    onChange={() => setStaffScope('ALL_OUTLETS_MASTER')}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      ALL_OUTLETS_MASTER (Brand Owner)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Full authority to switch between all branches under this brand and view consolidated ledgers.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {editingVendor && (
        <Modal
          isOpen={Boolean(editingVendor)}
          onClose={() => setEditingVendor(null)}
          title={`Edit Outlet: ${editingVendor.name}`}
          footer={
            <div className="flex justify-end gap-2 w-full">
              <Button variant="outline" size="sm" onClick={() => setEditingVendor(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                isLoading={updateVendorMutation.isPending}
                onClick={() =>
                  updateVendorMutation.mutate({
                    vendorId: editingVendor.id,
                    data: {
                      name: editName,
                      contactPhone: editContactPhone,
                      commissionRate: parseFloat(editCommissionRate),
                      defaultPrepTimeMinutes: parseInt(editDefaultPrepTime, 10),
                      deliveryRadiusKm: parseFloat(editDeliveryRadius),
                    },
                  })
                }
              >
                Save Changes
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Store / Branch Name
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Store Name"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Store Phone
              </label>
              <Input
                value={editContactPhone}
                onChange={(e) => setEditContactPhone(e.target.value)}
                placeholder="+8801700000000"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Commission (%)
                </label>
                <Input
                  type="number"
                  value={editCommissionRate}
                  onChange={(e) => setEditCommissionRate(e.target.value)}
                  placeholder="15"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Avg Prep (mins)
                </label>
                <Input
                  type="number"
                  value={editDefaultPrepTime}
                  onChange={(e) => setEditDefaultPrepTime(e.target.value)}
                  placeholder="20"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Radius (km)
                </label>
                <Input
                  type="number"
                  value={editDeliveryRadius}
                  onChange={(e) => setEditDeliveryRadius(e.target.value)}
                  placeholder="5"
                />
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
