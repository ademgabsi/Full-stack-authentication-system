import apiClient from './client';
import type { User, UpdateProfileRequest, ChangePasswordRequest, UploadImageResponse, MessageResponse } from '@/types';

export const usersApi = {
  getProfile: () =>
    apiClient.get<User>('/users/me').then((r) => r.data),

  updateProfile: (data: UpdateProfileRequest) =>
    apiClient.put<User>('/users/me', data).then((r) => r.data),

  changePassword: (data: ChangePasswordRequest) =>
    apiClient.put<MessageResponse>('/users/me/password', data).then((r) => r.data),

  uploadImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiClient.post<UploadImageResponse>('/users/me/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },

  requestDeletion: () =>
    apiClient.post<MessageResponse>('/users/me/delete').then((r) => r.data),

  confirmDeletion: (code: string) =>
    apiClient.post<MessageResponse>('/users/me/delete/confirm', { code }).then((r) => r.data),

  cancelDeletion: (code: string) =>
    apiClient.post<MessageResponse>('/users/me/delete/cancel', { code }).then((r) => r.data),
};