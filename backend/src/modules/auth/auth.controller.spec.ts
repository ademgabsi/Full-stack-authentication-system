import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppConfigService } from '../../config/app-config.service';
import { Request, Response } from 'express';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
  verifyEmail: jest.fn(),
  resendVerification: jest.fn(),
  verifyMfa: jest.fn(),
  verifyMfaBackupCode: jest.fn(),
  verifyStepUp: jest.fn(),
  setupMfa: jest.fn(),
  enableMfa: jest.fn(),
  disableMfa: jest.fn(),
  regenerateBackupCodes: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  listSessions: jest.fn(),
  revokeSession: jest.fn(),
  revokeAllSessions: jest.fn(),
  storeOAuthState: jest.fn(),
  exchangeOAuthState: jest.fn(),
  googleOAuthLogin: jest.fn(),
};

const mockConfigService = {
  url: 'http://localhost:3000',
  jwtSecret: 'test-secret',
};

describe('AuthController', () => {
  let controller: AuthController;
  let authService: typeof mockAuthService;

  const mockRes = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  } as unknown as Response;

  const mockReq = {
    cookies: {},
    headers: {},
    ip: '127.0.0.1',
    user: { id: 'user-1', email: 'test@example.com', role: 'user' },
  } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AppConfigService, useValue: mockConfigService },
        { provide: JwtService, useValue: { sign: jest.fn() } },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('should call authService.register', async () => {
      mockAuthService.register.mockResolvedValue({ message: 'Registered' });
      const result = await controller.register(
        {
          email: 'test@example.com',
          password: 'StrongPass1!',
          fullName: 'Test',
        },
        mockReq,
      );
      expect(authService.register).toHaveBeenCalled();
      expect(result.message).toBe('Registered');
    });
  });

  describe('login', () => {
    it('should set refresh token cookie on success', async () => {
      mockAuthService.login.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: { id: 'user-1', role: 'user' },
      });
      const result = await controller.login(
        { email: 'test@example.com', password: 'Pass1!' },
        mockReq,
        mockRes,
      );
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh',
        expect.objectContaining({ httpOnly: true }),
      );
      expect(result).not.toHaveProperty('refreshToken');
    });

    it('should set mfa_temp_token cookie for MFA required response', async () => {
      mockAuthService.login.mockResolvedValue({
        mfaRequired: true,
        tempToken: 'temp-jwt',
        message: 'MFA required',
      });
      const result = await controller.login(
        { email: 'test@example.com', password: 'Pass1!' },
        mockReq,
        mockRes,
      );
      expect(result).toHaveProperty('mfaRequired', true);
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'mfa_temp_token',
        'temp-jwt',
        expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
      );
    });
  });

  describe('verifyEmail', () => {
    it('should call authService.verifyEmail', async () => {
      mockAuthService.verifyEmail.mockResolvedValue({ message: 'Verified' });
      const result = await controller.verifyEmail(
        { email: 'test@example.com', code: '123456' },
        mockReq,
      );
      expect(result.message).toBe('Verified');
    });
  });

  describe('resendVerification', () => {
    it('should call authService.resendVerification', async () => {
      mockAuthService.resendVerification.mockResolvedValue({ message: 'Sent' });
      const result = await controller.resendVerification({
        email: 'test@example.com',
      });
      expect(result.message).toBe('Sent');
    });
  });

  describe('verifyMfa', () => {
    it('should throw when mfa_temp_token cookie is missing', async () => {
      await expect(
        controller.verifyMfa(
          { tempToken: 't', totpCode: '123456' },
          { cookies: {} } as any,
          mockRes,
        ),
      ).rejects.toThrow('Missing temporary token');
    });

    it('should set refresh cookie and clear mfa cookie on success', async () => {
      mockAuthService.verifyMfa.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        user: { role: 'user' },
      });
      await controller.verifyMfa(
        { tempToken: 't', totpCode: '123456' },
        { cookies: { mfa_temp_token: 'valid-temp' } } as any,
        mockRes,
      );
      expect(mockRes.cookie).toHaveBeenCalled();
      expect(mockRes.clearCookie).toHaveBeenCalledWith('mfa_temp_token', {
        path: '/api/auth',
      });
    });
  });

  describe('verifyMfaBackupCode', () => {
    it('should throw when mfa_temp_token cookie is missing', async () => {
      await expect(
        controller.verifyMfaBackupCode(
          { tempToken: 't', backupCode: 'AAAAAAAA' },
          { cookies: {} } as any,
          mockRes,
        ),
      ).rejects.toThrow('Missing temporary token');
    });
  });

  describe('mfaSetup', () => {
    it('should call authService.setupMfa', async () => {
      mockAuthService.setupMfa.mockResolvedValue({ secret: 'S', qrCode: 'QR' });
      const result = await controller.setupMfa('user-1');
      expect(result).toHaveProperty('secret', 'S');
    });
  });

  describe('enableMfa', () => {
    it('should call authService.enableMfa', async () => {
      mockAuthService.enableMfa.mockResolvedValue({
        message: 'MFA enabled',
        backupCodes: [],
      });
      const result = await controller.enableMfa(
        'user-1',
        { totpCode: '123456' },
        mockReq,
      );
      expect(result.message).toContain('enabled');
    });
  });

  describe('disableMfa', () => {
    it('should call authService.disableMfa', async () => {
      mockAuthService.disableMfa.mockResolvedValue({ message: 'MFA disabled' });
      const result = await controller.disableMfa(
        'user-1',
        { password: 'Pass1!' },
        mockReq,
      );
      expect(result.message).toContain('disabled');
    });
  });

  describe('refreshTokens', () => {
    it('should throw when refresh_token cookie is missing', async () => {
      await expect(
        controller.refreshTokens({ cookies: {} } as any, mockRes),
      ).rejects.toThrow('Missing refresh token');
    });

    it('should set new refresh cookie on success', async () => {
      mockAuthService.refreshTokens.mockResolvedValue({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
        user: { role: 'user' },
      });
      const result = await controller.refreshTokens(
        { cookies: { refresh_token: 'valid-refresh' } } as any,
        mockRes,
      );
      expect(result).toHaveProperty('accessToken');
      expect(mockRes.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'new-refresh',
        expect.any(Object),
      );
    });
  });

  describe('logout', () => {
    it('should clear refresh cookie on logout', async () => {
      mockAuthService.logout.mockResolvedValue({ message: 'Logged out' });
      const result = await controller.logout(
        { cookies: { refresh_token: 'refresh' } } as any,
        'user-1',
        mockRes,
      );
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/',
      });
      expect(result.message).toContain('Logged out');
    });

    it('should not throw when no refresh token cookie', async () => {
      mockAuthService.logout.mockResolvedValue({ message: 'Logged out' });
      await controller.logout({ cookies: {} } as any, 'user-1', mockRes);
      expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', {
        path: '/',
      });
    });
  });

  describe('listSessions', () => {
    it('should call authService.listSessions', async () => {
      mockAuthService.listSessions.mockResolvedValue([
        { id: 's1', deviceInfo: 'Chrome' },
      ]);
      const result = await controller.listSessions('user-1', mockReq);
      expect(result).toHaveLength(1);
    });
  });

  describe('revokeSession', () => {
    it('should call authService.revokeSession', async () => {
      mockAuthService.revokeSession.mockResolvedValue({
        message: 'Session revoked',
      });
      const result = await controller.revokeSession(
        'session-1',
        'user-1',
        mockReq,
      );
      expect(result.message).toContain('revoked');
    });
  });

  describe('forgotPassword', () => {
    it('should call authService.forgotPassword', async () => {
      mockAuthService.forgotPassword.mockResolvedValue({ message: 'Sent' });
      const result = await controller.forgotPassword(
        { email: 'test@example.com' },
        mockReq,
      );
      expect(result.message).toBe('Sent');
    });
  });

  describe('resetPassword', () => {
    it('should call authService.resetPassword', async () => {
      mockAuthService.resetPassword.mockResolvedValue({
        message: 'Password reset',
      });
      const result = await controller.resetPassword(
        {
          email: 'test@example.com',
          code: '123456',
          password: 'NewPass1!',
        },
        mockReq,
      );
      expect(result.message).toBe('Password reset');
    });
  });

  describe('exchangeOAuthCode', () => {
    it('should exchange OAuth code and set cookies', async () => {
      mockAuthService.exchangeOAuthState.mockResolvedValue({
        accessToken: 'oauth-access',
        refreshToken: 'oauth-refresh',
        user: { role: 'user' },
      });
      const result = await controller.exchangeOAuthCode(
        { code: 'valid-oauth-code' },
        mockRes,
      );
      expect(result).toHaveProperty('accessToken');
      expect(mockRes.cookie).toHaveBeenCalled();
    });

    it('should throw for invalid OAuth code', async () => {
      mockAuthService.exchangeOAuthState.mockResolvedValue(null);
      await expect(
        controller.exchangeOAuthCode({ code: 'invalid' }, mockRes),
      ).rejects.toThrow('Invalid or expired OAuth code');
    });
  });
});
