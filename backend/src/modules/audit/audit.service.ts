import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { AuditLog } from '../../entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private repo: Repository<AuditLog>,
  ) {}

  async log(params: {
    userId: string | null;
    action: string;
    resource?: string;
    metadata?: Record<string, any>;
    req?: Request;
  }) {
    try {
      const forwarded = params.req?.headers?.['x-forwarded-for'];
      let ip = params.req?.ip || 'unknown';
      if (!params.req?.ip && forwarded) {
        ip =
          typeof forwarded === 'string'
            ? forwarded.split(',')[0].trim()
            : Array.isArray(forwarded)
              ? forwarded[0]
              : 'unknown';
      }

      const entry = this.repo.create({
        userId: params.userId ?? undefined,
        action: params.action,
        resource: params.resource ?? undefined,
        metadata: JSON.stringify(params.metadata ?? {}),
        ipAddress: ip,
        userAgent: params.req?.headers?.['user-agent'] || 'unknown',
      });
      await this.repo.save(entry);
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
    }
  }
}
