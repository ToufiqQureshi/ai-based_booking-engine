// API Client for Hotel Dashboard
// Centralized HTTP client with JWT token management.
//
// SECURITY NOTE: Tokens are currently stored in localStorage which is
// readable by any JavaScript running in the page (i.e. any successful
// XSS attack can steal them). The long-term fix is to switch to
// httpOnly + Secure + SameSite=Strict cookies set by the backend, so
// JavaScript can never read the token. To make that migration easier
// we already pass `credentials: 'include'` on every request — when the
// backend is updated to issue httpOnly cookies (and CORS is tightened
// accordingly), no client change is required. Until then, the localStorage
// token continues to be sent as a Bearer header as a fallback.

import { ApiError, AuthTokens } from '@/types/api';

// Dynamic API URL selection
const getBaseUrl = () => {
  const hostname = window.location.hostname;
  if (hostname.includes('staybooker.ai')) {
    return 'https://api.staybooker.ai/api/v1';
  }
  
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  
  if (hostname.includes('railway.app')) {
    return 'https://ai-basedbooking-engine-production.up.railway.app/api/v1';
  }
  
  // Local development fallback
  return '/api/v1';
};

const API_BASE_URL = getBaseUrl();


// Token storage keys
const ACCESS_TOKEN_KEY = 'hotel_access_token';
const REFRESH_TOKEN_KEY = 'hotel_refresh_token';

// Token management
export const tokenStorage = {
  getAccessToken: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefreshToken: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),

  setTokens: (tokens: AuthTokens): void => {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  },

  clearTokens: (): void => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  hasTokens: (): boolean => !!localStorage.getItem(ACCESS_TOKEN_KEY),
};

// Custom error class for API errors
export class ApiClientError extends Error {
  public status: number;
  public code?: string;
  public field?: string;

  constructor(message: string, status: number, code?: string, field?: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

// Request interceptor to add auth headers
const getHeaders = (customHeaders?: HeadersInit): HeadersInit => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  const token = tokenStorage.getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

// Response handler
const handleResponse = async <T>(response: Response, retryRequest?: () => Promise<Response>): Promise<T> => {
  if (!response.ok) {
    let errorData: ApiError = { detail: 'An error occurred' };

    try {
      errorData = await response.json();
    } catch {
      // Response might not be JSON
    }

    // Handle token expiration
    if (response.status === 401 && retryRequest) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        const retryResponse = await retryRequest();
        return handleResponse<T>(retryResponse);
      } else {
        tokenStorage.clearTokens();
        refreshAttempts = 0;
        window.location.href = '/login';
      }
    }

    // Handle user or hotel deactivation instantly
    if (response.status === 403) {
      if (errorData.detail === 'User is deactivated') {
        window.dispatchEvent(new CustomEvent('user-deactivated'));
      } else if (errorData.detail === 'Hotel is deactivated') {
        window.dispatchEvent(new CustomEvent('hotel-deactivated'));
      }
    }

    throw new ApiClientError(
      errorData.detail || 'Request failed',
      response.status,
      errorData.code,
      errorData.field
    );
  }

  // Handle empty responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
};

// Token refresh logic
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;
let refreshAttempts = 0;
const MAX_REFRESH_ATTEMPTS = 1;

const tryRefreshToken = async (): Promise<boolean> => {
  if (isRefreshing) {
    return refreshPromise!;
  }

  if (refreshAttempts >= MAX_REFRESH_ATTEMPTS) {
    return false;
  }

  isRefreshing = true;
  refreshAttempts++;

  refreshPromise = (async () => {
    try {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase.auth.refreshSession();

      if (error || !data.session) {
        return false;
      }

      tokenStorage.setTokens({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token || '',
        token_type: 'Bearer',
        expires_in: data.session.expires_in || 3600,
      });

      refreshAttempts = 0;
      return true;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

// Main API client
export const apiClient = {
  get: async <T>(endpoint: string, params?: Record<string, string>): Promise<T> => {
    const url = new URL(`${API_BASE_URL}${endpoint}`, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const makeRequest = () => fetch(url.toString(), {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
      signal: controller.signal,
    });

    try {
      const response = await makeRequest();
      clearTimeout(timeoutId);
      return handleResponse<T>(response, makeRequest);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  },

  post: async <T>(endpoint: string, data?: unknown, config?: RequestInit): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const headers = getHeaders(config?.headers);

    // Don't stringify FormData
    const body = data instanceof FormData ? data : (data ? JSON.stringify(data) : undefined);

    // If FormData, remove Content-Type to let browser set boundary
    if (data instanceof FormData) {
      delete (headers as any)['Content-Type'];
    }

    const { headers: _unusedHeaders, ...restConfig } = config || {};

    const makeRequest = () => fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body,
      credentials: 'include',
      signal: controller.signal,
      ...restConfig,
    });

    try {
      const response = await makeRequest();
      clearTimeout(timeoutId);
      return handleResponse<T>(response, makeRequest);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  },

  put: async <T>(endpoint: string, data?: unknown, config?: RequestInit): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const headers = getHeaders(config?.headers);
    const { headers: _unusedHeaders, ...restConfig } = config || {};

    const makeRequest = () => fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
      signal: controller.signal,
      ...restConfig,
    });

    try {
      const response = await makeRequest();
      clearTimeout(timeoutId);
      return handleResponse<T>(response, makeRequest);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  },

  patch: async <T>(endpoint: string, data?: unknown, config?: RequestInit): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const headers = getHeaders(config?.headers);
    const { headers: _unusedHeaders, ...restConfig } = config || {};

    const makeRequest = () => fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PATCH',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      credentials: 'include',
      signal: controller.signal,
      ...restConfig,
    });

    try {
      const response = await makeRequest();
      clearTimeout(timeoutId);
      return handleResponse<T>(response, makeRequest);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  },

  delete: async <T>(endpoint: string): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const makeRequest = () => fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: getHeaders(),
      credentials: 'include',
      signal: controller.signal,
    });

    try {
      const response = await makeRequest();
      clearTimeout(timeoutId);
      return handleResponse<T>(response, makeRequest);
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  },

  // Authenticated file download. A plain <a href> cannot send the Bearer
  // token, so we fetch the blob with auth and trigger a browser download.
  download: async (endpoint: string, fallbackFilename = 'download.csv'): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: getHeaders(),
      credentials: 'include',
    });
    if (!response.ok) {
      throw new ApiClientError('Download failed', response.status);
    }
    // Try to read filename from Content-Disposition
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : fallbackFilename;

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default apiClient;
