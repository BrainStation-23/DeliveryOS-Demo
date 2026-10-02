import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus, Trash2 } from 'lucide-react';
import adminApi, { AdminUserSummary, AdminVendor } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { Alert } from '../../../../components/ui/Alert';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { extractApiError } from '../../../../utils/apiError';

type StaffScope = 'PARTICULAR_OUTLET' | 'ALL_OUTLETS_MASTER';

interface StaffManagerModalProps {
  vendor: AdminVendor | null;
  onClose: () => void;
}

/**
 * Full owner/staff lifecycle for one outlet: review current assignments,
 * attach an existing platform user found by phone, provision a brand-new
 * account, and remove assignments (with last-assignment role demotion).
 */
export const StaffManagerModal: React.FC<StaffManagerModalProps> = ({ vendor, onClose }) => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [mode, setMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [phoneQuery, setPhoneQuery] = useState('');
  const debouncedPhone = useDebouncedValue(phoneQuery);
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [scope, setScope] = useState<StaffScope>('PARTICULAR_OUTLET');
  const [newPhone, setNewPhone] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [removeTarget, setRemoveTarget] = useState<AdminVendor['staff'][number] | null>(null);

  const { data: userResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['admin-user-search', debouncedPhone],
    queryFn: () => adminApi.searchUsersByPhone(debouncedPhone),
    enabled: mode === 'EXISTING' && debouncedPhone.trim().length >= 3,
  });

  const refreshStaff = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    queryClient.invalidateQueries({ queryKey: ['admin-vendor-staff'] });
    queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
  };

  const assignMutation = useMutation({
    mutationFn: ({ userId }: { userId: string }) =>
      adminApi.assignVendorStaff(vendor?.id as string, { userId, scope }),
    onSuccess: () => {
      setActionError(null);
      setSelectedUser(null);
      setPhoneQuery('');
      refreshStaff();
    },
    onError: (err) => setActionError(extractApiError(err, 'Staff assignment failed.')),
  });

  const createAndAssignMutation = useMutation({
    mutationFn: async () => {
      const user = await adminApi.createStaffUser({ phone: newPhone.trim(), fullName: newFullName.trim() });
      return adminApi.assignVendorStaff(vendor?.id as string, { userId: user.id, scope });
    },
    onSuccess: () => {
      setActionError(null);
      setNewPhone('');
      setNewFullName('');
      refreshStaff();
    },
    onError: (err) => setActionError(extractApiError(err, 'Account creation failed.')),
  });

  const removeMutation = useMutation({
    mutationFn: (staffId: string) => adminApi.removeVendorStaff(staffId),
    onSuccess: (result) => {
      setActionError(null);
      setRemoveTarget(null);
      if (result.demoted) {
        queryClient.invalidateQueries({ queryKey: ['admin-overview'] });
      }
      refreshStaff();
    },
    onError: (err) => setActionError(extractApiError(err, 'Staff removal failed.')),
  });

  const safeStaff = Array.isArray(vendor?.staff) ? vendor.staff : [];

  return (
    <>
      <Modal
        isOpen={!!vendor}
        onClose={onClose}
        size="lg"
        title={`Staff & Owners — ${vendor?.name || ''}`}
        description={vendor?.brandName ? `Brand: ${vendor.brandName}` : 'Standalone outlet (no brand)'}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {actionError && <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />}

          {/* Current assignments */}
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 mb-2">
              Current Assignments ({safeStaff.length})
            </h4>
            {safeStaff.length === 0 ? (
              <div className="text-xs text-slate-400 italic">No staff assigned to this outlet yet.</div>
            ) : (
              <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 dark:border-slate-800 dark:divide-slate-800 overflow-hidden">
                {safeStaff.map((staff) => (
                  <div key={staff.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {staff.fullName}
                        </span>
                        {staff.scope === 'ALL_OUTLETS_MASTER' ? (
                          <Badge variant="purple">Brand Owner</Badge>
                        ) : (
                          <Badge variant="info">Branch Manager</Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{staff.phone}</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7 px-2 shrink-0 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                      onClick={() => setRemoveTarget(staff)}
                      leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add assignment */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-primary-600" />
                Add Staff Account
              </h4>
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                {(['EXISTING', 'NEW'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      mode === m ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500'
                    }`}
                  >
                    {m === 'EXISTING' ? 'Existing User' : 'New Account'}
                  </button>
                ))}
              </div>
            </div>

            {/* Scope */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {([
                { id: 'PARTICULAR_OUTLET', title: 'Branch Manager', desc: 'Locked to this outlet only' },
                { id: 'ALL_OUTLETS_MASTER', title: 'Brand Owner', desc: 'All outlets under the brand' },
              ] as const).map((option) => (
                <label
                  key={option.id}
                  className={`flex items-start gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                    scope === option.id
                      ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-950/20'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="staff_scope"
                    checked={scope === option.id}
                    onChange={() => setScope(option.id)}
                    className="mt-0.5 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <div className="text-[11px] font-bold text-slate-900 dark:text-slate-100">{option.title}</div>
                    <div className="text-[10px] text-slate-500">{option.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {mode === 'EXISTING' ? (
              <div className="space-y-2.5">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search platform users by phone (min 3 digits)..."
                    value={phoneQuery}
                    onChange={(e) => {
                      setPhoneQuery(e.target.value);
                      setSelectedUser(null);
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                {debouncedPhone.trim().length >= 3 && (
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-44 overflow-y-auto">
                    {isSearching ? (
                      <div className="px-3 py-2.5 text-[11px] text-slate-400">Searching…</div>
                    ) : userResults.length === 0 ? (
                      <div className="px-3 py-2.5 text-[11px] text-slate-400 italic">
                        No user matches this phone — switch to “New Account” to provision one.
                      </div>
                    ) : (
                      userResults.map((user) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => setSelectedUser(user)}
                          className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            selectedUser?.id === user.id
                              ? 'bg-primary-50 dark:bg-primary-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user.fullName}</div>
                            <div className="text-[10px] text-slate-500">{user.phone}</div>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {user.role} · {user.status}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}

                <Button
                  size="sm"
                  disabled={!selectedUser}
                  isLoading={assignMutation.isPending}
                  onClick={() => selectedUser && assignMutation.mutate({ userId: selectedUser.id })}
                >
                  Assign {selectedUser ? selectedUser.fullName : 'User'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Phone Number
                    </label>
                    <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+8801712345678" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Full Name
                    </label>
                    <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="Rahim Uddin" />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  The account is provisioned as an owner/staff member — they sign in with this phone via OTP, no
                  password involved.
                </p>
                <Button
                  size="sm"
                  disabled={!newPhone.trim() || !newFullName.trim()}
                  isLoading={createAndAssignMutation.isPending}
                  onClick={() => createAndAssignMutation.mutate()}
                >
                  Create Account &amp; Assign
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!removeTarget}
        title="Remove Staff Assignment?"
        variant="danger"
        confirmLabel="Remove Assignment"
        message={
          removeTarget && (
            <>
              <p>
                Remove <strong className="text-slate-900 dark:text-slate-100">{removeTarget.fullName}</strong> ({removeTarget.phone}) from{' '}
                {removeTarget.scope === 'ALL_OUTLETS_MASTER' ? 'this brand' : 'this outlet'}?
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                If this is their only assignment, the account demotes to CUSTOMER and loses vendor portal access
                immediately.
              </p>
            </>
          )
        }
        isPending={removeMutation.isPending}
        onConfirm={() => {
          if (removeTarget) {
            removeMutation.mutate(removeTarget.id);
          }
        }}
        onCancel={() => setRemoveTarget(null)}
      />
    </>
  );
};
