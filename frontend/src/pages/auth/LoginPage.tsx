import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button, Input, ErrorBanner, Turnstile } from '@/components/ui';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import type { LoginResponse, MfaRequiredResponse } from '@/types';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

const TURNSTILE_ENABLED = !!import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mutate: login, isPending, error } = useLogin();
  const [captchaToken, setCaptchaToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handleCaptchaToken = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);

  const resetCaptcha = useCallback(() => {
    setCaptchaToken('');
    setTurnstileKey((k) => k + 1);
  }, []);

  const onSubmit = (data: FormData) => {
    login(
      { ...data, captchaToken },
      {
        onSuccess: (response) => {
          if ('mfaRequired' in response && response.mfaRequired) {
            useAuthStore
              .getState()
              .setTempToken((response as MfaRequiredResponse).tempToken);
            navigate('/mfa/verify', { replace: true });
            return;
          }
          const loginResp = response as LoginResponse;
          useAuthStore
            .getState()
            .login(loginResp.accessToken, loginResp.user);
          navigate(
            loginResp.user?.role === 'admin' ? '/admin' : '/dashboard',
            { replace: true },
          );
        },
        onError: () => {
          resetCaptcha();
        },
      },
    );
  };

  const state = location.state as { registered?: boolean } | null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
        Welcome back
      </h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter your credentials to access your account
      </p>

      {state?.registered && (
        <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">
          Registration successful! Please check your email to verify your
          account, then sign in.
        </div>
      )}

      <ErrorBanner error={error} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          id="email"
          type="email"
          placeholder="john@example.com"
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
        <Turnstile key={turnstileKey} onToken={handleCaptchaToken} />
        <Button
          type="submit"
          loading={isPending}
          className="w-full"
          disabled={TURNSTILE_ENABLED && !captchaToken}
        >
          Sign in
        </Button>
      </form>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-gray-400 uppercase">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <a
        href="/api/auth/google"
        className="mt-4 flex items-center justify-center gap-3 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Sign in with Google
      </a>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link
          to="/register"
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
