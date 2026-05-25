import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { EmailService } from './email.service';
import { AppConfigService } from '../../config/app-config.service';

const mockMailerService = {
  sendMail: jest.fn(() => Promise.resolve()),
};

const mockConfigService = {
  smtpConfig: { fromName: 'AuthSystem' },
  url: 'http://localhost:3000',
};

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    mockMailerService.sendMail.mockReset().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: MailerService, useValue: mockMailerService },
        { provide: AppConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email with correct template', async () => {
      await service.sendVerificationEmail('test@example.com', '123456');

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Verify your email address',
        template: 'verify-email',
        context: { code: '123456', appName: 'AuthSystem' },
      });
    });

    it('should throw when mailer fails', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('Mail failed'));

      await expect(
        service.sendVerificationEmail('test@example.com', '123456'),
      ).rejects.toThrow('Mail failed');
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email with correct template', async () => {
      await service.sendWelcomeEmail('test@example.com', 'Test User');

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Welcome!',
        template: 'welcome',
        context: {
          fullName: 'Test User',
          appName: 'AuthSystem',
          loginUrl: 'http://localhost:3000/auth/login',
        },
      });
    });

    it('should not throw when mailer fails', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('Mail failed'));

      await expect(
        service.sendWelcomeEmail('test@example.com', 'Test User'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with correct template', async () => {
      await service.sendPasswordResetEmail('test@example.com', '123456');

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Reset your password',
        template: 'reset-password',
        context: { code: '123456', appName: 'AuthSystem' },
      });
    });

    it('should throw when mailer fails', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('Mail failed'));

      await expect(
        service.sendPasswordResetEmail('test@example.com', '123456'),
      ).rejects.toThrow('Mail failed');
    });
  });

  describe('sendMfaEnabledEmail', () => {
    it('should send MFA enabled email', async () => {
      await service.sendMfaEnabledEmail('test@example.com', 'Test User');

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Two-Factor Authentication Enabled',
        template: 'mfa-enabled',
        context: { fullName: 'Test User', appName: 'AuthSystem' },
      });
    });

    it('should not throw when mailer fails', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('Mail failed'));

      await expect(
        service.sendMfaEnabledEmail('test@example.com', 'Test User'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendAccountLockedEmail', () => {
    it('should send account locked email', async () => {
      await service.sendAccountLockedEmail('test@example.com', 'Test User');

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Account Locked',
        template: 'account-locked',
        context: {
          fullName: 'Test User',
          appName: 'AuthSystem',
          supportUrl: 'http://localhost:3000',
        },
      });
    });

    it('should not throw when mailer fails', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('Mail failed'));

      await expect(
        service.sendAccountLockedEmail('test@example.com', 'Test User'),
      ).resolves.toBeUndefined();
    });
  });

  describe('sendStepUpChallengeEmail', () => {
    it('should send step-up challenge email', async () => {
      await service.sendStepUpChallengeEmail('test@example.com', '654321');

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Unusual Activity Detected',
        template: 'step-up-challenge',
        context: { code: '654321', appName: 'AuthSystem' },
      });
    });

    it('should throw when mailer fails', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('Mail failed'));

      await expect(
        service.sendStepUpChallengeEmail('test@example.com', '654321'),
      ).rejects.toThrow('Mail failed');
    });
  });

  describe('sendAccountDeletionEmail', () => {
    it('should send account deletion email', async () => {
      await service.sendAccountDeletionEmail('test@example.com', '789012');

      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Account Deletion Request',
        template: 'account-deletion',
        context: { code: '789012', appName: 'AuthSystem' },
      });
    });

    it('should throw when mailer fails', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('Mail failed'));

      await expect(
        service.sendAccountDeletionEmail('test@example.com', '789012'),
      ).rejects.toThrow('Mail failed');
    });
  });
});
