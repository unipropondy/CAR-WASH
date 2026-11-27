import { create } from 'zustand';
import { Platform } from 'react-native';
import { AuthenticatedUser } from '../../../types/auth.types';

export const AUTH_USER_KEY = 'redbay_authenticated_user';
export const AUTH_TOKEN_KEY = 'redbay_auth_token';

interface AuthState {
  user: AuthenticatedUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: AuthenticatedUser, token?: string) => void;
  logout: () => void;
  loadStoredSession: () => void;
}

/**
 * Validates JWT token structure and expiration
 */
export function isTokenValid(token: string | null): boolean {
  if (!token || typeof token !== 'string' || token.trim().length === 0) {
    return false;
  }
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    if (decoded && decoded.exp) {
      const isExpired = Date.now() >= decoded.exp * 1000;
      if (isExpired) return false;
    }
    return true;
  } catch {
    return false;
  }
}

const getStoredAuthState = () => {
  if (Platform.OS === 'web') {
    try {
      // Clear any legacy persistent authentication from localStorage to ensure
      // fresh links always require the user to sign in
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }

      if (typeof sessionStorage !== 'undefined') {
        const storedUser = sessionStorage.getItem(AUTH_USER_KEY);
        const storedToken = sessionStorage.getItem(AUTH_TOKEN_KEY);
        if (storedUser && storedToken && isTokenValid(storedToken)) {
          const user = JSON.parse(storedUser) as AuthenticatedUser;
          return { user, token: storedToken, isAuthenticated: true };
        }
        // If token is missing, expired, or invalid, clear sessionStorage
        sessionStorage.removeItem(AUTH_USER_KEY);
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch (e) {
      console.warn('Failed to load initial session from storage', e);
    }
  }
  return { user: null, token: null, isAuthenticated: false };
};

const initialAuth = getStoredAuthState();

export const useAuthStore = create<AuthState>((set) => ({
  user: initialAuth.user,
  token: initialAuth.token,
  isAuthenticated: initialAuth.isAuthenticated,

  setUser: (user: AuthenticatedUser, token?: string) => {
    const valid = isTokenValid(token || null);
    if (Platform.OS === 'web') {
      try {
        if (typeof sessionStorage !== 'undefined') {
          if (valid && token) {
            sessionStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
            sessionStorage.setItem(AUTH_TOKEN_KEY, token);
          } else {
            sessionStorage.removeItem(AUTH_USER_KEY);
            sessionStorage.removeItem(AUTH_TOKEN_KEY);
          }
        }
        // Always ensure persistent localStorage does not hold sensitive tokens
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(AUTH_USER_KEY);
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      } catch (e) {
        console.warn('Failed to persist session to sessionStorage', e);
      }
    }
    set({ user: valid ? user : null, token: valid ? (token || null) : null, isAuthenticated: valid });
  },

  logout: () => {
    if (Platform.OS === 'web') {
      try {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(AUTH_USER_KEY);
          sessionStorage.removeItem(AUTH_TOKEN_KEY);
        }
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(AUTH_USER_KEY);
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
      } catch (e) {
        console.warn('Failed to clear session from storage', e);
      }
    }
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadStoredSession: () => {
    const stored = getStoredAuthState();
    set(stored);
  },
}));
