import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldCheck, UserRound } from 'lucide-react';
import adminApi, { AdminStaffAssignment, AdminUserSummary } from '../../../../services/adminApi';
import { Badge } from '../../../../components/ui/Badge';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { Modal } from '../../../../components/ui/Modal';
import { Alert } from '../../../../components/ui/Alert';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { extractApiError } from '../../../../utils/apiError';

type StaffScope = 'PARTICULAR_OUTLET' | 'ALL_OUTLETS_MASTER';

interface StaffProfileDialogProps {
  /** Assignment to view/edit; null in create mode. */
  assignment: AdminStaffAssignment | null;
  isOpen: boolean;
  /** Create-mode context: the outlet/brand the new staff binds to. */
  createScope: { vendorId: string; vendorName: string; brandId: string; brandName: string } | null;
  onClose: () => void;
}

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-1.5">
    <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{label}</span>
    <span className="text-xs font-medium text-slate-800 dark:text-slate-200 text-right">{children}</span>
  </div>
);

/**
 * Unified staff profile: existing assignments open in view mode (edit via the
 * footer), new accounts open straight in create mode with phone-search or
 * fresh provisioning.
 */
export const StaffProfileDialog: React.FC<StaffProfileDialogProps> = ({
  assignment,
  isOpen,
  createScope,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const isCreate = !assignment;
  const [mode, setMode] = useState<'view' | 'edit'>('view');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [scope, setScope] = useState<StaffScope>('PARTICULAR_OUTLET');
  const [actionError, setActionError] = useState<string | null>(null);

  // create-mode: existing user lookup
  const [lookupPhone, setLookupPhone] = useState('');
  const debouncedLookup = useDebouncedValue(lookupPhone);
  const [selectedUser, setSelectedUser] = useState<AdminUserSummary | null>(null);
  const [useNewAccount, setUseNewAccount] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMode(isCreate ? 'edit' : 'view');
      setActionError(null);
      setLookupPhone('');
      setSelectedUser(null);
      setUseNewAccount(false);
      if (assignment) {
        setFullName(assignment.fullName);
        setPhone(assignment.phone);
        setIsActive(assignment.isActive);
        setScope(assignment.scope);
      } else {
        setFullName('');
        setPhone('');
        setIsActive(true);
        setScope('PARTICULAR_OUTLET');
      }
    }
  }, [isOpen, assignment, isCreate]);

  const { data: userResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['admin-user-search', debouncedLookup],
    queryFn: () => adminApi.searchUsersByPhone(debouncedLookup),
    enabled: isCreate && !useNewAccount && isOpen && debouncedLookup.trim().length >= 3,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-outlet-detail'] });
    queryClient.invalidateQueries({ queryKey: ['admin-vendors'] });
    queryClient.invalidateQueries({ queryKey: ['admin-vendor-staff'] });
    queryClient.invalidateQueries({ queryKey: ['admin-brands'] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (assignment) {
        await adminApi.updateStaffAccount(assignment.userId, { fullName: fullName.trim(), phone: phone.trim() });
        return adminApi.updateVendorStaff(assignment.id, { isActive, scope });
      }
      const target = createScope as NonNullable<typeof createScope>;
      let userId = selectedUser?.id;
      if (!userId) {
        const created = await adminApi.createStaffUser({ phone: phone.trim(), fullName: fullName.trim() });
        userId = created.id;
      }
      return adminApi.assignVendorStaff(target.vendorId, { userId, scope });
    },
    onSuccess: () => {
      setActionError(null);
      refresh();
      onClose();
    },
    onError: (err) => setActionError(extractApiError(err, 'Staff save failed.')),
  });

  const brandName = assignment?.brandName || createScope?.brandName || '';
  const outletName =
    assignment?.scope === 'PARTICULAR_OUTLET'
      ? assignment.vendorName || createScope?.vendorName
      : createScope?.vendorName;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreate ? 'New Staff Account' : mode === 'view' ? 'Staff Profile' : 'Edit Staff Account'}
      description={
        isCreate
          ? 'Attach an existing user by phone or provision a new account — owners sign in via OTP.'
          : assignment?.scope === 'ALL_OUTLETS_MASTER'
            ? `Brand Owner — governs every ${brandName || 'brand'} outlet`
            : 'Branch Manager — locked to one outlet'
      }
      footer={
        <div className="flex items-center justify-between gap-2 w-full">
          {mode === 'view' ? (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => (isCreate ? onClose() : setMode('view'))}>
              {isCreate ? 'Cancel' : 'Back to View'}
            </Button>
          )}
          {mode === 'view' && (
            <Button size="sm" onClick={() => setMode('edit')} leftIcon={<UserRound className="h-3.5 w-3.5" />}>
              Edit Profile
            </Button>
          )}
          {mode === 'edit' && (
            <Button
              size="sm"
              isLoading={saveMutation.isPending}
              disabled={isCreate && !selectedUser && !useNewAccount && !(phone.trim() && fullName.trim())}
              onClick={() => saveMutation.mutate()}
              leftIcon={<ShieldCheck className="h-3.5 w-3.5" />}
            >
              Save Account
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {actionError && <Alert type="error" message={actionError} onDismiss={() => setActionError(null)} />}

        {mode === 'view' && assignment && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 divide-y divide-slate-100 dark:divide-slate-800">
            <Row label="Name">{assignment.fullName}</Row>
            <Row label="Phone">{assignment.phone}</Row>
            <Row label="Role">
              {assignment.scope === 'ALL_OUTLETS_MASTER' ? (
                <Badge variant="purple">Brand Owner</Badge>
              ) : (
                <Badge variant="info">Branch Manager</Badge>
              )}
            </Row>
            <Row label="Governance">
              {assignment.scope === 'ALL_OUTLETS_MASTER' ? `All ${brandName} outlets` : assignment.vendorName || '—'}
            </Row>
            <Row label="Status">
              {assignment.isActive ? <Badge variant="success">Active</Badge> : <Badge variant="danger">Inactive</Badge>}
            </Row>
            <Row label="Account">{assignment.userStatus}</Row>
          </div>
        )}

        {mode === 'edit' && (
          <>
            {isCreate && (
              <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Attach Account</span>
                  <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5">
                    <button
                      type="button"
                      onClick={() => setUseNewAccount(false)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                        !useNewAccount ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500'
                      }`}
                    >
                      Existing User
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setUseNewAccount(true);
                        setSelectedUser(null);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                        useNewAccount ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500'
                      }`}
                    >
                      New Account
                    </button>
                  </div>
                </div>

                {!useNewAccount ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search platform users by phone (min 3 digits)..."
                        value={lookupPhone}
                        onChange={(e) => {
                          setLookupPhone(e.target.value);
                          setSelectedUser(null);
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                    {debouncedLookup.trim().length >= 3 && (
                      <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-36 overflow-y-auto">
                        {isSearching ? (
                          <div className="px-3 py-2 text-[11px] text-slate-400">Searching…</div>
                        ) : userResults.length === 0 ? (
                          <div className="px-3 py-2 text-[11px] text-slate-400 italic">
                            No match — switch to “New Account”.
                          </div>
                        ) : (
                          userResults.map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                setSelectedUser(user);
                                setFullName(user.fullName);
                                setPhone(user.phone);
                              }}
                              className={`w-full text-left px-3 py-2 flex items-center justify-between cursor-pointer ${
                                selectedUser?.id === user.id
                                  ? 'bg-primary-50 dark:bg-primary-950/30'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <div>
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user.fullName}</div>
                                <div className="text-[10px] text-slate-500">{user.phone}</div>
                              </div>
                              <span className="text-[10px] text-slate-400">{user.role}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                    {selectedUser && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                        Selected: {selectedUser.fullName} ({selectedUser.phone})
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    The account is provisioned now; the owner signs in with this phone via OTP later.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Rahim Uddin"
                  disabled={isCreate && !useNewAccount && !!selectedUser}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+8801712345678"
                  disabled={isCreate && !useNewAccount && !!selectedUser}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Role Scope</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {([
                  { id: 'PARTICULAR_OUTLET' as const, title: 'Branch Manager', desc: `One outlet${outletName ? ` — ${outletName}` : ''}` },
                  { id: 'ALL_OUTLETS_MASTER' as const, title: 'Brand Owner', desc: `All outlets${brandName ? ` — ${brandName}` : ''}` },
                ]).map((option) => (
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
                      name="profile_scope"
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
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Assignment Status
              </label>
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 w-fit">
                {([
                  { value: true, label: 'Active' },
                  { value: false, label: 'Inactive' },
                ]).map((option) => (
                  <button
                    key={String(option.value)}
                    type="button"
                    onClick={() => setIsActive(option.value)}
                    className={`px-3 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
                      isActive === option.value
                        ? option.value
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-500 text-white'
                        : 'text-slate-500'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Inactive staff lose vendor-portal access immediately (session cache purged server-side).
              </p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
