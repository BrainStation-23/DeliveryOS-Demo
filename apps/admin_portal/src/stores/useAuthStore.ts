import { create } from 'zustand';
import apiClient, { ADMIN_TOKEN_KEY, ADMIN_REFRESH_KEY, ADMIN_USER_KEY, ensureFreshToken, isTokenExpired } from '../services/apiClient';
import { User, UserRole } from '../types/auth';
import { connectSocket, disconnectSocket } from '../services/socket';

export { ADMIN_TOKEN_KEY, ADMIN_USER_KEY };

const getInitialAdminToken = (): string | null => {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
};

const getInitialAdminUser = (): User | null => {
  try {
    const raw = localStorage.getItem(ADMIN_USER_KEY);
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

const initialToken = getInitialAdminToken();
const initialUser = getInitialAdminUser();

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

      const formattedUser: User = {
        id: userData.id,
        phone: userData.phone,
        email: userData.email,
        fullName: userData.full_name || userData.fullName,
        role: userData.role,
        vendorId: userData.vendorId,
        vendorName: userData.vendorName,
        outletScope: userData.outletScope,
        managedVendorIds: userData.managedVendorIds,
      };

      localStorage.setItem(ADMIN_TOKEN_KEY, accessToken);
      if (refreshToken) {
        localStorage.setItem(ADMIN_REFRESH_KEY, refreshToken);
      }
      localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(formattedUser));

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
    const refreshToken = localStorage.getItem(ADMIN_REFRESH_KEY);
    if (refreshToken) {
      // Revoke server-side; fire-and-forget so logout is instant
      apiClient.post('/api/v1/auth/logout', { refreshToken }).catch(() => undefined);
    }
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_KEY);
    localStorage.removeItem(ADMIN_USER_KEY);
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
