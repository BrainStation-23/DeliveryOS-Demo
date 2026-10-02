import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
});

const { postMock, getMock, connectSocketMock, disconnectSocketMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  getMock: vi.fn(),
  connectSocketMock: vi.fn(),
  disconnectSocketMock: vi.fn(),
}));

vi.mock('../services/apiClient', () => ({
  default: { post: postMock, get: getMock },
  VENDOR_TOKEN_KEY: 'deliveryos_vendor_token',
  VENDOR_REFRESH_KEY: 'deliveryos_vendor_refresh',
  VENDOR_USER_KEY: 'deliveryos_vendor_user',
  ensureFreshToken: vi.fn().mockResolvedValue(null),
  isTokenExpired: vi.fn().mockReturnValue(false),
}));

vi.mock('../services/socket', () => ({
  connectSocket: connectSocketMock,
  disconnectSocket: disconnectSocketMock,
}));

import { useAuthStore } from './useAuthStore';
import { UserRole } from '../types/auth';

const authPayload = {
  data: {
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    user: {
      id: 'vendor-user-1',
      phone: '+8801700000001',
      full_name: 'Store Manager',
      role: UserRole.VENDOR_ADMIN,
      vendorId: 'vendor-1',
    },
  },
};

describe('useAuthStore', () => {
  beforeEach(() => {
    storage.clear();
    postMock.mockReset();
    getMock.mockReset();
    connectSocketMock.mockReset();
    disconnectSocketMock.mockReset();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
    vi.clearAllMocks();
  });

  it('login persists tokens + user and flips authentication state', async () => {
    postMock.mockResolvedValue(authPayload);

    const result = await useAuthStore.getState().login('+8801700000001', '123456');

    expect(result).toEqual({ role: UserRole.VENDOR_ADMIN });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.fullName).toBe('Store Manager');
    expect(storage.get('deliveryos_vendor_token')).toBe('access-token-1');
    expect(storage.get('deliveryos_vendor_refresh')).toBe('refresh-token-1');
    expect(connectSocketMock).toHaveBeenCalled();
  });

  it('logout revokes refresh token, clears storage including active outlet, and disconnects socket', async () => {
    storage.set('deliveryos_vendor_token', 'token-123');
    storage.set('deliveryos_vendor_refresh', 'refresh-token-1');
    storage.set('deliveryos_vendor_user', JSON.stringify({ id: 'u1' }));
    storage.set('deliveryos_active_outlet', 'outlet-1');

    useAuthStore.setState({
      token: 'token-123',
      user: { id: 'u1', fullName: 'Manager' } as any,
      isAuthenticated: true,
    });

    postMock.mockResolvedValue({});

    useAuthStore.getState().logout();

    expect(storage.get('deliveryos_vendor_token')).toBeUndefined();
    expect(storage.get('deliveryos_vendor_refresh')).toBeUndefined();
    expect(storage.get('deliveryos_vendor_user')).toBeUndefined();
    expect(storage.get('deliveryos_active_outlet')).toBeUndefined();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(disconnectSocketMock).toHaveBeenCalled();
    expect(postMock).toHaveBeenCalledWith('/api/v1/auth/logout', { refreshToken: 'refresh-token-1' });
  });

  it('logout succeeds even when no refresh token was present', () => {
    expect(() => useAuthStore.getState().logout()).not.toThrow();
  });
});
