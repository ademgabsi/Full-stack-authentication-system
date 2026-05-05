export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'user' | 'admin';
  image: string | null;
  mfaEnabled: boolean;
  isActive: boolean;
  isVerified: boolean;
  lockedUntil: string | null;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UploadImageResponse {
  image: string;
}