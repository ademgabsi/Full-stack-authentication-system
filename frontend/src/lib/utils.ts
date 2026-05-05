import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export type ErrorCategory = 'server' | 'client' | 'unknown';

export interface ErrorInfo {
  category: ErrorCategory;
  message: string;
  statusCode?: number;
}

export function getErrorInfo(err: unknown): ErrorInfo {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: { status?: number; data?: { message?: string | string[] } };
    };
    if (axiosErr.response?.data?.message) {
      const raw = axiosErr.response.data.message;
      const message = Array.isArray(raw) ? raw.join(', ') : raw;
      return {
        category: 'server',
        message,
        statusCode: axiosErr.response.status,
      };
    }
    if (axiosErr.response) {
      return {
        category: 'server',
        message: `Request failed with status ${axiosErr.response.status}`,
        statusCode: axiosErr.response.status,
      };
    }
  }
  if (err && typeof err === 'object' && 'request' in err) {
    return { category: 'client', message: 'Network error. Please check your connection.' };
  }
  if (err instanceof Error) {
    return { category: 'client', message: err.message };
  }
  return { category: 'unknown', message: 'An unexpected error occurred' };
}

export function getErrorMessage(err: unknown): string {
  return getErrorInfo(err).message;
}