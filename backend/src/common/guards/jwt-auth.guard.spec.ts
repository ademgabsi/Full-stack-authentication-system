import {
  JwtAuthGuard,
} from './jwt-auth.guard';
import { UnauthorizedException } from '@nestjs/common';

const mockReflector = {
  getAllAndOverride: jest.fn(),
};

const mockJwtService = {
  verifyAsync: jest.fn(),
};

const mockConfigService = {
  jwtSecret: 'test-secret',
};

function createMockContext(authHeader?: string) {
  const request = {
    headers: { authorization: authHeader },
    user: undefined as any,
  } as any;
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(() => {
    guard = new JwtAuthGuard(
      mockReflector as any,
      mockJwtService as any,
      mockConfigService as any,
    );
    jest.clearAllMocks();
  });

  it('should allow access to public routes', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(true);
    const ctx = createMockContext();

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockJwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('should throw if no authorization header', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    const ctx = createMockContext();

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Authorization header missing',
    );
  });

  it('should throw if authorization header is not Bearer', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    const ctx = createMockContext('Basic abc');

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Invalid authorization header format',
    );
  });

  it('should verify token and attach payload to request', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    const ctx = createMockContext('Bearer valid-token');
    const payload = { sub: 'user-1', email: 'test@example.com', role: 'user' };
    mockJwtService.verifyAsync.mockResolvedValue(payload);

    const result = await guard.canActivate(ctx);

    expect(result).toBe(true);
    expect(mockJwtService.verifyAsync).toHaveBeenCalledWith('valid-token', {
      secret: 'test-secret',
    });
    expect(ctx.switchToHttp().getRequest().user).toEqual(payload);
  });

  it('should throw if token is invalid', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    const ctx = createMockContext('Bearer invalid-token');
    mockJwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'Invalid or expired token',
    );
  });

  it('should throw UnauthorizedException for MFA pending tokens', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    const ctx = createMockContext('Bearer mfa-token');
    mockJwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      email: 'test@example.com',
      mfaPending: true,
    });

    await expect(guard.canActivate(ctx)).rejects.toThrow(
      'MFA verification required',
    );
  });

  it('should re-throw UnauthorizedException from JWT verify', async () => {
    mockReflector.getAllAndOverride.mockReturnValue(false);
    const ctx = createMockContext('Bearer some-token');
    const authError = new UnauthorizedException('Custom error');
    mockJwtService.verifyAsync.mockRejectedValue(authError);

    await expect(guard.canActivate(ctx)).rejects.toThrow('Custom error');
  });
});
