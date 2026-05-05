import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link } from 'react-router';
import { Button, Input, ErrorBanner } from '@/components/ui';
import { useResendVerification } from '@/hooks/useAuth';
import { useState } from 'react';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ResendVerificationPage() {
  const [sent, setSent] = useState(false);
  const { mutate: resend, isPending, error } = useResendVerification();

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    resend(data, {
      onSuccess: () => setSent(true),
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Resend Verification Code</h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter your email to receive a new verification code
      </p>

      {sent ? (
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-success-50 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-success-700 mb-4">Verification code sent! Please check your inbox.</p>
          <div className="space-y-2">
            <Link to="/verify-email">
              <Button variant="secondary" className="w-full">Enter Code</Button>
            </Link>
            <Link to="/login" className="block">
              <Button variant="secondary" className="w-full">Back to Login</Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <ErrorBanner error={error} />
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Email"
              id="email"
              type="email"
              placeholder="john@example.com"
              error={errors.email?.message}
              {...reg('email')}
            />
            <Button type="submit" loading={isPending} className="w-full">
              Resend Code
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-500">
            <Link to="/login" className="text-primary-600 hover:text-primary-700">
              Back to Login
            </Link>
          </p>
        </>
      )}
    </div>
  );
}