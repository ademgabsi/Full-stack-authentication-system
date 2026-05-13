import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { DeviceFingerprint } from '../../entities/device-fingerprint.entity';

const mockRequest = {
  headers: {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    'accept-language': 'en-US,en;q=0.9',
    'accept-encoding': 'gzip, deflate, br',
  },
  ip: '192.168.1.1',
} as unknown as Request;

describe('DeviceFingerprintService', () => {
  let service: DeviceFingerprintService;
  let repo: Repository<DeviceFingerprint>;

  const mockRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((dto) => dto as DeviceFingerprint),
    save: jest.fn((entity) => Promise.resolve({ id: 'fp-1', ...entity })),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceFingerprintService,
        {
          provide: getRepositoryToken(DeviceFingerprint),
          useValue: mockRepo,
        },
      ],
    }).compile();

    service = module.get<DeviceFingerprintService>(DeviceFingerprintService);
    repo = module.get<Repository<DeviceFingerprint>>(
      getRepositoryToken(DeviceFingerprint),
    );
    jest.clearAllMocks();
  });

  describe('generateFingerprintHash', () => {
    it('should return a consistent hash for same inputs', () => {
      const clientData = {
        screenResolution: '1920x1080',
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Win32',
        canvasHash: 'abc123',
        webglHash: 'def456',
        fontsHash: 'ghi789',
        colorDepth: '24',
        touchSupport: 'false',
      };

      const hash1 = service.generateFingerprintHash(clientData, mockRequest);
      const hash2 = service.generateFingerprintHash(clientData, mockRequest);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex
    });

    it('should return different hashes for different inputs', () => {
      const clientData1 = { screenResolution: '1920x1080' };
      const clientData2 = { screenResolution: '2560x1440' };

      const hash1 = service.generateFingerprintHash(clientData1, mockRequest);
      const hash2 = service.generateFingerprintHash(clientData2, mockRequest);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getOrCreateFingerprint', () => {
    it('should return existing fingerprint and not create new one', async () => {
      const existing = {
        id: 'fp-existing',
        userId: 'user-1',
        fingerprintHash: 'hash123',
        loginCount: 3,
        lastSeenAt: new Date('2024-01-01'),
        isRevoked: false,
      };
      mockRepo.findOne.mockResolvedValue(existing);

      const result = await service.getOrCreateFingerprint({
        userId: 'user-1',
        fingerprintHash: 'hash123',
        ipAddress: '192.168.1.2',
      });

      expect(result.isNew).toBe(false);
      expect(result.fingerprint.loginCount).toBe(4);
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('should create new fingerprint when none exists', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.getOrCreateFingerprint({
        userId: 'user-1',
        fingerprintHash: 'newhash',
        browser: 'Chrome',
        os: 'Windows',
        ipAddress: '192.168.1.1',
      });

      expect(result.isNew).toBe(true);
      expect(result.fingerprint.loginCount).toBe(1);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    it('should not match revoked fingerprints', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await service.getOrCreateFingerprint({
        userId: 'user-1',
        fingerprintHash: 'hash123',
      });

      expect(mockRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRevoked: false }),
        }),
      );
    });
  });

  describe('trustFingerprint', () => {
    it('should update isTrusted to true', async () => {
      await service.trustFingerprint('fp-1');
      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'fp-1' },
        { isTrusted: true },
      );
    });
  });

  describe('revokeFingerprint', () => {
    it('should update isRevoked to true', async () => {
      await service.revokeFingerprint('fp-1');
      expect(mockRepo.update).toHaveBeenCalledWith(
        { id: 'fp-1' },
        { isRevoked: true },
      );
    });
  });
});
