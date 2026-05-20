import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/api/auth.api';

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const [error, setError] = useState<string | null>(null);
  const exchanged = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const mfaRequired = searchParams.get('mfaRequired');
    const stepUpRequired = searchParams.get('stepUpRequired');

    if (mfaRequired === 'true') {
      navigate('/mfa/verify', { replace: true });
      return;
    }

    if (stepUpRequired === 'true') {
      navigate('/step-up/verify', { replace: true });
      return;
    }

    if (!code) {
      navigate('/login', { replace: true });
      return;
    }

    if (exchanged.current) return;
    exchanged.current = true;

    authApi
      .exchangeOAuthCode(code)
      .then((data) => {
        login(data.accessToken, data.user);
        navigate(
          data.user?.role === 'admin' ? '/admin' : '/dashboard',
          { replace: true },
        );
      })
      .catch(() => {
        setError('Google sign-in failed. Please try again.');
      });
  }, [searchParams, navigate, login]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <a href="/login" className="text-primary-600 hover:text-primary-700">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mx-auto mb-4" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
