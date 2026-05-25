import { Test, TestingModule } from '@nestjs/testing';
import { DeviceFingerprintController } from './device-fingerprint.controller';
import { DeviceFingerprintService } from './device-fingerprint.service';

const mockFingerprintService = {
  findByUser: jest.fn(),
};

describe('DeviceFingerprintController', () => {
  let controller: DeviceFingerprintController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeviceFingerprintController],
      providers: [
        { provide: DeviceFingerprintService, useValue: mockFingerprintService },
      ],
    }).compile();

    controller = module.get<DeviceFingerprintController>(DeviceFingerprintController);
    jest.clearAllMocks();
  });

  describe('listMyFingerprints', () => {
    it('should return fingerprints for the authenticated user', async () => {
      const mockFingerprints = [
        {
          id: 'fp-1',
          userId: 'user-1',
          hash: 'abc123',
          deviceInfo: 'Chrome / Mac',
          lastSeen: new Date(),
          createdAt: new Date(),
          trusted: true,
        },
      ];
      mockFingerprintService.findByUser.mockResolvedValue(mockFingerprints);

      const result = await controller.listMyFingerprints('user-1');

      expect(mockFingerprintService.findByUser).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockFingerprints);
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no fingerprints', async () => {
      mockFingerprintService.findByUser.mockResolvedValue([]);

      const result = await controller.listMyFingerprints('user-1');

      expect(result).toEqual([]);
    });
  });
});
