import { create } from 'zustand';
import kdsApi from '../services/kdsApi';
import { PermissionScope } from '../types/auth';
import { useAuthStore } from './useAuthStore';

export interface AccessibleOutlet {
  id: string;
  name: string;
  addressText: string;
  isBusy: boolean;
  isActive: boolean;
  defaultPrepTimeMinutes: number;
  brandId?: string | null;
  brandName?: string | null;
}

export interface VendorOutletState {
  activeOutletId: string;
  outlets: AccessibleOutlet[];
  isLoading: boolean;
  setActiveOutletId: (id: string) => void;
  fetchOutlets: () => Promise<void>;
  refetchOutlets: () => Promise<void>;
  getActiveOutlet: () => AccessibleOutlet | null;
  reset: () => void;
}

const getSavedActiveOutlet = (): string => {
  try {
    return localStorage.getItem('deliveryos_active_outlet') || 'ALL';
  } catch {
    return 'ALL';
  }
};

export const useVendorOutletStore = create<VendorOutletState>((set, get) => ({
  activeOutletId: getSavedActiveOutlet(),
  outlets: [],
  isLoading: false,

  reset: () => {
    try {
      localStorage.removeItem('deliveryos_active_outlet');
    } catch {
      // ignore
    }
    set({ activeOutletId: 'ALL', outlets: [], isLoading: false });
  },

  setActiveOutletId: (id: string) => {
    localStorage.setItem('deliveryos_active_outlet', id);
    set({ activeOutletId: id });
  },

  getActiveOutlet: () => {
    const { activeOutletId, outlets } = get();
    if (!activeOutletId || activeOutletId === 'ALL') return null;
    return outlets.find((o) => o.id === activeOutletId) || null;
  },

  fetchOutlets: async () => {
    const authState = useAuthStore.getState();
    if (!authState.isAuthenticated) return;

    set({ isLoading: true });
    try {
      const data = await kdsApi.getAccessibleOutlets();
      const safeData = Array.isArray(data) ? data : [];
      set({ outlets: safeData });

      const isMultiBranch = authState.user?.outletScope === PermissionScope.ALL_OUTLETS_MASTER;
      const savedOutlet = localStorage.getItem('deliveryos_active_outlet');

      let targetOutletId = 'ALL';
      if (!isMultiBranch && safeData.length > 0) {
        targetOutletId = safeData[0].id;
      } else if (savedOutlet && (savedOutlet === 'ALL' || safeData.some((o) => o.id === savedOutlet))) {
        targetOutletId = savedOutlet;
      } else if (safeData.length > 0) {
        targetOutletId = safeData[0].id;
      }

      set({ activeOutletId: targetOutletId, isLoading: false });
      localStorage.setItem('deliveryos_active_outlet', targetOutletId);
    } catch (err) {
      console.error('Failed to load accessible outlets in store:', err);
      set({ outlets: [], isLoading: false });
    }
  },

  refetchOutlets: async () => {
    await get().fetchOutlets();
  },
}));
