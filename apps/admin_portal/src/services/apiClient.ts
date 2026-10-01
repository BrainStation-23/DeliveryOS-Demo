import axios, { AxiosError, AxiosRequestConfig } from 'axios';

export const ADMIN_TOKEN_KEY = 'deliveryos_admin_token';
export const ADMIN_REFRESH_KEY = 'deliveryos_admin_refresh';
export const ADMIN_USER_KEY = 'deliveryos_admin_user';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to requests
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function clearSessionAndRedirect(): void {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_REFRESH_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
  if (!window.location.pathname.includes('/login')) {
    window.location.href = '/login';
  }
}

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1])) as { exp?: number };
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

let refreshInProgress: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(ADMIN_REFRESH_KEY);
  if (!refreshToken) return null;
  try {
    const baseUrl = apiClient.defaults.baseURL || '';
    const res = await axios.post(`${baseUrl}/api/v1/auth/refresh`, { refreshToken });
    const payload = res.data?.data || res.data;
    if (!payload?.accessToken || !payload?.refreshToken) return null;
    localStorage.setItem(ADMIN_TOKEN_KEY, payload.accessToken);
    localStorage.setItem(ADMIN_REFRESH_KEY, payload.refreshToken);
    return payload.accessToken as string;
  } catch {
    return null;
  }
}

/** Silently rotate the session if the access token is expired; returns the live token or null. */
export async function ensureFreshToken(): Promise<string | null> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  if (token && !isTokenExpired(token)) return token;
  return refreshAccessToken();
}

// Handle 401: single-flight refresh, replay the original request once
apiClient.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
  const isAuthRoute = original?.url?.includes('/auth/');
  const canRefresh = error.response?.status === 401 && original && !original._retried && !isAuthRoute;

  if (canRefresh) {
    original._retried = true;
    refreshInProgress =
      refreshInProgress ||
      refreshAccessToken().finally(() => {
        refreshInProgress = null;
      });
    const newToken = await refreshInProgress;
    if (newToken) {
      if (original.headers) {
        original.headers.Authorization = `Bearer ${newToken}`;
      } else {
        original.headers = { Authorization: `Bearer ${newToken}` };
      }
      return apiClient(original);
    }
    clearSessionAndRedirect();
  } else if (error.response?.status === 401 && (!original || original._retried || isAuthRoute)) {
    clearSessionAndRedirect();
  }

  return Promise.reject(error);
});

export default apiClient;
