import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * RedBay Car Wash POS & Kiosk - Centralized API Configuration
 * Supports ALL Internet Networks:
 *   - Local Development (PC localhost / 127.0.0.1)
 *   - Office / Branch Local Area Networks (LAN)
 *   - Mobile Data (4G / 5G cellular)
 *   - Remote / Cloud Hosted HTTPS servers (AWS, DigitalOcean, Railway, etc.)
 *   - Native Android APK & Web deployments
 */

export const DEFAULT_BACKEND_PORT = 5000;
export const STORAGE_CUSTOM_API_KEY = '@redbay_custom_api_url';

/**
 * Normalizes URL with protocol (http:// or https://) and defaults
 * Railway private internal networking (.railway.internal) to backend port 5000 if not specified.
 */
export function normalizeApiUrl(rawUrl: string): string {
  let clean = rawUrl.trim().replace(/\/+$/, '');
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = `http://${clean}`;
  }
  // If railway.internal domain without port, append :DEFAULT_BACKEND_PORT (5000)
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
 * Determine the correct API base URL dynamically based on environment,
 * network configuration, and device platform.
 *
 * Evaluation Order:
 * 1. Runtime Custom API URL Override (Settings / Diagnostics)
 * 2. Environment Variable `EXPO_PUBLIC_API_URL` (from .env or build pipeline)
 * 3. Expo Constants `Constants.expoConfig?.extra?.apiUrl` (app.json)
 * 4. Web Browser dynamic origin detection (preserves HTTPS / hostname)
 * 5. Native Expo Go / Dev Client packager host auto-detection
 * 6. Safe Default Fallback
 */
export function getApiBaseUrl(): string {
  // 1. Runtime custom override
  if (customApiBaseUrl && customApiBaseUrl.trim().length > 0) {
    return normalizeApiUrl(customApiBaseUrl);
  }

  // 2. Environment variable override (preferred for modern Expo 51+ builds)
  const envApiUrl = (process.env as any)?.EXPO_PUBLIC_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim().length > 0) {
    const envUrl = envApiUrl.trim();
    if (envUrl !== 'http://' && envUrl !== 'https://') {
      return normalizeApiUrl(envUrl);
    }
  }

  // 3. Extra configuration in app.json (if explicitly set and non-empty)
  const extraUrl = Constants.expoConfig?.extra?.apiUrl;
  if (extraUrl && typeof extraUrl === 'string' && extraUrl.trim().length > 0) {
    return normalizeApiUrl(extraUrl);
  }

  // 4. Web browser environment: dynamically use current browser host
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const { protocol, hostname, port } = window.location;

      // In production web served over HTTPS: must use HTTPS to avoid Mixed Content blocks
      if (protocol === 'https:') {
        return `https://${hostname}${port && port !== '443' ? `:${port}` : ''}`;
      }

      // Local development on PC
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
        return `http://localhost:${DEFAULT_BACKEND_PORT}`;
      }

      // Accessed over LAN / custom domain via HTTP (e.g. tablet accessing dev server)
      if (hostname) {
        return `http://${hostname}:${DEFAULT_BACKEND_PORT}`;
      }
    }
    return `http://car-wash.railway.internal:${DEFAULT_BACKEND_PORT}`;
  }

  // 5. Native React Native environment (Expo Go / Dev Client on Android/iOS)
  // Automatically detects the dev machine serving the Metro bundle across ANY Wi-Fi or hotspot
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

  // 6. Safe default fallback for emulators & Railway private mesh
  return `http://car-wash.railway.internal:${DEFAULT_BACKEND_PORT}`;
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
 * Ping backend health endpoint to verify connectivity across any network.
 */
export async function checkBackendHealth(targetBaseUrl?: string): Promise<BackendHealthResult> {
  const baseUrl = (targetBaseUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const testUrl = `${baseUrl}/api/health`;
  const startTime = Date.now();

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 6000) : null;

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
        ? 'Connection timed out after 6 seconds'
        : err?.message || 'Network unreachable',
    };
  }
}

/**
 * Universal safe fetch with configurable timeout, centralized URL resolution,
 * and clear, actionable network error messages.
 */
export async function apiFetch(
  endpointOrUrl: string, 
  options: RequestInit = {}, 
  timeoutMs: number = 15000
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
        `Connection timed out (${Math.round(timeoutMs / 1000)}s) connecting to ${baseUrl}. Verify the backend server is running and reachable.`
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
