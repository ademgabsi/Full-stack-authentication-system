export type WebhookEvent =
  | 'user.registered'
  | 'user.locked'
  | 'user.unlocked'
  | 'user.deactivated'
  | 'user.email_verified'
  | 'mfa.enabled'
  | 'mfa.disabled'
  | 'user.password_changed'
  | 'user.password_reset'
  | 'user.role_changed'
  | 'user.login'
  | 'user.login_failed';

export type DeliveryStatus = 'pending' | 'success' | 'failed' | 'retrying';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  event: string;
  payload: {
    id: string;
    event: string;
    timestamp: string;
    data: Record<string, unknown>;
  };
  responseStatus: number | null;
  responseBody: string | null;
  status: DeliveryStatus;
  attempts: number;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface ListWebhooksParams {
  page?: number;
  limit?: number;
  search?: string;
  event?: WebhookEvent;
}

export interface ListWebhooksResponse {
  webhooks: Webhook[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListDeliveriesParams {
  page?: number;
  limit?: number;
  status?: DeliveryStatus;
  event?: string;
}

export interface ListDeliveriesResponse {
  deliveries: WebhookDelivery[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  events: WebhookEvent[];
  isActive?: boolean;
}

export interface UpdateWebhookRequest {
  name?: string;
  url?: string;
  events?: WebhookEvent[];
  isActive?: boolean;
}

export interface WebhookEventOption {
  value: WebhookEvent;
  label: string;
}

export interface DeliveryStatsResponse {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  pendingDeliveries: number;
  recentDeliveries: WebhookDelivery[];
}