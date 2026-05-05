import { createBrowserRouter, Navigate } from 'react-router';
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { UserLayout } from '@/components/layout/UserLayout';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthGuard } from '@/components/guards/AuthGuard';
import { GuestGuard } from '@/components/guards/GuestGuard';
import { AdminGuard } from '@/components/guards/AdminGuard';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage'));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const ResendVerificationPage = lazy(() => import('@/pages/auth/ResendVerificationPage'));
const MfaVerifyPage = lazy(() => import('@/pages/auth/MfaVerifyPage'));

const DashboardPage = lazy(() => import('@/pages/user/DashboardPage'));
const ProfilePage = lazy(() => import('@/pages/user/ProfilePage'));
const ChangePasswordPage = lazy(() => import('@/pages/user/ChangePasswordPage'));
const SecurityPage = lazy(() => import('@/pages/user/SecurityPage'));
const MfaSetupPage = lazy(() => import('@/pages/user/MfaSetupPage'));

const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'));
const AdminOverview = lazy(() => import('@/pages/admin/Overview'));
const UsersList = lazy(() => import('@/pages/admin/UsersList'));
const UserDetail = lazy(() => import('@/pages/admin/UserDetail'));
const UserEdit = lazy(() => import('@/pages/admin/UserEdit'));

function LazyPage({ Component }: { Component: LazyExoticComponent<ComponentType> }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" /></div>}>
      <Component />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },

  {
    element: <GuestGuard />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: 'login', element: <LazyPage Component={LoginPage} /> },
          { path: 'register', element: <LazyPage Component={RegisterPage} /> },
          { path: 'forgot-password', element: <LazyPage Component={ForgotPasswordPage} /> },
          { path: 'resend-verification', element: <LazyPage Component={ResendVerificationPage} /> },
          { path: 'admin/login', element: <LazyPage Component={AdminLoginPage} /> },
        ],
      },
    ],
  },

  {
    element: <AuthLayout />,
    children: [
      { path: 'verify-email', element: <LazyPage Component={VerifyEmailPage} /> },
      { path: 'reset-password', element: <LazyPage Component={ResetPasswordPage} /> },
      { path: 'mfa/verify', element: <LazyPage Component={MfaVerifyPage} /> },
    ],
  },

  {
    element: <AuthGuard />,
    children: [
      {
        element: <UserLayout />,
        children: [
          { path: 'dashboard', element: <LazyPage Component={DashboardPage} /> },
          { path: 'profile', element: <LazyPage Component={ProfilePage} /> },
          { path: 'profile/password', element: <LazyPage Component={ChangePasswordPage} /> },
          { path: 'security', element: <LazyPage Component={SecurityPage} /> },
          { path: 'security/mfa/setup', element: <LazyPage Component={MfaSetupPage} /> },
        ],
      },
    ],
  },

  {
    element: <AdminGuard />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: 'admin', element: <LazyPage Component={AdminOverview} /> },
          { path: 'admin/users', element: <LazyPage Component={UsersList} /> },
          { path: 'admin/users/:id', element: <LazyPage Component={UserDetail} /> },
          { path: 'admin/users/:id/edit', element: <LazyPage Component={UserEdit} /> },
        ],
      },
    ],
  },

  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);
