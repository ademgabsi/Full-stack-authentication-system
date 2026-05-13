import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { DeviceFingerprint } from '../../entities/device-fingerprint.entity';
import { AnomalyLog, AnomalyType } from '../../entities/anomaly-log.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';

const mockRequest = {
  headers: {
    'user-agent': 'Mozilla/5.0 Chrome/120.0.0.0',
    'x-forwarded-for': '203.0.113.1',
  },
  ip: '203.0.113.1',
} as unknown as Request;

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;
  let anomalyRepo: Repository<AnomalyLog>;

  const mockFingerprintRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockAnomalyRepo = {
    create: jest.fn((dto) => dto as AnomalyLog),
    save: jest.fn((entity) => Promise.resolve({ id: 'anomaly-1', ...entity })),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    })),
  };

  const mockRefreshTokenRepo = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnomalyDetectionService,
        {
          provide: getRepositoryToken(DeviceFingerprint),
          useValue: mockFingerprintRepo,
        },
        {
          provide: getRepositoryToken(AnomalyLog),
          useValue: mockAnomalyRepo,
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
      ],
    }).compile();

    service = module.get<AnomalyDetectionService>(AnomalyDetectionService);
    anomalyRepo = module.get<Repository<AnomalyLog>>(
      getRepositoryToken(AnomalyLog),
    );
    jest.clearAllMocks();
  });

  describe('detectAnomalies', () => {
    it('should return no anomalies for known device and IP', async () => {
      mockFingerprintRepo.findOne.mockResolvedValueOnce({
        id: 'fp-1',
        userId: 'user-1',
        ipAddress: '203.0.113.1',
      });
      mockFingerprintRepo.find.mockResolvedValueOnce([{ countryCode: 'US' }]);
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        ipAddress: '203.0.113.1',
        lastUsedAt: new Date(),
      });

      const fingerprint = {
        id: 'fp-1',
        userId: 'user-1',
        fingerprintHash: 'hash',
      } as DeviceFingerprint;

      const result = await service.detectAnomalies({
        userId: 'user-1',
        fingerprint,
        isNewFingerprint: false,
        ipAddress: '203.0.113.1',
        req: mockRequest,
      });

      expect(result.anomalies).toEqual([]);
      expect(result.riskScore).toBe(0);
      expect(result.shouldStepUp).toBe(false);
    });

    it('should detect new device anomaly', async () => {
      mockFingerprintRepo.findOne.mockResolvedValueOnce(null);
      mockFingerprintRepo.find.mockResolvedValueOnce([{ countryCode: 'US' }]);
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        ipAddress: '203.0.113.1',
        lastUsedAt: new Date(),
      });

      const fingerprint = {
        id: 'fp-new',
        userId: 'user-1',
        fingerprintHash: 'newhash',
      } as DeviceFingerprint;

      const result = await service.detectAnomalies({
        userId: 'user-1',
        fingerprint,
        isNewFingerprint: true,
        ipAddress: '203.0.113.1',
        req: mockRequest,
      });

      expect(result.anomalies).toContain(AnomalyType.NEW_DEVICE);
      expect(result.riskScore).toBeGreaterThan(0);
    });

    it('should trigger step-up for impossible travel', async () => {
      mockFingerprintRepo.findOne.mockResolvedValueOnce(null);
      mockFingerprintRepo.find.mockResolvedValueOnce([]);
      // Previous session in Tokyo, current in New York (impossible in 1 hour)
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce({
        ipAddress: '1.1.1.1',
        lastUsedAt: new Date(Date.now() - 60 * 60 * 1000),
      });

      const fingerprint = {
        id: 'fp-1',
        userId: 'user-1',
        fingerprintHash: 'hash',
      } as DeviceFingerprint;

      const result = await service.detectAnomalies({
        userId: 'user-1',
        fingerprint,
        isNewFingerprint: false,
        ipAddress: '8.8.8.8',
        req: mockRequest,
      });

      expect(result.anomalies).toContain(AnomalyType.IMPOSSIBLE_TRAVEL);
      expect(result.shouldStepUp).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(0.9);
    });

    it('should trigger step-up when risk score >= 0.5', async () => {
      // New device + new IP + new location = 0.8 risk
      mockFingerprintRepo.findOne.mockResolvedValueOnce(null); // new IP
      mockFingerprintRepo.find.mockResolvedValueOnce([]); // no known countries
      mockRefreshTokenRepo.findOne.mockResolvedValueOnce(null); // no previous session

      const fingerprint = {
        id: 'fp-new',
        userId: 'user-1',
        fingerprintHash: 'newhash',
      } as DeviceFingerprint;

      const result = await service.detectAnomalies({
        userId: 'user-1',
        fingerprint,
        isNewFingerprint: true,
        ipAddress: '203.0.113.50',
        req: mockRequest,
      });

      expect(result.shouldStepUp).toBe(true);
      expect(result.riskScore).toBeGreaterThanOrEqual(0.5);
      expect(mockAnomalyRepo.save).toHaveBeenCalled();
    });
  });

  describe('logAnomaly', () => {
    it('should create and save anomaly log', async () => {
      await service.logAnomaly({
        userId: 'user-1',
        action: 'login',
        anomalyType: AnomalyType.NEW_DEVICE,
        riskScore: 0.3,
        req: mockRequest,
      });

      expect(mockAnomalyRepo.create).toHaveBeenCalled();
      expect(mockAnomalyRepo.save).toHaveBeenCalled();
    });
  });

  describe('markStepUpCompleted', () => {
    it('should update anomaly logs for user', async () => {
      await service.markStepUpCompleted('user-1');
      expect(mockAnomalyRepo.update).toHaveBeenCalledWith(
        {
          userId: 'user-1',
          stepUpCompleted: false,
          stepUpIssued: true,
        },
        { stepUpCompleted: true },
      );
    });
  });

  describe('haversineDistance', () => {
    it('should calculate correct distance between two points', () => {
      // Distance between New York and London should be ~5570 km
      const distance = (service as any).haversineDistance(
        40.7128,
        -74.006, // NYC
        51.5074,
        -0.1278, // London
      );
      expect(distance).toBeGreaterThan(5500);
      expect(distance).toBeLessThan(5600);
    });

    it('should return 0 for same coordinates', () => {
      const distance = (service as any).haversineDistance(
        40.7128,
        -74.006,
        40.7128,
        -74.006,
      );
      expect(distance).toBe(0);
    });
  });
});
