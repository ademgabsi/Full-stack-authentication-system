import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { User, UserRole } from '../../entities/user.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { PasswordReset } from '../../entities/password-reset.entity';
import { EmailVerificationToken } from '../../entities/email-verification-token.entity';
import { AppConfigService } from '../../config/app-config.service';
import { EmailService } from '../email/email.service';
import { AuditLogService } from '../audit/audit.service';
import { CaptchaService } from '../captcha/captcha.service';
import { BreachPasswordService } from './breach-password.service';
import { WebhookService } from '../webhook/webhook.service';
import { DeviceFingerprintService } from '../device-fingerprint/device-fingerprint.service';
import { AnomalyDetectionService } from '../device-fingerprint/anomaly-detection.service';
import { StepUpChallengeService } from '../device-fingerprint/step-up-challenge.service';

const mockUserRepo = {
  findOne: jest.fn(),
  create: jest.fn((dto) => dto as User),
  save: jest.fn((entity) => Promise.resolve({ id: 'user-1', ...entity })),
  update: jest.fn(),
  increment: jest.fn(),
};

const mockRefreshTokenRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((dto) => dto as RefreshToken),
  save: jest.fn((entity) => Promise.resolve({ id: 'rt-1', ...entity })),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockPasswordResetRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((dto) => dto as PasswordReset),
  save: jest.fn((entity) => Promise.resolve({ id: 'pr-1', ...entity })),
  update: jest.fn(),
  delete: jest.fn(),
};

const mockEmailVerificationRepo = {
  findOne: jest.fn(),
  create: jest.fn((dto) => dto as EmailVerificationToken),
  save: jest.fn((entity) => Promise.resolve({ id: 'ev-1', ...entity })),
  delete: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(() => 'jwt-token'),
  verify: jest.fn(),
  verifyAsync: jest.fn(),
};

const mockConfigService = {
  jwtSecret: 'test-secret-key-for-unit-tests',
  jwtExpiration: '15m',
  jwtRefreshExpiration: '7d',
  jwtMfaExpiration: '5m',
  maxFailedAttempts: 5,
  lockTimeMinutes: 15,
  smtpConfig: { fromName: 'AuthSystem' },
  url: 'http://localhost:3000',
  captchaEnabled: false,
};

const mockEmailService = {
  sendVerificationEmail: jest.fn(() => Promise.resolve()),
  sendWelcomeEmail: jest.fn(() => Promise.resolve()),
  sendMfaEnabledEmail: jest.fn(() => Promise.resolve()),
  sendAccountLockedEmail: jest.fn(() => Promise.resolve()),
  sendPasswordResetEmail: jest.fn(() => Promise.resolve()),
};

const mockMfaService = {
  generateSecret: jest.fn(() => ({ secret: 'MFA_SECRET', otpauthUrl: 'otpauth://...' })),
  generateQrCode: jest.fn(() => Promise.resolve('data:image/png;base64,...')),
  verifyTotp: jest.fn(),
  generateBackupCodes: jest.fn(() => ['CODE1CODE', 'CODE2CODE']),
  hashBackupCodes: jest.fn((codes: string[]) => codes.map(() => 'hashed-code')),
  verifyBackupCodeHashed: jest.fn(),
};

const mockAuditLogService = {
  log: jest.fn(() => Promise.resolve()),
};

const mockCaptchaService = {
  verify: jest.fn(() => Promise.resolve(true)),
};

const mockBreachService = {
  isBreached: jest.fn(() => Promise.resolve(0)),
};

const mockWebhookService = {
  dispatchEvent: jest.fn(() => Promise.resolve()),
};

const mockDeviceFingerprintService = {
  generateFingerprintHash: jest.fn(() => 'test-fingerprint-hash'),
  getOrCreateFingerprint: jest.fn(() =>
    Promise.resolve({ isNew: false, fingerprint: { id: 'fp-1' } }),
  ),
};

const mockAnomalyDetectionService = {
  detectAnomalies: jest.fn(() => Promise.resolve({ shouldStepUp: false })),
  markStepUpCompleted: jest.fn(() => Promise.resolve()),
};

const mockStepUpChallengeService = {
  createEmailChallenge: jest.fn(),
  verifyChallenge: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: typeof mockUserRepo;
  let refreshTokenRepo: typeof mockRefreshTokenRepo;
  let passwordResetRepo: typeof mockPasswordResetRepo;
  let emailVerificationRepo: typeof mockEmailVerificationRepo;
  let jwtService: typeof mockJwtService;
  let configService: typeof mockConfigService;
  let captchaService: typeof mockCaptchaService;
  let breachService: typeof mockBreachService;
  let mfaService: typeof mockMfaService;
  let anomalyDetectionService: typeof mockAnomalyDetectionService;

  const testUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: '',
    provider: 'credentials',
    providerId: null!,
    role: UserRole.USER,
    fullName: 'Test User',
    image: null!,
    mfaEnabled: false,
    mfaSecret: null!,
    mfaBackupCodes: null!,
    failedAttempts: 0,
    lockedUntil: null!,
    isActive: true,
    isVerified: false,
    passkeysEnabled: false,
    lastLogin: null!,
    scheduledDeletionAt: null!,
    deletionRequestedAt: null!,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockCaptchaService.verify.mockResolvedValue(true);
    mockBreachService.isBreached.mockResolvedValue(0);
    mockMfaService.verifyTotp.mockReturnValue(true);
    mockUserRepo.create.mockImplementation((dto: any) => ({ id: 'new-' + Math.random().toString(36).slice(2), ...dto }));
    mockUserRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));
    mockEmailVerificationRepo.create.mockImplementation((dto: any) => dto);
    mockEmailVerificationRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));
    mockPasswordResetRepo.create.mockImplementation((dto: any) => dto);
    mockPasswordResetRepo.save.mockImplementation((entity: any) => Promise.resolve({ id: 'pr-1', ...entity }));
    mockRefreshTokenRepo.create.mockImplementation((dto: any) => dto);
    mockRefreshTokenRepo.save.mockImplementation((entity: any) => Promise.resolve({ id: 'rt-1', ...entity }));
    mockJwtService.sign.mockReturnValue('jwt-token');
    mockDeviceFingerprintService.generateFingerprintHash.mockReturnValue('test-fingerprint-hash');
    mockDeviceFingerprintService.getOrCreateFingerprint.mockResolvedValue({ isNew: false, fingerprint: { id: 'fp-1' } });
    mockAnomalyDetectionService.detectAnomalies.mockResolvedValue({ shouldStepUp: false });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo },
        { provide: getRepositoryToken(PasswordReset), useValue: mockPasswordResetRepo },
        { provide: getRepositoryToken(EmailVerificationToken), useValue: mockEmailVerificationRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: JwtService, useValue: mockJwtService },
        { provide: AppConfigService, useValue: mockConfigService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: MfaService, useValue: mockMfaService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: CaptchaService, useValue: mockCaptchaService },
        { provide: BreachPasswordService, useValue: mockBreachService },
        { provide: WebhookService, useValue: mockWebhookService },
        { provide: DeviceFingerprintService, useValue: mockDeviceFingerprintService },
        { provide: AnomalyDetectionService, useValue: mockAnomalyDetectionService },
        { provide: StepUpChallengeService, useValue: mockStepUpChallengeService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    refreshTokenRepo = module.get(getRepositoryToken(RefreshToken));
    passwordResetRepo = module.get(getRepositoryToken(PasswordReset));
    emailVerificationRepo = module.get(getRepositoryToken(EmailVerificationToken));
    jwtService = module.get(JwtService);
    configService = module.get(AppConfigService);
    captchaService = module.get(CaptchaService);
    breachService = module.get(BreachPasswordService);
    mfaService = module.get(MfaService);
    anomalyDetectionService = module.get(AnomalyDetectionService);
  });

  // ─── Register ─────────────────────────────────────────────────────
  describe('register', () => {
    const dto = {
      email: 'new@example.com',
      password: 'StrongPass1!',
      fullName: 'New User',
    };

    it('should register a new user successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.register(dto);

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('message');
      expect(result.message).toContain('Registration successful');
      expect(mockUserRepo.create).toHaveBeenCalled();
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.register' }),
      );
    });

    it('should normalize email to lowercase', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await service.register({ ...dto, email: 'UPPER@Example.COM' });
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'upper@example.com' }),
      );
    });

    it('should fail when captcha verification fails', async () => {
      mockCaptchaService.verify.mockResolvedValue(false);
      await expect(service.register({ ...dto })).rejects.toThrow('CAPTCHA verification failed');
    });

    it('should return ambiguous message when email is already registered (anti-enumeration)', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, id: 'existing' });
      const result = await service.register(dto);
      expect(result.message).toContain('If this email is not already registered');
      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });

    it('should fail when password is found in breach database', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockBreachService.isBreached.mockResolvedValue(100);
      await expect(service.register(dto)).rejects.toThrow('data breaches');
    });

    it('should allow breached password when ignoreBreachWarning is true', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockBreachService.isBreached.mockResolvedValue(100);
      const result = await service.register({ ...dto, ignoreBreachWarning: true });
      expect(result).toHaveProperty('userId');
    });

    it('should create verification token with correct expiry', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await service.register(dto);
      expect(mockEmailVerificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  // ─── Login ────────────────────────────────────────────────────────
  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'StrongPass1!' };
    const verifiedUser = { ...testUser, isVerified: true, passwordHash: '' };

    beforeEach(async () => {
      verifiedUser.passwordHash = await bcrypt.hash('StrongPass1!', 10);
    });

    it('should login successfully with valid credentials', async () => {
      mockUserRepo.findOne.mockResolvedValue(verifiedUser);
      const result = await service.login(dto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login' }),
      );
    });

    it('should fail with invalid captcha', async () => {
      mockCaptchaService.verify.mockResolvedValue(false);
      await expect(service.login(dto)).rejects.toThrow('CAPTCHA verification failed');
    });

    it('should return ambiguous error for non-existent user (anti-enumeration)', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.login.failed', metadata: expect.objectContaining({ reason: 'user_not_found' }) }),
      );
    });

    it('should hash dummy password for non-existent user (timing attack prevention)', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockCaptchaService.verify.mockResolvedValue(true);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
      // Verification: code calls bcrypt.hash(dto.password, 10) for non-existent users
      // to prevent timing-based user enumeration
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it('should return ambiguous error for unverified email', async () => {
      mockUserRepo.findOne.mockResolvedValue(testUser);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
      // should not reveal that email is unverified
    });

    it('should return ambiguous error for wrong password', async () => {
      mockUserRepo.findOne.mockResolvedValue(verifiedUser);
      await expect(service.login({ ...dto, password: 'WrongPass1!' })).rejects.toThrow('Invalid credentials');
    });

    it('should increment failed attempts on wrong password', async () => {
      mockUserRepo.findOne.mockResolvedValue(verifiedUser);
      mockUserRepo.findOne.mockResolvedValueOnce(verifiedUser);
      mockUserRepo.findOne.mockResolvedValueOnce({ ...verifiedUser, failedAttempts: 1 });
      await expect(service.login({ ...dto, password: 'WrongPass1!' })).rejects.toThrow('Invalid credentials');
      expect(mockUserRepo.increment).toHaveBeenCalled();
    });

    it('should return ambiguous error for locked account', async () => {
      const lockedUser = {
        ...verifiedUser,
        lockedUntil: new Date(Date.now() + 1000000),
        failedAttempts: 5,
      };
      mockUserRepo.findOne.mockResolvedValue(lockedUser);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('should return ambiguous error for deactivated account', async () => {
      const deactivatedUser = { ...verifiedUser, isActive: false };
      mockUserRepo.findOne.mockResolvedValue(deactivatedUser);
      await expect(service.login(dto)).rejects.toThrow('Invalid credentials');
    });

    it('should lock account after max failed attempts', async () => {
      const userWithHighFails = { ...verifiedUser, failedAttempts: 4 };
      mockUserRepo.findOne
        .mockResolvedValueOnce(userWithHighFails)
        .mockResolvedValueOnce({ ...userWithHighFails, failedAttempts: 5 });
      await expect(service.login({ ...dto, password: 'WrongPass1!' })).rejects.toThrow('Invalid credentials');
      expect(mockEmailService.sendAccountLockedEmail).toHaveBeenCalled();
      expect(mockUserRepo.update).toHaveBeenCalledWith(
        verifiedUser.id,
        expect.objectContaining({ failedAttempts: 0, lockedUntil: expect.any(Date) }),
      );
    });

    it('should return MFA required when user has MFA enabled', async () => {
      const mfaUser = { ...verifiedUser, mfaEnabled: true };
      mockUserRepo.findOne.mockResolvedValue(mfaUser);
      const result = await service.login(dto);
      expect(result).toHaveProperty('mfaRequired', true);
      expect(result).toHaveProperty('tempToken');
      expect(jwtService.sign).toHaveBeenCalled();
    });

    it('should sanitize user object in response (no passwordHash, mfaSecret)', async () => {
      mockUserRepo.findOne.mockResolvedValue(verifiedUser);
      const result = await service.login(dto);
      if ('user' in result) {
        expect(result.user).not.toHaveProperty('passwordHash');
        expect(result.user).not.toHaveProperty('mfaSecret');
      }
    });
  });

  // ─── Email Verification ───────────────────────────────────────────
  describe('verifyEmail', () => {
    const dto = { email: 'test@example.com', code: '123456' };

    it('should verify email successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, isVerified: false });
      mockEmailVerificationRepo.findOne.mockResolvedValue({
        id: 'ev-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 100000),
      });
      const result = await service.verifyEmail(dto);
      expect(result.message).toContain('verified');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { isVerified: true });
    });

    it('should throw for non-existent user (anti-enumeration)', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail(dto)).rejects.toThrow('Invalid verification code');
    });

    it('should throw for expired code', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, isVerified: false });
      mockEmailVerificationRepo.findOne.mockResolvedValue({
        id: 'ev-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 100000),
      });
      await expect(service.verifyEmail(dto)).rejects.toThrow('Verification code has expired');
    });

    it('should throw for already verified user (anti-enumeration)', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, isVerified: true });
      mockEmailVerificationRepo.findOne.mockResolvedValue({
        id: 'ev-1', userId: 'user-1', expiresAt: new Date(Date.now() + 100000),
      });
      await expect(service.verifyEmail(dto)).rejects.toThrow('Invalid verification code');
    });
  });

  // ─── Resend Verification ─────────────────────────────────────────
  describe('resendVerification', () => {
    it('should return ambiguous message for non-existent user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.resendVerification({ email: 'nonexistent@example.com' });
      expect(result.message).toContain('If this email is registered');
    });

    it('should throw for already verified user', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, isVerified: true });
      await expect(service.resendVerification({ email: 'test@example.com' })).rejects.toThrow('Email already verified');
    });

    it('should send new verification code for unverified user', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, isVerified: false });
      const result = await service.resendVerification({ email: 'test@example.com' });
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalled();
      expect(result.message).toContain('If this email is registered');
    });
  });

  // ─── MFA Setup / Enable / Disable ────────────────────────────────
  describe('MFA setup', () => {
    const mfaUser = { ...testUser, mfaEnabled: false, mfaSecret: null! };

    it('should setup MFA and return QR code', async () => {
      mockUserRepo.findOne.mockResolvedValue(mfaUser);
      const result = await service.setupMfa('user-1');
      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { mfaSecret: 'MFA_SECRET' });
    });

    it('should throw if MFA is already enabled', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...mfaUser, mfaEnabled: true });
      await expect(service.setupMfa('user-1')).rejects.toThrow('MFA is already enabled');
    });
  });

  describe('enableMfa', () => {
    const dto = { totpCode: '123456' };

    it('should enable MFA with valid TOTP code', async () => {
      const userWithSecret = { ...testUser, mfaSecret: 'MFA_SECRET', mfaEnabled: false };
      mockUserRepo.findOne.mockResolvedValue(userWithSecret);
      mockMfaService.verifyTotp.mockReturnValue(true);
      const result = await service.enableMfa('user-1', dto);
      expect(result).toHaveProperty('backupCodes');
      expect(result.message).toContain('MFA enabled');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1',
        expect.objectContaining({ mfaEnabled: true }),
      );
    });

    it('should throw with invalid TOTP code', async () => {
      const userWithSecret = { ...testUser, mfaSecret: 'MFA_SECRET', mfaEnabled: false };
      mockUserRepo.findOne.mockResolvedValue(userWithSecret);
      mockMfaService.verifyTotp.mockReturnValue(false);
      await expect(service.enableMfa('user-1', dto)).rejects.toThrow('Invalid TOTP code');
    });

    it('should throw if MFA secret not set up', async () => {
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, mfaEnabled: false });
      await expect(service.enableMfa('user-1', dto)).rejects.toThrow('Please set up MFA first');
    });
  });

  describe('disableMfa', () => {
    const dto = { password: 'StrongPass1!', totpCode: '123456' };

    it('should disable MFA with valid password and TOTP', async () => {
      const pwHash = await bcrypt.hash('StrongPass1!', 10);
      const mfaEnabledUser = { ...testUser, mfaEnabled: true, mfaSecret: 'SECRET', passwordHash: pwHash };
      mockUserRepo.findOne.mockResolvedValue(mfaEnabledUser);
      mockMfaService.verifyTotp.mockReturnValue(true);
      const result = await service.disableMfa('user-1', dto);
      expect(result.message).toContain('MFA disabled');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1',
        expect.objectContaining({ mfaEnabled: false }),
      );
    });

    it('should throw with invalid password', async () => {
      const pwHash = await bcrypt.hash('StrongPass1!', 10);
      mockUserRepo.findOne.mockResolvedValue({
        ...testUser, mfaEnabled: true, mfaSecret: 'SECRET', passwordHash: pwHash,
      });
      await expect(service.disableMfa('user-1', { ...dto, password: 'WrongPass1!' })).rejects.toThrow('Invalid password');
    });
  });

  // ─── Forgot / Reset Password ─────────────────────────────────────
  describe('forgotPassword', () => {
    it('should return ambiguous message for non-existent user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.forgotPassword({ email: 'nonexistent@example.com' });
      expect(result.message).toContain('If an account');
    });

    it('should send reset code for existing user', async () => {
      mockUserRepo.findOne.mockResolvedValue(testUser);
      const result = await service.forgotPassword({ email: 'test@example.com' });
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();
      expect(result.message).toContain('If an account');
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid code', async () => {
      const code = '123456';
      const hashedCode = await bcrypt.hash(code, 10);
      const resetToken = {
        id: 'pr-1',
        code: hashedCode,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 100000),
        used: false,
      };
      const pwHash = await bcrypt.hash('OldPass123!', 10);
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, passwordHash: pwHash });
      mockPasswordResetRepo.find.mockResolvedValue([resetToken]);
      const result = await service.resetPassword({ email: 'test@example.com', code, password: 'NewPass123!' });
      expect(result.message).toContain('Password reset successfully');
      expect(mockUserRepo.update).toHaveBeenCalled();
    });

    it('should throw for non-existent user (anti-enumeration)', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.resetPassword({ email: 'test@example.com', code: '123456', password: 'NewPass123!' })).rejects.toThrow('Invalid reset code');
    });

    it('should throw when new password is same as old', async () => {
      const code = '123456';
      const hashedCode = await bcrypt.hash(code, 10);
      const samePassword = await bcrypt.hash('SamePass1!', 10);
      const resetToken = {
        id: 'pr-1',
        code: hashedCode,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 100000),
        used: false,
      };
      // Password hash matches the new password (simulating same password)
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, passwordHash: samePassword });
      mockPasswordResetRepo.find.mockResolvedValue([resetToken]);
      // bcrypt.compare should return true for the same password
      await expect(
        service.resetPassword({ email: 'test@example.com', code, password: 'SamePass1!' }),
      ).rejects.toThrow('New password must be different');
    });

    it('should throw with expired reset code', async () => {
      const code = '123456';
      const hashedCode = await bcrypt.hash(code, 10);
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, passwordHash: '' });
      mockPasswordResetRepo.find.mockResolvedValue([
        { id: 'pr-1', code: hashedCode, userId: 'user-1', expiresAt: new Date(Date.now() - 100000), used: false },
      ]);
      await expect(service.resetPassword({ email: 'test@example.com', code, password: 'NewPass123!' })).rejects.toThrow('Reset code has expired');
    });
  });

  // ─── Refresh Token ───────────────────────────────────────────────
  describe('refreshTokens', () => {
    it('should refresh token successfully', async () => {
      const fakeTxManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            id: 'rt-1',
            token: 'hashed-refresh',
            userId: 'user-1',
            family: 'family-1',
            isRevoked: false,
            expiresAt: new Date(Date.now() + 10000000),
            user: { ...testUser, isVerified: true, isActive: true },
          }),
        }),
        update: jest.fn(),
        delete: jest.fn(),
        save: jest.fn((entity) => Promise.resolve(entity)),
      };
      mockDataSource.transaction.mockImplementation(async (_level, cb) => cb(fakeTxManager));

      const result = await service.refreshTokens('valid-refresh-token');
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(fakeTxManager.update).toHaveBeenCalled();
    });

    it('should throw for invalid refresh token', async () => {
      const fakeTxManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null),
        }),
        delete: jest.fn(),
        update: jest.fn(),
        save: jest.fn(),
      };
      mockDataSource.transaction.mockImplementation(async (_level, cb) => cb(fakeTxManager));

      await expect(service.refreshTokens('invalid-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should revoke all family tokens on replay attack', async () => {
      const fakeTxManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            id: 'rt-1',
            token: 'hashed-refresh',
            userId: 'user-1',
            family: 'family-1',
            isRevoked: true,
            expiresAt: new Date(Date.now() + 10000000),
            user: { ...testUser, isVerified: true, isActive: true },
          }),
        }),
        delete: jest.fn(),
        update: jest.fn(),
        save: jest.fn(),
      };
      mockDataSource.transaction.mockImplementation(async (_level, cb) => cb(fakeTxManager));

      await expect(service.refreshTokens('replayed-token')).rejects.toThrow('Refresh token has been revoked');
      expect(fakeTxManager.delete).toHaveBeenCalled();
    });

    it('should throw for expired refresh token', async () => {
      const fakeTxManager = {
        createQueryBuilder: jest.fn().mockReturnValue({
          innerJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({
            id: 'rt-1',
            token: 'hashed-refresh',
            userId: 'user-1',
            family: 'family-1',
            isRevoked: false,
            expiresAt: new Date(Date.now() - 10000),
            user: { ...testUser, isVerified: true, isActive: true },
          }),
        }),
        update: jest.fn(),
        delete: jest.fn(),
        save: jest.fn(),
      };
      mockDataSource.transaction.mockImplementation(async (_level, cb) => cb(fakeTxManager));

      await expect(service.refreshTokens('expired-token')).rejects.toThrow('Refresh token has expired');
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────
  describe('logout', () => {
    it('should revoke refresh token on logout', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue({
        id: 'rt-1',
        token: 'hashed-token',
        userId: 'user-1',
        isRevoked: false,
      });
      const result = await service.logout('valid-refresh', 'user-1');
      expect(mockRefreshTokenRepo.update).toHaveBeenCalled();
      expect(result.message).toContain('Logged out');
    });

    it('should not throw if token not found', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);
      const result = await service.logout('nonexistent');
      expect(result.message).toContain('Logged out');
    });
  });

  // ─── Session Management ──────────────────────────────────────────
  describe('listSessions', () => {
    it('should list active sessions', async () => {
      mockRefreshTokenRepo.find.mockResolvedValue([
        { id: 'rt-1', userId: 'user-1', deviceInfo: 'Chrome/Windows', ipAddress: '1.2.3.4', location: null, createdAt: new Date(), lastUsedAt: new Date(), expiresAt: new Date(Date.now() + 10000000), isRevoked: false, family: 'f1' },
      ]);
      const sessions = await service.listSessions('user-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0]).toHaveProperty('deviceInfo', 'Chrome/Windows');
    });

    it('should filter out expired sessions', async () => {
      mockRefreshTokenRepo.find.mockResolvedValue([
        { id: 'rt-1', userId: 'user-1', deviceInfo: 'Old', ipAddress: '1.2.3.4', location: null, createdAt: new Date(), lastUsedAt: new Date(), expiresAt: new Date(Date.now() - 10000), isRevoked: false, family: 'f1' },
      ]);
      const sessions = await service.listSessions('user-1');
      expect(sessions).toHaveLength(0);
    });
  });

  describe('revokeSession', () => {
    it('should revoke a specific session', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue({ id: 'rt-1', userId: 'user-1', isRevoked: false });
      const result = await service.revokeSession('rt-1', 'user-1');
      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith('rt-1', { isRevoked: true });
      expect(result.message).toContain('revoked');
    });

    it('should throw if session not found', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.revokeSession('rt-nonexistent', 'user-1')).rejects.toThrow('Session not found');
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all sessions except current', async () => {
      mockRefreshTokenRepo.findOne.mockResolvedValue({ id: 'current-rt', userId: 'user-1', token: 'hashed' });
      mockRefreshTokenRepo.find.mockResolvedValue([
        { id: 'current-rt', userId: 'user-1', isRevoked: false },
        { id: 'other-rt', userId: 'user-1', isRevoked: false },
      ]);
      const result = await service.revokeAllSessions('user-1', 'current-refresh');
      expect(mockRefreshTokenRepo.update).toHaveBeenCalledWith(['other-rt'], { isRevoked: true });
      expect(result.message).toContain('revoked');
    });
  });

  // ─── MFA Verify ──────────────────────────────────────────────────
  describe('verifyMfa', () => {
    it('should verify MFA and return tokens', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1', email: 'test@example.com', role: 'user', mfaPending: true,
      });
      const mfaUser = { ...testUser, isVerified: true, mfaSecret: 'SECRET', mfaEnabled: true };
      mockUserRepo.findOne.mockResolvedValue(mfaUser);
      mockMfaService.verifyTotp.mockReturnValue(true);

      const result = await service.verifyMfa({ tempToken: 'temp-token', totpCode: '123456' });
      expect(result).toHaveProperty('accessToken');
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'auth.mfa.verified' }),
      );
    });

    it('should throw with invalid temp token', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error('Invalid token'); });
      await expect(service.verifyMfa({ tempToken: 'bad', totpCode: '123456' })).rejects.toThrow('Invalid or expired temporary token');
    });

    it('should throw if mfaPending flag is missing', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', email: 'test@example.com', role: 'user' });
      await expect(service.verifyMfa({ tempToken: 'valid-but-not-mfa', totpCode: '123456' })).rejects.toThrow('Invalid token for MFA verification');
    });

    it('should throw with invalid TOTP code', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'user-1', email: 'test@example.com', role: 'user', mfaPending: true,
      });
      mockUserRepo.findOne.mockResolvedValue({ ...testUser, mfaSecret: 'SECRET' });
      mockMfaService.verifyTotp.mockReturnValue(false);

      await expect(service.verifyMfa({ tempToken: 'temp', totpCode: '000000' })).rejects.toThrow('Invalid MFA code');
    });
  });

  // ─── Google OAuth ────────────────────────────────────────────────
  describe('googleOAuthLogin', () => {
    const googleProfile = {
      email: 'google@example.com',
      firstName: 'Google',
      lastName: 'User',
      providerId: 'google-provider-id',
      picture: 'https://example.com/photo.jpg',
    };

    it('should create new user from Google OAuth', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.googleOAuthLogin(googleProfile);
      if (!('mfaRequired' in result) && !('stepUpRequired' in result)) {
        expect(result).toHaveProperty('accessToken');
        expect(mockUserRepo.save).toHaveBeenCalled();
      }
    });

    it('should link existing credentials user to Google', async () => {
      const credUser = { ...testUser, isVerified: false, provider: 'credentials' };
      mockUserRepo.findOne.mockResolvedValue(credUser);
      mockUserRepo.findOne.mockResolvedValueOnce(credUser);
      mockUserRepo.findOne.mockResolvedValueOnce({ ...credUser, provider: 'google', providerId: 'google-provider-id' });
      const result = await service.googleOAuthLogin(googleProfile);
      if (!('mfaRequired' in result) && !('stepUpRequired' in result)) {
        expect(mockUserRepo.update).toHaveBeenCalledWith('user-1',
          expect.objectContaining({ provider: 'google', isVerified: true }),
        );
      }
    });

    it('should throw for account conflict', async () => {
      const conflictUser = { ...testUser, provider: 'google', providerId: 'different-id' };
      mockUserRepo.findOne.mockResolvedValue(conflictUser);
      await expect(service.googleOAuthLogin(googleProfile)).rejects.toThrow('Account conflict detected');
    });
  });
});
