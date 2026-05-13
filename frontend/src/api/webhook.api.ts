import apiClient from './client';
import type {
  ListWebhooksParams,
  ListWebhooksResponse,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  Webhook,
  WebhookEventOption,
  ListDeliveriesParams,
  ListDeliveriesResponse,
  DeliveryStatsResponse,
} from '@/types';

export const webhookApi = {
  listWebhooks: (params?: ListWebhooksParams) =>
    apiClient.get<ListWebhooksResponse>('/admin/webhooks', { params }).then((r) => r.data),

  getWebhook: (id: string) =>
    apiClient.get<Webhook>(`/admin/webhooks/${id}`).then((r) => r.data),

  createWebhook: (data: CreateWebhookRequest) =>
    apiClient.post<Webhook>('/admin/webhooks', data).then((r) => r.data),

  updateWebhook: (id: string, data: UpdateWebhookRequest) =>
    apiClient.put<Webhook>(`/admin/webhooks/${id}`, data).then((r) => r.data),

  deleteWebhook: (id: string) =>
    apiClient.delete<{ message: string }>(`/admin/webhooks/${id}`).then((r) => r.data),

  getEvents: () =>
    apiClient.get<WebhookEventOption[]>('/admin/webhooks/events').then((r) => r.data),

  getDeliveryStats: () =>
    apiClient.get<DeliveryStatsResponse>('/admin/webhooks/stats').then((r) => r.data),

  listDeliveries: (webhookId: string, params?: ListDeliveriesParams) =>
    apiClient.get<ListDeliveriesResponse>(`/admin/webhooks/${webhookId}/deliveries`, { params }).then((r) => r.data),
};