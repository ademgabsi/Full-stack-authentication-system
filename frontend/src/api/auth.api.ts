import apiClient from './client';
import type {
  AuthUser,
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  MfaRequiredResponse,
  StepUpRequiredResponse,
  StepUpVerifyRequest,
  MfaVerifyRequest,
  MfaBackupCodeVerifyRequest,
  MfaEnableRequest,
  MfaDisableRequest,
  MfaSetupResponse,
  MfaEnableResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  ResendVerificationRequest,
  VerifyEmailRequest,
  MessageResponse,
  Session,
  WebAuthnCredential,
} from '@/types';

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<RegisterResponse>('/auth/register', data).then((r) => r.data),

  verifyEmail: (data: VerifyEmailRequest) =>
    apiClient.post<MessageResponse>('/auth/verify-email', data).then((r) => r.data),

  resendVerification: (data: ResendVerificationRequest) =>
    apiClient.post<MessageResponse>('/auth/resend-verification', data).then((r) => r.data),

  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse | MfaRequiredResponse | StepUpRequiredResponse>('/auth/login', data).then((r) => r.data),

  verifyStepUp: (data: StepUpVerifyRequest) =>
    apiClient.post<LoginResponse>('/auth/step-up/verify', data).then((r) => r.data),

  verifyMfa: (data: MfaVerifyRequest) =>
    apiClient.post<LoginResponse>('/auth/mfa/verify', data).then((r) => r.data),

  verifyMfaBackupCode: (data: MfaBackupCodeVerifyRequest) =>
    apiClient.post<LoginResponse>('/auth/mfa/verify-backup', data).then((r) => r.data),

  setupMfa: () =>
    apiClient.post<MfaSetupResponse>('/auth/mfa/setup').then((r) => r.data),

  enableMfa: (data: MfaEnableRequest) =>
    apiClient.post<MfaEnableResponse>('/auth/mfa/enable', data).then((r) => r.data),

  disableMfa: (data: MfaDisableRequest) =>
    apiClient.post<MessageResponse>('/auth/mfa/disable', data).then((r) => r.data),

  regenerateBackupCodes: () =>
    apiClient.post<MfaEnableResponse>('/auth/mfa/backup-codes').then((r) => r.data),

  refreshToken: () =>
    apiClient.post<LoginResponse>('/auth/refresh').then((r) => r.data),

  logout: () =>
    apiClient.post<MessageResponse>('/auth/logout').then((r) => r.data),

  forgotPassword: (data: ForgotPasswordRequest) =>
    apiClient.post<MessageResponse>('/auth/forgot-password', data).then((r) => r.data),

  resetPassword: (data: ResetPasswordRequest) =>
    apiClient.post<MessageResponse>('/auth/reset-password', data).then((r) => r.data),

  getSessions: () =>
    apiClient.get<Session[]>('/auth/sessions').then((r) => r.data),

  revokeSession: (id: string) =>
    apiClient.delete<MessageResponse>(`/auth/sessions/${id}`).then((r) => r.data),

  revokeAllSessions: () =>
    apiClient.delete<MessageResponse>('/auth/sessions').then((r) => r.data),

  exchangeOAuthCode: (code: string) =>
    apiClient.post<{ accessToken: string; user: AuthUser }>('/auth/google/exchange', { code }).then((r) => r.data),

  webauthnRegistrationOptions: () =>
    apiClient.post<PublicKeyCredentialCreationOptionsJSON & { challengeKey: string }>('/auth/webauthn/register/options').then((r) => r.data),

  webauthnRegistrationVerify: (response: string, challengeKey: string, name?: string) =>
    apiClient.post<{ message: string; credential: { id: string; name: string; createdAt: string } }>('/auth/webauthn/register/verify', { response, challengeKey, name }).then((r) => r.data),

  webauthnAuthenticationOptions: (email?: string) =>
    apiClient.post<PublicKeyCredentialRequestOptionsJSON & { challengeKey: string }>('/auth/webauthn/login/options', { email }).then((r) => r.data),

  webauthnAuthenticationVerify: (response: string, challengeKey: string) =>
    apiClient.post<LoginResponse>('/auth/webauthn/login/verify', { response, challengeKey }).then((r) => r.data),

  getWebAuthnCredentials: () =>
    apiClient.get<WebAuthnCredential[]>('/auth/webauthn/credentials').then((r) => r.data),

  renameWebAuthnCredential: (id: string, name: string) =>
    apiClient.patch<MessageResponse>(`/auth/webauthn/credentials/${id}`, { name }).then((r) => r.data),

  deleteWebAuthnCredential: (id: string) =>
    apiClient.delete<MessageResponse>(`/auth/webauthn/credentials/${id}`).then((r) => r.data),
};