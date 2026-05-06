import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomInt, createHash } from 'crypto';
import { Request } from 'express';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const UAParser = require('ua-parser-js');
import { User, UserRole } from '../../entities/user.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { PasswordReset } from '../../entities/password-reset.entity';
import { EmailVerificationToken } from '../../entities/email-verification-token.entity';
import { AppConfigService } from '../../config/app-config.service';
import { EmailService } from '../email/email.service';
import { MfaService } from './mfa.service';
import { AuditLogService } from '../audit/audit.service';
import { CaptchaService } from '../captcha/captcha.service';
import { BreachPasswordService } from './breach-password.service';
import { GoogleProfile } from './strategies/google.strategy';
import {
  RegisterDto,
  LoginDto,
  MfaVerifyDto,
  MfaEnableDto,
  MfaDisableDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  ResendVerificationDto,
  MfaBackupCodeVerifyDto,
  VerifyEmailDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(EmailVerificationToken)
    private emailVerificationRepository: Repository<EmailVerificationToken>,
    private jwtService: JwtService,
    private configService: AppConfigService,
    private emailService: EmailService,
    private mfaService: MfaService,
    private auditLogService: AuditLogService,
    private captchaService: CaptchaService,
    private breachService: BreachPasswordService,
  ) {}

  private generateCode(): string {
    return String(randomInt(100000, 1000000));
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDeviceInfo(req?: Request): string {
    if (!req) return 'Unknown';
    const ua = req.headers['user-agent'];
    if (!ua) return 'Unknown';
    const result = new UAParser(ua).getResult();
    const browser = result.browser;
    const os = result.os;
    const browserName = browser.name || 'Unknown';
    const browserVersion = browser.major ? ` ${browser.major}` : '';
    const osName = os.name || 'Unknown';
    const osVersion = os.version ? ` ${os.version}` : '';
    return `${browserName}${browserVersion} / ${osName}${osVersion}`;
  }

  private getIpAddress(req?: Request): string {
    if (!req) return 'Unknown';
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    if (Array.isArray(forwarded)) return forwarded[0].trim();
    return req.ip || 'Unknown';
  }

  async register(dto: RegisterDto, req?: Request) {
    const captchaValid = await this.captchaService.verify(
      dto.captchaToken ?? '',
    );
    if (!captchaValid) {
      throw new BadRequestException('CAPTCHA verification failed');
    }

    const normalizedEmail = dto.email.toLowerCase().trim();
    const existingUser = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return {
        message:
          'If this email is not already registered, a verification code has been sent.',
      };
    }

    const breachCount = await this.breachService.isBreached(dto.password);
    if (breachCount > 0 && !dto.ignoreBreachWarning) {
      throw new BadRequestException(
        `This password has been found in ${breachCount.toLocaleString()} data breaches. Please choose a different password.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      email: normalizedEmail,
      passwordHash,
      fullName: dto.fullName,
      role: UserRole.USER,
    });
    await this.userRepository.save(user);

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tokenEntity = this.emailVerificationRepository.create({
      code,
      userId: user.id,
      expiresAt,
    });
    await this.emailVerificationRepository.save(tokenEntity);

    this.emailService.sendVerificationEmail(user.email, code).catch(() => {});

    await this.auditLogService.log({
      userId: user.id,
      action: 'auth.register',
      resource: `user:${user.id}`,
      metadata: { email: normalizedEmail },
      req,
    });

    return {
      message:
        'Registration successful. Please check your email for the verification code.',
      userId: user.id,
    };
  }

  async verifyEmail(dto: VerifyEmailDto, req?: Request) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (!user) {
      throw new BadRequestException('Invalid verification code');
    }

    const verificationToken = await this.emailVerificationRepository.findOne({
      where: { code: dto.code, userId: user.id },
    });
    if (!verificationToken) {
      throw new BadRequestException('Invalid verification code');
    }
    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired');
    }
    if (user.isVerified) {
      throw new BadRequestException('Invalid verification code');
    }

    await this.userRepository.update(user.id, {
      isVerified: true,
    });
    await this.emailVerificationRepository.delete(verificationToken.id);

    this.emailService
      .sendWelcomeEmail(user.email, user.fullName)
      .catch(() => {});

    await this.auditLogService.log({
      userId: user.id,
      action: 'auth.email.verified',
      resource: `user:${user.id}`,
      req,
    });

    return { message: 'Email verified successfully. You can now log in.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (!user) {
      return {
        message:
          'If this email is registered, a new verification code has been sent.',
      };
    }
    if (user.isVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.emailVerificationRepository.delete({ userId: user.id });

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.emailVerificationRepository.save(
      this.emailVerificationRepository.create({
        code,
        userId: user.id,
        expiresAt,
      }),
    );

    this.emailService.sendVerificationEmail(user.email, code).catch(() => {});

    return {
      message:
        'If this email is registered, a new verification code has been sent.',
    };
  }

  async login(dto: LoginDto, req?: Request) {
    const captchaValid = await this.captchaService.verify(
      dto.captchaToken ?? '',
    );
    if (!captchaValid) {
      throw new BadRequestException('CAPTCHA verification failed');
    }

    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (!user) {
      await bcrypt.hash(dto.password, 10);
      await this.auditLogService.log({
        userId: null,
        action: 'auth.login.failed',
        metadata: { email: normalizedEmail, reason: 'user_not_found' },
        req,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isVerified) {
      this.emailService
        .sendVerificationEmail(
          user.email,
          (
            await this.emailVerificationRepository.findOne({
              where: { userId: user.id },
            })
          )?.code ?? '',
        )
        .catch(() => {});
      await this.auditLogService.log({
        userId: user.id,
        action: 'auth.login.failed',
        resource: `user:${user.id}`,
        metadata: { reason: 'email_not_verified' },
        req,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.auditLogService.log({
        userId: user.id,
        action: 'auth.login.failed',
        resource: `user:${user.id}`,
        metadata: { reason: 'account_locked' },
        req,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      await this.auditLogService.log({
        userId: user.id,
        action: 'auth.login.failed',
        resource: `user:${user.id}`,
        metadata: { reason: 'account_deactivated' },
        req,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      await this.userRepository.increment({ id: user.id }, 'failedAttempts', 1);
      const updatedUser = await this.userRepository.findOne({
        where: { id: user.id },
      });
      if (
        updatedUser &&
        updatedUser.failedAttempts >= this.configService.maxFailedAttempts
      ) {
        const lockedUntil = new Date(
          Date.now() + this.configService.lockTimeMinutes * 60 * 1000,
        );
        await this.userRepository.update(user.id, {
          failedAttempts: 0,
          lockedUntil,
        });
        this.emailService
          .sendAccountLockedEmail(user.email, user.fullName)
          .catch(() => {});
        await this.auditLogService.log({
          userId: user.id,
          action: 'auth.login.failed',
          resource: `user:${user.id}`,
          metadata: { reason: 'account_auto_locked' },
          req,
        });
        throw new UnauthorizedException('Invalid credentials');
      }
      await this.auditLogService.log({
        userId: user.id,
        action: 'auth.login.failed',
        resource: `user:${user.id}`,
        metadata: { reason: 'wrong_password' },
        req,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.userRepository.update(user.id, {
      failedAttempts: 0,
      lockedUntil: null!,
      lastLogin: new Date(),
    });

    if (user.mfaEnabled) {
      const tempToken = this.jwtService.sign(
        {
          sub: user.id,
          email: user.email,
          role: user.role,
          mfaPending: true,
        },
        {
          secret: this.configService.jwtSecret,
          expiresIn: this.configService.jwtMfaExpiration as any,
        },
      );
      return {
        mfaRequired: true,
        tempToken,
        message: 'MFA verification required',
      };
    }

    await this.auditLogService.log({
      userId: user.id,
      action: 'auth.login',
      resource: `user:${user.id}`,
      req,
    });

    return this.generateTokens(user, req);
  }

  async verifyMfa(dto: MfaVerifyDto, req?: Request) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.tempToken, {
        secret: this.configService.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    if (!payload.mfaPending) {
      throw new BadRequestException('Invalid token for MFA verification');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!this.mfaService.verifyTotp(user.mfaSecret, dto.totpCode)) {
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.userRepository.update(user.id, {
      lastLogin: new Date(),
      failedAttempts: 0,
    });

    await this.auditLogService.log({
      userId: user.id,
      action: 'auth.mfa.verified',
      resource: `user:${user.id}`,
      req,
    });

    return this.generateTokens(user, req);
  }

  async verifyMfaBackupCode(dto: MfaBackupCodeVerifyDto, req?: Request) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.tempToken, {
        secret: this.configService.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired temporary token');
    }

    if (!payload.mfaPending) {
      throw new BadRequestException('Invalid token for MFA verification');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user || !user.mfaBackupCodes) {
      throw new UnauthorizedException('Invalid backup code');
    }

    const codeIndex = this.mfaService.verifyBackupCodeHashed(
      user.mfaBackupCodes,
      dto.backupCode,
    );
    if (codeIndex === -1) {
      throw new UnauthorizedException('Invalid backup code');
    }

    const updatedBackupCodes = [...user.mfaBackupCodes];
    updatedBackupCodes.splice(codeIndex, 1);
    await this.userRepository.update(user.id, {
      mfaBackupCodes: updatedBackupCodes,
      lastLogin: new Date(),
      failedAttempts: 0,
    });

    await this.auditLogService.log({
      userId: user.id,
      action: 'auth.mfa.verified',
      resource: `user:${user.id}`,
      metadata: { method: 'backup_code' },
      req,
    });

    return this.generateTokens(user, req);
  }

  async setupMfa(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }

    const { secret, otpauthUrl } = this.mfaService.generateSecret(user.email);
    const qrCode = await this.mfaService.generateQrCode(otpauthUrl);

    await this.userRepository.update(userId, { mfaSecret: secret });

    return {
      secret,
      qrCode,
      manualEntry: otpauthUrl,
      message:
        'Scan the QR code with your authenticator app, then verify with the enable endpoint',
    };
  }

  async enableMfa(userId: string, dto: MfaEnableDto, req?: Request) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (user.mfaEnabled) {
      throw new BadRequestException('MFA is already enabled');
    }
    if (!user.mfaSecret) {
      throw new BadRequestException(
        'Please set up MFA first using the setup endpoint',
      );
    }

    if (!this.mfaService.verifyTotp(user.mfaSecret, dto.totpCode)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    const backupCodes = this.mfaService.generateBackupCodes();
    const hashedBackupCodes = this.mfaService.hashBackupCodes(backupCodes);
    await this.userRepository.update(userId, {
      mfaEnabled: true,
      mfaBackupCodes: hashedBackupCodes,
    });

    this.emailService
      .sendMfaEnabledEmail(user.email, user.fullName)
      .catch(() => {});

    await this.auditLogService.log({
      userId,
      action: 'auth.mfa.enabled',
      resource: `user:${userId}`,
      req,
    });

    return {
      message: 'MFA enabled successfully',
      backupCodes,
    };
  }

  async disableMfa(userId: string, dto: MfaDisableDto, req?: Request) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    await this.userRepository.update(userId, {
      mfaEnabled: false,
      mfaSecret: null!,
      mfaBackupCodes: null!,
    });

    await this.auditLogService.log({
      userId,
      action: 'auth.mfa.disabled',
      resource: `user:${userId}`,
      req,
    });

    return { message: 'MFA disabled successfully' };
  }

  async regenerateBackupCodes(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.mfaEnabled) {
      throw new BadRequestException('MFA is not enabled');
    }

    const backupCodes = this.mfaService.generateBackupCodes();
    const hashedBackupCodes = this.mfaService.hashBackupCodes(backupCodes);
    await this.userRepository.update(userId, {
      mfaBackupCodes: hashedBackupCodes,
    });

    return {
      message: 'Backup codes regenerated successfully',
      backupCodes,
    };
  }

  async googleOAuthLogin(googleProfile: GoogleProfile, req?: Request) {
    const normalizedEmail = googleProfile.email.toLowerCase().trim();

    let user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });

    if (user) {
      if (
        user.provider === 'google' &&
        user.providerId !== googleProfile.providerId
      ) {
        throw new BadRequestException('Account conflict detected');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Account is deactivated');
      }
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new UnauthorizedException('Account is temporarily locked');
      }

      if (user.provider === 'credentials') {
        await this.userRepository.update(user.id, {
          provider: 'google',
          providerId: googleProfile.providerId,
          isVerified: true,
        });
        user.provider = 'google';
        user.providerId = googleProfile.providerId;
      }

      await this.userRepository.update(user.id, {
        failedAttempts: 0,
        lockedUntil: null!,
        lastLogin: new Date(),
        ...(googleProfile.picture && !user.image
          ? { image: googleProfile.picture }
          : {}),
      });
      user = await this.userRepository.findOne({ where: { id: user.id } });
    } else {
      user = this.userRepository.create({
        email: normalizedEmail,
        passwordHash: null!,
        fullName:
          `${googleProfile.firstName} ${googleProfile.lastName}`.trim() ||
          'Google User',
        role: 'user' as any,
        provider: 'google',
        providerId: googleProfile.providerId,
        isVerified: true,
        image: googleProfile.picture || undefined,
      });
      await this.userRepository.save(user);

      this.emailService
        .sendWelcomeEmail(user.email, user.fullName)
        .catch(() => {});
    }

    await this.auditLogService.log({
      userId: user!.id,
      action: 'auth.login.google',
      resource: `user:${user!.id}`,
      req,
    });

    return this.generateTokens(user!, req);
  }

  async refreshTokens(refreshToken: string, req?: Request) {
    const tokenHash = this.hashToken(refreshToken);
    const refreshTokenEntity = await this.refreshTokenRepository.findOne({
      where: { token: tokenHash },
      relations: ['user'],
    });

    if (!refreshTokenEntity) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (refreshTokenEntity.isRevoked) {
      await this.refreshTokenRepository.delete({
        userId: refreshTokenEntity.userId,
      });
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    if (refreshTokenEntity.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }
    if (!refreshTokenEntity.user.isActive) {
      throw new ForbiddenException('Account deactivated');
    }

    await this.refreshTokenRepository.update(refreshTokenEntity.id, {
      isRevoked: true,
    });

    await this.auditLogService.log({
      userId: refreshTokenEntity.userId,
      action: 'auth.refresh',
      resource: `user:${refreshTokenEntity.userId}`,
      req,
    });

    return this.generateTokens(refreshTokenEntity.user, req);
  }

  async logout(refreshToken: string, userId?: string, req?: Request) {
    const tokenHash = this.hashToken(refreshToken);
    const tokenEntity = await this.refreshTokenRepository.findOne({
      where: { token: tokenHash },
    });
    if (tokenEntity) {
      await this.refreshTokenRepository.update(tokenEntity.id, {
        isRevoked: true,
      });
    }

    await this.auditLogService.log({
      userId: userId || tokenEntity?.userId || null,
      action: 'auth.logout',
      resource: userId ? `user:${userId}` : undefined,
      req,
    });

    return { message: 'Logged out successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto, req?: Request) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (!user) {
      return {
        message:
          'If an account with this email exists, a reset code has been sent.',
      };
    }

    await this.passwordResetRepository.delete({ userId: user.id });

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.passwordResetRepository.save(
      this.passwordResetRepository.create({
        code,
        userId: user.id,
        expiresAt,
      }),
    );

    this.emailService.sendPasswordResetEmail(user.email, code).catch(() => {});

    await this.auditLogService.log({
      userId: user.id,
      action: 'auth.password.reset',
      resource: `user:${user.id}`,
      metadata: { step: 'requested' },
      req,
    });

    return {
      message:
        'If an account with this email exists, a reset code has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto, req?: Request) {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const user = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (!user) {
      throw new BadRequestException('Invalid reset code');
    }

    const resetToken = await this.passwordResetRepository.findOne({
      where: { code: dto.code, userId: user.id },
    });
    if (!resetToken) {
      throw new BadRequestException('Invalid reset code');
    }
    if (resetToken.used) {
      throw new BadRequestException('Reset code has already been used');
    }
    if (resetToken.expiresAt < new Date()) {
      throw new BadRequestException('Reset code has expired');
    }

    const isSamePassword = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const breachCount = await this.breachService.isBreached(dto.password);
    if (breachCount > 0 && !dto.ignoreBreachWarning) {
      throw new BadRequestException(
        `This password has been found in ${breachCount.toLocaleString()} data breaches. Please choose a different password.`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.userRepository.update(resetToken.userId, { passwordHash });
    await this.passwordResetRepository.update(resetToken.id, { used: true });

    await this.refreshTokenRepository.delete({ userId: resetToken.userId });

    await this.auditLogService.log({
      userId: resetToken.userId,
      action: 'auth.password.reset',
      resource: `user:${resetToken.userId}`,
      metadata: { step: 'completed' },
      req,
    });

    return { message: 'Password reset successfully' };
  }

  async listSessions(userId: string, currentRefreshToken?: string) {
    let currentTokenId: string | null = null;
    if (currentRefreshToken) {
      const tokenHash = this.hashToken(currentRefreshToken);
      const current = await this.refreshTokenRepository.findOne({
        where: { token: tokenHash },
      });
      currentTokenId = current?.id ?? null;
    }

    const tokens = await this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
      order: { lastUsedAt: 'DESC' },
    });

    const now = new Date();
    return tokens
      .filter((t) => t.expiresAt > now)
      .map((t) => ({
        id: t.id,
        deviceInfo: t.deviceInfo ?? 'Unknown',
        ipAddress: t.ipAddress ?? 'Unknown',
        location: t.location ?? null,
        createdAt: t.createdAt,
        lastUsedAt: t.lastUsedAt ?? t.createdAt,
        isCurrent: t.id === currentTokenId,
      }));
  }

  async revokeSession(sessionId: string, userId: string, req?: Request) {
    const token = await this.refreshTokenRepository.findOne({
      where: { id: sessionId, userId },
    });
    if (!token) {
      throw new BadRequestException('Session not found');
    }

    await this.refreshTokenRepository.update(sessionId, { isRevoked: true });

    await this.auditLogService.log({
      userId,
      action: 'auth.session.revoked',
      resource: `session:${sessionId}`,
      req,
    });

    return { message: 'Session revoked successfully' };
  }

  async revokeAllSessions(
    userId: string,
    currentRefreshToken?: string,
    req?: Request,
  ) {
    let currentTokenId: string | null = null;
    if (currentRefreshToken) {
      const tokenHash = this.hashToken(currentRefreshToken);
      const current = await this.refreshTokenRepository.findOne({
        where: { token: tokenHash },
      });
      currentTokenId = current?.id ?? null;
    }

    const tokens = await this.refreshTokenRepository.find({
      where: { userId, isRevoked: false },
    });

    const toRevoke = tokens
      .filter((t) => t.id !== currentTokenId)
      .map((t) => t.id);

    if (toRevoke.length > 0) {
      await this.refreshTokenRepository.update(toRevoke, { isRevoked: true });
    }

    await this.auditLogService.log({
      userId,
      action: 'auth.session.revoked_all',
      resource: `user:${userId}`,
      req,
    });

    return { message: 'All other sessions revoked successfully' };
  }

  private async generateTokens(user: User, req?: Request) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.jwtSecret,
      expiresIn: this.configService.jwtExpiration as any,
      issuer: 'authsystem-api',
      audience: 'authsystem-app',
    });

    const refreshToken = randomUUID();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.parseDuration(this.configService.jwtRefreshExpiration),
    );

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        token: tokenHash,
        userId: user.id,
        expiresAt,
        deviceInfo: this.parseDeviceInfo(req),
        ipAddress: this.getIpAddress(req),
        lastUsedAt: new Date(),
      }),
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        mfaEnabled: user.mfaEnabled,
        image: user.image,
      },
    };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }
}
