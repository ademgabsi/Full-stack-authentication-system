import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import { Button, Input, ErrorBanner } from '@/components/ui';
import { useForgotPassword } from '@/hooks/useAuth';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { mutate: forgotPassword, isPending, error } = useForgotPassword();

  const {
    register: reg,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    forgotPassword(data, {
      onSuccess: () => {
        navigate('/reset-password', { state: { email: data.email } });
      },
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Forgot Password</h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter your email and we'll send you a reset code
      </p>

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
          Send Reset Code
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-500">
        <Link to="/login" className="text-primary-600 hover:text-primary-700">
          Back to Login
        </Link>
      </p>
    </div>
  );
}