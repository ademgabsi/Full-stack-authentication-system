import { Outlet, Navigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';

export function GuestGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  }

  return <Outlet />;
}
