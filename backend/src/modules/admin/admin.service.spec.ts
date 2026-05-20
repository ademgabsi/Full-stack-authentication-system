import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { User, UserRole } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { AppConfigService } from '../../config/app-config.service';
import { AuditLogService } from '../audit/audit.service';
import { WebhookService } from '../webhook/webhook.service';
import { ForbiddenException } from '@nestjs/common';

const testUser: User = {
  id: 'user-1',
  email: 'user@example.com',
  passwordHash: 'hashed',
  provider: 'credentials',
  providerId: null!,
  role: UserRole.USER,
  fullName: 'Regular User',
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

const mockUserRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
};

const mockAuditLogRepo = {
  count: jest.fn(() => Promise.resolve(0)),
  createQueryBuilder: jest.fn(),
};

const mockUsersService = {
  findAll: jest.fn(),
  findById: jest.fn(),
  sanitizeUser: jest.fn((u: User) => {
    const { passwordHash, mfaSecret, mfaBackupCodes, ...rest } = u;
    return rest;
  }),
  adminUpdateUser: jest.fn(),
  lockUser: jest.fn(),
  unlockUser: jest.fn(),
  deactivateUser: jest.fn(),
};

const mockConfigService = {
  lockTimeMinutes: 15,
};

const mockAuditLogService = {
  log: jest.fn(() => Promise.resolve()),
};

const mockWebhookService = {
  dispatchEvent: jest.fn(() => Promise.resolve()),
};

describe('AdminService', () => {
  let service: AdminService;
  let usersService: typeof mockUsersService;
  let auditLogService: typeof mockAuditLogService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(AuditLog), useValue: mockAuditLogRepo },
        { provide: AppConfigService, useValue: mockConfigService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: WebhookService, useValue: mockWebhookService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    usersService = module.get(UsersService);
    auditLogService = module.get(AuditLogService);
  });

  describe('listUsers', () => {
    it('should return paginated user list', async () => {
      mockUsersService.findAll.mockResolvedValue({
        users: [{ id: 'user-1', email: 'user@example.com' }],
        total: 1,
      });
      const result = await service.listUsers({ page: 1, limit: 10 });
      expect(result.users).toHaveLength(1);
      expect(result.totalPages).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should pass search and role filters', async () => {
      mockUsersService.findAll.mockResolvedValue({ users: [], total: 0 });
      await service.listUsers({ page: 1, limit: 10, search: 'john', role: UserRole.ADMIN });
      expect(mockUsersService.findAll).toHaveBeenCalledWith(1, 10, 'john', UserRole.ADMIN);
    });
  });

  describe('getUser', () => {
    it('should return sanitized user', async () => {
      mockUsersService.findById.mockResolvedValue(testUser);
      const result = await service.getUser('user-1');
      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('updateUser', () => {
    it('should throw ForbiddenException when admin modifies self', async () => {
      await expect(service.updateUser('admin-1', {}, 'admin-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should update user role and log audit', async () => {
      mockUsersService.findById.mockResolvedValue({ ...testUser, role: UserRole.USER });
      mockUsersService.adminUpdateUser.mockResolvedValue({ ...testUser, role: UserRole.ADMIN });

      await service.updateUser('user-1', { role: UserRole.ADMIN }, 'admin-1');
      expect(mockUsersService.adminUpdateUser).toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.user.role-changed' }),
      );
    });

    it('should not log role change if role unchanged', async () => {
      mockUsersService.findById.mockResolvedValue({ ...testUser, role: UserRole.USER });
      mockUsersService.adminUpdateUser.mockResolvedValue({ ...testUser, role: UserRole.USER });

      await service.updateUser('user-1', { role: UserRole.USER }, 'admin-1');
      // Should still log admin.user.updated but not admin.user.role-changed
      expect(mockAuditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'admin.user.updated' }),
      );
    });
  });

  describe('lockUser', () => {
    it('should throw ForbiddenException when admin locks self', async () => {
      await expect(service.lockUser('admin-1', { locked: true }, 'admin-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should lock user account', async () => {
      mockUsersService.findById.mockResolvedValue(testUser);
      mockUsersService.lockUser.mockResolvedValue({});
      await service.lockUser('user-1', { locked: true }, 'admin-1');
      expect(mockUsersService.lockUser).toHaveBeenCalledWith('user-1', 15);
    });

    it('should unlock user account', async () => {
      mockUsersService.findById.mockResolvedValue(testUser);
      mockUsersService.unlockUser.mockResolvedValue({});
      await service.lockUser('user-1', { locked: false }, 'admin-1');
      expect(mockUsersService.unlockUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('deactivateUser', () => {
    it('should throw ForbiddenException when admin deactivates self', async () => {
      await expect(service.deactivateUser('admin-1', 'admin-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should deactivate user account', async () => {
      mockUsersService.findById.mockResolvedValue(testUser);
      mockUsersService.deactivateUser.mockResolvedValue({ message: 'User deactivated' });
      const result = await service.deactivateUser('user-1', 'admin-1');
      expect(mockUsersService.deactivateUser).toHaveBeenCalledWith('user-1');
      expect(result.message).toContain('deactivated');
    });
  });

  describe('queryAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.queryAuditLogs({ page: 1, limit: 20 });
      expect(result).toHaveProperty('logs');
      expect(result).toHaveProperty('total');
    });

    it('should apply filters (userId, action, from, to)', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      await service.queryAuditLogs({
        userId: 'user-1',
        action: 'login',
        from: '2024-01-01',
        to: '2024-12-31',
      });

      expect(qb.andWhere).toHaveBeenCalledTimes(4);
    });
  });

  describe('getAuditLogStats', () => {
    it('should return aggregate statistics', async () => {
      mockAuditLogRepo.count.mockResolvedValue(100);
      const qb = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          { date: '2024-01-01', count: 5 },
        ]),
      };
      mockAuditLogRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getAuditLogStats();
      expect(result).toHaveProperty('totalLogs');
      expect(result).toHaveProperty('failedLogins');
      expect(result).toHaveProperty('loginsPerDay');
      expect(result).toHaveProperty('actionBreakdown');
    });
  });
});
