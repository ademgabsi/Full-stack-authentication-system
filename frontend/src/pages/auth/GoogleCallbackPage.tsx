import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import type { AuthUser } from '@/types';

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export default function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const setTempToken = useAuthStore((s) => s.setTempToken);
  const setStepUpToken = useAuthStore((s) => s.setStepUpToken);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const userParam = searchParams.get('user');
    const mfaRequired = searchParams.get('mfaRequired');
    const tempToken = getCookie('mfa_temp_token');
    const stepUpRequired = searchParams.get('stepUpRequired');
    const stepUpToken = getCookie('step_up_token');

    if (mfaRequired === 'true' && tempToken) {
      setTempToken(tempToken);
      navigate('/mfa/verify', { replace: true });
      return;
    }

    if (stepUpRequired === 'true' && stepUpToken) {
      setStepUpToken(stepUpToken);
      navigate('/step-up/verify', { replace: true });
      return;
    }

    if (!accessToken || !userParam) {
      navigate('/login', { replace: true });
      return;
    }

    try {
      const user: AuthUser = JSON.parse(userParam);
      login(accessToken, user);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, login, setTempToken, setStepUpToken]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mx-auto mb-4" />
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}
