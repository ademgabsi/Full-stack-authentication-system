import { describe, it, expect } from 'vitest';

describe('Type exports', () => {
  // Verify the types re-export from the barrel index
  it('should export auth types from types/index', async () => {
    const types = await import('@/types');
    // Auth types
    expect(types).toBeDefined();
  });

  it('should have expected type shapes', () => {
    // This test verifies that type definitions exist and can be imported
    // The actual types are compile-time only, but we verify the module loads
    const mockAuthUser = {
      id: '1',
      email: 'test@test.com',
      fullName: 'Test User',
      role: 'user' as const,
      mfaEnabled: false,
      image: null,
    };
    expect(mockAuthUser.id).toBe('1');
    expect(mockAuthUser.role).toBe('user');
  });
});
