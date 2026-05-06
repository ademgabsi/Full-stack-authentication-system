import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: ConfigService) {}

  get port(): number {
    return this.configService.get<number>('app.port')!;
  }

  get url(): string {
    return this.configService.get<string>('app.url')!;
  }

  get maxFailedAttempts(): number {
    return this.configService.get<number>('app.maxFailedAttempts')!;
  }

  get lockTimeMinutes(): number {
    return this.configService.get<number>('app.lockTimeMinutes')!;
  }

  get jwtSecret(): string {
    return this.configService.get<string>('app.jwt.secret')!;
  }

  get jwtRefreshSecret(): string {
    return this.configService.get<string>('app.jwt.refreshSecret')!;
  }

  get jwtExpiration(): string {
    return this.configService.get<string>('app.jwt.expiration')!;
  }

  get jwtRefreshExpiration(): string {
    return this.configService.get<string>('app.jwt.refreshExpiration')!;
  }

  get jwtMfaExpiration(): string {
    return this.configService.get<string>('app.jwt.mfaExpiration')!;
  }

  get dbConfig() {
    return this.configService.get('app.db')!;
  }

  get smtpConfig() {
    return this.configService.get('app.smtp')!;
  }

  get cloudinaryConfig() {
    return this.configService.get('app.cloudinary')!;
  }

  get turnstileSecretKey(): string {
    return this.configService.get<string>('app.turnstile.secretKey') ?? '';
  }

  get captchaEnabled(): boolean {
    return this.configService.get<boolean>('app.turnstile.enabled') ?? false;
  }

  get googleClientId(): string {
    return this.configService.get<string>('app.google.clientId') ?? '';
  }

  get googleClientSecret(): string {
    return this.configService.get<string>('app.google.clientSecret') ?? '';
  }

  get googleCallbackUrl(): string {
    return this.configService.get<string>('app.google.callbackUrl') ?? '';
  }

  get webauthnRpName(): string {
    return this.configService.get<string>('app.webauthn.rpName') ?? 'Auth System';
  }

  get webauthnRpId(): string {
    return this.configService.get<string>('app.webauthn.rpId') ?? 'localhost';
  }

  get webauthnOrigin(): string {
    return this.configService.get<string>('app.webauthn.origin') ?? 'http://localhost:5173';
  }
}
