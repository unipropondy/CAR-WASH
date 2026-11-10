import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Default LAN configuration for the Car Wash POS & Kiosk backend.
 * Update DEFAULT_LAN_HOST if your PC's local Wi-Fi IPv4 address changes.
 */
export const DEFAULT_BACKEND_PORT = 5000;
export const DEFAULT_LAN_HOST = '192.168.0.128';

/**
 * Determine the correct API base URL based on platform and execution environment.
 * Works seamlessly across:
 * 1. Windows PC Web Browser (localhost / 127.0.0.1)
 * 2. Mobile Phone Browser via Wi-Fi LAN IP (e.g. http://192.168.0.128:8081)
 * 3. Physical Android Mobile Phone via Expo Go / Standalone
 * 4. Android Studio Emulator (10.0.2.2 or LAN IP)
 */
export function getApiBaseUrl(): string {
  // 1. Environment variable override (if configured)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  // 2. Extra configuration in app.json (if configured)
  const extraUrl = Constants.expoConfig?.extra?.apiUrl;
  if (extraUrl && typeof extraUrl === 'string' && extraUrl.trim().length > 0) {
    return extraUrl.trim().replace(/\/+$/, '');
  }

  // 3. Web browser environment
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const hostname = window.location.hostname;
      // When opened on PC via localhost
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
        return `http://localhost:${DEFAULT_BACKEND_PORT}`;
      }
      // When opened on mobile browser (e.g. http://192.168.0.128:8081)
      if (hostname) {
        return `http://${hostname}:${DEFAULT_BACKEND_PORT}`;
      }
    }
    return `http://localhost:${DEFAULT_BACKEND_PORT}`;
  }

  // 4. Native React Native environment (Expo Go or Dev Client on Android/iOS)
  // Expo Constants hostUri contains the IP address of the development machine serving the bundle
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

  // 5. Fallback for physical devices / emulators
  return `http://${DEFAULT_LAN_HOST}:${DEFAULT_BACKEND_PORT}`;
}

export const API_BASE_URL = getApiBaseUrl();

/**
 * Safe fetch with configurable timeout and descriptive error messages.
 */
export async function apiFetch(
  endpointOrUrl: string, 
  options: RequestInit = {}, 
  timeoutMs: number = 12000
): Promise<Response> {
  const baseUrl = getApiBaseUrl();
  const fullUrl = endpointOrUrl.startsWith('http://') || endpointOrUrl.startsWith('https://')
    ? endpointOrUrl
    : `${baseUrl}${endpointOrUrl.startsWith('/') ? '' : '/'}${endpointOrUrl}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(
        `Connection timed out (${timeoutMs / 1000}s) connecting to ${baseUrl}. Verify the backend is running and reachable on this network.`
      );
    }
    const message = error?.message || 'Network request failed';
    throw new Error(
      `Cannot reach backend server (${baseUrl}): ${message}. Check your Wi-Fi connection and backend status.`
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

