import { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router';
import { Button, Input, ErrorBanner } from '@/components/ui';
import { useVerifyEmail, useResendVerification } from '@/hooks/useAuth';

export default function VerifyEmailPage() {
  const location = useLocation();
  const emailFromState = (location.state as { email?: string })?.email || '';
  const [email, setEmail] = useState(emailFromState);
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [success, setSuccess] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { mutate: verifyEmail, isPending, error } = useVerifyEmail();
  const { mutate: resendVerification, isPending: isResending } = useResendVerification();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.slice(-1);
    }
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

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

    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const codeStr = code.join('');
    if (codeStr.length !== 6 || !email) return;

    verifyEmail({ email, code: codeStr }, {
      onSuccess: () => setSuccess(true),
    });
  };

  const handleResend = () => {
    if (!email) return;
    resendVerification({ email }, {
      onSuccess: () => {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 5000);
      },
    });
  };

  if (success) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-success-50 flex items-center justify-center mb-4">
          <svg className="h-6 w-6 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h2>
        <p className="text-success-700 mb-6">Your email has been verified successfully!</p>
        <Link to="/login">
          <Button>Continue to Login</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Verify Your Email</h2>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter the 6-digit code we sent to your email
      </p>

      <ErrorBanner error={error} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          id="email"
          type="email"
          placeholder="john@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Verification Code</label>
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
        </div>

        <Button type="submit" loading={isPending} className="w-full" disabled={code.join('').length !== 6 || !email}>
          Verify Email
        </Button>
      </form>

      <div className="mt-4 text-center">
        {resendSuccess ? (
          <p className="text-success-600 text-sm">A new code has been sent to your email.</p>
        ) : (
          <p className="text-sm text-gray-500">
            Didn't receive the code?{' '}
            <button
              onClick={handleResend}
              disabled={isResending || !email}
              className="text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
            >
              {isResending ? 'Sending...' : 'Resend Code'}
            </button>
          </p>
        )}
      </div>

      <p className="mt-4 text-center text-sm text-gray-500">
        <Link to="/login" className="text-primary-600 hover:text-primary-700">
          Back to Login
        </Link>
      </p>
    </div>
  );
}