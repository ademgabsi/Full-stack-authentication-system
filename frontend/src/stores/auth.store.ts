import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthUser, UserRole } from '@/types';

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function getRoleFromToken(token: string | null): UserRole | null {
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  return (payload?.role as UserRole) ?? null;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  tempToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  setTempToken: (tempToken: string | null) => void;
  login: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      tempToken: null,
      isAuthenticated: false,
      isAdmin: false,

      setTokens: (accessToken, refreshToken) => {
        set({
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isAdmin: getRoleFromToken(accessToken) === 'admin',
        });
      },

      setUser: (user) => {
        set({ user, isAuthenticated: true, isAdmin: user.role === ('admin' as UserRole) });
      },

      setTempToken: (tempToken) => {
        set({ tempToken });
      },

      login: (accessToken, refreshToken, user) => {
        set({
          accessToken,
          refreshToken,
          user,
          tempToken: null,
          isAuthenticated: true,
          isAdmin: user.role === ('admin' as UserRole),
        });
      },

      logout: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          tempToken: null,
          isAuthenticated: false,
          isAdmin: false,
        });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin,
      }),
    },
  ),
);
