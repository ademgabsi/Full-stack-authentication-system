import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { UsersService } from '../users/users.service';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { WebhookEvent } from '../../entities/webhook.entity';
import { AuditLogService } from '../audit/audit.service';
import { WebhookService } from '../webhook/webhook.service';
import {
  AdminUpdateUserDto,
  ListUsersQueryDto,
  LockUserDto,
  AuditLogQueryDto,
} from './dto';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class AdminService {
  constructor(
    private usersService: UsersService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    private configService: AppConfigService,
    private auditLogService: AuditLogService,
    private webhookService: WebhookService,
  ) {}

  async listUsers(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { users, total } = await this.usersService.findAll(
      page,
      limit,
      query.search,
      query.role,
    );
    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUser(id: string) {
    return this.usersService
      .findById(id)
      .then((user) => this.usersService.sanitizeUser(user));
  }

  async updateUser(
    id: string,
    dto: AdminUpdateUserDto,
    adminId: string,
    req?: Request,
  ) {
    if (id === adminId) {
      throw new ForbiddenException('Admins cannot modify their own account');
    }
    const user = await this.usersService.findById(id);
    const result = await this.usersService.adminUpdateUser(id, dto);

    if (dto.role && dto.role !== user.role) {
      await this.auditLogService.log({
        userId: adminId,
        action: 'admin.user.role-changed',
        resource: `user:${id}`,
        metadata: { oldRole: user.role, newRole: dto.role },
        req,
      });
      this.webhookService
        .dispatchEvent(WebhookEvent.USER_ROLE_CHANGED, {
          userId: id,
          oldRole: user.role,
          newRole: dto.role,
          changedBy: adminId,
        })
        .catch(() => {});
    }

    await this.auditLogService.log({
      userId: adminId,
      action: 'admin.user.updated',
      resource: `user:${id}`,
      metadata: { ...dto },
      req,
    });

    return result;
  }

  async lockUser(id: string, dto: LockUserDto, adminId: string, req?: Request) {
    if (id === adminId) {
      throw new ForbiddenException('Admins cannot lock their own account');
    }
    await this.usersService.findById(id);
    if (dto.locked) {
      const result = await this.usersService.lockUser(
        id,
        this.configService.lockTimeMinutes,
      );
      await this.auditLogService.log({
        userId: adminId,
        action: 'admin.user.locked',
        resource: `user:${id}`,
        req,
      });
      this.webhookService
        .dispatchEvent(WebhookEvent.USER_LOCKED, {
          userId: id,
          lockedBy: adminId,
        })
        .catch(() => {});
      return result;
    }
    const result = await this.usersService.unlockUser(id);
    await this.auditLogService.log({
      userId: adminId,
      action: 'admin.user.unlocked',
      resource: `user:${id}`,
      req,
    });
    this.webhookService
      .dispatchEvent(WebhookEvent.USER_UNLOCKED, {
        userId: id,
        unlockedBy: adminId,
      })
      .catch(() => {});
    return result;
  }

  async deactivateUser(id: string, adminId: string, req?: Request) {
    if (id === adminId) {
      throw new ForbiddenException(
        'Admins cannot deactivate their own account',
      );
    }
    await this.usersService.findById(id);
    const result = await this.usersService.deactivateUser(id);
    await this.auditLogService.log({
      userId: adminId,
      action: 'admin.user.deactivated',
      resource: `user:${id}`,
    });
    this.webhookService
      .dispatchEvent(WebhookEvent.USER_DEACTIVATED, {
        userId: id,
        deactivatedBy: adminId,
      })
      .catch(() => {});
    return result;
  }

  async queryAuditLogs(query: AuditLogQueryDto) {
    const qb = this.auditLogRepository.createQueryBuilder('log');

    if (query.userId) {
      qb.andWhere('log.userId = :userId', { userId: query.userId });
    }
    if (query.action) {
      qb.andWhere('log.action ILIKE :action', {
        action: `%${query.action}%`,
      });
    }
    if (query.from) {
      qb.andWhere('log.timestamp >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('log.timestamp <= :to', { to: new Date(query.to) });
    }

    qb.orderBy('log.timestamp', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [logs, total] = await qb.getManyAndCount();
    return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getAuditLogStats() {
    const totalLogs = await this.auditLogRepository.count();

    const loginsPerDay = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('DATE(log.timestamp)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('log.action IN (:...actions)', {
        actions: ['auth.login', 'auth.login.failed'],
      })
      .groupBy('date')
      .orderBy('date', 'DESC')
      .limit(30)
      .getRawMany();

    const failedLogins = await this.auditLogRepository.count({
      where: { action: 'auth.login.failed' },
    });

    const actionBreakdown = await this.auditLogRepository
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .groupBy('log.action')
      .orderBy('count', 'DESC')
      .getRawMany();

    return {
      totalLogs,
      failedLogins,
      loginsPerDay,
      actionBreakdown,
    };
  }
}
