import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '@/stores/auth.store';
import { act } from '@testing-library/react';

const makePayload = (sub = 'user-1', email = 'test@example.com', role = 'user') => {
  const payload = { sub, email, role };
  const base64 = btoa(JSON.stringify(payload));
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  return `${header}.${base64}.signature`;
};

describe('useAuthStore', () => {
  beforeEach(() => {
    act(() => {
      useAuthStore.getState().logout();
    });
  });

  it('should initialize with default state', () => {
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isAdmin).toBe(false);
  });

  it('should set access token and authentication state', () => {
    const token = makePayload('user-1', 'test@example.com', 'user');

    act(() => {
      useAuthStore.getState().setAccessToken(token);
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(token);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isAdmin).toBe(false);
  });

  it('should detect admin role from token', () => {
    const token = makePayload('admin-1', 'admin@example.com', 'admin');

    act(() => {
      useAuthStore.getState().setAccessToken(token);
    });

    expect(useAuthStore.getState().isAdmin).toBe(true);
  });

  it('should handle setUser for admin role', () => {
    act(() => {
      useAuthStore.getState().setUser({
        id: 'admin-1',
        email: 'admin@example.com',
        fullName: 'Admin',
        role: 'admin',
        mfaEnabled: false,
        image: null,
      });
    });

    expect(useAuthStore.getState().isAdmin).toBe(true);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should handle login action', () => {
    const token = makePayload('user-1', 'test@example.com', 'user');

    act(() => {
      useAuthStore.getState().login(token, {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        role: 'user',
        mfaEnabled: true,
        image: null,
      });
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(token);
    expect(state.user?.email).toBe('test@example.com');
    expect(state.isAuthenticated).toBe(true);
  });

  it('should handle logout', () => {
    act(() => {
      useAuthStore.getState().setAccessToken(makePayload());
    });

    act(() => {
      useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('should handle setUser for regular user', () => {
    act(() => {
      useAuthStore.getState().setUser({
        id: 'user-1',
        email: 'user@example.com',
        fullName: 'User',
        role: 'user',
        mfaEnabled: true,
        image: null,
      });
    });

    expect(useAuthStore.getState().isAdmin).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});
