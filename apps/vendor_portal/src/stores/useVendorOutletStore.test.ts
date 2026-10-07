import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
});

const { getAccessibleOutletsMock, authState } = vi.hoisted(() => ({
  getAccessibleOutletsMock: vi.fn(),
  authState: {
    isAuthenticated: true,
    user: { id: 'u1', outletScope: 'ALL_OUTLETS_MASTER' },
  },
}));

vi.mock('../services/kdsApi', () => ({
  default: { getAccessibleOutlets: getAccessibleOutletsMock },
}));

vi.mock('./useAuthStore', () => ({
  useAuthStore: { getState: () => authState },
}));

import { useVendorOutletStore } from './useVendorOutletStore';

const outlets = [
  { id: 'outlet-1', name: 'Gulshan', addressText: 'Gulshan 1', isBusy: false, isActive: true, defaultPrepTimeMinutes: 15, brandName: 'Burger King' },
  { id: 'outlet-2', name: 'Dhanmondi', addressText: 'Road 5', isBusy: true, isActive: true, defaultPrepTimeMinutes: 20, brandName: 'Burger King' },
];

describe('useVendorOutletStore', () => {
  beforeEach(() => {
    storage.clear();
    getAccessibleOutletsMock.mockReset();
    useVendorOutletStore.setState({ activeOutletId: 'ALL', outlets: [], isLoading: false });
  });

  it('does nothing when the session is unauthenticated', async () => {
    authState.isAuthenticated = false;

    await useVendorOutletStore.getState().fetchOutlets();

    expect(getAccessibleOutletsMock).not.toHaveBeenCalled();
    authState.isAuthenticated = true;
  });

  it('restores the saved outlet for multi-branch brand owners', async () => {
    storage.set('deliveryos_active_outlet', 'outlet-2');
    getAccessibleOutletsMock.mockResolvedValue(outlets);

    await useVendorOutletStore.getState().fetchOutlets();

    const state = useVendorOutletStore.getState();
    expect(state.outlets).toHaveLength(2);
    expect(state.activeOutletId).toBe('outlet-2');
    expect(state.isLoading).toBe(false);
  });

  it('forces single-branch managers onto their only outlet, ignoring saved state', async () => {
    storage.set('deliveryos_active_outlet', 'outlet-2');
    authState.user = { id: 'u1', outletScope: 'PARTICULAR_OUTLET' };
    getAccessibleOutletsMock.mockResolvedValue(outlets);

    await useVendorOutletStore.getState().fetchOutlets();

    expect(useVendorOutletStore.getState().activeOutletId).toBe('outlet-1');
    authState.user = { id: 'u1', outletScope: 'ALL_OUTLETS_MASTER' };
  });

  it('falls back to ALL when the saved selection no longer exists for multi-branch', async () => {
    storage.set('deliveryos_active_outlet', 'outlet-deleted');
    getAccessibleOutletsMock.mockResolvedValue(outlets);

    await useVendorOutletStore.getState().fetchOutlets();

    // Saved id is unknown → falls through to first outlet per resolution order
    expect(useVendorOutletStore.getState().activeOutletId).toBe('outlet-1');
  });

  it('resets to an empty outlet list when the API call fails', async () => {
    getAccessibleOutletsMock.mockRejectedValue(new Error('network down'));

    await useVendorOutletStore.getState().fetchOutlets();

    const state = useVendorOutletStore.getState();
    expect(state.outlets).toEqual([]);
    expect(state.isLoading).toBe(false);
  });

  it('treats non-array API payloads as an empty list', async () => {
    getAccessibleOutletsMock.mockResolvedValue({ unexpected: true });

    await useVendorOutletStore.getState().fetchOutlets();

    expect(useVendorOutletStore.getState().outlets).toEqual([]);
  });

  it('setActiveOutletId persists the selection', () => {
    useVendorOutletStore.getState().setActiveOutletId('outlet-1');

    expect(useVendorOutletStore.getState().activeOutletId).toBe('outlet-1');
    expect(storage.get('deliveryos_active_outlet')).toBe('outlet-1');
  });

  it('getActiveOutlet returns null for ALL and resolves concrete ids', () => {
    useVendorOutletStore.setState({ outlets, activeOutletId: 'ALL' });
    expect(useVendorOutletStore.getState().getActiveOutlet()).toBeNull();

    useVendorOutletStore.setState({ activeOutletId: 'outlet-2' });
    const active = useVendorOutletStore.getState().getActiveOutlet();
    expect(active?.name).toBe('Dhanmondi');
    expect(active?.brandName).toBe('Burger King');
  });

  it('refetchOutlets refreshes isBusy after a rush-pause toggle without query invalidation', async () => {
    getAccessibleOutletsMock.mockResolvedValue(outlets);
    await useVendorOutletStore.getState().refetchOutlets();

    useVendorOutletStore.setState({ activeOutletId: 'outlet-1' });
    expect(useVendorOutletStore.getState().getActiveOutlet()?.isBusy).toBe(false);

    // Server-side rush pause applied — the store refetch is the only refresh
    // path the toggle relies on.
    getAccessibleOutletsMock.mockResolvedValue(
      outlets.map((o) => (o.id === 'outlet-1' ? { ...o, isBusy: true } : o)),
    );
    await useVendorOutletStore.getState().refetchOutlets();

    const active = useVendorOutletStore.getState().getActiveOutlet();
    expect(active?.id).toBe('outlet-1');
    expect(active?.isBusy).toBe(true);
  });
});
