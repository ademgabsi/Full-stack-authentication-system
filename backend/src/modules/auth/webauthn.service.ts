import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/types';
import { WebAuthnCredential } from '../../entities/webauthn-credential.entity';
import { User } from '../../entities/user.entity';
import { AppConfigService } from '../../config/app-config.service';
import { AuditLogService } from '../audit/audit.service';
import { Request } from 'express';

@Injectable()
export class WebAuthnService {
  private readonly logger = new Logger(WebAuthnService.name);
  private challenges = new Map<string, string>();

  constructor(
    @InjectRepository(WebAuthnCredential)
    private credentialRepository: Repository<WebAuthnCredential>,
    private configService: AppConfigService,
    private auditLogService: AuditLogService,
  ) {}

  async generateRegistrationOptions(user: User) {
    const existingCredentials = await this.credentialRepository.find({
      where: { userId: user.id },
    });

    const options = await generateRegistrationOptions({
      rpName: this.configService.webauthnRpName,
      rpID: this.configService.webauthnRpId,
      userName: user.email,
      userDisplayName: user.fullName,
      attestationType: 'none',
      excludeCredentials: existingCredentials.map((c) => ({
        id: c.id,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    this.challenges.set(user.id, options.challenge);
    return options;
  }

  async verifyRegistration(
    user: User,
    responseJson: RegistrationResponseJSON,
    name?: string,
    req?: Request,
  ) {
    const expectedChallenge = this.challenges.get(user.id);
    if (!expectedChallenge) {
      throw new BadRequestException('No pending registration challenge found');
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: responseJson,
        expectedChallenge,
        expectedOrigin: this.configService.webauthnOrigin,
        expectedRPID: this.configService.webauthnRpId,
      });

      if (!verification.verified || !verification.registrationInfo) {
        throw new BadRequestException('Registration verification failed');
      }

      const { credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;

      const existingCred = await this.credentialRepository.findOne({
        where: { id: credential.id },
      });
      if (existingCred) {
        throw new BadRequestException('Credential already registered');
      }

      const newCredential = this.credentialRepository.create({
        id: credential.id,
        userId: user.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
        transports: credential.transports
          ? JSON.stringify(credential.transports)
          : null!,
        name: name || 'Passkey',
      });
      await this.credentialRepository.save(newCredential);

      this.challenges.delete(user.id);

      await this.auditLogService.log({
        userId: user.id,
        action: 'auth.webauthn.register',
        resource: `credential:${newCredential.id}`,
        req,
      });

      return newCredential;
    } catch (error) {
      this.challenges.delete(user.id);
      throw error;
    }
  }

  async generateAuthenticationOptions(email?: string) {
    let allowCredentials: any[] | undefined;

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const credentials = await this.credentialRepository
        .createQueryBuilder('cred')
        .innerJoin('cred.user', 'user', 'user.email = :email', {
          email: normalizedEmail,
        })
        .getMany();

      if (credentials.length > 0) {
        allowCredentials = credentials.map((c) => ({
          id: c.id,
          transports: c.transports ? JSON.parse(c.transports) : undefined,
        }));
      }
    }

    const options = await generateAuthenticationOptions({
      rpID: this.configService.webauthnRpId,
      allowCredentials,
      userVerification: 'required',
    });

    this.challenges.set('auth', options.challenge);
    return options;
  }

  async verifyAuthentication(
    response: AuthenticationResponseJSON,
    req?: Request,
  ) {
    const expectedChallenge = this.challenges.get('auth');
    if (!expectedChallenge) {
      throw new BadRequestException(
        'No pending authentication challenge found',
      );
    }

    const credential = await this.credentialRepository.findOne({
      where: { id: response.id },
      relations: ['user'],
    });
    if (!credential) {
      throw new BadRequestException('Credential not found');
    }

    if (!credential.user.isActive) {
      throw new BadRequestException('Account is deactivated');
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.configService.webauthnOrigin,
        expectedRPID: this.configService.webauthnRpId,
        credential: {
          id: credential.id,
          publicKey: new Uint8Array(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports
            ? JSON.parse(credential.transports)
            : undefined,
        },
      });

      if (!verification.verified) {
        throw new BadRequestException('Authentication verification failed');
      }

      await this.credentialRepository.update(credential.id, {
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      });

      this.challenges.delete('auth');

      await this.auditLogService.log({
        userId: credential.userId,
        action: 'auth.webauthn.login',
        resource: `credential:${credential.id}`,
        req,
      });

      return credential.user;
    } catch (error) {
      this.challenges.delete('auth');
      throw error;
    }
  }

  async listCredentials(userId: string) {
    const credentials = await this.credentialRepository.find({
      where: { userId },
      select: [
        'id',
        'name',
        'deviceType',
        'transports',
        'createdAt',
        'lastUsedAt',
      ],
    });

    return credentials.map((c) => ({
      id: c.id,
      name: c.name || 'Passkey',
      deviceType: c.deviceType || 'unknown',
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
    }));
  }

  async renameCredential(userId: string, credentialId: string, name: string) {
    const credential = await this.credentialRepository.findOne({
      where: { id: credentialId, userId },
    });
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    await this.credentialRepository.update(credentialId, { name });
  }

  async deleteCredential(userId: string, credentialId: string, req?: Request) {
    const credential = await this.credentialRepository.findOne({
      where: { id: credentialId, userId },
    });
    if (!credential) {
      throw new NotFoundException('Credential not found');
    }

    await this.credentialRepository.delete(credentialId);

    const remaining = await this.credentialRepository.count({
      where: { userId },
    });

    await this.auditLogService.log({
      userId,
      action: 'auth.webauthn.credential_deleted',
      resource: `credential:${credentialId}`,
      req,
    });

    return { remaining };
  }
}
