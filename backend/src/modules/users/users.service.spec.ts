import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User, UserRole } from '../../entities/user.entity';
import { EmailVerificationToken } from '../../entities/email-verification-token.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { DeviceFingerprint } from '../../entities/device-fingerprint.entity';
import { AnomalyLog } from '../../entities/anomaly-log.entity';
import { StepUpChallenge } from '../../entities/step-up-challenge.entity';
import { WebAuthnCredential } from '../../entities/webauthn-credential.entity';
import { PasswordReset } from '../../entities/password-reset.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuditLogService } from '../audit/audit.service';
import { BreachPasswordService } from '../auth/breach-password.service';
import { WebhookService } from '../webhook/webhook.service';
import { EmailService } from '../email/email.service';

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
  isVerified: true,
  passkeysEnabled: false,
  lastLogin: new Date(),
  scheduledDeletionAt: null!,
  deletionRequestedAt: null!,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createMockRepo() {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto: any) => dto),
    save: jest.fn((entity: any) => Promise.resolve({ id: 'entity-1', ...entity })),
    update: jest.fn(() => Promise.resolve()),
    delete: jest.fn(() => Promise.resolve()),
    createQueryBuilder: jest.fn(),
  };
}

const mockUserRepo = createMockRepo();
const mockEmailVerifRepo = createMockRepo();
const mockRefreshTokenRepo2 = createMockRepo();
const mockDfRepo2 = createMockRepo();
const mockAlRepo2 = createMockRepo();
const mockScRepo2 = createMockRepo();
const mockWaRepo2 = createMockRepo();
const mockPrRepo2 = createMockRepo();

const mockDataSource = {
  transaction: jest.fn(),
};

const mockCloudinary = {
  uploadImage: jest.fn(() => Promise.resolve('https://cloud.example.com/img.jpg')),
  deleteImage: jest.fn(() => Promise.resolve()),
  getPublicIdFromUrl: jest.fn(() => 'profiles/abc123'),
};

const mockAuditLog = {
  log: jest.fn(() => Promise.resolve()),
};

const mockBreach = {
  isBreached: jest.fn(() => Promise.resolve(0)),
};

const mockWebhook = {
  dispatchEvent: jest.fn(() => Promise.resolve()),
};

const mockEmail = {
  sendAccountDeletionEmail: jest.fn(() => Promise.resolve()),
};

describe('UsersService', () => {
  let service: UsersService;
  let userRepo: ReturnType<typeof createMockRepo>;
  let emailVerificationRepo: ReturnType<typeof createMockRepo>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockBreach.isBreached.mockResolvedValue(0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(EmailVerificationToken), useValue: mockEmailVerifRepo },
        { provide: getRepositoryToken(RefreshToken), useValue: mockRefreshTokenRepo2 },
        { provide: getRepositoryToken(DeviceFingerprint), useValue: mockDfRepo2 },
        { provide: getRepositoryToken(AnomalyLog), useValue: mockAlRepo2 },
        { provide: getRepositoryToken(StepUpChallenge), useValue: mockScRepo2 },
        { provide: getRepositoryToken(WebAuthnCredential), useValue: mockWaRepo2 },
        { provide: getRepositoryToken(PasswordReset), useValue: mockPrRepo2 },
        { provide: DataSource, useValue: mockDataSource },
        { provide: CloudinaryService, useValue: mockCloudinary },
        { provide: AuditLogService, useValue: mockAuditLog },
        { provide: BreachPasswordService, useValue: mockBreach },
        { provide: WebhookService, useValue: mockWebhook },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepo = module.get(getRepositoryToken(User));
    emailVerificationRepo = module.get(getRepositoryToken(EmailVerificationToken));
  });

  describe('findById', () => {
    it('should return user by id', async () => {
      mockUserRepo.findOne.mockResolvedValue(testUser);
      const user = await service.findById('user-1');
      expect(user.id).toBe('user-1');
    });

    it('should throw NotFoundException for nonexistent user', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow('User not found');
    });
  });

  describe('sanitizeUser', () => {
    it('should remove sensitive fields (passwordHash, mfaSecret, mfaBackupCodes)', () => {
      const sanitized = service.sanitizeUser(testUser);
      expect(sanitized).not.toHaveProperty('passwordHash');
      expect(sanitized).not.toHaveProperty('mfaSecret');
      expect(sanitized).not.toHaveProperty('mfaBackupCodes');
    });

    it('should retain non-sensitive fields', () => {
      const sanitized = service.sanitizeUser(testUser);
      expect(sanitized).toHaveProperty('email', 'test@example.com');
      expect(sanitized).toHaveProperty('id', 'user-1');
      expect(sanitized).toHaveProperty('fullName', 'Test User');
      expect(sanitized).toHaveProperty('role', 'user');
    });
  });

  describe('updateProfile', () => {
    it('should update fullName', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(testUser);
      mockUserRepo.findOne.mockResolvedValueOnce({ ...testUser, fullName: 'Updated Name' });
      const result = await service.updateProfile('user-1', { fullName: 'Updated Name' });
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { fullName: 'Updated Name' });
      expect((result as any).fullName).toBe('Updated Name');
    });

    it('should throw when changing email to one already in use', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(testUser) // findById
        .mockResolvedValueOnce({ id: 'user-2', email: 'existing@example.com' }); // findByEmail
      await expect(
        service.updateProfile('user-1', { email: 'existing@example.com', currentPassword: 'StrongPass1!' }),
      ).rejects.toThrow('Email already in use');
    });

    it('should throw when changing email without currentPassword', async () => {
      mockUserRepo.findOne
        .mockResolvedValueOnce(testUser) // findById
        .mockResolvedValueOnce(null); // findByEmail returns null (no conflict)
      await expect(service.updateProfile('user-1', { email: 'new@example.com' })).rejects.toThrow(
        'Current password is required to change email',
      );
    });

    it('should throw for OAuth accounts when changing email', async () => {
      const oauthUser = { ...testUser, provider: 'google', passwordHash: null! };
      mockUserRepo.findOne
        .mockResolvedValueOnce(oauthUser) // findById
        .mockResolvedValueOnce(null) // findByEmail (no conflict)
        .mockResolvedValueOnce(oauthUser); // userRepository.findOne with select passwordHash
      await expect(
        service.updateProfile('user-1', { email: 'new@example.com', currentPassword: 'Pass1!' }),
      ).rejects.toThrow('Cannot change email for OAuth accounts');
    });
  });

  describe('changePassword', () => {
    it('should change password successfully', async () => {
      const pwHash = await bcrypt.hash('OldPass1!', 10);
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', passwordHash: pwHash });
      const result = await service.changePassword('user-1', {
        currentPassword: 'OldPass1!',
        newPassword: 'NewStrong1!',
      });
      expect(result.message).toContain('Password changed');
      expect(mockUserRepo.update).toHaveBeenCalled();
    });

    it('should throw when current password is wrong', async () => {
      const pwHash = await bcrypt.hash('OldPass1!', 10);
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', passwordHash: pwHash });
      await expect(
        service.changePassword('user-1', { currentPassword: 'WrongPass1!', newPassword: 'NewStrong1!' }),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw when new password is breached', async () => {
      const pwHash = await bcrypt.hash('OldPass1!', 10);
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', passwordHash: pwHash });
      mockBreach.isBreached.mockResolvedValue(50);
      await expect(
        service.changePassword('user-1', { currentPassword: 'OldPass1!', newPassword: 'Leaked1!' }),
      ).rejects.toThrow('data breaches');
    });

    it('should allow breached password with ignoreBreachWarning', async () => {
      const pwHash = await bcrypt.hash('OldPass1!', 10);
      mockUserRepo.findOne.mockResolvedValue({ id: 'user-1', passwordHash: pwHash });
      mockBreach.isBreached.mockResolvedValue(50);
      const result = await service.changePassword('user-1', {
        currentPassword: 'OldPass1!',
        newPassword: 'Leaked1!',
        ignoreBreachWarning: true,
      });
      expect(result.message).toContain('Password changed');
    });
  });

  describe('account deletion flow', () => {
    it('should request deletion and send confirmation code', async () => {
      mockUserRepo.findOne.mockResolvedValue(testUser);
      emailVerificationRepo.findOne.mockResolvedValue(null);
      const result = await service.requestDeletion('user-1');
      expect(result.message).toContain('Confirmation code');
      expect(mockEmail.sendAccountDeletionEmail).toHaveBeenCalled();
    });

    it('should confirm deletion and schedule for 14 days', async () => {
      mockUserRepo.findOne.mockResolvedValue(testUser); // findById
      emailVerificationRepo.findOne.mockResolvedValue({
        id: 'ev-1', userId: 'user-1', code: 'hashed-code', expiresAt: new Date(Date.now() + 100000),
      });
      const result = await service.confirmDeletion('user-1', '123456');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1',
        expect.objectContaining({ isActive: false, scheduledDeletionAt: expect.any(Date) }),
      );
      expect(result.message).toContain('scheduled for deletion');
    });

    it('should throw with invalid confirmation code', async () => {
      mockUserRepo.findOne.mockResolvedValue(testUser); // findById returns user
      emailVerificationRepo.findOne.mockResolvedValue(null);
      await expect(service.confirmDeletion('user-1', 'wrong')).rejects.toThrow('Invalid confirmation code');
    });

    it('should throw with expired confirmation code', async () => {
      mockUserRepo.findOne.mockResolvedValue(testUser); // findById returns user
      emailVerificationRepo.findOne.mockResolvedValue({
        id: 'ev-1', userId: 'user-1', code: 'hashed-code', expiresAt: new Date(Date.now() - 100000),
      });
      await expect(service.confirmDeletion('user-1', '123456')).rejects.toThrow('Confirmation code has expired');
    });

    it('should cancel deletion', async () => {
      const deletionUser = { ...testUser, scheduledDeletionAt: new Date(Date.now() + 100000) };
      mockUserRepo.findOne.mockResolvedValue(deletionUser); // findById
      emailVerificationRepo.findOne.mockResolvedValue({
        id: 'ev-1', userId: 'user-1', code: 'hashed-code', expiresAt: new Date(Date.now() + 100000),
      });
      const result = await service.cancelDeletion('user-1', '123456');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1',
        expect.objectContaining({ isActive: true }),
      );
      expect(result.message).toContain('cancelled');
    });

    it('should throw canceling when no deletion request exists', async () => {
      mockUserRepo.findOne.mockResolvedValue(testUser);
      await expect(service.cancelDeletion('user-1', '123456')).rejects.toThrow('No deletion request found');
    });
  });
});
