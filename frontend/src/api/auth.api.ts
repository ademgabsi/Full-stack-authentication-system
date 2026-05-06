import apiClient from './client';
import type {
  RegisterRequest,
  RegisterResponse,
  LoginRequest,
  LoginResponse,
  MfaRequiredResponse,
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
} from '@/types';

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<RegisterResponse>('/auth/register', data).then((r) => r.data),

  verifyEmail: (data: VerifyEmailRequest) =>
    apiClient.post<MessageResponse>('/auth/verify-email', data).then((r) => r.data),

  resendVerification: (data: ResendVerificationRequest) =>
    apiClient.post<MessageResponse>('/auth/resend-verification', data).then((r) => r.data),

  login: (data: LoginRequest) =>
    apiClient.post<LoginResponse | MfaRequiredResponse>('/auth/login', data).then((r) => r.data),

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
};