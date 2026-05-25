import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID, randomInt, createHash, createHmac } from 'crypto';
import { Request } from 'express';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const UAParser = require('ua-parser-js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const geoip = require('geoip-lite');
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
import { WebhookService } from '../webhook/webhook.service';
import { WebhookEvent } from '../../entities/webhook.entity';
import { GoogleProfile } from './strategies/google.strategy';
import { DeviceFingerprintService } from '../device-fingerprint/device-fingerprint.service';
import { AnomalyDetectionService } from '../device-fingerprint/anomaly-detection.service';
import { StepUpChallengeService } from '../device-fingerprint/step-up-challenge.service';
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
  StepUpVerifyDto,
} from './dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly oauthStateStore = new Map<
    string,
    { data: any; expiresAt: number }
  >();

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    @InjectRepository(EmailVerificationToken)
    private emailVerificationRepository: Repository<EmailVerificationToken>,
    private dataSource: DataSource,
    private jwtService: JwtService,
    private configService: AppConfigService,
    private emailService: EmailService,
    private mfaService: MfaService,
    private auditLogService: AuditLogService,
    private captchaService: CaptchaService,
    private breachService: BreachPasswordService,
    private webhookService: WebhookService,
    private deviceFingerprintService: DeviceFingerprintService,
    private anomalyDetectionService: AnomalyDetectionService,
    private stepUpChallengeService: StepUpChallengeService,
  ) {
    this.isAuditDisabled = configService.disableAuditLogs;
    this.isWebhooksDisabled = configService.disableWebhooks;
    this.isFingerprintingDisabled = configService.disableFingerprinting;
  }

  private isAuditDisabled = false;
  private isWebhooksDisabled = false;
  private isFingerprintingDisabled = false;

  private async logAudit(params: Parameters<AuditLogService['log']>[0]): Promise<void> {
    if (!this.isAuditDisabled) {
      await this.auditLogService.log(params);
    }
  }

  private async dispatchWebhook(event: WebhookEvent, data: any): Promise<void> {
    if (!this.isWebhooksDisabled) {
      this.webhookService.dispatchEvent(event, data).catch(() => {});
    }
  }

  private generateCode(): string {
    return String(randomInt(100000, 1000000));
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private readonly jwtKeyVersion = process.env.JWT_KEY_VERSION || 'v1';
  private readonly jwtKeyRegistry: Map<string, string> = new Map();

  private getJwtSigningKey(): { key: string; kid: string } {
    const secret = this.configService.jwtSecret;
    const kid = `${this.jwtKeyVersion}-${createHash('sha256').update(secret).digest('hex').substring(0, 8)}`;
    this.jwtKeyRegistry.set(kid, secret);
    return { key: secret, kid };
  }

  private resolveJwtKey(kid: string): string | null {
    return this.jwtKeyRegistry.get(kid) ?? null;
  }

  private hashEmailCode(code: string): string {
    return createHmac('sha256', this.configService.jwtSecret)
      .update(code)
      .digest('hex');
  }

  async storeOAuthState(
    code: string,
    data: { accessToken: string; refreshToken: string; user: any },
  ): Promise<void> {
    this.oauthStateStore.set(code, {
      data,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    setTimeout(() => this.oauthStateStore.delete(code), 5 * 60 * 1000);
  }

  async exchangeOAuthState(
    code: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: any } | null> {
    const entry = this.oauthStateStore.get(code);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.oauthStateStore.delete(code);
      return null;
    }
    this.oauthStateStore.delete(code);
    return entry.data;
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
    if (req.ip) return req.ip;
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    if (Array.isArray(forwarded)) return forwarded[0].trim();
    return 'Unknown';
  }

  private parseUA(req?: Request): {
    browser: string;
    os: string;
    deviceType: string;
  } {
    const defaults = {
      browser: 'Unknown',
      os: 'Unknown',
      deviceType: 'desktop',
    };
    if (!req) return defaults;
    const ua = req.headers['user-agent'];
    if (!ua) return defaults;
    const result = new UAParser(ua).getResult();
    return {
      browser: result.browser.name || 'Unknown',
      os: result.os.name || 'Unknown',
      deviceType: result.device.type || 'desktop',
    };
  }

  private async checkAnomaliesAndStepUp(
    user: User,
    req?: Request,
    clientFingerprint?: Record<string, any>,
  ): Promise<{
    mfaRequired?: boolean;
    tempToken?: string;
    message?: string;
    stepUpRequired?: boolean;
    stepUpToken?: string;
  } | null> {
    if (!req) return null;

    const fingerprintHash =
      this.deviceFingerprintService.generateFingerprintHash(
        clientFingerprint || {},
        req,
      );
    const ip = this.getIpAddress(req);
    const geo = geoip.lookup(ip);

    const uaInfo = this.parseUA(req);
    const { fingerprint, isNew } =
      await this.deviceFingerprintService.getOrCreateFingerprint({
        userId: user.id,
        fingerprintHash,
        browser: uaInfo.browser,
        os: uaInfo.os,
        deviceType: uaInfo.deviceType,
        ipAddress: ip,
        countryCode: geo?.country,
        city: geo?.city,
      });

    const { shouldStepUp } = await this.anomalyDetectionService.detectAnomalies(
      {
        userId: user.id,
        fingerprint,
        isNewFingerprint: isNew,
        ipAddress: ip,
        req,
      },
    );

    if (!shouldStepUp) return null;

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
        message: 'MFA verification required due to unusual activity',
      };
    }

    const { stepUpToken } =
      await this.stepUpChallengeService.createEmailChallenge(
        user.id,
        user.email,
      );
    return {
      stepUpRequired: true,
      stepUpToken,
      message:
        'Unusual activity detected. Please verify your email to continue.',
    };
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

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.userRepository.create({
      email: normalizedEmail,
      passwordHash,
      fullName: dto.fullName,
      role: UserRole.USER,
    });
    await this.userRepository.save(user);

    const code = this.generateCode();
    const hashedCode = this.hashEmailCode(code);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tokenEntity = this.emailVerificationRepository.create({
      code: hashedCode,
      userId: user.id,
      expiresAt,
    });
    await this.emailVerificationRepository.save(tokenEntity);

    this.emailService.sendVerificationEmail(user.email, code).catch(() => {});

    await this.logAudit({
      userId: user.id,
      action: 'auth.register',
      resource: `user:${user.id}`,
      metadata: { email: normalizedEmail },
      req,
    });

    this.dispatchWebhook(WebhookEvent.USER_REGISTERED, {
      userId: user.id,
      email: normalizedEmail,
      fullName: user.fullName,
    });

    return {
      message:
        'If this email is not already registered, a verification code has been sent.',
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

    const hashedCode = this.hashEmailCode(dto.code);
    const verificationToken = await this.emailVerificationRepository.findOne({
      where: { code: hashedCode, userId: user.id },
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

    await this.logAudit({
      userId: user.id,
      action: 'auth.email.verified',
      resource: `user:${user.id}`,
      req,
    });

    this.dispatchWebhook(WebhookEvent.USER_EMAIL_VERIFIED, {
      userId: user.id,
      email: user.email,
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
    const hashedCode = this.hashEmailCode(code);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.emailVerificationRepository.save(
      this.emailVerificationRepository.create({
        code: hashedCode,
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
      await this.logAudit({
        userId: null,
        action: 'auth.login.failed',
        metadata: { email: normalizedEmail, reason: 'user_not_found' },
        req,
      });
      this.dispatchWebhook(WebhookEvent.USER_LOGIN_FAILED, {
        email: normalizedEmail,
        reason: 'user_not_found',
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
      await this.logAudit({
        userId: user.id,
        action: 'auth.login.failed',
        resource: `user:${user.id}`,
        metadata: { reason: 'email_not_verified' },
        req,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.logAudit({
        userId: user.id,
        action: 'auth.login.failed',
        resource: `user:${user.id}`,
        metadata: { reason: 'account_locked' },
        req,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive && !user.scheduledDeletionAt) {
      await this.logAudit({
        userId: user.id,
        action: 'auth.login.failed',
        resource: `user:${user.id}`,
        metadata: { reason: 'account_deactivated' },
        req,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.passwordHash) {
      await this.logAudit({
        userId: user.id,
        action: 'auth.login.failed',
        resource: `user:${user.id}`,
        metadata: { reason: 'no_password_set' },
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
        await this.logAudit({
          userId: user.id,
          action: 'auth.login.failed',
          resource: `user:${user.id}`,
          metadata: { reason: 'account_auto_locked' },
          req,
        });
        this.dispatchWebhook(WebhookEvent.USER_LOCKED, {
          userId: user.id,
          email: user.email,
          reason: 'auto_locked_max_attempts',
        });
        throw new UnauthorizedException('Invalid credentials');
      }
      await this.logAudit({
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

    if (!this.isFingerprintingDisabled) {
      const stepUpResult = await this.checkAnomaliesAndStepUp(
        user,
        req,
        dto.fingerprint,
      );
      if (stepUpResult) {
        return stepUpResult;
      }
    }

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

    await this.logAudit({
      userId: user.id,
      action: 'auth.login',
      resource: `user:${user.id}`,
      req,
    });

    this.dispatchWebhook(WebhookEvent.USER_LOGIN, {
      userId: user.id,
      email: user.email,
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

    await this.logAudit({
      userId: user.id,
      action: 'auth.mfa.verified',
      resource: `user:${user.id}`,
      req,
    });

    await this.anomalyDetectionService.markStepUpCompleted(user.id);

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

    await this.logAudit({
      userId: user.id,
      action: 'auth.mfa.verified',
      resource: `user:${user.id}`,
      metadata: { method: 'backup_code' },
      req,
    });

    await this.anomalyDetectionService.markStepUpCompleted(user.id);

    return this.generateTokens(user, req);
  }

  async verifyStepUp(dto: StepUpVerifyDto, req?: Request) {
    const { userId } = await this.stepUpChallengeService.verifyChallenge(
      dto.stepUpToken,
      dto.code,
    );
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    await this.anomalyDetectionService.markStepUpCompleted(userId);

    await this.logAudit({
      userId,
      action: 'auth.step_up.completed',
      resource: `user:${userId}`,
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

    await this.logAudit({
      userId,
      action: 'auth.mfa.enabled',
      resource: `user:${userId}`,
      req,
    });

    this.dispatchWebhook(WebhookEvent.MFA_ENABLED, {
      userId,
      email: user.email,
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

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid password');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    if (user.mfaSecret) {
      if (!dto.totpCode) {
        throw new BadRequestException(
          'Current MFA code is required to disable MFA',
        );
      }
      if (!this.mfaService.verifyTotp(user.mfaSecret, dto.totpCode)) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    await this.userRepository.update(userId, {
      mfaEnabled: false,
      mfaSecret: null!,
      mfaBackupCodes: null!,
    });

    await this.logAudit({
      userId,
      action: 'auth.mfa.disabled',
      resource: `user:${userId}`,
      req,
    });

    this.dispatchWebhook(WebhookEvent.MFA_DISABLED, {
      userId,
      email: user.email,
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

      if (!user.isActive && !user.scheduledDeletionAt) {
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

    if (!this.isFingerprintingDisabled) {
      const stepUpResult = await this.checkAnomaliesAndStepUp(user!, req);
      if (stepUpResult) {
        return stepUpResult;
      }
    }

    await this.logAudit({
      userId: user!.id,
      action: 'auth.login.google',
      resource: `user:${user!.id}`,
      req,
    });

    return this.generateTokens(user!, req);
  }

  async findUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    return user;
  }

  async setPasskeysEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.userRepository.update(userId, { passkeysEnabled: enabled });
  }

  async generateTokensForUser(user: User, req?: Request) {
    return this.generateTokens(user, req);
  }

  async refreshTokens(refreshToken: string, req?: Request) {
    const tokenHash = this.hashToken(refreshToken);

    return this.dataSource.transaction('SERIALIZABLE', async (manager) => {
      const refreshTokenEntity = await manager
        .createQueryBuilder(RefreshToken, 'rt')
        .innerJoinAndSelect('rt.user', 'user')
        .where('rt.token = :tokenHash', { tokenHash })
        .setLock('pessimistic_write')
        .getOne();

      if (!refreshTokenEntity) {
        throw new UnauthorizedException('Invalid refresh token');
      }
      if (refreshTokenEntity.isRevoked) {
        if (refreshTokenEntity.family) {
          await manager.delete(RefreshToken, {
            userId: refreshTokenEntity.userId,
            family: refreshTokenEntity.family,
          });
        } else {
          await manager.delete(RefreshToken, {
            userId: refreshTokenEntity.userId,
          });
        }
        throw new UnauthorizedException('Refresh token has been revoked');
      }
      if (refreshTokenEntity.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token has expired');
      }
      if (
        !refreshTokenEntity.user.isActive &&
        !refreshTokenEntity.user.scheduledDeletionAt
      ) {
        throw new ForbiddenException('Account deactivated');
      }

      await manager.update(RefreshToken, refreshTokenEntity.id, {
        isRevoked: true,
      });

      await this.logAudit({
        userId: refreshTokenEntity.userId,
        action: 'auth.refresh',
        resource: `user:${refreshTokenEntity.userId}`,
        req,
      });

      return this.generateTokensWithManager(
        manager,
        refreshTokenEntity.user,
        req,
        refreshTokenEntity.family || undefined,
      );
    });
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

    await this.logAudit({
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
    const hashedCode = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await this.passwordResetRepository.save(
      this.passwordResetRepository.create({
        code: hashedCode,
        userId: user.id,
        expiresAt,
      }),
    );

    this.emailService.sendPasswordResetEmail(user.email, code).catch(() => {});

    await this.logAudit({
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

    const resetTokens = await this.passwordResetRepository.find({
      where: { userId: user.id, used: false },
    });
    let resetToken: PasswordReset | null = null;
    for (const rt of resetTokens) {
      const isValid = await bcrypt.compare(dto.code, rt.code);
      if (isValid) {
        resetToken = rt;
        break;
      }
    }
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

    const passwordHash = await bcrypt.hash(dto.password, 12);
    await this.userRepository.update(resetToken.userId, { passwordHash });
    await this.passwordResetRepository.update(resetToken.id, { used: true });

    await this.refreshTokenRepository.delete({ userId: resetToken.userId });

    await this.logAudit({
      userId: resetToken.userId,
      action: 'auth.password.reset',
      resource: `user:${resetToken.userId}`,
      metadata: { step: 'completed' },
      req,
    });

    this.dispatchWebhook(WebhookEvent.USER_PASSWORD_RESET, {
      userId: resetToken.userId,
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

    await this.logAudit({
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

    await this.logAudit({
      userId,
      action: 'auth.session.revoked_all',
      resource: `user:${userId}`,
      req,
    });

    return { message: 'All other sessions revoked successfully' };
  }

  private async generateTokensWithManager(
    manager: EntityManager,
    user: User,
    req?: Request,
    family?: string,
  ) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const { key, kid } = this.getJwtSigningKey();
    const accessToken = this.jwtService.sign(payload, {
      secret: key,
      expiresIn: this.configService.jwtExpiration as any,
      issuer: 'authsystem-api',
      audience: 'authsystem-app',
      keyid: kid,
    });

    const refreshToken = randomUUID();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.parseDuration(this.configService.jwtRefreshExpiration),
    );
    const tokenFamily = family || randomUUID();

    await manager.save(RefreshToken, {
      token: tokenHash,
      userId: user.id,
      expiresAt,
      family: tokenFamily,
      deviceInfo: this.parseDeviceInfo(req),
      ipAddress: this.getIpAddress(req),
      lastUsedAt: new Date(),
    });

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

  private async generateTokens(user: User, req?: Request, family?: string) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const { key, kid } = this.getJwtSigningKey();
    const accessToken = this.jwtService.sign(payload, {
      secret: key,
      expiresIn: this.configService.jwtExpiration as any,
      issuer: 'authsystem-api',
      audience: 'authsystem-app',
      keyid: kid,
    });

    const refreshToken = randomUUID();
    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + this.parseDuration(this.configService.jwtRefreshExpiration),
    );
    const tokenFamily = family || randomUUID();

    await this.refreshTokenRepository.save(
      this.refreshTokenRepository.create({
        token: tokenHash,
        userId: user.id,
        expiresAt,
        family: tokenFamily,
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
