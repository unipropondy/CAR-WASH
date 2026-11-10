import { create } from 'zustand';
import { Platform } from 'react-native';
import { AuthenticatedUser } from '../../../types/auth.types';

const AUTH_USER_KEY = 'redbay_authenticated_user';
const AUTH_TOKEN_KEY = 'redbay_auth_token';

interface AuthState {
  user: AuthenticatedUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setUser: (user: AuthenticatedUser, token?: string) => void;
  logout: () => void;
  loadStoredSession: () => void;
}

const getStoredAuthState = () => {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    try {
      const storedUser = localStorage.getItem(AUTH_USER_KEY);
      const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
      if (storedUser) {
        const user = JSON.parse(storedUser) as AuthenticatedUser;
        return { user, token: storedToken || null, isAuthenticated: true };
      }
    } catch (e) {
      console.warn('Failed to load initial session from localStorage', e);
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
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
        if (token) {
          localStorage.setItem(AUTH_TOKEN_KEY, token);
        }
      } catch (e) {
        console.warn('Failed to persist session to localStorage', e);
      }
    }
    set({ user, token: token || null, isAuthenticated: true });
  },

  logout: () => {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_TOKEN_KEY);
      } catch (e) {
        console.warn('Failed to clear session from localStorage', e);
      }
    }
    set({ user: null, token: null, isAuthenticated: false });
  },

  loadStoredSession: () => {
    const stored = getStoredAuthState();
    if (stored.isAuthenticated) {
      set(stored);
    }
  },
}));
