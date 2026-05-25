import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './app-config.service';

const mockConfigService = {
  get: jest.fn(),
};

describe('AppConfigService', () => {
  let service: AppConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
    jest.clearAllMocks();
  });

  describe('port', () => {
    it('should return app port', () => {
      mockConfigService.get.mockReturnValueOnce(3000);
      expect(service.port).toBe(3000);
    });
  });

  describe('url', () => {
    it('should return app URL', () => {
      mockConfigService.get.mockReturnValueOnce('http://localhost:3000');
      expect(service.url).toBe('http://localhost:3000');
    });
  });

  describe('maxFailedAttempts', () => {
    it('should return max failed attempts', () => {
      mockConfigService.get.mockReturnValueOnce(5);
      expect(service.maxFailedAttempts).toBe(5);
    });
  });

  describe('lockTimeMinutes', () => {
    it('should return lock time minutes', () => {
      mockConfigService.get.mockReturnValueOnce(15);
      expect(service.lockTimeMinutes).toBe(15);
    });
  });

  describe('jwtSecret', () => {
    it('should return JWT secret', () => {
      mockConfigService.get.mockReturnValueOnce('jwt-secret');
      expect(service.jwtSecret).toBe('jwt-secret');
    });
  });

  describe('jwtRefreshSecret', () => {
    it('should return JWT refresh secret', () => {
      mockConfigService.get.mockReturnValueOnce('refresh-secret');
      expect(service.jwtRefreshSecret).toBe('refresh-secret');
    });
  });

  describe('jwtExpiration', () => {
    it('should return JWT expiration', () => {
      mockConfigService.get.mockReturnValueOnce('15m');
      expect(service.jwtExpiration).toBe('15m');
    });
  });

  describe('jwtRefreshExpiration', () => {
    it('should return JWT refresh expiration', () => {
      mockConfigService.get.mockReturnValueOnce('7d');
      expect(service.jwtRefreshExpiration).toBe('7d');
    });
  });

  describe('jwtMfaExpiration', () => {
    it('should return JWT MFA expiration', () => {
      mockConfigService.get.mockReturnValueOnce('5m');
      expect(service.jwtMfaExpiration).toBe('5m');
    });
  });

  describe('dbConfig', () => {
    it('should return database config', () => {
      const dbConfig = { host: 'localhost', port: 5432 };
      mockConfigService.get.mockReturnValueOnce(dbConfig);
      expect(service.dbConfig).toEqual(dbConfig);
    });
  });

  describe('smtpConfig', () => {
    it('should return SMTP config', () => {
      const smtp = { host: 'smtp.example.com', fromName: 'App' };
      mockConfigService.get.mockReturnValueOnce(smtp);
      expect(service.smtpConfig).toEqual(smtp);
    });
  });

  describe('cloudinaryConfig', () => {
    it('should return Cloudinary config', () => {
      const cfg = { cloudName: 'cloud', apiKey: 'key', apiSecret: 'secret' };
      mockConfigService.get.mockReturnValueOnce(cfg);
      expect(service.cloudinaryConfig).toEqual(cfg);
    });
  });

  describe('turnstileSecretKey', () => {
    it('should return turnstile secret key', () => {
      mockConfigService.get.mockReturnValueOnce('ts-secret');
      expect(service.turnstileSecretKey).toBe('ts-secret');
    });

    it('should return empty string when not configured', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      expect(service.turnstileSecretKey).toBe('');
    });
  });

  describe('captchaEnabled', () => {
    it('should return captcha enabled status', () => {
      mockConfigService.get.mockReturnValueOnce(true);
      expect(service.captchaEnabled).toBe(true);
    });

    it('should return false when not configured', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      expect(service.captchaEnabled).toBe(false);
    });
  });

  describe('google OAuth config', () => {
    it('should return Google client ID', () => {
      mockConfigService.get.mockReturnValueOnce('g-client-id');
      expect(service.googleClientId).toBe('g-client-id');
    });

    it('should return Google client secret', () => {
      mockConfigService.get.mockReturnValueOnce('g-client-secret');
      expect(service.googleClientSecret).toBe('g-client-secret');
    });

    it('should return Google callback URL', () => {
      mockConfigService.get.mockReturnValueOnce('http://localhost:3000/api/auth/google/callback');
      expect(service.googleCallbackUrl).toBe('http://localhost:3000/api/auth/google/callback');
    });

    it('should return empty string for unconfigured Google options', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      expect(service.googleClientId).toBe('');
    });
  });

  describe('WebAuthn config', () => {
    it('should return WebAuthn RP name', () => {
      mockConfigService.get.mockReturnValueOnce('My App');
      expect(service.webauthnRpName).toBe('My App');
    });

    it('should return default RP name when not configured', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      expect(service.webauthnRpName).toBe('Auth System');
    });

    it('should return WebAuthn RP ID', () => {
      mockConfigService.get.mockReturnValueOnce('example.com');
      expect(service.webauthnRpId).toBe('example.com');
    });

    it('should return default RP ID when not configured', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      expect(service.webauthnRpId).toBe('localhost');
    });

    it('should return WebAuthn origin', () => {
      mockConfigService.get.mockReturnValueOnce('https://example.com');
      expect(service.webauthnOrigin).toBe('https://example.com');
    });

    it('should return default origin when not configured', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      expect(service.webauthnOrigin).toBe('http://localhost:5173');
    });
  });

  describe('Redis config', () => {
    it('should return Redis host', () => {
      mockConfigService.get.mockReturnValueOnce('redis.example.com');
      expect(service.redisHost).toBe('redis.example.com');
    });

    it('should return default Redis host', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      expect(service.redisHost).toBe('127.0.0.1');
    });

    it('should return Redis port', () => {
      mockConfigService.get.mockReturnValueOnce(6380);
      expect(service.redisPort).toBe(6380);
    });

    it('should return default Redis port', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      expect(service.redisPort).toBe(6379);
    });

    it('should return Redis password', () => {
      mockConfigService.get.mockReturnValueOnce('redis-pass');
      expect(service.redisPassword).toBe('redis-pass');
    });

    it('should return undefined for empty Redis password', () => {
      mockConfigService.get.mockReturnValueOnce('');
      expect(service.redisPassword).toBeUndefined();
    });
  });

  describe('devMode', () => {
    it('should return dev mode true', () => {
      mockConfigService.get.mockReturnValueOnce(true);
      expect(service.devMode).toBe(true);
    });

    it('should return dev mode false by default', () => {
      mockConfigService.get.mockReturnValueOnce(undefined);
      expect(service.devMode).toBe(false);
    });
  });

  describe('disableAuditLogs', () => {
    it('should return disable audit logs status', () => {
      mockConfigService.get.mockReturnValueOnce(true);
      expect(service.disableAuditLogs).toBe(true);
    });
  });

  describe('disableWebhooks', () => {
    it('should return disable webhooks status', () => {
      mockConfigService.get.mockReturnValueOnce(false);
      expect(service.disableWebhooks).toBe(false);
    });
  });

  describe('disableFingerprinting', () => {
    it('should return disable fingerprinting status', () => {
      mockConfigService.get.mockReturnValueOnce(false);
      expect(service.disableFingerprinting).toBe(false);
    });
  });
});
