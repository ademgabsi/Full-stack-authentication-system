export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  mfaEnabled: boolean;
  image: string | null;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  tempToken: string;
  message: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface MfaVerifyRequest {
  tempToken: string;
  totpCode: string;
}

export interface MfaBackupCodeVerifyRequest {
  tempToken: string;
  backupCode: string;
}

export interface MfaEnableRequest {
  totpCode: string;
}

export interface MfaDisableRequest {
  password: string;
}

export interface MfaSetupResponse {
  secret: string;
  qrCode: string;
  manualEntry: string;
  message: string;
}

export interface MfaEnableResponse {
  message: string;
  backupCodes: string[];
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  password: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface MessageResponse {
  message: string;
}