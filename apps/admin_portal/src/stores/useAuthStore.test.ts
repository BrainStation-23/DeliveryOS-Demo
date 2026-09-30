import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => void storage.set(key, value),
  removeItem: (key: string) => void storage.delete(key),
  clear: () => storage.clear(),
});

const { postMock, connectSocketMock, disconnectSocketMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  connectSocketMock: vi.fn(),
  disconnectSocketMock: vi.fn(),
}));

vi.mock('../services/apiClient', () => ({
  default: { post: postMock },
  ADMIN_TOKEN_KEY: 'deliveryos_admin_token',
  ADMIN_REFRESH_KEY: 'deliveryos_admin_refresh',
  ADMIN_USER_KEY: 'deliveryos_admin_user',
  ensureFreshToken: vi.fn().mockResolvedValue(null),
  isTokenExpired: vi.fn().mockReturnValue(false),
}));

vi.mock('../services/socket', () => ({
  connectSocket: connectSocketMock,
  disconnectSocket: disconnectSocketMock,
}));

import { useAuthStore } from './useAuthStore';

const authPayload = {
  data: {
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    user: {
      id: 'user-1',
      phone: '+8801700000001',
      full_name: 'Tariqul Islam',
      role: 'SUPER_ADMIN',
    },
  },
};

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    postMock.mockReset();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
    vi.clearAllMocks();
  });

  it('login persists tokens + user and flips authentication state', async () => {
    postMock.mockResolvedValue(authPayload);

    const result = await useAuthStore.getState().login('+8801700000001', '123456');

    expect(result).toEqual({ role: 'SUPER_ADMIN' });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.token).toBe('access-token-1');
    expect(state.user).toMatchObject({ id: 'user-1', role: 'SUPER_ADMIN' });
    expect(localStorage.getItem('deliveryos_admin_token')).toBe('access-token-1');
    expect(localStorage.getItem('deliveryos_admin_refresh')).toBe('refresh-token-1');
    expect(connectSocketMock).toHaveBeenCalledTimes(1);
  });

  it('login rejects malformed authentication payloads without persisting state', async () => {
    postMock.mockResolvedValue({ data: { data: {} } });

    await expect(
      useAuthStore.getState().login('+8801700000001', '123456'),
    ).rejects.toThrow(/Invalid authentication response/);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(localStorage.getItem('deliveryos_admin_token')).toBeNull();
  });

  it('login resets isLoading and rethrows on API failure', async () => {
    postMock.mockRejectedValue(new Error('Invalid or expired OTP code'));

    await expect(useAuthStore.getState().login('+8801700000001', '000000')).rejects.toThrow(
      'Invalid or expired OTP code',
    );
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it('logout revokes the refresh token, clears storage, and disconnects the socket', async () => {
    postMock.mockResolvedValue(authPayload);
    await useAuthStore.getState().login('+8801700000001', '123456');

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(localStorage.getItem('deliveryos_admin_token')).toBeNull();
    expect(localStorage.getItem('deliveryos_admin_user')).toBeNull();
    expect(postMock).toHaveBeenCalledWith('/api/v1/auth/logout', { refreshToken: 'refresh-token-1' });
    expect(disconnectSocketMock).toHaveBeenCalledTimes(1);
  });

  it('logout works even when no refresh token was stored', () => {
    expect(() => useAuthStore.getState().logout()).not.toThrow();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
