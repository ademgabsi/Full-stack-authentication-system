import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/api/auth.api';
import type {
  RegisterRequest,
  LoginRequest,
  StepUpVerifyRequest,
  MfaVerifyRequest,
  MfaEnableRequest,
  MfaDisableRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ResendVerificationRequest,
  VerifyEmailRequest,
} from '@/types';
import type { AxiosError } from 'axios';

export function useRegister() {
  return useMutation({
    mutationFn: (data: RegisterRequest) => authApi.register(data),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: (data: LoginRequest) => authApi.login(data),
  });
}

export function useVerifyMfa() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const tempToken = useAuthStore((s) => s.tempToken);

  return useMutation({
    mutationFn: (data: Omit<MfaVerifyRequest, 'tempToken'>) =>
      authApi.verifyMfa({ ...data, tempToken: tempToken! }),
    onSuccess: (response) => {
      const { accessToken, user } = response;
      login(accessToken, user);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    },
    onError: (error: AxiosError) => {
      if (error.response?.status === 401) {
        navigate('/login', { replace: true });
      }
    },
  });
}

export function useVerifyStepUp() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const clearStepUpToken = () => useAuthStore.setState({ stepUpToken: null });

  return useMutation({
    mutationFn: (data: StepUpVerifyRequest) => authApi.verifyStepUp(data),
    onSuccess: (response) => {
      const { accessToken, user } = response;
      clearStepUpToken();
      login(accessToken, user);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    },
    onError: (error: AxiosError) => {
      clearStepUpToken();
      if (error.response?.status === 401) {
        navigate('/login', { replace: true });
      }
    },
  });
}

export function useVerifyMfaBackup() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const tempToken = useAuthStore((s) => s.tempToken);

  return useMutation({
    mutationFn: (backupCode: string) =>
      authApi.verifyMfaBackupCode({ tempToken: tempToken!, backupCode }),
    onSuccess: (response) => {
      const { accessToken, user } = response;
      login(accessToken, user);
      navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    },
  });
}

export function useSetupMfa() {
  return useMutation({
    mutationFn: () => authApi.setupMfa(),
  });
}

export function useEnableMfa() {
  return useMutation({
    mutationFn: (data: MfaEnableRequest) => authApi.enableMfa(data),
  });
}

export function useDisableMfa() {
  return useMutation({
    mutationFn: (data: MfaDisableRequest) => authApi.disableMfa(data),
  });
}

export function useRegenerateBackupCodes() {
  return useMutation({
    mutationFn: () => authApi.regenerateBackupCodes(),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: ForgotPasswordRequest) => authApi.forgotPassword(data),
  });
}

export function useResetPassword() {
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => authApi.resetPassword(data),
    onSuccess: () => {
      navigate('/login', { replace: true });
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: (data: VerifyEmailRequest) => authApi.verifyEmail(data),
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (data: ResendVerificationRequest) => authApi.resendVerification(data),
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const doLogout = () => {
    logout();
    navigate('/login', { replace: true });
    authApi.logout().catch(() => {});
  };
  return { logout: doLogout };
}

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: () => authApi.getSessions(),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authApi.revokeSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => authApi.revokeAllSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}
