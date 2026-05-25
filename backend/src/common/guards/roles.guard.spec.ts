import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { ROLES_KEY } from '../decorators/roles.decorator';

const mockReflector = {
  getAllAndOverride: jest.fn(),
};

function createMockContext(user?: any) {
  const request = { user } as any;
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;

  beforeEach(() => {
    guard = new RolesGuard(mockReflector as any);
    jest.clearAllMocks();
  });

  it('should allow access when no roles are required', () => {
    mockReflector.getAllAndOverride.mockReturnValue(undefined);
    const ctx = createMockContext();

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should allow access when required roles array is empty', () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);
    const ctx = createMockContext();

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should allow access when user has the required role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = createMockContext({ role: 'admin' });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });

  it('should throw ForbiddenException when user has no role', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = createMockContext(undefined);

    expect(() => guard.canActivate(ctx)).toThrow(
      'Access denied',
    );
  });

  it('should throw ForbiddenException when user role does not match', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['admin']);
    const ctx = createMockContext({ role: 'user' });

    expect(() => guard.canActivate(ctx)).toThrow(
      'You do not have permission to access this resource',
    );
  });

  it('should match if user has one of multiple required roles', () => {
    mockReflector.getAllAndOverride.mockReturnValue(['admin', 'superadmin']);
    const ctx = createMockContext({ role: 'superadmin' });

    const result = guard.canActivate(ctx);

    expect(result).toBe(true);
  });
});
