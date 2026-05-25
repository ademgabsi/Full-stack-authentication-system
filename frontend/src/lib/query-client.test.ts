import { describe, it, expect } from 'vitest';
import { queryClient } from '@/lib/query-client';

describe('queryClient', () => {
  it('should create a QueryClient with default options', () => {
    expect(queryClient).toBeDefined();
  });

  it('should have staleTime configured', () => {
    const options = queryClient.getDefaultOptions();
    expect(options.queries?.staleTime).toBe(5 * 60 * 1000);
  });

  it('should have retry configured to 1', () => {
    const options = queryClient.getDefaultOptions();
    expect(options.queries?.retry).toBe(1);
  });

  it('should have refetchOnWindowFocus disabled', () => {
    const options = queryClient.getDefaultOptions();
    expect(options.queries?.refetchOnWindowFocus).toBe(false);
  });
});
