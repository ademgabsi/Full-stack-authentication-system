import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { User } from '../../entities/user.entity';
import { EmailVerificationToken } from '../../entities/email-verification-token.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { DeviceFingerprint } from '../../entities/device-fingerprint.entity';
import { AnomalyLog } from '../../entities/anomaly-log.entity';
import { StepUpChallenge } from '../../entities/step-up-challenge.entity';
import { WebAuthnCredential } from '../../entities/webauthn-credential.entity';
import { PasswordReset } from '../../entities/password-reset.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AccountDeletionCronService } from './account-deletion-cron.service';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { WebhookModule } from '../webhook/webhook.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      EmailVerificationToken,
      RefreshToken,
      DeviceFingerprint,
      AnomalyLog,
      StepUpChallenge,
      WebAuthnCredential,
      PasswordReset,
    ]),
    PassportModule,
    CloudinaryModule,
    WebhookModule,
    EmailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, AccountDeletionCronService],
  exports: [UsersService],
})
export class UsersModule {}
