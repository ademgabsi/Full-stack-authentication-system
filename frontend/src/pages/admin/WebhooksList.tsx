import { useState } from 'react';
import { useListWebhooks, useWebhookEvents, useCreateWebhook, useDeleteWebhook } from '@/hooks/useWebhook';
import { Card, CardContent, Badge, Button, Modal, ErrorBanner, Spinner, Input } from '@/components/ui';
import type { Webhook, WebhookEvent } from '@/types';
import { Plus, Trash2, ExternalLink, ToggleLeft, ToggleRight } from 'lucide-react';
import { useUpdateWebhook } from '@/hooks/useWebhook';
import { formatDate } from '@/lib/utils';

export default function WebhooksList() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useListWebhooks({ page, limit: 10 });
  const { data: eventsData } = useWebhookEvents();
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const deleteWebhook = useDeleteWebhook();

  const handleDelete = () => {
    if (!deleteId) return;
    deleteWebhook.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  };

  const handleToggle = (webhook: Webhook) => {
    updateWebhook.mutate({
      id: webhook.id,
      data: { isActive: !webhook.isActive },
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webhooks</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure webhooks to receive real-time notifications for auth events
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Webhook
        </Button>
      </div>

      {isError && <ErrorBanner error={error} className="mb-6" />}

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !data?.webhooks.length ? (
        <Card>
          <CardContent className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <ToggleLeft className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No webhooks yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Create a webhook to receive notifications when auth events occur.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Webhook
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4">
            {data.webhooks.map((webhook) => (
              <WebhookCard
                key={webhook.id}
                webhook={webhook}
                onToggle={handleToggle}
                onDelete={setDeleteId}
                isToggling={updateWebhook.isPending}
              />
            ))}
          </div>
          {data.totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm text-gray-500">
                  Page {page} of {data.totalPages}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page === data.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {showCreate && eventsData && (
        <CreateWebhookModal
          events={eventsData}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => {
            createWebhook.mutate(data, {
              onSuccess: () => setShowCreate(false),
            });
          }}
          isSubmitting={createWebhook.isPending}
          error={createWebhook.error}
        />
      )}

      <Modal
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Delete Webhook"
      >
        <p className="text-sm text-gray-500 mb-4">
          Are you sure you want to delete this webhook? All delivery history will be lost.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button variant="danger" loading={deleteWebhook.isPending} onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function WebhookCard({
  webhook,
  onToggle,
  onDelete,
  isToggling,
}: {
  webhook: Webhook;
  onToggle: (w: Webhook) => void;
  onDelete: (id: string) => void;
  isToggling: boolean;
}) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-sm font-semibold text-gray-900">{webhook.name}</h3>
              <Badge variant={webhook.isActive ? 'success' : 'default'}>
                {webhook.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 flex items-center gap-1 mb-3 truncate">
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
              {webhook.url}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {webhook.events.map((event) => (
                <span
                  key={event}
                  className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700"
                >
                  {event}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => onToggle(webhook)}
              disabled={isToggling}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
              title={webhook.isActive ? 'Disable' : 'Enable'}
            >
              {webhook.isActive ? (
                <ToggleRight className="h-5 w-5 text-primary-600" />
              ) : (
                <ToggleLeft className="h-5 w-5" />
              )}
            </button>
            <button
              onClick={() => onDelete(webhook.id)}
              className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Secret: {webhook.secret.substring(0, 8)}...
          </p>
          <p className="text-xs text-gray-400">
            Created {formatDate(webhook.createdAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateWebhookModal({
  events,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  events: { value: string; label: string }[];
  onClose: () => void;
  onSubmit: (data: { name: string; url: string; events: WebhookEvent[]; isActive?: boolean }) => void;
  isSubmitting: boolean;
  error: unknown;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<WebhookEvent[]>([]);

  const toggleEvent = (event: WebhookEvent) => {
    setSelectedEvents((prev) =>
      prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event],
    );
  };

  const selectAll = () => setSelectedEvents(events.map((e) => e.value as WebhookEvent));
  const deselectAll = () => setSelectedEvents([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, url, events: selectedEvents, isActive: true });
  };

  return (
    <Modal open onClose={onClose} title="Create Webhook" className="max-w-lg">
      <form onSubmit={handleSubmit}>
        {error && <ErrorBanner error={error} className="mb-4" />}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Slack Notifications"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payload URL</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/auth"
              type="url"
              required
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">Events</label>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-xs text-primary-600 hover:text-primary-700">
                  Select all
                </button>
                <button type="button" onClick={deselectAll} className="text-xs text-gray-500 hover:text-gray-700">
                  Deselect all
                </button>
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2">
              {events.map((event) => (
                <label
                  key={event.value}
                  className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(event.value as WebhookEvent)}
                    onChange={() => toggleEvent(event.value as WebhookEvent)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{event.label}</span>
                    <span className="text-xs text-gray-500 ml-2">{event.value}</span>
                  </div>
                </label>
              ))}
            </div>
            {selectedEvents.length === 0 && (
              <p className="text-xs text-danger-600 mt-1">Select at least one event</p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            loading={isSubmitting}
            disabled={!name || !url || selectedEvents.length === 0}
          >
            Create Webhook
          </Button>
        </div>
      </form>
    </Modal>
  );
}