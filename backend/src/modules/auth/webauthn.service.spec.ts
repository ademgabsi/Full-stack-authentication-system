import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as simpleWebAuthn from '@simplewebauthn/server';
import { WebAuthnService } from './webauthn.service';
import { WebAuthnCredential } from '../../entities/webauthn-credential.entity';
import { User, UserRole } from '../../entities/user.entity';
import { AppConfigService } from '../../config/app-config.service';
import { AuditLogService } from '../audit/audit.service';

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

const mockCredentialRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((dto) => dto as WebAuthnCredential),
  save: jest.fn((entity) => Promise.resolve({ id: 'cred-1', ...entity })),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockConfigService = {
  webauthnRpName: 'Auth System',
  webauthnRpId: 'localhost',
  webauthnOrigin: 'http://localhost:5173',
};

const mockAuditLogService = {
  log: jest.fn(() => Promise.resolve()),
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

describe('WebAuthnService', () => {
  let service: WebAuthnService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebAuthnService,
        {
          provide: getRepositoryToken(WebAuthnCredential),
          useValue: mockCredentialRepo,
        },
        { provide: AppConfigService, useValue: mockConfigService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = module.get<WebAuthnService>(WebAuthnService);
    jest.clearAllMocks();
  });

  describe('generateRegistrationOptions', () => {
    it('should generate registration options for a user', async () => {
      const user = makeUser();
      mockCredentialRepo.find.mockResolvedValue([]);
      (simpleWebAuthn.generateRegistrationOptions as jest.Mock).mockResolvedValue({
        challenge: 'test-challenge',
        rp: { name: 'Auth System', id: 'localhost' },
        user: { id: 'uid', name: user.email, displayName: user.fullName },
      });

      const result = await service.generateRegistrationOptions(user);

      expect(result.challenge).toBeDefined();
      expect(result.challengeKey).toBeDefined();
      expect(result.challengeKey).toContain('reg:user-1:');
    });

    it('should exclude existing credentials', async () => {
      const user = makeUser();
      mockCredentialRepo.find.mockResolvedValue([
        { id: 'existing-creds', transports: JSON.stringify(['internal']) },
      ]);
      (simpleWebAuthn.generateRegistrationOptions as jest.Mock).mockResolvedValue({
        challenge: 'test-challenge',
      });

      await service.generateRegistrationOptions(user);

      const callArgs = (simpleWebAuthn.generateRegistrationOptions as jest.Mock).mock
        .calls[0][0];
      expect(callArgs.excludeCredentials).toHaveLength(1);
      expect(callArgs.excludeCredentials[0].id).toBe('existing-creds');
    });
  });

  describe('verifyRegistration', () => {
    it('should verify a registration response', async () => {
      const user = makeUser();
      mockCredentialRepo.find.mockResolvedValue([]);
      (simpleWebAuthn.generateRegistrationOptions as jest.Mock).mockResolvedValue({
        challenge: 'test-challenge',
      });
      const options = await service.generateRegistrationOptions(user);

      const responseJson: any = { id: 'cred-id' };

      (simpleWebAuthn.verifyRegistrationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-id',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            transports: ['internal'],
          },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      });

      mockCredentialRepo.findOne.mockResolvedValue(null);
      mockCredentialRepo.save.mockResolvedValue({
        id: 'cred-id',
        name: 'My Passkey',
        userId: user.id,
      });

      const result = await service.verifyRegistration(
        user,
        responseJson,
        'My Passkey',
        undefined,
        options.challengeKey,
      );

      expect(result.id).toBe('cred-id');
      expect(result.name).toBe('My Passkey');
      expect(mockCredentialRepo.save).toHaveBeenCalled();
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it('should throw if challenge is not found', async () => {
      const user = makeUser();

      await expect(
        service.verifyRegistration(user, { id: 'x' } as any, undefined, undefined, 'invalid-key'),
      ).rejects.toThrow('No pending registration challenge found');
    });

    it('should throw if verification fails', async () => {
      const user = makeUser();
      mockCredentialRepo.find.mockResolvedValue([]);
      (simpleWebAuthn.generateRegistrationOptions as jest.Mock).mockResolvedValue({
        challenge: 'test-challenge',
      });
      const options = await service.generateRegistrationOptions(user);
      (simpleWebAuthn.verifyRegistrationResponse as jest.Mock).mockResolvedValue({
        verified: false,
      });

      await expect(
        service.verifyRegistration(user, { id: 'x' } as any, undefined, undefined, options.challengeKey),
      ).rejects.toThrow('Registration verification failed');
    });

    it('should throw if credential already exists', async () => {
      const user = makeUser();
      mockCredentialRepo.find.mockResolvedValue([]);
      (simpleWebAuthn.generateRegistrationOptions as jest.Mock).mockResolvedValue({
        challenge: 'test-challenge',
      });
      const options = await service.generateRegistrationOptions(user);
      (simpleWebAuthn.verifyRegistrationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'existing-cred',
            publicKey: new Uint8Array([1]),
            counter: 0,
          },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      });
      mockCredentialRepo.findOne.mockResolvedValue({ id: 'existing-cred' });

      await expect(
        service.verifyRegistration(user, { id: 'x' } as any, undefined, undefined, options.challengeKey),
      ).rejects.toThrow('Credential already registered');
    });

    it('should default name to "Passkey" if not provided', async () => {
      const user = makeUser();
      mockCredentialRepo.find.mockResolvedValue([]);
      (simpleWebAuthn.generateRegistrationOptions as jest.Mock).mockResolvedValue({
        challenge: 'test-challenge',
      });
      const options = await service.generateRegistrationOptions(user);
      (simpleWebAuthn.verifyRegistrationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'cred-id',
            publicKey: new Uint8Array([1]),
            counter: 0,
          },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      });
      mockCredentialRepo.findOne.mockResolvedValue(null);
      mockCredentialRepo.save.mockResolvedValue({ id: 'cred-id', name: 'Passkey', userId: user.id });

      const result = await service.verifyRegistration(user, { id: 'x' } as any, undefined, undefined, options.challengeKey);
      expect(result.name).toBe('Passkey');
    });
  });

  describe('generateAuthenticationOptions', () => {
    it('should generate authentication options without email', async () => {
      (simpleWebAuthn.generateAuthenticationOptions as jest.Mock).mockResolvedValue({
        challenge: 'auth-challenge',
      });

      const result = await service.generateAuthenticationOptions();

      expect(result.challenge).toBe('auth-challenge');
      expect(result.challengeKey).toContain('auth:');
    });

    it('should generate authentication options with email lookup', async () => {
      const mockQb = {
        innerJoin: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'cred-1', transports: JSON.stringify(['internal']) },
        ]),
      };
      mockCredentialRepo.createQueryBuilder.mockReturnValue(mockQb);
      (simpleWebAuthn.generateAuthenticationOptions as jest.Mock).mockResolvedValue({
        challenge: 'auth-challenge',
      });

      const result = await service.generateAuthenticationOptions('test@example.com');

      expect(result.challenge).toBe('auth-challenge');
      const callArgs = (simpleWebAuthn.generateAuthenticationOptions as jest.Mock).mock.calls[0][0];
      expect(callArgs.allowCredentials).toHaveLength(1);
    });
  });

  describe('verifyAuthentication', () => {
    it('should verify an authentication response', async () => {
      mockCredentialRepo.find.mockResolvedValue([]);
      (simpleWebAuthn.generateAuthenticationOptions as jest.Mock).mockResolvedValue({
        challenge: 'auth-challenge',
      });
      const options = await service.generateAuthenticationOptions();

      mockCredentialRepo.findOne.mockResolvedValue({
        id: 'cred-1',
        userId: 'user-1',
        publicKey: Buffer.from([1, 2, 3]),
        counter: 0,
        transports: JSON.stringify(['internal']),
        user: makeUser(),
      });
      (simpleWebAuthn.verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });

      const result = await service.verifyAuthentication(
        { id: 'cred-1' } as any,
        undefined,
        options.challengeKey,
      );

      expect(result.id).toBe('user-1');
      expect(mockCredentialRepo.update).toHaveBeenCalledWith('cred-1', expect.any(Object));
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it('should throw if challenge is not found', async () => {
      await expect(
        service.verifyAuthentication({ id: 'x' } as any, undefined, 'invalid-key'),
      ).rejects.toThrow('No pending authentication challenge found');
    });

    it('should throw if credential not found', async () => {
      (simpleWebAuthn.generateAuthenticationOptions as jest.Mock).mockResolvedValue({
        challenge: 'auth-challenge',
      });
      const options = await service.generateAuthenticationOptions();
      mockCredentialRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyAuthentication({ id: 'cred-1' } as any, undefined, options.challengeKey),
      ).rejects.toThrow('Credential not found');
    });

    it('should throw if user is deactivated', async () => {
      (simpleWebAuthn.generateAuthenticationOptions as jest.Mock).mockResolvedValue({
        challenge: 'auth-challenge',
      });
      const options = await service.generateAuthenticationOptions();
      mockCredentialRepo.findOne.mockResolvedValue({
        id: 'cred-1',
        userId: 'user-1',
        publicKey: Buffer.from([1]),
        counter: 0,
        user: makeUser({ isActive: false }),
      });

      await expect(
        service.verifyAuthentication({ id: 'cred-1' } as any, undefined, options.challengeKey),
      ).rejects.toThrow('Account is deactivated');
    });
  });

  describe('listCredentials', () => {
    it('should list credentials for a user', async () => {
      mockCredentialRepo.find.mockResolvedValue([
        { id: 'cred-1', name: 'Mac Passkey', deviceType: 'singleDevice', createdAt: new Date(), lastUsedAt: null, transports: '["internal"]' },
      ]);

      const result = await service.listCredentials('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cred-1');
      expect(result[0].name).toBe('Mac Passkey');
      expect(result[0].deviceType).toBe('singleDevice');
    });

    it('should default name and deviceType for missing values', async () => {
      mockCredentialRepo.find.mockResolvedValue([
        { id: 'cred-1', name: null, deviceType: null, createdAt: new Date(), lastUsedAt: null, transports: null },
      ]);

      const result = await service.listCredentials('user-1');
      expect(result[0].name).toBe('Passkey');
      expect(result[0].deviceType).toBe('unknown');
    });

    it('should return empty array when no credentials', async () => {
      mockCredentialRepo.find.mockResolvedValue([]);
      const result = await service.listCredentials('user-1');
      expect(result).toEqual([]);
    });
  });

  describe('renameCredential', () => {
    it('should rename a credential', async () => {
      mockCredentialRepo.findOne.mockResolvedValue({ id: 'cred-1', userId: 'user-1' });

      await service.renameCredential('user-1', 'cred-1', 'New Name');

      expect(mockCredentialRepo.update).toHaveBeenCalledWith('cred-1', { name: 'New Name' });
    });

    it('should throw if credential not found', async () => {
      mockCredentialRepo.findOne.mockResolvedValue(null);

      await expect(
        service.renameCredential('user-1', 'cred-1', 'New Name'),
      ).rejects.toThrow('Credential not found');
    });
  });

  describe('deleteCredential', () => {
    it('should delete a credential and return remaining count', async () => {
      mockCredentialRepo.findOne.mockResolvedValue({ id: 'cred-1', userId: 'user-1' });
      mockCredentialRepo.count.mockResolvedValue(0);

      const result = await service.deleteCredential('user-1', 'cred-1');

      expect(mockCredentialRepo.delete).toHaveBeenCalledWith('cred-1');
      expect(result.remaining).toBe(0);
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it('should throw if credential not found', async () => {
      mockCredentialRepo.findOne.mockResolvedValue(null);

      await expect(
        service.deleteCredential('user-1', 'cred-1'),
      ).rejects.toThrow('Credential not found');
    });
  });
});
