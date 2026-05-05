import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useLocation, useNavigate } from 'react-router';
import { Button, Input, ErrorBanner } from '@/components/ui';
import { useLogin } from '@/hooks/useAuth';
import { useAuthStore } from '@/stores/auth.store';
import type { LoginResponse, MfaRequiredResponse } from '@/types';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { mutate: login, isPending, error } = useLogin();

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    login(data, {
      onSuccess: (response) => {
        if ('mfaRequired' in response && response.mfaRequired) {
          useAuthStore.getState().setTempToken((response as MfaRequiredResponse).tempToken);
          navigate('/mfa/verify', { replace: true });
          return;
        }
        const loginResp = response as LoginResponse;
        useAuthStore.getState().login(loginResp.accessToken, loginResp.refreshToken, loginResp.user);
        navigate(loginResp.user?.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
      },
    });
  };

  const state = location.state as { registered?: boolean } | null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Welcome back</h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          Enter your credentials to access your account
        </p>

        {state?.registered && (
          <div className="mb-4 p-3 rounded-lg bg-success-50 text-success-700 text-sm">
            Registration successful! Please check your email to verify your account, then sign in.
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
          <Button type="submit" loading={isPending} className="w-full">
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
            Create one
          </Link>
        </p>
      </div>
  );
}
