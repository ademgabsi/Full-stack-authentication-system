import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface AlertProps {
  variant?: 'error' | 'success' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
}

const variantStyles = {
  error: 'bg-danger-50 text-danger-700 border-danger-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-600 border-warning-200',
  info: 'bg-primary-50 text-primary-700 border-primary-200',
};

export function Alert({ variant = 'info', children, className }: AlertProps) {
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', variantStyles[variant], className)}>
      {children}
    </div>
  );
}