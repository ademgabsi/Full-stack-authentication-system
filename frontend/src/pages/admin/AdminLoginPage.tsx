import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import { Button, Input, ErrorBanner } from '@/components/ui';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import type { LoginResponse, MfaRequiredResponse } from '@/types';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { mutate: login, isPending, error } = useLogin();
  const [adminError, setAdminError] = useState<string | null>(null);

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    setAdminError(null);
    login(data, {
      onSuccess: (response) => {
        if ('mfaRequired' in response && response.mfaRequired) {
          useAuthStore.getState().setTempToken((response as MfaRequiredResponse).tempToken);
          navigate('/mfa/verify', { replace: true });
          return;
        }
        const loginResp = response as LoginResponse;
        if (loginResp.user?.role !== 'admin') {
          useAuthStore.getState().logout();
          setAdminError('This account does not have admin privileges.');
          return;
        }
        useAuthStore.getState().login(loginResp.accessToken, loginResp.refreshToken, loginResp.user);
        navigate('/admin', { replace: true });
      },
      onError: () => {
        setAdminError('Invalid email or password.');
      },
    });
  };

  return (
    <>
      <div className="text-center mb-6">
        <div className="mx-auto h-12 w-12 rounded-full bg-gray-900 flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-2.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Admin Login</h2>
        <p className="text-sm text-gray-500 mt-1">Sign in to your admin account</p>
      </div>

      <ErrorBanner error={adminError ? new Error(adminError) : error} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          id="email"
          type="email"
          placeholder="admin@example.com"
          error={errors.email?.message}
          {...reg('email')}
        />
        <Input
          label="Password"
          id="password"
          type="password"
          placeholder="Enter your password"
          error={errors.password?.message}
          {...reg('password')}
        />
        <div className="flex items-center justify-end">
          <Link
            to="/forgot-password"
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Forgot password?
          </Link>
        </div>
        <Button type="submit" loading={isPending} className="w-full">
          Sign in to Admin
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Regular user?{' '}
        <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
          Sign in here
        </Link>
      </p>
    </>
  );
}