import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceFingerprint } from '../../entities/device-fingerprint.entity';
import { AnomalyLog } from '../../entities/anomaly-log.entity';
import { StepUpChallenge } from '../../entities/step-up-challenge.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { StepUpChallengeService } from './step-up-challenge.service';
import { DeviceFingerprintController } from './device-fingerprint.controller';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeviceFingerprint,
      AnomalyLog,
      StepUpChallenge,
      RefreshToken,
    ]),
    EmailModule,
  ],
  controllers: [DeviceFingerprintController],
  providers: [
    DeviceFingerprintService,
    AnomalyDetectionService,
    StepUpChallengeService,
  ],
  exports: [
    DeviceFingerprintService,
    AnomalyDetectionService,
    StepUpChallengeService,
  ],
})
export class DeviceFingerprintModule {}
