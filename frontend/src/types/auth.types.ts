export type UserRole = 'user' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  mfaEnabled: boolean;
  image: string | null;
  provider?: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface MfaRequiredResponse {
  mfaRequired: true;
  tempToken: string;
  message: string;
}

export interface StepUpRequiredResponse {
  stepUpRequired: true;
  stepUpToken: string;
  message: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
  captchaToken?: string;
}

export interface RegisterResponse {
  message: string;
  userId: string;
}

export interface FingerprintData {
  screenResolution?: string;
  timezone?: string;
  language?: string;
  platform?: string;
  canvasHash?: string;
  webglHash?: string;
  fontsHash?: string;
  colorDepth?: string;
  touchSupport?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  captchaToken?: string;
  fingerprint?: FingerprintData;
}

export interface StepUpVerifyRequest {
  stepUpToken?: string;
  code: string;
}

export interface MfaVerifyRequest {
  tempToken?: string;
  totpCode: string;
}

export interface MfaBackupCodeVerifyRequest {
  tempToken?: string;
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

export interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  location: string | null;
  createdAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export interface WebAuthnCredential {
  id: string;
  name: string;
  deviceType: string;
  createdAt: string;
  lastUsedAt: string | null;
}