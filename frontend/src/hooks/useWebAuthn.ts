import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import { authApi } from '@/api/auth.api';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export function useWebAuthnRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name?: string) => {
      const options = await authApi.webauthnRegistrationOptions();
      const { challengeKey, ...optionsJSON } = options;
      const response = await startRegistration({ optionsJSON });
      return authApi.webauthnRegistrationVerify(JSON.stringify(response), challengeKey, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webauthn-credentials'] });
    },
  });
}

export function useWebAuthnLogin() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  return useMutation({
    mutationFn: async (email?: string) => {
      const options = await authApi.webauthnAuthenticationOptions(email);
      const { challengeKey, ...optionsJSON } = options;
      const response = await startAuthentication({ optionsJSON });
      return authApi.webauthnAuthenticationVerify(JSON.stringify(response), challengeKey);
    },
    onSuccess: (response) => {
      login(response.accessToken, response.user);
      navigate(
        response.user?.role === 'admin' ? '/admin' : '/dashboard',
        { replace: true },
      );
    },
  });
}

export function useWebAuthnCredentials() {
  return useQuery({
    queryKey: ['webauthn-credentials'],
    queryFn: () => authApi.getWebAuthnCredentials(),
  });
}

export function useRenameWebAuthnCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      authApi.renameWebAuthnCredential(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webauthn-credentials'] });
    },
  });
}

export function useDeleteWebAuthnCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authApi.deleteWebAuthnCredential(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webauthn-credentials'] });
    },
  });
}
