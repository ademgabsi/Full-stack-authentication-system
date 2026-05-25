import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit.service';
import { AuditLog } from '../../entities/audit-log.entity';

const mockAuditLogRepo = {
  create: jest.fn((dto) => dto as AuditLog),
  save: jest.fn((entity) => Promise.resolve({ id: 'log-1', ...entity })),
};

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: getRepositoryToken(AuditLog),
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create and save an audit log entry', async () => {
      await service.log({
        userId: 'user-1',
        action: 'auth.login',
        resource: 'session',
        metadata: { ip: '127.0.0.1' },
      });

      const savedEntry = mockAuditLogRepo.save.mock.calls[0][0];
      expect(savedEntry.userId).toBe('user-1');
      expect(savedEntry.action).toBe('auth.login');
      expect(savedEntry.resource).toBe('session');
      expect(savedEntry.ipAddress).toBe('unknown');
      expect(savedEntry.userAgent).toBe('unknown');
    });

    it('should handle null userId', async () => {
      await service.log({
        userId: null,
        action: 'auth.failed_login',
      });

      const savedEntry = mockAuditLogRepo.save.mock.calls[0][0];
      expect(savedEntry.userId).toBeUndefined();
      expect(savedEntry.action).toBe('auth.failed_login');
    });

    it('should extract IP from request', async () => {
      const req = {
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0',
        },
      };

      await service.log({
        userId: 'user-1',
        action: 'auth.login',
        req: req as any,
      });

      const savedEntry = mockAuditLogRepo.save.mock.calls[0][0];
      expect(savedEntry.ipAddress).toBe('192.168.1.1');
      expect(savedEntry.userAgent).toBe('Mozilla/5.0');
    });

    it('should extract IP from x-forwarded-for header when direct ip is missing', async () => {
      const req = {
        ip: undefined,
        headers: {
          'x-forwarded-for': '10.0.0.1, 10.0.0.2',
          'user-agent': 'curl/7.0',
        },
      };

      await service.log({
        userId: 'user-1',
        action: 'auth.login',
        req: req as any,
      });

      const savedEntry = mockAuditLogRepo.save.mock.calls[0][0];
      expect(savedEntry.ipAddress).toBe('10.0.0.1');
    });

    it('should handle array x-forwarded-for', async () => {
      const req = {
        headers: {
          'x-forwarded-for': ['10.0.0.1'],
          'user-agent': 'test-agent',
        },
      };

      await service.log({
        userId: 'user-1',
        action: 'auth.login',
        req: req as any,
      });

      const savedEntry = mockAuditLogRepo.save.mock.calls[0][0];
      expect(savedEntry.ipAddress).toBe('10.0.0.1');
    });

    it('should log and not throw when save fails', async () => {
      mockAuditLogRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(
        service.log({
          userId: 'user-1',
          action: 'auth.login',
        }),
      ).resolves.toBeUndefined();
    });

    it('should JSON stringify metadata', async () => {
      await service.log({
        userId: 'user-1',
        action: 'auth.login',
        metadata: { key: 'value', nested: { deep: true } },
      });

      const savedEntry = mockAuditLogRepo.save.mock.calls[0][0];
      expect(savedEntry.metadata).toBe('{"key":"value","nested":{"deep":true}}');
    });

    it('should default metadata to empty object', async () => {
      await service.log({
        userId: 'user-1',
        action: 'auth.login',
      });

      const savedEntry = mockAuditLogRepo.save.mock.calls[0][0];
      expect(savedEntry.metadata).toBe('{}');
    });
  });
});
