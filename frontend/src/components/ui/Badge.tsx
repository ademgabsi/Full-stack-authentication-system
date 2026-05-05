import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'warning' | 'info';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-gray-100 text-gray-700',
      success: 'bg-success-50 text-success-700',
      danger: 'bg-danger-50 text-danger-700',
      warning: 'bg-warning-50 text-warning-600',
      info: 'bg-primary-50 text-primary-700',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          variants[variant],
          className,
        )}
        {...props}
      />
    );
  },
);

Badge.displayName = 'Badge';

export { Badge };
export type { BadgeProps };