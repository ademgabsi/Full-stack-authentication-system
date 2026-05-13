import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { UsersModule } from '../users/users.module';
import { AppConfigModule } from '../../config/config.module';
import { WebhookModule } from '../webhook/webhook.module';
import { DeviceFingerprintModule } from '../device-fingerprint/device-fingerprint.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuditLog]),
    UsersModule,
    AppConfigModule,
    WebhookModule,
    DeviceFingerprintModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
