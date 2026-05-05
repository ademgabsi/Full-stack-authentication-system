import apiClient from './client';
import type { ListUsersParams, ListUsersResponse, AdminUpdateUserRequest, LockUserRequest, User } from '@/types';

export const adminApi = {
  listUsers: (params?: ListUsersParams) =>
    apiClient.get<ListUsersResponse>('/admin/users', { params }).then((r) => r.data),

  getUser: (id: string) =>
    apiClient.get<User>(`/admin/users/${id}`).then((r) => r.data),

  updateUser: (id: string, data: AdminUpdateUserRequest) =>
    apiClient.put<User>(`/admin/users/${id}`, data).then((r) => r.data),

  lockUser: (id: string, data: LockUserRequest) =>
    apiClient.put<User>(`/admin/users/${id}/lock`, data).then((r) => r.data),

  deactivateUser: (id: string) =>
    apiClient.delete<{ message: string }>(`/admin/users/${id}`).then((r) => r.data),
};