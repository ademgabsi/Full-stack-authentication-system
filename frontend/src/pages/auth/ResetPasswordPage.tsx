import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router';
import { Button, Input, ErrorBanner } from '@/components/ui';
import { useResetPassword } from '@/hooks/useAuth';

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain an uppercase letter')
  .regex(/[a-z]/, 'Must contain a lowercase letter')
  .regex(/[0-9]/, 'Must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Must contain a special character');

const schema = z
  .object({
    email: z.string().email('Invalid email address'),
    code: z.string().length(6, 'Code must be 6 digits'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const location = useLocation();
  const emailFromState = (location.state as { email?: string })?.email || '';
  const { mutate: resetPassword, isPending, error, isSuccess } = useResetPassword();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const {
    register: reg,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: emailFromState,
    },
  });

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);
    setValue('code', newCode.join(''));

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 0) return;

    const newCode = [...code];
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }
    setCode(newCode);
    setValue('code', newCode.join(''));

    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const onSubmit = (data: FormData) => {
    resetPassword({ email: data.email, code: data.code, password: data.password });
  };

  if (isSuccess) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-success-50 flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
        <p className="text-success-700 mb-6">Your password has been reset successfully.</p>
        <Link to="/login">
          <Button>Continue to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Reset Password</h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter the 6-digit code from your email and your new password
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Reset Code</label>
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleCodeChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-12 text-center text-xl font-bold border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            ))}
          </div>
          {errors.code?.message && (
            <p className="mt-1 text-sm text-danger-600">{errors.code.message}</p>
          )}
        </div>

        <Input
          label="New Password"
          id="password"
          type="password"
          placeholder="New password"
          error={errors.password?.message}
          {...reg('password')}
        />
        <Input
          label="Confirm New Password"
          id="confirmPassword"
          type="password"
          placeholder="Confirm new password"
          error={errors.confirmPassword?.message}
          {...reg('confirmPassword')}
        />
        <Button type="submit" loading={isPending} className="w-full">
          Reset Password
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