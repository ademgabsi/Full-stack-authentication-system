import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Alert, ErrorBanner } from '@/components/ui';
import { ArrowLeft } from 'lucide-react';
import { useChangePassword } from '@/hooks/useUser';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Must contain an uppercase letter')
      .regex(/[a-z]/, 'Must contain a lowercase letter')
      .regex(/[0-9]/, 'Must contain a number')
      .regex(/[^A-Za-z0-9]/, 'Must contain a special character'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

import { useNavigate } from 'react-router';

export default function ChangePasswordPage() {
  const [success, setSuccess] = useState(false);
  const { mutate: changePassword, isPending, error } = useChangePassword();

  const {
    register: reg,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    setSuccess(false);
    changePassword(
      { currentPassword: data.currentPassword, newPassword: data.newPassword },
      {
        onSuccess: () => {
          setSuccess(true);
          reset();
        },
      },
    );
  };

  const navigate = useNavigate();

  return (
    <div>
      <button onClick={() => navigate('/dashboard')} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </button>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Change Password</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Update Your Password</CardTitle>
        </CardHeader>
        <CardContent>
          {success && (
            <Alert variant="success" className="mb-4">
              Password changed successfully
            </Alert>
          )}
          {error && (
            <ErrorBanner error={error} />
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Current Password"
              id="currentPassword"
              type="password"
              placeholder="Enter current password"
              error={errors.currentPassword?.message}
              {...reg('currentPassword')}
            />
            <Input
              label="New Password"
              id="newPassword"
              type="password"
              placeholder="Enter new password"
              error={errors.newPassword?.message}
              {...reg('newPassword')}
            />
            <Input
              label="Confirm New Password"
              id="confirmPassword"
              type="password"
              placeholder="Confirm new password"
              error={errors.confirmPassword?.message}
              {...reg('confirmPassword')}
            />
            <div className="flex justify-end">
              <Button type="submit" loading={isPending}>
                Change Password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}