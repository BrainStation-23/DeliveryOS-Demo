import React, { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Search, UserRound, UserRoundPlus, X } from 'lucide-react';
import adminApi from '../../../../services/adminApi';
import { Button } from '../../../../components/ui/Button';
import { Input } from '../../../../components/ui/Input';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';

export interface BrandOwnerState {
  userId: string | null;
  label: string;
  /** True when the pending selection differs from the persisted owner. */
  changed: boolean;
}

export interface BrandOwnerPickerProps {
  /** Persisted owner baseline (null on create, or when the brand has none). */
  initialOwner: { userId: string; fullName: string } | null;
  onChange: (state: BrandOwnerState) => void;
}

/**
 * Brand-owner selector for the brand form: attach an existing user by phone
 * search, provision a fresh account, or clear ownership. The role itself is
 * fixed — ownership is always the brand-scoped master assignment (the outlet
 * staff dialog handles manager accounts).
 */
export const BrandOwnerPicker: React.FC<BrandOwnerPickerProps> = ({ initialOwner, onChange }) => {
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [lookupPhone, setLookupPhone] = useState('');
  const [selected, setSelected] = useState<{ userId: string | null; label: string }>(
    initialOwner ? { userId: initialOwner.userId, label: initialOwner.fullName } : { userId: null, label: '' },
  );
  const [newFullName, setNewFullName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const debouncedLookup = useDebouncedValue(lookupPhone);

  useEffect(() => {
    setSelected(
      initialOwner ? { userId: initialOwner.userId, label: initialOwner.fullName } : { userId: null, label: '' },
    );
    setLookupPhone('');
    setNewFullName('');
    setNewPhone('');
    setTab('existing');
    setActionError(null);
  }, [initialOwner]);

  useEffect(() => {
    onChange({
      userId: selected.userId,
      label: selected.label,
      changed: selected.userId !== (initialOwner?.userId ?? null),
    });
  }, [selected, initialOwner, onChange]);

  const { data: userResults = [], isFetching: isSearching } = useQuery({
    queryKey: ['admin-user-search', debouncedLookup],
    queryFn: () => adminApi.searchUsersByPhone(debouncedLookup),
    enabled: tab === 'existing' && debouncedLookup.trim().length >= 3,
  });

  const provisionMutation = useMutation({
    mutationFn: () => adminApi.createStaffUser({ phone: newPhone.trim(), fullName: newFullName.trim() }),
    onSuccess: (user) => {
      setActionError(null);
      setSelected({ userId: user.id, label: user.fullName });
    },
    onError: () => setActionError('Could not provision the account — check the phone number is unique.'),
  });

  const removed = selected.userId === null && !!initialOwner;

  return (
    <div className="rounded-xl border border-slate-200 p-3.5 space-y-2.5 dark:border-slate-800">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-900 dark:text-slate-100 inline-flex items-center gap-1.5">
          <UserRound className="h-3.5 w-3.5 text-primary-600 dark:text-primary-400" /> Brand Owner
        </span>
        <span className="text-[10px] text-slate-400">governs every outlet of this brand</span>
      </div>

      {/* Current / pending selection */}
      <div
        className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
          removed
            ? 'border-rose-200 bg-rose-50/60 dark:border-rose-900/60 dark:bg-rose-950/20'
            : selected.userId
              ? 'border-primary-200 bg-primary-50/50 dark:border-primary-900 dark:bg-primary-950/20'
              : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
        }`}
      >
        <div className="min-w-0">
          {removed ? (
            <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Ownership will be removed</p>
          ) : selected.userId ? (
            <>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{selected.label || 'Selected account'}</p>
              <p className="text-[10px] text-slate-500">
                {selected.userId === initialOwner?.userId ? 'Current owner' : 'New owner on save'}
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-500 italic">No owner assigned — optional</p>
          )}
        </div>
        {(selected.userId || removed) && (
          <button
            type="button"
            onClick={() => setSelected({ userId: null, label: '' })}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors cursor-pointer"
            title={removed ? 'Keep current owner' : 'Remove ownership'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Attach tabs */}
      <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 w-fit">
        {(['existing', 'new'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer ${
              tab === id ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-500'
            }`}
          >
            {id === 'existing' ? 'Existing User' : 'New Account'}
          </button>
        ))}
      </div>

      {tab === 'existing' ? (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search platform users by phone (min 3 digits)..."
              value={lookupPhone}
              onChange={(e) => setLookupPhone(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          {debouncedLookup.trim().length >= 3 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-36 overflow-y-auto">
              {isSearching ? (
                <div className="px-3 py-2 text-[11px] text-slate-400">Searching…</div>
              ) : userResults.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-slate-400 italic">No match — switch to “New Account”.</div>
              ) : (
                userResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setSelected({ userId: user.id, label: user.fullName })}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between cursor-pointer ${
                      selected.userId === user.id
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
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="Owner full name" />
            <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+8801712345678" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500">The account is provisioned now; the owner signs in via OTP later.</p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 h-7 text-xs"
              disabled={!newFullName.trim() || !newPhone.trim()}
              isLoading={provisionMutation.isPending}
              onClick={() => provisionMutation.mutate()}
              leftIcon={<UserRoundPlus className="h-3.5 w-3.5" />}
            >
              Provision & Select
            </Button>
          </div>
        </div>
      )}

      {actionError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{actionError}</p>}
    </div>
  );
};
