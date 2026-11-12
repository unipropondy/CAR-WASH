import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * RedBay Car Wash POS & Kiosk - Centralized API Configuration
 * Production URL: https://car-wash.up.railway.app (Railway Public HTTPS)
 * Works on:
 *   - Android APK (any Wi-Fi or mobile data)
 *   - Web browser (HTTPS)
 *   - Local Development
 */

export const DEFAULT_BACKEND_PORT = 5000;
export const STORAGE_CUSTOM_API_KEY = '@redbay_custom_api_url';

// ===========================================================================
// PRODUCTION BACKEND URL — Railway Public HTTPS (no port needed)
// ===========================================================================
export const PRODUCTION_API_URL = 'https://car-wash.up.railway.app';

/**
 * Normalizes URL with protocol (http:// or https://)
 * Never appends :5000 to HTTPS Railway public URLs — Railway handles that.
 */
export function normalizeApiUrl(rawUrl: string): string {
  let clean = rawUrl.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `https://${clean}`;
  }
  // NEVER append port to public Railway HTTPS URLs (.up.railway.app)
  if (clean.includes('.up.railway.app')) {
    // Strip any stray port that may have been appended
    clean = clean.replace(/:\d+$/, '');
    return clean;
  }
  // For railway.internal (private), use port 5000
  if (clean.includes('.railway.internal') && !clean.match(/:\d+$/)) {
    clean = `${clean}:${DEFAULT_BACKEND_PORT}`;
  }
  return clean;
}

// Runtime in-memory override cache
let customApiBaseUrl: string | null = null;

// Initialize custom URL from localStorage on Web if available
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
  try {
    const saved = window.localStorage.getItem(STORAGE_CUSTOM_API_KEY);
    if (saved && saved.trim().length > 0) {
      customApiBaseUrl = normalizeApiUrl(saved);
    }
  } catch (e) {
    // Ignore localStorage access restrictions
  }
}

/**
 * Retrieve user/admin custom configured backend URL override
 */
export function getCustomApiBaseUrl(): string | null {
  return customApiBaseUrl;
}

/**
 * Set custom backend URL at runtime (e.g. from POS Settings or Diagnostics screen)
 */
export function setCustomApiBaseUrl(url: string | null): void {
  if (url && url.trim().length > 0) {
    const cleanUrl = normalizeApiUrl(url);
    customApiBaseUrl = cleanUrl;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_CUSTOM_API_KEY, cleanUrl);
      } catch (e) {}
    }
  } else {
    customApiBaseUrl = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(STORAGE_CUSTOM_API_KEY);
      } catch (e) {}
    }
  }
}

/**
 * Determine the correct API base URL dynamically based on environment.
 *
 * Evaluation Order:
 * 1. Runtime Custom API URL Override (Settings / Diagnostics)
 * 2. Environment Variable `EXPO_PUBLIC_API_URL` (from .env or build pipeline)
 * 3. Expo Constants `Constants.expoConfig?.extra?.apiUrl` (app.json)
 * 4. Web Browser dynamic origin detection (HTTPS production)
 * 5. Local development fallback
 * 6. PRODUCTION_API_URL safe default (Railway public HTTPS)
 */
export function getApiBaseUrl(): string {
  // 1. Runtime custom override (from POS Settings screen)
  if (customApiBaseUrl && customApiBaseUrl.trim().length > 0) {
    return normalizeApiUrl(customApiBaseUrl);
  }

  // 2. Environment variable (highest priority for production builds)
  const envApiUrl = (process.env as any)?.EXPO_PUBLIC_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim().length > 0) {
    const envUrl = envApiUrl.trim();
    if (envUrl !== 'http://' && envUrl !== 'https://' && !envUrl.includes('railway.internal')) {
      return normalizeApiUrl(envUrl);
    }
  }

  // 3. Extra configuration in app.json (if set and non-empty, non-internal)
  const extraUrl = Constants.expoConfig?.extra?.apiUrl;
  if (
    extraUrl &&
    typeof extraUrl === 'string' &&
    extraUrl.trim().length > 0 &&
    !extraUrl.includes('railway.internal')
  ) {
    return normalizeApiUrl(extraUrl);
  }

  // 4. Web browser environment: use current browser host (production HTTPS)
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const { protocol, hostname, port } = window.location;

      // Production web served over HTTPS
      if (protocol === 'https:') {
        return `https://${hostname}${port && port !== '443' ? `:${port}` : ''}`;
      }

      // Local development on PC
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
        return `http://localhost:${DEFAULT_BACKEND_PORT}`;
      }

      // LAN / custom domain via HTTP
      if (hostname) {
        return `http://${hostname}:${DEFAULT_BACKEND_PORT}`;
      }
    }
    // Web fallback: production URL
    return PRODUCTION_API_URL;
  }

  // 5. Native React Native Expo Go / Dev Client: auto-detect dev machine
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
    (Constants as any).manifest?.debuggerHost;

  if (hostUri && typeof hostUri === 'string') {
    const devMachineIp = hostUri.split(':')[0];
    if (devMachineIp && devMachineIp !== 'localhost' && devMachineIp !== '127.0.0.1') {
      return `http://${devMachineIp}:${DEFAULT_BACKEND_PORT}`;
    }
  }

  // 6. Final safe production fallback — Railway Public HTTPS
  // This is what Android APK production builds use when env vars are baked in
  return PRODUCTION_API_URL;
}

export const API_BASE_URL = getApiBaseUrl();

export interface BackendHealthResult {
  ok: boolean;
  status: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  url: string;
  latencyMs: number;
  database?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Ping backend health endpoint to verify connectivity.
 */
export async function checkBackendHealth(targetBaseUrl?: string): Promise<BackendHealthResult> {
  const baseUrl = (targetBaseUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const testUrl = `${baseUrl}/api/health`;
  const startTime = Date.now();

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 8000) : null;

  try {
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller?.signal,
    });
    if (timeoutId) clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: true,
        status: data.database === 'CONNECTED' ? 'ONLINE' : 'DEGRADED',
        url: baseUrl,
        latencyMs,
        database: data.database || 'UNKNOWN',
        timestamp: data.timestamp || new Date().toISOString(),
      };
    } else {
      return {
        ok: false,
        status: 'OFFLINE',
        url: baseUrl,
        latencyMs,
        error: `HTTP ${res.status}: ${res.statusText || 'Server Error'}`,
      };
    }
  } catch (err: any) {
    if (timeoutId) clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    const isTimeout = err?.name === 'AbortError';
    return {
      ok: false,
      status: 'OFFLINE',
      url: baseUrl,
      latencyMs,
      error: isTimeout
        ? 'Connection timed out after 8 seconds'
        : err?.message || 'Network unreachable',
    };
  }
}

/**
 * Universal safe fetch with configurable timeout, centralized URL resolution.
 */
export async function apiFetch(
  endpointOrUrl: string,
  options: RequestInit = {},
  timeoutMs: number = 20000
): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const fullUrl = endpointOrUrl.startsWith('http://') || endpointOrUrl.startsWith('https://')
    ? endpointOrUrl
    : `${baseUrl}${endpointOrUrl.startsWith('/') ? '' : '/'}${endpointOrUrl}`;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const response = await fetch(fullUrl, {
      ...options,
      headers,
      signal: controller?.signal,
    });

    return response;
  } catch (error: any) {
    const isTimeout = error?.name === 'AbortError';

    // Check if client is entirely offline (Web)
    const isOffline = Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.onLine === false;
    if (isOffline) {
      throw new Error(
        'No internet connection detected on this device. Please check your network and tap Retry.'
      );
    }

    if (isTimeout) {
      throw new Error(
        `Connection timed out (${Math.round(timeoutMs / 1000)}s) connecting to backend. Verify the server is running.`
      );
    }

    const message = error?.message || 'Network request failed';
    throw new Error(
      `Cannot reach backend server (${baseUrl}): ${message}. Verify server status and internet connection.`
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
