import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Button, Input, ErrorBanner } from '@/components/ui';
import { useVerifyStepUp } from '@/hooks/useAuth';

export default function StepUpVerifyPage() {
  const navigate = useNavigate();
  const { mutate: verifyStepUp, isPending, error } = useVerifyStepUp();
  const [code, setCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    verifyStepUp({ code: code.trim() });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
        Verify Your Identity
      </h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        We detected unusual activity on your account. A verification code has been sent to your email.
      </p>

      <ErrorBanner error={error} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Verification Code"
          id="code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <Button type="submit" loading={isPending} className="w-full">
          Verify
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-gray-500">
        Didn&apos;t receive a code?{' '}
        <button
          type="button"
          onClick={() => navigate('/login', { replace: true })}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Try logging in again
        </button>
      </p>
    </div>
  );
}
