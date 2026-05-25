import { Test, TestingModule } from '@nestjs/testing';
import { WebAuthnController } from './webauthn.controller';
import { WebAuthnService } from './webauthn.service';
import { AuthService } from './auth.service';
import { User, UserRole } from '../../entities/user.entity';

const mockWebAuthnService = {
  generateRegistrationOptions: jest.fn(),
  verifyRegistration: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthentication: jest.fn(),
  listCredentials: jest.fn(),
  renameCredential: jest.fn(),
  deleteCredential: jest.fn(),
};

const mockAuthService = {
  findUserById: jest.fn(),
  generateTokensForUser: jest.fn(),
  setPasskeysEnabled: jest.fn(),
};

const makeUser = (overrides = {}): User =>
  ({
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'Test User',
    role: 'user' as UserRole,
    passwordHash: 'hash',
    isActive: true,
    isVerified: true,
    ...overrides,
  }) as User;

describe('WebAuthnController', () => {
  let controller: WebAuthnController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebAuthnController],
      providers: [
        { provide: WebAuthnService, useValue: mockWebAuthnService },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    controller = module.get<WebAuthnController>(WebAuthnController);
    jest.clearAllMocks();
  });

  describe('registrationOptions', () => {
    it('should return registration options', async () => {
      const user = makeUser();
      mockAuthService.findUserById.mockResolvedValue(user);
      mockWebAuthnService.generateRegistrationOptions.mockResolvedValue({
        challenge: 'test-challenge',
        challengeKey: 'reg:user-1:uuid',
      });

      const result = await controller.registrationOptions('user-1');

      expect(mockAuthService.findUserById).toHaveBeenCalledWith('user-1');
      expect(result.challenge).toBe('test-challenge');
      expect(result.challengeKey).toBe('reg:user-1:uuid');
    });
  });

  describe('registrationVerify', () => {
    it('should verify registration and set passkeysEnabled when first credential', async () => {
      const user = makeUser();
      mockAuthService.findUserById.mockResolvedValue(user);
      mockWebAuthnService.verifyRegistration.mockResolvedValue({
        id: 'cred-1',
        name: 'My Passkey',
        createdAt: new Date(),
      });
      mockWebAuthnService.listCredentials.mockResolvedValue([{ id: 'cred-1' }]);

      const result = await controller.registrationVerify(
        'user-1',
        { response: '{"id":"cred-1"}', name: 'My Passkey', challengeKey: 'key-1' },
        {} as any,
      );

      expect(result.message).toBe('Passkey registered successfully');
      expect(mockAuthService.setPasskeysEnabled).toHaveBeenCalledWith('user-1', true);
    });

    it('should not set passkeysEnabled when not first credential', async () => {
      const user = makeUser();
      mockAuthService.findUserById.mockResolvedValue(user);
      mockWebAuthnService.verifyRegistration.mockResolvedValue({
        id: 'cred-2',
        name: 'My Passkey',
        createdAt: new Date(),
      });
      mockWebAuthnService.listCredentials.mockResolvedValue([{ id: 'cred-1' }, { id: 'cred-2' }]);

      await controller.registrationVerify(
        'user-1',
        { response: '{"id":"cred-2"}', name: 'My Passkey', challengeKey: 'key-1' },
        {} as any,
      );

      expect(mockAuthService.setPasskeysEnabled).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid JSON', async () => {
      await expect(
        controller.registrationVerify('user-1', { response: 'invalid', challengeKey: 'key-1' }, {} as any),
      ).rejects.toThrow('Invalid registration response format');
    });
  });

  describe('authenticationOptions', () => {
    it('should return authentication options', async () => {
      mockWebAuthnService.generateAuthenticationOptions.mockResolvedValue({
        challenge: 'auth-challenge',
        challengeKey: 'auth:uuid',
      });

      const result = await controller.authenticationOptions({ email: 'test@example.com' });

      expect(result.challenge).toBe('auth-challenge');
      expect(mockWebAuthnService.generateAuthenticationOptions).toHaveBeenCalledWith('test@example.com');
    });

    it('should work without email', async () => {
      mockWebAuthnService.generateAuthenticationOptions.mockResolvedValue({
        challenge: 'auth-challenge',
        challengeKey: 'auth:uuid',
      });

      const result = await controller.authenticationOptions({});

      expect(result.challenge).toBe('auth-challenge');
    });
  });

  describe('authenticationVerify', () => {
    it('should verify authentication and return tokens', async () => {
      const user = makeUser();
      mockWebAuthnService.verifyAuthentication.mockResolvedValue(user);
      mockAuthService.generateTokensForUser.mockResolvedValue({
        accessToken: 'at-1',
        refreshToken: 'rt-1',
        user: { id: 'user-1', email: 'test@example.com', role: 'user' },
      });

      const res = { cookie: jest.fn() };
      const result = await controller.authenticationVerify(
        { response: '{"id":"cred-1"}', challengeKey: 'key-1' },
        {} as any,
        res as any,
      );

      expect(result.accessToken).toBe('at-1');
      expect(result.user).toBeDefined();
      expect(res.cookie).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid JSON', async () => {
      const res = { cookie: jest.fn() };
      await expect(
        controller.authenticationVerify(
          { response: 'invalid', challengeKey: 'key-1' },
          {} as any,
          res as any,
        ),
      ).rejects.toThrow('Invalid authentication response format');
    });
  });

  describe('listCredentials', () => {
    it('should list user credentials', async () => {
      mockWebAuthnService.listCredentials.mockResolvedValue([
        { id: 'cred-1', name: 'Passkey', deviceType: 'singleDevice', createdAt: new Date(), lastUsedAt: null },
      ]);

      const result = await controller.listCredentials('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cred-1');
    });
  });

  describe('renameCredential', () => {
    it('should rename a credential', async () => {
      mockWebAuthnService.renameCredential.mockResolvedValue(undefined);

      const result = await controller.renameCredential('user-1', 'cred-1', { name: 'New Name' });

      expect(result.message).toBe('Passkey renamed successfully');
      expect(mockWebAuthnService.renameCredential).toHaveBeenCalledWith('user-1', 'cred-1', 'New Name');
    });
  });

  describe('deleteCredential', () => {
    it('should delete a credential and disable passkeys if none remaining', async () => {
      mockWebAuthnService.deleteCredential.mockResolvedValue({ remaining: 0 });

      const result = await controller.deleteCredential('user-1', 'cred-1', {} as any);

      expect(result.message).toBe('Passkey deleted successfully');
      expect(mockAuthService.setPasskeysEnabled).toHaveBeenCalledWith('user-1', false);
    });

    it('should not disable passkeys if credentials remain', async () => {
      mockWebAuthnService.deleteCredential.mockResolvedValue({ remaining: 2 });

      await controller.deleteCredential('user-1', 'cred-1', {} as any);

      expect(mockAuthService.setPasskeysEnabled).not.toHaveBeenCalled();
    });
  });
});
