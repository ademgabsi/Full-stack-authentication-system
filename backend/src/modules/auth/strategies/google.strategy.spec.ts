import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleStrategy, GoogleProfile } from './google.strategy';
import { AppConfigService } from '../../../config/app-config.service';

const mockConfigService = {
  googleClientId: 'test-client-id',
  googleClientSecret: 'test-client-secret',
  googleCallbackUrl: 'http://localhost:3000/api/auth/google/callback',
};

describe('GoogleStrategy', () => {
  let strategy: GoogleStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleStrategy,
        { provide: AppConfigService, useValue: mockConfigService },
      ],
    }).compile();

    strategy = module.get<GoogleStrategy>(GoogleStrategy);
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(strategy).toBeDefined();
    });
  });

  describe('validate', () => {
    it('should return a GoogleProfile from valid profile data', () => {
      const done = jest.fn();
      const profile = {
        id: 'google-123',
        emails: [{ value: 'user@gmail.com' }],
        name: { givenName: 'John', familyName: 'Doe' },
        photos: [{ value: 'https://photo.url' }],
      };

      strategy.validate('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(null, {
        email: 'user@gmail.com',
        firstName: 'John',
        lastName: 'Doe',
        providerId: 'google-123',
        picture: 'https://photo.url',
      });
    });

    it('should handle missing name fields', () => {
      const done = jest.fn();
      const profile = {
        id: 'google-456',
        emails: [{ value: 'user2@gmail.com' }],
        name: {},
      };

      strategy.validate('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(null, {
        email: 'user2@gmail.com',
        firstName: '',
        lastName: '',
        providerId: 'google-456',
        picture: undefined,
      });
    });

    it('should handle missing photos', () => {
      const done = jest.fn();
      const profile = {
        id: 'google-789',
        emails: [{ value: 'user3@gmail.com' }],
        name: { givenName: 'Jane', familyName: 'Smith' },
      };

      strategy.validate('access-token', 'refresh-token', profile, done);

      const result: GoogleProfile = done.mock.calls[0][1];
      expect(result.picture).toBeUndefined();
      expect(result.email).toBe('user3@gmail.com');
    });

    it('should throw UnauthorizedException when no email is present', () => {
      const done = jest.fn();
      const profile = {
        id: 'google-999',
        emails: [],
        name: { givenName: 'No', familyName: 'Email' },
      };

      strategy.validate('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(
        expect.any(UnauthorizedException),
        false,
      );
    });

    it('should throw UnauthorizedException when emails is undefined', () => {
      const done = jest.fn();
      const profile = {
        id: 'google-999',
        name: { givenName: 'No', familyName: 'Email' },
      };

      strategy.validate('access-token', 'refresh-token', profile, done);

      expect(done).toHaveBeenCalledWith(
        expect.any(UnauthorizedException),
        false,
      );
    });
  });
});
