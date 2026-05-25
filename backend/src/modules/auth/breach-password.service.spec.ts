import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { AxiosResponse, AxiosHeaders } from 'axios';
import { BreachPasswordService } from './breach-password.service';

const createMockResponse = (data: string, status = 200): AxiosResponse<string> => ({
  data,
  status,
  statusText: 'OK',
  headers: {} as AxiosHeaders,
  config: { headers: new AxiosHeaders() },
});

describe('BreachPasswordService', () => {
  let service: BreachPasswordService;
  let httpService: { get: jest.Mock };

  beforeEach(async () => {
    httpService = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BreachPasswordService,
        { provide: HttpService, useValue: httpService },
      ],
    }).compile();

    service = module.get<BreachPasswordService>(BreachPasswordService);
    jest.clearAllMocks();
  });

  describe('isBreached', () => {
    it('should return 0 when password is not found in HIBP', async () => {
      httpService.get.mockReturnValue(
        of(createMockResponse('NOTFOUND:42\nANOTHER:12')),
      );

      const count = await service.isBreached('SecurePassword123!');
      expect(count).toBe(0);
    });

    it('should return the breach count when password is found', async () => {
      httpService.get.mockReturnValue(
        of(createMockResponse('SOMEBREACH:150\nANOTHER:5')),
      );

      const hash = require('crypto')
        .createHash('sha1')
        .update('password')
        .digest('hex')
        .toUpperCase();
      const suffix = hash.substring(5);

      httpService.get.mockReturnValue(
        of(createMockResponse(`${suffix}:42\nOTHER:10`)),
      );

      const count = await service.isBreached('password');
      expect(count).toBe(42);
    });

    it('should use k-anonymity by only sending prefix', async () => {
      httpService.get.mockReturnValue(of(createMockResponse('')));

      await service.isBreached('test123');

      const callUrl = httpService.get.mock.calls[0][0];
      expect(callUrl).toContain('https://api.pwnedpasswords.com/range/');
      const prefixLength = 5;
      const urlPrefix = callUrl.split('/').pop();
      expect(urlPrefix).toHaveLength(prefixLength);
    });

    it('should cache HIBP results', async () => {
      httpService.get.mockReturnValue(of(createMockResponse('')));

      await service.isBreached('test123');
      await service.isBreached('test123');

      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('should return 0 when HIBP API fails', async () => {
      httpService.get.mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const count = await service.isBreached('testpassword');
      expect(count).toBe(0);
    });

    it('should handle empty response from HIBP', async () => {
      httpService.get.mockReturnValue(of(createMockResponse('')));

      const count = await service.isBreached('nonexistentpassword');
      expect(count).toBe(0);
    });

    it('should send Add-Padding header for k-anonymity', async () => {
      httpService.get.mockReturnValue(of(createMockResponse('')));

      await service.isBreached('test123');

      const callConfig = httpService.get.mock.calls[0][1];
      expect(callConfig.headers['Add-Padding']).toBe('true');
    });

    it('should handle large breach counts', async () => {
      httpService.get.mockReturnValue(
        of(createMockResponse('SOMESUFFIX:999999999\n')),
      );

      const hash = require('crypto')
        .createHash('sha1')
        .update('password')
        .digest('hex')
        .toUpperCase();
      const suffix = hash.substring(5);

      httpService.get.mockReturnValue(
        of(createMockResponse(`${suffix}:999999999\n`)),
      );

      const count = await service.isBreached('password');
      expect(count).toBe(999999999);
    });
  });
});
