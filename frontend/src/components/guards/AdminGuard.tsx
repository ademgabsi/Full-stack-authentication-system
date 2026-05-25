import { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/api/auth.api';
import { Spinner } from '@/components/ui';

export function AdminGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const accessToken = useAuthStore((s) => s.accessToken);
  const location = useLocation();

  const [refreshing, setRefreshing] = useState(
    isAuthenticated && !accessToken,
  );

  useEffect(() => {
    if (!isAuthenticated || accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRefreshing(false);
      return;
    }

    let cancelled = false;
    const { login, setAccessToken, logout } = useAuthStore.getState();

    authApi
      .refreshToken()
      .then((data) => {
        if (cancelled) return;
        if (data.user) {
          login(data.accessToken, data.user);
        } else {
          setAccessToken(data.accessToken);
        }
        setRefreshing(false);
      })
      .catch(() => {
        if (cancelled) return;
        logout();
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken]);

  if (refreshing) {
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
