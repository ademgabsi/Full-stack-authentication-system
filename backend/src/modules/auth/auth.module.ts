import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { User } from '../../entities/user.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { PasswordReset } from '../../entities/password-reset.entity';
import { EmailVerificationToken } from '../../entities/email-verification-token.entity';
import { EmailModule } from '../email/email.module';
import { WebhookModule } from '../webhook/webhook.module';
import { DeviceFingerprintModule } from '../device-fingerprint/device-fingerprint.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      PasswordReset,
      EmailVerificationToken,
    ]),
    PassportModule,
    JwtModule.register({}),
    EmailModule,
    WebhookModule,
    DeviceFingerprintModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, MfaService, JwtStrategy, GoogleStrategy],
  exports: [AuthService, MfaService],
})
export class AuthModule {}
