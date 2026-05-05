import { getErrorInfo } from '@/lib/utils';
import type { ErrorCategory } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ErrorBannerProps {
  error: unknown;
  className?: string;
}

const categoryConfig: Record<
  ErrorCategory,
  { label: string; containerClass: string; labelClass: string }
> = {
  server: {
    label: 'Server Error',
    containerClass: 'bg-red-50 border-red-200 text-red-800',
    labelClass: 'bg-red-100 text-red-700',
  },
  client: {
    label: 'Validation Error',
    containerClass: 'bg-amber-50 border-amber-200 text-amber-800',
    labelClass: 'bg-amber-100 text-amber-700',
  },
  unknown: {
    label: 'Error',
    containerClass: 'bg-red-50 border-red-200 text-red-800',
    labelClass: 'bg-red-100 text-red-700',
  },
};

export function ErrorBanner({ error, className }: ErrorBannerProps) {
  if (!error) return null;

  const { category, message, statusCode } = getErrorInfo(error);
  const config = categoryConfig[category];

  return (
    <div className={cn('mb-4 rounded-lg border px-4 py-3 text-sm', config.containerClass, className)}>
      <div className="flex items-start gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold shrink-0',
            config.labelClass,
          )}
        >
          {config.label}
          {statusCode ? ` ${statusCode}` : ''}
        </span>
        <span>{message}</span>
      </div>
    </div>
  );
}