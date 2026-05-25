import { describe, it, expect } from 'vitest';
import { cn, formatDate, getInitials, getErrorInfo, getErrorMessage, ErrorInfo } from '@/lib/utils';

describe('cn', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('should handle empty input', () => {
    expect(cn()).toBe('');
  });

  it('should handle undefined values', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });
});

describe('formatDate', () => {
  it('should format a date string', () => {
    const result = formatDate('2025-01-15T10:30:00Z');
    expect(result).toContain('Jan');
    expect(result).toContain('15');
    expect(result).toContain('2025');
  });

  it('should return dash for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—');
  });

  it('should return dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });
});

describe('getInitials', () => {
  it('should return initials from full name', () => {
    expect(getInitials('John Doe')).toBe('JD');
  });

  it('should handle single name', () => {
    expect(getInitials('John')).toBe('J');
  });

  it('should handle three-part name', () => {
    expect(getInitials('John Michael Doe')).toBe('JM');
  });

  it('should uppercase initials', () => {
    expect(getInitials('john doe')).toBe('JD');
  });

  it('should handle empty string', () => {
    expect(getInitials('')).toBe('');
  });
});

describe('getErrorInfo', () => {
  it('should categorize Axios response errors as server errors', () => {
    const error = {
      response: {
        status: 400,
        data: { message: 'Bad request' },
      },
    };
    const info = getErrorInfo(error);
    expect(info.category).toBe('server');
    expect(info.message).toBe('Bad request');
    expect(info.statusCode).toBe(400);
  });

  it('should join array messages from Axios errors', () => {
    const error = {
      response: {
        status: 422,
        data: { message: ['email is required', 'password is invalid'] },
      },
    };
    const info = getErrorInfo(error);
    expect(info.message).toBe('email is required, password is invalid');
  });

  it('should handle Axios error without data message', () => {
    const error = {
      response: {
        status: 500,
      },
    };
    const info = getErrorInfo(error);
    expect(info.category).toBe('server');
    expect(info.message).toContain('failed');
    expect(info.message).toContain('500');
  });

  it('should categorize errors with request property as network errors', () => {
    const error = {
      request: {},
    };
    const info = getErrorInfo(error);
    expect(info.category).toBe('network');
    expect(info.message).toContain('Network');
  });

  it('should categorize Error instances as client errors', () => {
    const error = new Error('Something went wrong');
    const info = getErrorInfo(error);
    expect(info.category).toBe('client');
    expect(info.message).toBe('Something went wrong');
  });

  it('should categorize unknown errors', () => {
    const info = getErrorInfo('some string');
    expect(info.category).toBe('unknown');
    expect(info.message).toBe('An unexpected error occurred');
  });

  it('should categorize null as unknown', () => {
    const info = getErrorInfo(null);
    expect(info.category).toBe('unknown');
  });
});

describe('getErrorMessage', () => {
  it('should extract message from error', () => {
    const error = {
      response: {
        data: { message: 'Invalid credentials' },
      },
    };
    expect(getErrorMessage(error)).toBe('Invalid credentials');
  });

  it('should return default for unknown errors', () => {
    expect(getErrorMessage(null)).toBe('An unexpected error occurred');
  });
});
