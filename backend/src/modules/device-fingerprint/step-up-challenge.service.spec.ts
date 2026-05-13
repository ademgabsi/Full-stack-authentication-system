import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { StepUpChallengeService } from './step-up-challenge.service';
import { StepUpChallenge, StepUpType } from '../../entities/step-up-challenge.entity';
import { EmailService } from '../email/email.service';
import { AppConfigService } from '../../config/app-config.service';

describe('StepUpChallengeService', () => {
  let service: StepUpChallengeService;
  let repo: Repository<StepUpChallenge>;
  let emailService: EmailService;

  const mockRepo = {
    create: jest.fn((dto) => ({ ...dto, used: false }) as StepUpChallenge),
    save: jest.fn((entity) =>
      Promise.resolve({ id: 'challenge-1', ...entity }),
    ),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockEmailService = {
    sendStepUpChallengeEmail: jest.fn().mockResolvedValue(undefined),
  };

  const mockJwtService = {};

  const mockConfigService = {
    jwtSecret: 'test-secret',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StepUpChallengeService,
        {
          provide: getRepositoryToken(StepUpChallenge),
          useValue: mockRepo,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StepUpChallengeService>(StepUpChallengeService);
    repo = module.get<Repository<StepUpChallenge>>(
      getRepositoryToken(StepUpChallenge),
    );
    emailService = module.get<EmailService>(EmailService);
    jest.clearAllMocks();
  });

  describe('createEmailChallenge', () => {
    it('should create challenge and send email', async () => {
      const result = await service.createEmailChallenge(
        'user-1',
        'test@example.com',
      );

      expect(result.stepUpToken).toBeDefined();
      expect(result.stepUpToken).toHaveLength(36); // UUID format
      expect(mockRepo.save).toHaveBeenCalled();
      const savedCall = mockRepo.save.mock.calls[0][0];
      expect(savedCall.type).toBe(StepUpType.EMAIL_OTP);
      expect(savedCall.code).toHaveLength(6);
      expect(savedCall.used).toBe(false);
      expect(mockEmailService.sendStepUpChallengeEmail).toHaveBeenCalledWith(
        'test@example.com',
        savedCall.code,
      );
    });

    it('should generate unique tokens for each call', async () => {
      const result1 = await service.createEmailChallenge('user-1', 'a@b.com');
      const result2 = await service.createEmailChallenge('user-1', 'a@b.com');

      expect(result1.stepUpToken).not.toBe(result2.stepUpToken);
    });
  });

  describe('verifyChallenge', () => {
    it('should verify valid challenge', async () => {
      const token = 'valid-token-uuid';
      const code = '123456';
      const tokenHash = require('crypto')
        .createHash('sha256')
        .update(token)
        .digest('hex');

      mockRepo.findOne.mockResolvedValue({
        id: 'challenge-1',
        tokenHash,
        code,
        used: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        userId: 'user-1',
      });

      const result = await service.verifyChallenge(token, code);

      expect(result.userId).toBe('user-1');
      expect(mockRepo.update).toHaveBeenCalledWith('challenge-1', { used: true });
    });

    it('should throw for invalid token', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyChallenge('invalid-token', '123456'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw for already used challenge', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'challenge-1',
        tokenHash: 'hash',
        code: '123456',
        used: true,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(
        service.verifyChallenge('token', '123456'),
      ).rejects.toThrow('already been used');
    });

    it('should throw for expired challenge', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'challenge-1',
        tokenHash: 'hash',
        code: '123456',
        used: false,
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      });

      await expect(
        service.verifyChallenge('token', '123456'),
      ).rejects.toThrow('expired');
    });

    it('should throw for wrong code', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'challenge-1',
        tokenHash: 'hash',
        code: '123456',
        used: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(
        service.verifyChallenge('token', '999999'),
      ).rejects.toThrow('Invalid step-up code');
    });
  });
});
