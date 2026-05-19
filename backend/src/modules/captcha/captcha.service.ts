import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);
  private readonly secretKey: string;
  private readonly enabled: boolean;

  constructor(
    private config: AppConfigService,
    private http: HttpService,
  ) {
    this.secretKey = this.config.turnstileSecretKey;
    this.enabled = this.config.captchaEnabled;
  }

  async verify(token: string): Promise<boolean> {
    if (!this.enabled) {
      if (process.env.NODE_ENV === 'production') {
        this.logger.warn('CAPTCHA verification bypassed in production mode');
        return false;
      }
      return true;
    }

    if (!token) {
      return false;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<{ success: boolean }>(
          'https://challenges.cloudflare.com/turnstile/v0/siteverify',
          `secret=${this.secretKey}&response=${token}`,
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          },
        ),
      );
      return response.data.success === true;
    } catch (error) {
      this.logger.error('Turnstile verification request failed', error);
      return false;
    }
  }
}
