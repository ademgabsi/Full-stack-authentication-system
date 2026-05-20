import { useEffect, useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/api/auth.api';
import { Spinner } from '@/components/ui';

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const login = useAuthStore((s) => s.login);
  const setAccessToken = useAuthStore((s) => s.setAccessToken);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();

  const [refreshing, setRefreshing] = useState(
    isAuthenticated && !accessToken,
  );

  useEffect(() => {
    if (!isAuthenticated || accessToken) {
      setRefreshing(false);
      return;
    }

    let cancelled = false;

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
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}