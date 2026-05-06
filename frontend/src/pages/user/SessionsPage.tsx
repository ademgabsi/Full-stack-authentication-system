import { Card, CardContent, Button, Badge, Alert, ErrorBanner } from '@/components/ui';
import { useSessions, useRevokeSession, useRevokeAllSessions } from '@/hooks/useAuth';
import { ArrowLeft, Monitor, Smartphone, Tablet, Globe, Loader2, Trash2, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';
import { formatDate } from '@/lib/utils';

const DEVICE_ICONS: Record<string, LucideIcon> = {
  mobile: Smartphone,
  tablet: Tablet,
  desktop: Monitor,
};

function getDeviceIconName(deviceInfo: string): string {
  const lower = deviceInfo.toLowerCase();
  if (lower.includes('mobile') || lower.includes('android') || lower.includes('iphone')) return 'mobile';
  if (lower.includes('tablet') || lower.includes('ipad')) return 'tablet';
  return 'desktop';
}

function formatRelativeTime(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(date);
}

export default function SessionsPage() {
  const { data: sessions, isLoading, isError, error } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAllSessions = useRevokeAllSessions();
  const [successMessage, setSuccessMessage] = useState('');
  const [revokingId, setRevokingId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>;
  }

  if (isError) {
    return <ErrorBanner error={error} />;
  }

  const currentSession = sessions?.find((s) => s.isCurrent);
  const otherSessions = sessions?.filter((s) => !s.isCurrent) ?? [];

  const handleRevoke = (id: string) => {
    setSuccessMessage('');
    setRevokingId(id);
    revokeSession.mutate(id, {
      onSuccess: () => {
        setSuccessMessage('Session revoked successfully');
        setRevokingId(null);
      },
      onError: () => {
        setRevokingId(null);
      },
    });
  };

  const handleRevokeAll = () => {
    setSuccessMessage('');
    revokeAllSessions.mutate(undefined, {
      onSuccess: () => {
        setSuccessMessage('All other sessions have been revoked');
      },
    });
  };

  return (
    <div>
      <Link to="/security" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Security
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Active Sessions</h1>
        {otherSessions.length > 0 && (
          <Button
            variant="danger"
            onClick={handleRevokeAll}
            loading={revokeAllSessions.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Revoke All Other Sessions
          </Button>
        )}
      </div>

      {successMessage && <Alert variant="success" className="mb-4">{successMessage}</Alert>}
      {revokeSession.isError && <ErrorBanner error={revokeSession.error} />}
      {revokeAllSessions.isError && <ErrorBanner error={revokeAllSessions.error} />}

      {sessions && sessions.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No active sessions found.
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {currentSession && (
          <Card className="border-primary-200 bg-primary-50/30">
            <CardContent className="py-4">
              <SessionRow session={currentSession} />
            </CardContent>
          </Card>
        )}

        {otherSessions.map((session) => (
          <Card key={session.id}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <SessionRow session={session} />
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRevoke(session.id)}
                  disabled={revokingId === session.id}
                >
                  {revokingId === session.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Revoke'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SessionRow({ session }: { session: {
  deviceInfo: string;
  ipAddress: string;
  location: string | null;
  lastUsedAt: string;
  createdAt: string;
  isCurrent: boolean;
} }) {
  const DeviceIcon = DEVICE_ICONS[getDeviceIconName(session.deviceInfo)];

  return (
    <div className="flex items-center gap-4 min-w-0 flex-1">
      <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
        <DeviceIcon className="h-5 w-5 text-gray-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-900 truncate">{session.deviceInfo}</span>
          {session.isCurrent && (
            <Badge variant="success">Current session</Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500 mt-0.5 flex-wrap">
          <span className="flex items-center gap-1">
            <Globe className="h-3.5 w-3.5" />
            {session.ipAddress}
          </span>
          {session.location && (
            <span>{session.location}</span>
          )}
          <span>Last active {formatRelativeTime(session.lastUsedAt)}</span>
        </div>
      </div>
    </div>
  );
}
