import { create } from 'zustand';
import apiClient, { VENDOR_TOKEN_KEY, VENDOR_REFRESH_KEY, VENDOR_USER_KEY, ensureFreshToken, isTokenExpired } from '../services/apiClient';
import { User, UserRole, PermissionScope } from '../types/auth';
import { connectSocket, disconnectSocket } from '../services/socket';

export { VENDOR_TOKEN_KEY, VENDOR_USER_KEY };

const getInitialVendorToken = (): string | null => {
  try {
    return localStorage.getItem(VENDOR_TOKEN_KEY);
  } catch {
    return null;
  }
};

const getInitialVendorUser = (): User | null => {
  try {
    const raw = localStorage.getItem(VENDOR_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<{ role: UserRole }>;
  logout: () => void;
  initialize: () => void;
}

const initialToken = getInitialVendorToken();
const initialUser = getInitialVendorUser();

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  token: initialToken,
  isAuthenticated: !!initialToken && !!initialUser,
  isLoading: false,

  initialize: () => {
    const { token, user } = get();
    if (!token || !user) return;

    if (isTokenExpired(token)) {
      // Access token expired: rotate silently or end the session
      ensureFreshToken()
        .then((fresh) => {
          if (fresh) {
            set({ token: fresh });
            connectSocket();
          } else {
            get().logout();
          }
        })
        .catch(() => get().logout());
      return;
    }

    connectSocket();
  },

  login: async (phone: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await apiClient.post('/api/v1/auth/otp/verify', {
        phone,
        otp: password,
      });

      const payload = response.data?.data || response.data;
      const accessToken = payload.accessToken || payload.token;
      const refreshToken = payload.refreshToken;
      const userData = payload.user;

      if (!accessToken || !userData) {
        throw new Error('Invalid authentication response structure');
      }

      let vendorId = userData.vendorId;
      let vendorName = userData.vendorName;
      let brandName = userData.brandName ?? null;
      let outletScope = userData.outletScope;
      let managedVendorIds = userData.managedVendorIds;

      if (userData.role === UserRole.VENDOR_ADMIN && !outletScope) {
        try {
          const staffProfileRes = await apiClient.get('/api/v1/vendor/me', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const staffProfile = staffProfileRes.data?.data || staffProfileRes.data;
          if (staffProfile) {
            outletScope = staffProfile.outlet_scope || staffProfile.outletScope || PermissionScope.PARTICULAR_OUTLET;
            vendorId = staffProfile.vendor_id || staffProfile.vendorId;
            vendorName = staffProfile.vendor?.name || staffProfile.vendorName;
            brandName = staffProfile.brandName ?? staffProfile.brand?.name ?? null;
            managedVendorIds = staffProfile.managedVendorIds || (vendorId ? [vendorId] : []);
          }
        } catch {
          outletScope = PermissionScope.PARTICULAR_OUTLET;
        }
      }

      const formattedUser: User = {
        id: userData.id,
        phone: userData.phone,
        email: userData.email,
        fullName: userData.full_name || userData.fullName,
        role: userData.role,
        vendorId,
        vendorName,
        brandName,
        outletScope,
        managedVendorIds,
      };

      localStorage.setItem(VENDOR_TOKEN_KEY, accessToken);
      if (refreshToken) {
        localStorage.setItem(VENDOR_REFRESH_KEY, refreshToken);
      }
      localStorage.setItem(VENDOR_USER_KEY, JSON.stringify(formattedUser));

      set({
        token: accessToken,
        user: formattedUser,
        isAuthenticated: true,
        isLoading: false,
      });

      connectSocket();

      return { role: formattedUser.role };
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    const refreshToken = localStorage.getItem(VENDOR_REFRESH_KEY);
    if (refreshToken) {
      // Revoke server-side; fire-and-forget so logout is instant
      apiClient.post('/api/v1/auth/logout', { refreshToken }).catch(() => undefined);
    }
    localStorage.removeItem(VENDOR_TOKEN_KEY);
    localStorage.removeItem(VENDOR_REFRESH_KEY);
    localStorage.removeItem(VENDOR_USER_KEY);
    try {
      localStorage.removeItem('deliveryos_active_outlet');
    } catch {
      // ignore
    }
    disconnectSocket();
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));

// Initialize socket if already logged in
const state = useAuthStore.getState();
if (state.token && state.user) {
  state.initialize();
}
