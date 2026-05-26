import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router';
import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';
import { Spinner } from '@/components/ui';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export function AdminGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  const needsRefresh = isAuthenticated && !accessToken;

  useEffect(() => {
    if (!needsRefresh) return;

    let cancelled = false;
    const { login, setAccessToken, logout } = useAuthStore.getState();

    axios
      .post(`${API_BASE_URL}/api/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        if (cancelled) return;
        const data = response.data?.data ?? response.data;
        if (data.user) {
          login(data.accessToken, data.user);
        } else {
          setAccessToken(data.accessToken);
        }
      })
      .catch(() => {
        if (cancelled) return;
        logout();
      });

    return () => {
      cancelled = true;
    };
  }, [needsRefresh]);

  if (needsRefresh) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
