import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';

@Injectable()
export class BreachPasswordService {
  private readonly logger = new Logger(BreachPasswordService.name);
  private cache = new Map<string, { data: string; expires: number }>();

  constructor(private http: HttpService) {}

  async isBreached(password: string): Promise<number> {
    const hash = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = hash.substring(0, 5);
    const suffix = hash.substring(5);

    const lines = await this.fetchRange(prefix);

    for (const line of lines) {
      const [hashSuffix, count] = line.trim().split(':');
      if (hashSuffix === suffix) return parseInt(count, 10);
    }
    return 0;
  }

  private async fetchRange(prefix: string): Promise<string[]> {
    const cached = this.cache.get(prefix);
    if (cached && cached.expires > Date.now()) {
      return cached.data.split('\n');
    }

    try {
      const response = await firstValueFrom(
        this.http.get(`https://api.pwnedpasswords.com/range/${prefix}`, {
          headers: { 'Add-Padding': 'true' },
        }),
      );

      const data = response.data as string;
      this.cache.set(prefix, {
        data,
        expires: Date.now() + 24 * 60 * 60 * 1000,
      });

      if (this.cache.size > 10000) {
        const oldest = [...this.cache.entries()].sort(
          (a, b) => a[1].expires - b[1].expires,
        );
        for (let i = 0; i < 1000; i++) {
          this.cache.delete(oldest[i][0]);
        }
      }

      return data.split('\n');
    } catch (error) {
      this.logger.warn(
        `HIBP API lookup failed for prefix ${prefix}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      return [];
    }
  }
}
