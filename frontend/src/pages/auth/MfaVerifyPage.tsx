import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router';
import { Button, Input, ErrorBanner } from '@/components/ui';
import { useVerifyMfa, useVerifyMfaBackup } from '@/hooks/useAuth';

const schema = z.object({
  totpCode: z.string().length(6, 'Enter the 6-digit code'),
});

type FormData = z.infer<typeof schema>;

export default function MfaVerifyPage() {
  const [useBackup, setUseBackup] = useState(false);
  const { mutate: verifyMfa, isPending: mfaPending, error: mfaError } = useVerifyMfa();

  const backupSchema = z.object({
    backupCode: z.string().min(1, 'Enter your backup code'),
  });
  type BackupFormData = z.infer<typeof backupSchema>;

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const {
    register: regBackup,
    handleSubmit: handleSubmitBackup,
    formState: { errors: backupErrors },
  } = useForm<BackupFormData>({
    resolver: zodResolver(backupSchema),
  });

  const { mutate: verifyBackup, isPending: backupPending, error: backupError } = useVerifyMfaBackup();

  const activeError = useBackup ? backupError : mfaError;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
          {useBackup ? 'Use Backup Code' : 'Two-Factor Authentication'}
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6">
          {useBackup
            ? 'Enter one of your backup codes to sign in'
            : 'Enter the 6-digit code from your authenticator app'}
        </p>

        <ErrorBanner error={activeError} />

        {!useBackup ? (
          <form
            onSubmit={handleSubmit((data) => verifyMfa({ totpCode: data.totpCode }))}
            className="space-y-4"
          >
            <Input
              label="Authentication Code"
              id="totpCode"
              placeholder="000000"
              maxLength={6}
              error={errors.totpCode?.message}
              {...reg('totpCode')}
            />
            <Button type="submit" loading={mfaPending} className="w-full">
              Verify
            </Button>
          </form>
        ) : (
          <form
            onSubmit={handleSubmitBackup((data) => verifyBackup(data.backupCode))}
            className="space-y-4"
          >
            <Input
              label="Backup Code"
              id="backupCode"
              placeholder="Enter your backup code"
              error={backupErrors.backupCode?.message}
              {...regBackup('backupCode')}
            />
            <Button type="submit" loading={backupPending} className="w-full">
              Verify
            </Button>
          </form>
        )}

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => setUseBackup(!useBackup)}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            {useBackup ? 'Use authenticator code instead' : 'Use a backup code instead'}
          </button>
        </div>

        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/login" className="text-primary-600 hover:text-primary-700">
            Cancel and return to login
          </Link>
        </p>
      </div>
  );
}
