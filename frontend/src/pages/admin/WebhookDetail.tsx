import { useState } from 'react';
import { useParams, Link } from 'react-router';
import { useGetWebhook, useListDeliveries, useUpdateWebhook, useDeleteWebhook } from '@/hooks/useWebhook';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Modal, ErrorBanner, Spinner } from '@/components/ui';
import { ArrowLeft, ToggleLeft, ToggleRight, Trash2, ExternalLink, Copy, Check } from 'lucide-react';
import type { DeliveryStatus } from '@/types';
import { formatDate } from '@/lib/utils';

const STATUS_VARIANTS: Record<string, 'success' | 'danger' | 'warning' | 'default'> = {
  success: 'success',
  failed: 'danger',
  pending: 'warning',
  retrying: 'warning',
};

export default function WebhookDetail() {
  const { id } = useParams<{ id: string }>();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | ''>('');
  const [showDelete, setShowDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: webhook, isLoading, isError, error } = useGetWebhook(id!);
  const { data: deliveries, isLoading: deliveriesLoading } = useListDeliveries(id!, {
    page,
    limit: 20,
    status: statusFilter || undefined,
  });

  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const handleToggle = () => {
    if (!webhook) return;
    updateWebhook.mutate({
      id: webhook.id,
      data: { isActive: !webhook.isActive },
    });
  };

  const handleDelete = () => {
    if (!id) return;
    deleteWebhook.mutate(id, {
      onSuccess: () => {
        window.location.href = '/admin/webhooks';
      },
    });
  };

  const copySecret = () => {
    if (!webhook) return;
    navigator.clipboard.writeText(webhook.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Spinner /></div>;
  if (isError) return <ErrorBanner error={error} />;
  if (!webhook) return <div className="text-center py-12 text-gray-500">Webhook not found</div>;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/webhooks" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{webhook.name}</h1>
            <Badge variant={webhook.isActive ? 'success' : 'default'}>
              {webhook.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
            <ExternalLink className="h-3 w-3" />
            {webhook.url}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleToggle}>
            {webhook.isActive ? (
              <><ToggleRight className="h-4 w-4 mr-1" /> Disable</>
            ) : (
              <><ToggleLeft className="h-4 w-4 mr-1" /> Enable</>
            )}
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader><CardTitle>Subscribed Events</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {webhook.events.map((event) => (
                <span key={event} className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700">
                  {event}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Signing Secret</CardTitle></CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">
                {webhook.secret}
              </code>
              <button onClick={copySecret} className="p-1 text-gray-400 hover:text-gray-600" title="Copy secret">
                {copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Use this secret to verify webhook signatures using HMAC-SHA256.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Info</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900 font-medium">{formatDate(webhook.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Updated</span>
                <span className="text-gray-900 font-medium">{formatDate(webhook.updatedAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Delivery History</CardTitle>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as DeliveryStatus | ''); setPage(1); }}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="retrying">Retrying</option>
            </select>
          </div>
        </CardHeader>
        {deliveriesLoading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : !deliveries?.deliveries.length ? (
          <CardContent className="text-center text-gray-500 py-8">
            No deliveries yet
          </CardContent>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Event</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Response</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Attempts</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {deliveries.deliveries.map((delivery) => (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700">
                          {delivery.event}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANTS[delivery.status] || 'default'}>
                          {delivery.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {delivery.responseStatus ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {delivery.attempts}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(delivery.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {deliveries.totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex justify-center gap-2">
                <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <span className="text-sm text-gray-500 flex items-center">
                  Page {page} of {deliveries.totalPages}
                </span>
                <Button variant="secondary" size="sm" disabled={page === deliveries.totalPages} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Webhook">
        <p className="text-sm text-gray-500 mb-4">
          Are you sure you want to delete <strong>{webhook.name}</strong>? All delivery history will be lost.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" loading={deleteWebhook.isPending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}