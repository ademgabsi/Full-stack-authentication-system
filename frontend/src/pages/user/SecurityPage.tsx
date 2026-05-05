import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Alert, Badge, Modal, ErrorBanner } from '@/components/ui';
import { useProfile } from '@/hooks/useUser';
import { useDisableMfa, useRegenerateBackupCodes } from '@/hooks/useAuth';
import { Link } from 'react-router';
import { useNavigate } from 'react-router';
import { ArrowLeft, Shield, Key, AlertTriangle, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui';

const disableSchema = z.object({
  password: z.string().min(1, 'Password is required to disable MFA'),
});

type DisableFormData = z.infer<typeof disableSchema>;

export default function SecurityPage() {
  const { data: profile, isLoading } = useProfile();
  const navigate = useNavigate();
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disableSuccess, setDisableSuccess] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');

  const disableMfa = useDisableMfa();
  const regenerateBackup = useRegenerateBackupCodes();

  const {
    register: reg,
    handleSubmit: handleDisableSubmit,
    formState: { errors },
  } = useForm<DisableFormData>({
    resolver: zodResolver(disableSchema),
  });

  if (isLoading || !profile) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary-600" /></div>;
  }

  const onDisable = (data: DisableFormData) => {
    setDisableSuccess('');
    disableMfa.mutate(data, {
      onSuccess: () => {
        setShowDisableModal(false);
        setDisableSuccess('MFA has been disabled successfully');
      },
    });
  };

  const onRegenerate = () => {
    setBackupSuccess('');
    regenerateBackup.mutate(undefined, {
      onSuccess: (data) => {
        setBackupCodes(data.backupCodes);
        setShowBackupModal(true);
      },
    });
  };

  return (
    <div>
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Security</h1>

      {disableSuccess && <Alert variant="success" className="mb-4">{disableSuccess}</Alert>}
      {backupSuccess && <Alert variant="success" className="mb-4">{backupSuccess}</Alert>}

      {/* MFA Status */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary-600" />
            </div>
            <div>
              <CardTitle>Two-Factor Authentication</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">
                {profile.mfaEnabled
                  ? 'Your account is protected with 2FA'
                  : 'Enable 2FA for extra security'}
              </p>
            </div>
          </div>
          <Badge variant={profile.mfaEnabled ? 'success' : 'warning'}>
            {profile.mfaEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </CardHeader>
        <CardContent>
          {profile.mfaEnabled ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Two-factor authentication is currently active. You'll need your authenticator app
                each time you sign in.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="danger"
                  onClick={() => setShowDisableModal(true)}
                >
                  Disable 2FA
                </Button>
                <Button variant="secondary" onClick={() => navigate('/security/mfa/setup')}>
                  <Key className="h-4 w-4 mr-2" />
                  Manage 2FA
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-warning-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-warning-500 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning-600">
                    Your account is not protected
                  </p>
                  <p className="text-sm text-warning-500 mt-1">
                    Enable two-factor authentication to add an extra layer of security.
                  </p>
                </div>
              </div>
              <Button onClick={() => navigate('/security/mfa/setup')}>
                <Shield className="h-4 w-4 mr-2" />
                Enable 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Codes (only if MFA enabled) */}
      {profile.mfaEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gray-100 flex items-center justify-center">
                <Key className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <CardTitle>Backup Codes</CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">
                  Generate new backup codes if you've lost yours
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" onClick={onRegenerate} loading={regenerateBackup.isPending}>
              Regenerate Backup Codes
            </Button>

            {disableMfa.isError && (
              <ErrorBanner error={disableMfa.error} />
            )}
          </CardContent>
        </Card>
      )}

      {/* Disable MFA Modal */}
      <Modal open={showDisableModal} onClose={() => setShowDisableModal(false)} title="Disable 2FA">
        <p className="text-sm text-gray-500 mb-4">
          This will remove two-factor authentication from your account. Please enter your password to confirm.
        </p>
        {disableMfa.isError && (
          <ErrorBanner error={disableMfa.error} />
        )}
        <form onSubmit={handleDisableSubmit(onDisable)} className="space-y-4">
          <Input
            label="Password"
            id="password"
            type="password"
            placeholder="Enter your password"
            error={errors.password?.message}
            {...reg('password')}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={() => setShowDisableModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" type="submit" loading={disableMfa.isPending}>
              Disable 2FA
            </Button>
          </div>
        </form>
      </Modal>

      {/* Backup Codes Modal */}
      <Modal open={showBackupModal} onClose={() => setShowBackupModal(false)} title="Your Backup Codes">
        <div className="mb-4 p-3 bg-warning-50 rounded-lg">
          <p className="text-sm text-warning-600">
            Save these backup codes in a safe place. Each code can only be used once.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {backupCodes.map((code) => (
            <div
              key={code}
              className="px-3 py-2 bg-gray-50 rounded font-mono text-sm text-center"
            >
              {code}
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <Button onClick={() => setShowBackupModal(false)}>Done</Button>
        </div>
      </Modal>
    </div>
  );
}