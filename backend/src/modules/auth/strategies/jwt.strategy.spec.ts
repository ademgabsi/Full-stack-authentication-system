import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { AppConfigService } from '../../../config/app-config.service';
import { UnauthorizedException } from '@nestjs/common';

const mockConfigService = {
  jwtSecret: 'test-secret',
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: AppConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return user object from valid payload', async () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: 'user',
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
      });
    });

    it('should return admin role from payload', async () => {
      const payload = {
        sub: 'admin-1',
        email: 'admin@example.com',
        role: 'admin',
      };

      const result = await strategy.validate(payload);

      expect(result.role).toBe('admin');
    });

    it('should throw UnauthorizedException when MFA is pending', async () => {
      const payload = {
        sub: 'user-1',
        email: 'test@example.com',
        role: 'user',
        mfaPending: true,
      };

      await expect(strategy.validate(payload)).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(strategy.validate(payload)).rejects.toThrow(
        'MFA verification required',
      );
    });
  });
});
