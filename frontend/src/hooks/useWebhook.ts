import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhookApi } from '@/api/webhook.api';
import type {
  ListWebhooksParams,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  ListDeliveriesParams,
} from '@/types';

export function useListWebhooks(params?: ListWebhooksParams) {
  return useQuery({
    queryKey: ['admin', 'webhooks', params],
    queryFn: () => webhookApi.listWebhooks(params),
  });
}

export function useGetWebhook(id: string) {
  return useQuery({
    queryKey: ['admin', 'webhooks', id],
    queryFn: () => webhookApi.getWebhook(id),
    enabled: !!id,
  });
}

export function useWebhookEvents() {
  return useQuery({
    queryKey: ['admin', 'webhooks', 'events'],
    queryFn: () => webhookApi.getEvents(),
  });
}

export function useDeliveryStats() {
  return useQuery({
    queryKey: ['admin', 'webhooks', 'stats'],
    queryFn: () => webhookApi.getDeliveryStats(),
  });
}

export function useListDeliveries(webhookId: string, params?: ListDeliveriesParams) {
  return useQuery({
    queryKey: ['admin', 'webhooks', webhookId, 'deliveries', params],
    queryFn: () => webhookApi.listDeliveries(webhookId, params),
    enabled: !!webhookId,
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWebhookRequest) => webhookApi.createWebhook(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
    },
  });
}

export function useUpdateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWebhookRequest }) =>
      webhookApi.updateWebhook(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
    },
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => webhookApi.deleteWebhook(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'webhooks'] });
    },
  });
}