import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { User, UserRole } from '../../entities/user.entity';
import { EmailVerificationToken } from '../../entities/email-verification-token.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { DeviceFingerprint } from '../../entities/device-fingerprint.entity';
import { AnomalyLog } from '../../entities/anomaly-log.entity';
import { StepUpChallenge } from '../../entities/step-up-challenge.entity';
import { WebAuthnCredential } from '../../entities/webauthn-credential.entity';
import { PasswordReset } from '../../entities/password-reset.entity';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { AuditLogService } from '../audit/audit.service';
import { WebhookService } from '../webhook/webhook.service';
import { EmailService } from '../email/email.service';
import { WebhookEvent } from '../../entities/webhook.entity';
import { UpdateProfileDto, ChangePasswordDto } from './dto';
import { BreachPasswordService } from '../auth/breach-password.service';
import { randomInt, createHash } from 'crypto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(EmailVerificationToken)
    private emailVerificationRepository: Repository<EmailVerificationToken>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(DeviceFingerprint)
    private deviceFingerprintRepository: Repository<DeviceFingerprint>,
    @InjectRepository(AnomalyLog)
    private anomalyLogRepository: Repository<AnomalyLog>,
    @InjectRepository(StepUpChallenge)
    private stepUpChallengeRepository: Repository<StepUpChallenge>,
    @InjectRepository(WebAuthnCredential)
    private webauthnCredentialRepository: Repository<WebAuthnCredential>,
    @InjectRepository(PasswordReset)
    private passwordResetRepository: Repository<PasswordReset>,
    private dataSource: DataSource,
    private cloudinaryService: CloudinaryService,
    private auditLogService: AuditLogService,
    private breachService: BreachPasswordService,
    private webhookService: WebhookService,
    private emailService: EmailService,
  ) {}

  private generateCode(): string {
    return String(randomInt(100000, 1000000));
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async updateProfile(
    id: string,
    dto: UpdateProfileDto,
  ): Promise<Partial<User>> {
    const user = await this.findById(id);

    if (dto.email && dto.email.toLowerCase().trim() !== user.email) {
      const normalizedEmail = dto.email.toLowerCase().trim();
      const existing = await this.findByEmail(normalizedEmail);
      if (existing) {
        throw new BadRequestException('Email already in use');
      }

      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to change email',
        );
      }

      const userWithPassword = await this.userRepository.findOne({
        where: { id },
        select: ['id', 'passwordHash'],
      });
      if (!userWithPassword?.passwordHash) {
        throw new BadRequestException('Cannot change email for OAuth accounts');
      }

      const isPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        userWithPassword.passwordHash,
      );
      if (!isPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }
    }

    await this.userRepository.update(id, {
      ...(dto.fullName && { fullName: dto.fullName }),
      ...(dto.email && {
        email: dto.email.toLowerCase().trim(),
        isVerified: false,
      }),
    });

    const updated = await this.findById(id);
    return this.sanitizeUser(updated);
  }

  async changePassword(
    id: string,
    dto: ChangePasswordDto,
    req?: Request,
  ): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id },
      select: ['id', 'passwordHash'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const breachCount = await this.breachService.isBreached(dto.newPassword);
    if (breachCount > 0 && !dto.ignoreBreachWarning) {
      throw new BadRequestException(
        `This password has been found in ${breachCount.toLocaleString()} data breaches. Please choose a different password.`,
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.update(id, { passwordHash: newPasswordHash });

    await this.auditLogService.log({
      userId: id,
      action: 'auth.password.change',
      resource: `user:${id}`,
      req,
    });

    this.webhookService
      .dispatchEvent(WebhookEvent.USER_PASSWORD_CHANGED, {
        userId: id,
      })
      .catch(() => {});

    return { message: 'Password changed successfully' };
  }

  async uploadImage(
    id: string,
    file: Express.Multer.File,
  ): Promise<{ image: string }> {
    const user = await this.findById(id);

    if (user.image) {
      const publicId = this.cloudinaryService.getPublicIdFromUrl(user.image);
      if (publicId) {
        await this.cloudinaryService.deleteImage(publicId);
      }
    }

    const imageUrl = await this.cloudinaryService.uploadImage(file, 'profiles');
    await this.userRepository.update(id, { image: imageUrl });

    return { image: imageUrl };
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    search?: string,
    role?: string,
  ): Promise<{ users: Partial<User>[]; total: number }> {
    const query = this.userRepository.createQueryBuilder('user');

    if (search) {
      query.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (role) {
      query.andWhere('user.role = :role', { role });
    }

    query.orderBy('user.createdAt', 'DESC');

    const skip = (page - 1) * limit;
    query.skip(skip).take(limit);

    const [users, total] = await query.getManyAndCount();

    return {
      users: users.map((u) => this.sanitizeUser(u)),
      total,
    };
  }

  async adminUpdateUser(
    id: string,
    dto: { role?: string; isActive?: boolean; fullName?: string },
  ): Promise<Partial<User>> {
    const updateData: Partial<User> = {};
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.role !== undefined) updateData.role = dto.role as UserRole;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    await this.userRepository.update(id, updateData);
    const updated = await this.findById(id);
    return this.sanitizeUser(updated);
  }

  async lockUser(
    id: string,
    lockDurationMinutes: number,
  ): Promise<Partial<User>> {
    const lockedUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
    await this.userRepository.update(id, { lockedUntil });
    const updated = await this.findById(id);
    return this.sanitizeUser(updated);
  }

  async unlockUser(id: string): Promise<Partial<User>> {
    await this.userRepository.update(id, {
      lockedUntil: null!,
      failedAttempts: 0,
    });
    const updated = await this.findById(id);
    return this.sanitizeUser(updated);
  }

  async deactivateUser(id: string): Promise<{ message: string }> {
    await this.userRepository.update(id, { isActive: false });
    return { message: 'User deactivated successfully' };
  }

  async requestDeletion(
    id: string,
    req?: Request,
  ): Promise<{ message: string }> {
    const user = await this.findById(id);

    const code = this.generateCode();
    const hashedCode = this.hashToken(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.emailVerificationRepository.save(
      this.emailVerificationRepository.create({
        code: hashedCode,
        userId: id,
        expiresAt,
      }),
    );

    this.emailService
      .sendAccountDeletionEmail(user.email, code)
      .catch(() => {});

    if (user.scheduledDeletionAt) {
      return {
        message:
          'Confirmation code sent to your email. Use it to cancel the deletion.',
      };
    }

    return { message: 'Confirmation code sent to your email' };
  }

  async confirmDeletion(
    id: string,
    code: string,
    req?: Request,
  ): Promise<{ message: string }> {
    const user = await this.findById(id);

    const hashedCode = this.hashToken(code);
    const verificationToken = await this.emailVerificationRepository.findOne({
      where: { userId: id, code: hashedCode },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid confirmation code');
    }
    if (verificationToken.expiresAt < new Date()) {
      await this.emailVerificationRepository.delete(verificationToken.id);
      throw new BadRequestException('Confirmation code has expired');
    }

    const scheduledDeletionAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    await this.userRepository.update(id, {
      scheduledDeletionAt,
      deletionRequestedAt: new Date(),
      isActive: false,
    });

    await this.emailVerificationRepository.delete(verificationToken.id);

    await this.refreshTokenRepository.update(
      { userId: id, isRevoked: false },
      { isRevoked: true },
    );

    await this.auditLogService.log({
      userId: id,
      action: 'auth.account.deletion_requested',
      resource: `user:${id}`,
      req,
    });

    this.webhookService
      .dispatchEvent(WebhookEvent.USER_DELETION_REQUESTED, {
        userId: id,
        email: user.email,
        scheduledDeletionAt: scheduledDeletionAt.toISOString(),
      })
      .catch(() => {});

    return {
      message:
        'Account scheduled for deletion in 14 days. You can cancel this during that period.',
    };
  }

  async cancelDeletion(
    id: string,
    code: string,
    req?: Request,
  ): Promise<{ message: string }> {
    const user = await this.findById(id);

    if (!user.scheduledDeletionAt) {
      throw new BadRequestException(
        'No deletion request found for this account',
      );
    }

    const hashedCode = this.hashToken(code);
    const verificationToken = await this.emailVerificationRepository.findOne({
      where: { userId: id, code: hashedCode },
    });

    if (!verificationToken) {
      throw new BadRequestException('Invalid confirmation code');
    }
    if (verificationToken.expiresAt < new Date()) {
      await this.emailVerificationRepository.delete(verificationToken.id);
      throw new BadRequestException('Confirmation code has expired');
    }

    await this.userRepository.update(id, {
      scheduledDeletionAt: null!,
      deletionRequestedAt: null!,
      isActive: true,
    });

    await this.emailVerificationRepository.delete(verificationToken.id);

    await this.auditLogService.log({
      userId: id,
      action: 'auth.account.deletion_cancelled',
      resource: `user:${id}`,
      req,
    });

    return { message: 'Account deletion cancelled' };
  }

  async hardDeleteUser(id: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id } });

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(DeviceFingerprint, { userId: id });
      await manager.delete(AnomalyLog, { userId: id });
      await manager.delete(StepUpChallenge, { userId: id });
      await manager.delete(User, id);
    });

    if (user?.image) {
      const publicId = this.cloudinaryService.getPublicIdFromUrl(user.image);
      if (publicId) {
        await this.cloudinaryService.deleteImage(publicId).catch(() => {});
      }
    }

    await this.auditLogService.log({
      userId: id,
      action: 'auth.account.deleted',
      resource: `user:${id}`,
    });

    this.webhookService
      .dispatchEvent(WebhookEvent.USER_DELETED, {
        userId: id,
        email: user?.email,
      })
      .catch(() => {});
  }

  async getUsersPendingDeletion(): Promise<User[]> {
    return this.userRepository
      .createQueryBuilder('user')
      .where('user.scheduledDeletionAt IS NOT NULL')
      .andWhere('user.scheduledDeletionAt <= :now', { now: new Date() })
      .getMany();
  }

  sanitizeUser(user: User): Partial<User> {
    const { passwordHash, mfaSecret, mfaBackupCodes, ...result } = user;
    return result;
  }
}
