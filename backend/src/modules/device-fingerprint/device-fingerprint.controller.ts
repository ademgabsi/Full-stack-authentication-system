import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DeviceFingerprintService } from './device-fingerprint.service';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Device Fingerprint')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('device-fingerprints')
export class DeviceFingerprintController {
  constructor(private fingerprintService: DeviceFingerprintService) {}

  @Get()
  @ApiOperation({ summary: 'List my device fingerprints' })
  async listMyFingerprints(@CurrentUser('id') userId: string) {
    return this.fingerprintService.findByUser(userId);
  }
}
