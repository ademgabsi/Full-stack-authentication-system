import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, ErrorBanner } from '@/components/ui';
import { useSetupMfa, useEnableMfa } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Shield, Copy, Check } from 'lucide-react';

const enableSchema = z.object({
  totpCode: z.string().length(6, 'Enter the 6-digit code'),
});

type EnableFormData = z.infer<typeof enableSchema>;

export default function MfaSetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showCodes, setShowCodes] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const setupMfa = useSetupMfa();
  const enableMfa = useEnableMfa();

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<EnableFormData>({
    resolver: zodResolver(enableSchema),
  });

  const handleSetup = () => {
    setupMfa.mutate(undefined);
    setStep('verify');
  };

  const handleEnable = (data: EnableFormData) => {
    enableMfa.mutate({ totpCode: data.totpCode }, {
      onSuccess: (response) => {
        setBackupCodes(response.backupCodes);
        setShowCodes(true);
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  if (showCodes) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-6">2FA Enabled!</h1>
        <Card className="max-w-lg">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="mx-auto h-12 w-12 rounded-full bg-success-50 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-success-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Two-factor authentication is now enabled</h2>
              <p className="text-sm text-gray-500 mt-1">Save these backup codes in a safe place</p>
            </div>
            <div className="bg-warning-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-warning-600">
                Each backup code can only be used once. Store them securely.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-6">
              {backupCodes.map((code) => (
                <div key={code} className="px-3 py-2 bg-gray-50 rounded font-mono text-sm text-center">
                  {code}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => navigate('/security')}>Done</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Set Up Two-Factor Authentication</h1>

      {step === 'setup' && !setupMfa.data && (
        <Card className="max-w-lg">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary-50 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Secure your account</h2>
              <p className="text-sm text-gray-500 mt-1">
                Two-factor authentication adds an extra layer of security to your account
              </p>
            </div>
            <Button onClick={handleSetup} loading={setupMfa.isPending} className="w-full">
              Get Started
            </Button>
          </CardContent>
        </Card>
      )}

      {(setupMfa.data || step === 'verify') && setupMfa.data && (
        <div className="max-w-lg space-y-6">
          {/* QR Code */}
          <Card>
            <CardHeader>
              <CardTitle>1. Scan QR Code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
              </p>
              <div className="flex justify-center mb-4">
                <img src={setupMfa.data.qrCode} alt="MFA QR Code" className="max-w-48" />
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-2">Or enter the secret manually:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 bg-gray-50 rounded text-xs break-all">
                    {setupMfa.data.secret}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => copyToClipboard(setupMfa.data.secret)}
                  >
                    {copiedSecret ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Verify */}
          <Card>
            <CardHeader>
              <CardTitle>2. Verify Setup</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500 mb-4">
                Enter the 6-digit code from your authenticator app to complete setup
              </p>
              {enableMfa.isError && (
                <ErrorBanner error={enableMfa.error} />
              )}
              <form onSubmit={handleSubmit(handleEnable)} className="space-y-4">
                <Input
                  label="Authentication Code"
                  id="totpCode"
                  placeholder="000000"
                  maxLength={6}
                  error={errors.totpCode?.message}
                  {...reg('totpCode')}
                />
                <Button type="submit" loading={enableMfa.isPending} className="w-full">
                  Verify and Enable
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {setupMfa.isError && (
<ErrorBanner error={setupMfa.error} className="max-w-lg" />
      )}

      <div className="mt-4">
        <Button variant="ghost" onClick={() => navigate('/security')}>
          Back to Security
        </Button>
      </div>
    </div>
  );
}