import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const geoip = require('geoip-lite');
import { DeviceFingerprint } from '../../entities/device-fingerprint.entity';
import { AnomalyLog, AnomalyType } from '../../entities/anomaly-log.entity';
import { RefreshToken } from '../../entities/refresh-token.entity';

@Injectable()
export class AnomalyDetectionService {
  private readonly logger = new Logger(AnomalyDetectionService.name);

  constructor(
    @InjectRepository(DeviceFingerprint)
    private fingerprintRepo: Repository<DeviceFingerprint>,
    @InjectRepository(AnomalyLog)
    private anomalyLogRepo: Repository<AnomalyLog>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  async detectAnomalies(params: {
    userId: string;
    fingerprint: DeviceFingerprint;
    isNewFingerprint: boolean;
    ipAddress: string;
    req: Request;
  }): Promise<{
    anomalies: AnomalyType[];
    riskScore: number;
    shouldStepUp: boolean;
  }> {
    const anomalies: AnomalyType[] = [];
    let riskScore = 0;

    if (params.isNewFingerprint) {
      anomalies.push(AnomalyType.NEW_DEVICE);
      riskScore += 0.3;
    }

    const ipAnomaly = await this.checkNewIp(params.userId, params.ipAddress);
    if (ipAnomaly.isNewIp) {
      anomalies.push(AnomalyType.NEW_IP);
      riskScore += 0.2;
    }
    if (ipAnomaly.isNewLocation) {
      anomalies.push(AnomalyType.NEW_LOCATION);
      riskScore += 0.3;
    }

    const travelAnomaly = await this.checkImpossibleTravel({
      userId: params.userId,
      currentIp: params.ipAddress,
      currentTime: new Date(),
    });
    if (travelAnomaly.isImpossible) {
      anomalies.push(AnomalyType.IMPOSSIBLE_TRAVEL);
      riskScore += 0.9;
    }

    const finalRiskScore = Math.min(riskScore, 1.0);
    const shouldStepUp =
      finalRiskScore >= 0.5 ||
      anomalies.includes(AnomalyType.IMPOSSIBLE_TRAVEL);

    if (shouldStepUp) {
      for (const anomalyType of anomalies) {
        await this.logAnomaly({
          userId: params.userId,
          fingerprintId: params.fingerprint.id,
          action: 'login',
          anomalyType,
          riskScore: finalRiskScore,
          details: {
            ipAddress: params.ipAddress,
            ...travelAnomaly.details,
          },
          req: params.req,
          stepUpIssued: true,
        });
      }
      return { anomalies, riskScore: finalRiskScore, shouldStepUp: true };
    }

    if (anomalies.length > 0) {
      await this.logAnomaly({
        userId: params.userId,
        fingerprintId: params.fingerprint.id,
        action: 'login',
        anomalyType: AnomalyType.SUSPICIOUS_PATTERN,
        riskScore: finalRiskScore,
        details: { anomalies, ipAddress: params.ipAddress },
        req: params.req,
        stepUpIssued: false,
      });
    }

    return { anomalies, riskScore: finalRiskScore, shouldStepUp: false };
  }

  private async checkNewIp(
    userId: string,
    ipAddress: string,
  ): Promise<{ isNewIp: boolean; isNewLocation: boolean }> {
    const existing = await this.fingerprintRepo.findOne({
      where: { userId, ipAddress },
    });
    if (existing) return { isNewIp: false, isNewLocation: false };

    const currentGeo = geoip.lookup(ipAddress);
    if (!currentGeo) return { isNewIp: true, isNewLocation: false };

    const userFingerprints = await this.fingerprintRepo.find({
      where: { userId },
    });
    const knownCountries = new Set(
      userFingerprints.map((f) => f.countryCode).filter(Boolean),
    );

    return {
      isNewIp: true,
      isNewLocation: !knownCountries.has(currentGeo.country),
    };
  }

  private async checkImpossibleTravel(params: {
    userId: string;
    currentIp: string;
    currentTime: Date;
  }): Promise<{
    isImpossible: boolean;
    details?: Record<string, any>;
  }> {
    const lastSession = await this.refreshTokenRepo.findOne({
      where: { userId: params.userId, isRevoked: false },
      order: { lastUsedAt: 'DESC' },
    });

    if (!lastSession?.ipAddress || !lastSession.lastUsedAt) {
      return { isImpossible: false };
    }

    const lastGeo = geoip.lookup(lastSession.ipAddress);
    const currentGeo = geoip.lookup(params.currentIp);

    if (!lastGeo || !currentGeo || !lastGeo.ll || !currentGeo.ll) {
      return { isImpossible: false };
    }

    const distanceKm = this.haversineDistance(
      lastGeo.ll[0],
      lastGeo.ll[1],
      currentGeo.ll[0],
      currentGeo.ll[1],
    );
    const hoursElapsed =
      (params.currentTime.getTime() -
        new Date(lastSession.lastUsedAt).getTime()) /
      (1000 * 60 * 60);

    if (hoursElapsed <= 0) return { isImpossible: false };

    const speedKmh = distanceKm / hoursElapsed;
    const isImpossible = speedKmh > 900; // faster than commercial jet

    return {
      isImpossible,
      details: {
        lastIp: lastSession.ipAddress,
        lastLocation: `${lastGeo.city}, ${lastGeo.country}`,
        currentLocation: `${currentGeo.city}, ${currentGeo.country}`,
        distanceKm: Math.round(distanceKm),
        hoursElapsed: Math.round(hoursElapsed * 100) / 100,
        speedKmh: Math.round(speedKmh),
      },
    };
  }

  private haversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async logAnomaly(params: {
    userId: string;
    fingerprintId?: string;
    action: string;
    anomalyType: AnomalyType;
    riskScore: number;
    details?: Record<string, any>;
    req?: Request;
    stepUpIssued?: boolean;
    stepUpCompleted?: boolean;
  }): Promise<AnomalyLog> {
    const entry = this.anomalyLogRepo.create({
      userId: params.userId,
      fingerprintId: params.fingerprintId,
      action: params.action,
      anomalyType: params.anomalyType,
      riskScore: params.riskScore,
      details: params.details,
      ipAddress: params.req ? this.getIp(params.req) : undefined,
      userAgent: params.req?.headers?.['user-agent'] || undefined,
      stepUpIssued: params.stepUpIssued ?? false,
      stepUpCompleted: params.stepUpCompleted ?? false,
    });
    return this.anomalyLogRepo.save(entry);
  }

  async markStepUpCompleted(userId: string): Promise<void> {
    await this.anomalyLogRepo.update(
      { userId, stepUpCompleted: false, stepUpIssued: true },
      { stepUpCompleted: true },
    );
  }

  private getIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
    if (Array.isArray(forwarded)) return forwarded[0].trim();
    return req.ip || 'unknown';
  }

  async listAnomalies(query: {
    userId?: string;
    page: number;
    limit: number;
    type?: AnomalyType;
  }): Promise<{
    anomalies: AnomalyLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const qb = this.anomalyLogRepo.createQueryBuilder('a');
    if (query.userId) {
      qb.andWhere('a.userId = :userId', { userId: query.userId });
    }
    if (query.type) {
      qb.andWhere('a.anomalyType = :type', { type: query.type });
    }
    qb.orderBy('a.createdAt', 'DESC');
    const skip = (query.page - 1) * query.limit;
    qb.skip(skip).take(query.limit);
    const [anomalies, total] = await qb.getManyAndCount();
    return {
      anomalies,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }
}
