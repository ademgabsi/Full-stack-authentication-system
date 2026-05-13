import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { randomUUID, randomInt, createHash } from 'crypto';
import {
  StepUpChallenge,
  StepUpType,
} from '../../entities/step-up-challenge.entity';
import { EmailService } from '../email/email.service';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class StepUpChallengeService {
  private readonly logger = new Logger(StepUpChallengeService.name);

  constructor(
    @InjectRepository(StepUpChallenge)
    private challengeRepo: Repository<StepUpChallenge>,
    private emailService: EmailService,
    private jwtService: JwtService,
    private configService: AppConfigService,
  ) {}

  async createEmailChallenge(
    userId: string,
    email: string,
  ): Promise<{ stepUpToken: string }> {
    const code = String(randomInt(100000, 1000000));
    const token = randomUUID();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await this.challengeRepo.save(
      this.challengeRepo.create({
        userId,
        tokenHash,
        code,
        type: StepUpType.EMAIL_OTP,
        expiresAt,
      }),
    );

    this.emailService.sendStepUpChallengeEmail(email, code).catch((err) => {
      this.logger.error('Failed to send step-up email', err);
    });

    return { stepUpToken: token };
  }

  async verifyChallenge(
    token: string,
    code: string,
  ): Promise<{ userId: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const challenge = await this.challengeRepo.findOne({
      where: { tokenHash },
    });

    if (!challenge) {
      throw new UnauthorizedException('Invalid step-up token');
    }
    if (challenge.used) {
      throw new UnauthorizedException(
        'Step-up challenge has already been used',
      );
    }
    if (challenge.expiresAt < new Date()) {
      throw new UnauthorizedException('Step-up challenge has expired');
    }
    if (challenge.code !== code) {
      throw new UnauthorizedException('Invalid step-up code');
    }

    await this.challengeRepo.update(challenge.id, { used: true });
    return { userId: challenge.userId };
  }
}
