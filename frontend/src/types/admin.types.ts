import type { UserRole } from './auth.types';

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}

export interface ListUsersResponse {
  users: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    image: string | null;
    mfaEnabled: boolean;
    isActive: boolean;
    isVerified: boolean;
    lockedUntil: string | null;
    lastLogin: string | null;
    createdAt: string;
    updatedAt: string;
  }[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUpdateUserRequest {
  fullName?: string;
  role?: UserRole;
  isActive?: boolean;
}

export interface LockUserRequest {
  locked: boolean;
}