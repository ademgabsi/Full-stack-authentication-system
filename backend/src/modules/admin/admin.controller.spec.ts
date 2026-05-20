import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { DeviceFingerprintService } from '../device-fingerprint/device-fingerprint.service';
import { AnomalyDetectionService } from '../device-fingerprint/anomaly-detection.service';
import { AuditLogService } from '../audit/audit.service';
import { Request } from 'express';
import { ForbiddenException } from '@nestjs/common';

const mockAdminService = {
  listUsers: jest.fn(),
  getUser: jest.fn(),
  updateUser: jest.fn(),
  lockUser: jest.fn(),
  deactivateUser: jest.fn(),
  queryAuditLogs: jest.fn(),
  getAuditLogStats: jest.fn(),
};

const mockFingerprintService = {
  findByUser: jest.fn(),
  trustFingerprint: jest.fn(),
  revokeFingerprint: jest.fn(),
};

const mockAnomalyService = {
  listAnomalies: jest.fn(),
};

const mockAuditLogService = {
  log: jest.fn(() => Promise.resolve()),
};

describe('AdminController', () => {
  let controller: AdminController;
  let adminService: typeof mockAdminService;
  let fingerprintService: typeof mockFingerprintService;

  const mockReq = { headers: {}, ip: '127.0.0.1' } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: AdminService, useValue: mockAdminService },
        { provide: DeviceFingerprintService, useValue: mockFingerprintService },
        { provide: AnomalyDetectionService, useValue: mockAnomalyService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get(AdminService);
    fingerprintService = module.get(DeviceFingerprintService);
  });

  describe('listUsers', () => {
    it('should return paginated users', async () => {
      mockAdminService.listUsers.mockResolvedValue({ users: [], total: 0, page: 1, limit: 10, totalPages: 0 });
      const result = await controller.listUsers({ page: 1, limit: 10 });
      expect(result).toHaveProperty('users');
    });
  });

  describe('getUser', () => {
    it('should return user details', async () => {
      mockAdminService.getUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
      const result = await controller.getUser('user-1');
      expect(result.id).toBe('user-1');
    });
  });

  describe('updateUser', () => {
    it('should throw when admin modifies self', async () => {
      await expect(
        controller.updateUser('admin-1', { fullName: 'Test' }, 'admin-1', mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update another user', async () => {
      mockAdminService.updateUser.mockResolvedValue({ id: 'user-2', fullName: 'Updated' });
      const result = await controller.updateUser('user-2', { fullName: 'Updated' }, 'admin-1', mockReq);
      expect(result.fullName).toBe('Updated');
    });
  });

  describe('lockUser', () => {
    it('should throw when admin locks self', async () => {
      await expect(
        controller.lockUser('admin-1', { locked: true }, 'admin-1', mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should lock another user', async () => {
      mockAdminService.lockUser.mockResolvedValue({ id: 'user-2' });
      await controller.lockUser('user-2', { locked: true }, 'admin-1', mockReq);
      expect(mockAdminService.lockUser).toHaveBeenCalled();
    });
  });

  describe('deactivateUser', () => {
    it('should throw when admin deactivates self', async () => {
      await expect(
        controller.deactivateUser('admin-1', 'admin-1', mockReq),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should deactivate another user', async () => {
      mockAdminService.deactivateUser.mockResolvedValue({ message: 'User deactivated' });
      await controller.deactivateUser('user-2', 'admin-1', mockReq);
      expect(mockAdminService.deactivateUser).toHaveBeenCalled();
    });
  });

  describe('queryAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      mockAdminService.queryAuditLogs.mockResolvedValue({ logs: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      const result = await controller.queryAuditLogs({});
      expect(result).toHaveProperty('logs');
    });
  });

  describe('getAuditLogStats', () => {
    it('should return audit log stats', async () => {
      mockAdminService.getAuditLogStats.mockResolvedValue({ totalLogs: 100, failedLogins: 5 });
      const result = await controller.getAuditLogStats();
      expect(result.totalLogs).toBe(100);
    });
  });

  describe('listAnomalies', () => {
    it('should return anomaly logs', async () => {
      mockAnomalyService.listAnomalies.mockResolvedValue({ anomalies: [], total: 0 });
      const result = await controller.listAnomalies({});
      expect(result).toHaveProperty('anomalies');
    });
  });

  describe('getUserFingerprints', () => {
    it('should return user device fingerprints', async () => {
      mockFingerprintService.findByUser.mockResolvedValue([{ id: 'fp-1', fingerprintHash: 'hash1' }]);
      const result = await controller.getUserFingerprints('user-1', 'admin-1', mockReq);
      expect(result).toHaveLength(1);
    });
  });

  describe('getUserAnomalies', () => {
    it('should return user anomaly logs', async () => {
      mockAnomalyService.listAnomalies.mockResolvedValue({ anomalies: [], total: 0 });
      const result = await controller.getUserAnomalies('user-1', {});
      expect(result).toHaveProperty('anomalies');
    });
  });

  describe('trustFingerprint', () => {
    it('should trust a fingerprint', async () => {
      const result = await controller.trustFingerprint('fp-1');
      expect(mockFingerprintService.trustFingerprint).toHaveBeenCalledWith('fp-1');
      expect(result.message).toContain('trusted');
    });
  });

  describe('revokeFingerprint', () => {
    it('should revoke a fingerprint', async () => {
      const result = await controller.revokeFingerprint('fp-1');
      expect(mockFingerprintService.revokeFingerprint).toHaveBeenCalledWith('fp-1');
      expect(result.message).toContain('revoked');
    });
  });
});
