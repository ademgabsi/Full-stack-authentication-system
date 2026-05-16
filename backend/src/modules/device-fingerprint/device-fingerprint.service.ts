import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Request } from 'express';
import { DeviceFingerprint } from '../../entities/device-fingerprint.entity';
import { ClientFingerprintDto } from './dto/client-fingerprint.dto';

@Injectable()
export class DeviceFingerprintService {
  private static readonly ALLOWED_PLATFORMS = new Set([
    'Win32',
    'Win64',
    'Windows',
    'MacIntel',
    'MacPPC',
    'Linux x86_64',
    'Linux i686',
    'Linux armv7l',
    'Linux aarch64',
    'iPhone',
    'iPad',
    'Android',
    'CrOS',
    'FreeBSD',
    'OpenBSD',
    'SunOS',
  ]);

  private static readonly ALLOWED_COLOR_DEPTHS = new Set([
    '24',
    '30',
    '32',
    '48',
  ]);

  constructor(
    @InjectRepository(DeviceFingerprint)
    private fingerprintRepo: Repository<DeviceFingerprint>,
  ) {}

  private validateClientData(clientData: ClientFingerprintDto): void {
    if (
      clientData.platform &&
      !DeviceFingerprintService.ALLOWED_PLATFORMS.has(clientData.platform)
    ) {
      throw new BadRequestException('Invalid platform value');
    }
    if (
      clientData.colorDepth &&
      !DeviceFingerprintService.ALLOWED_COLOR_DEPTHS.has(
        String(clientData.colorDepth),
      )
    ) {
      throw new BadRequestException('Invalid color depth value');
    }
    if (clientData.screenResolution) {
      const match = clientData.screenResolution.match(/^(\d+)x(\d+)$/);
      if (
        !match ||
        parseInt(match[1]) < 320 ||
        parseInt(match[1]) > 7680 ||
        parseInt(match[2]) < 240 ||
        parseInt(match[2]) > 4320
      ) {
        throw new BadRequestException('Invalid screen resolution');
      }
    }
    if (clientData.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: clientData.timezone });
      } catch {
        throw new BadRequestException('Invalid timezone');
      }
    }
  }

  generateFingerprintHash(
    clientData: ClientFingerprintDto,
    req: Request,
  ): string {
    this.validateClientData(clientData);

    const ua = req.headers['user-agent'] || '';
    const acceptLang = req.headers['accept-language'] || '';
    const acceptEnc = req.headers['accept-encoding'] || '';
    const ip = req.ip || '';

    const serverComponents = createHash('sha256')
      .update([ua, acceptLang, acceptEnc, ip].join('|'))
      .digest('hex');

    const clientComponents = [
      clientData.screenResolution,
      clientData.timezone,
      clientData.language,
      clientData.platform,
      clientData.canvasHash,
      clientData.webglHash,
      clientData.fontsHash,
      clientData.colorDepth,
      clientData.touchSupport,
    ].join('|');

    return createHash('sha256')
      .update(serverComponents + '|' + clientComponents)
      .digest('hex');
  }

  async getOrCreateFingerprint(params: {
    userId: string;
    fingerprintHash: string;
    browser?: string;
    os?: string;
    deviceType?: string;
    screenResolution?: string;
    timezone?: string;
    language?: string;
    ipAddress?: string;
    countryCode?: string;
    city?: string;
  }): Promise<{ fingerprint: DeviceFingerprint; isNew: boolean }> {
    let fingerprint = await this.fingerprintRepo.findOne({
      where: {
        userId: params.userId,
        fingerprintHash: params.fingerprintHash,
        isRevoked: false,
      },
    });

    if (fingerprint) {
      fingerprint.lastSeenAt = new Date();
      fingerprint.loginCount += 1;
      if (params.ipAddress) fingerprint.ipAddress = params.ipAddress;
      if (params.countryCode) fingerprint.countryCode = params.countryCode;
      if (params.city) fingerprint.city = params.city;
      await this.fingerprintRepo.save(fingerprint);
      return { fingerprint, isNew: false };
    }

    fingerprint = this.fingerprintRepo.create({
      userId: params.userId,
      fingerprintHash: params.fingerprintHash,
      browser: params.browser,
      os: params.os,
      deviceType: params.deviceType,
      screenResolution: params.screenResolution,
      timezone: params.timezone,
      language: params.language,
      ipAddress: params.ipAddress,
      countryCode: params.countryCode,
      city: params.city,
      loginCount: 1,
    });

    await this.fingerprintRepo.save(fingerprint);
    return { fingerprint, isNew: true };
  }

  async findByUser(userId: string): Promise<DeviceFingerprint[]> {
    return this.fingerprintRepo.find({
      where: { userId },
      order: { lastSeenAt: 'DESC' },
    });
  }

  async trustFingerprint(id: string): Promise<void> {
    await this.fingerprintRepo.update({ id }, { isTrusted: true });
  }

  async revokeFingerprint(id: string): Promise<void> {
    await this.fingerprintRepo.update({ id }, { isRevoked: true });
  }
}
