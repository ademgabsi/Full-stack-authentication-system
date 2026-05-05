import { Outlet, Navigate, useLocation } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';

export function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isAdmin = useAuthStore((s) => s.isAdmin);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
