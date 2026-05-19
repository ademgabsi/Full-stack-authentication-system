import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/api/users.api';
import { useNavigate } from 'react-router';
import { useAuthStore } from '@/stores/auth.store';
import type { UpdateProfileRequest, ChangePasswordRequest } from '@/types';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => usersApi.getProfile(),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => usersApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => usersApi.changePassword(data),
  });
}

export function useUploadImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => usersApi.uploadImage(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useRequestDeletion() {
  return useMutation({
    mutationFn: () => usersApi.requestDeletion(),
  });
}

export function useConfirmDeletion() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (code: string) => usersApi.confirmDeletion(code),
    onSuccess: () => {
      logout();
      navigate('/login');
    },
  });
}

export function useCancelDeletion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => usersApi.cancelDeletion(code),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}