import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { CaptchaService } from './captcha.service';
import { AppConfigService } from '../../config/app-config.service';

describe('CaptchaService', () => {
  let service: CaptchaService;
  let httpService: { post: jest.Mock };
  let mockConfigService: {
    turnstileSecretKey: string;
    captchaEnabled: boolean;
  };

  beforeEach(async () => {
    httpService = { post: jest.fn() };
    mockConfigService = {
      turnstileSecretKey: 'test-secret-key',
      captchaEnabled: true,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaptchaService,
        { provide: HttpService, useValue: httpService },
        { provide: AppConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CaptchaService>(CaptchaService);
    jest.clearAllMocks();
  });

  describe('verify', () => {
    it('should return true for a valid token', async () => {
      httpService.post.mockReturnValue(
        of({ data: { success: true } }),
      );

      const result = await service.verify('valid-token');
      expect(result).toBe(true);
      expect(httpService.post).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.stringContaining('secret=test-secret-key'),
        expect.any(Object),
      );
    });

    it('should return false when success is false', async () => {
      httpService.post.mockReturnValue(
        of({ data: { success: false } }),
      );

      const result = await service.verify('invalid-token');
      expect(result).toBe(false);
    });

    it('should return false when API call fails', async () => {
      httpService.post.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const result = await service.verify('some-token');
      expect(result).toBe(false);
    });

    it('should return false for empty token', async () => {
      const result = await service.verify('');
      expect(result).toBe(false);
    });
  });

  describe('when captcha is disabled', () => {
    beforeEach(async () => {
      mockConfigService.captchaEnabled = false;
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          CaptchaService,
          { provide: HttpService, useValue: httpService },
          { provide: AppConfigService, useValue: mockConfigService },
        ],
      }).compile();

      service = module.get<CaptchaService>(CaptchaService);
      jest.clearAllMocks();
    });

    it('should return true without calling API (dev mode)', async () => {
      const result = await service.verify('any-token');
      expect(result).toBe(true);
      expect(httpService.post).not.toHaveBeenCalled();
    });
  });
});
