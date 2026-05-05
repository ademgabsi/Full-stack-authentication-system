import apiClient from './client';
import type { User, UpdateProfileRequest, ChangePasswordRequest, UploadImageResponse } from '@/types';

export const usersApi = {
  getProfile: () =>
    apiClient.get<User>('/users/me').then((r) => r.data),

  updateProfile: (data: UpdateProfileRequest) =>
    apiClient.put<User>('/users/me', data).then((r) => r.data),

  changePassword: (data: ChangePasswordRequest) =>
    apiClient.put<{ message: string }>('/users/me/password', data).then((r) => r.data),

  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.post<UploadImageResponse>('/users/me/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};