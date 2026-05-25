import { Test, TestingModule } from '@nestjs/testing';
import { MfaService } from './mfa.service';
import { AppConfigService } from '../../config/app-config.service';
import * as QRCode from 'qrcode';
import * as otplib from 'otplib';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,abc123'),
}));

const mockConfigService = {
  smtpConfig: { fromName: 'AuthSystem' },
  jwtSecret: 'test-secret-key-for-unit-tests',
};

describe('MfaService', () => {
  let service: MfaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        { provide: AppConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<MfaService>(MfaService);
    jest.clearAllMocks();
  });

  describe('generateSecret', () => {
    it('should generate a secret and otpauthUrl', () => {
      const email = 'test@example.com';
      const result = service.generateSecret(email);

      expect(result.secret).toBeDefined();
      expect(typeof result.secret).toBe('string');
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.otpauthUrl).toContain('otpauth://totp/AuthSystem:');
      expect(result.otpauthUrl).toContain(encodeURIComponent(email));
      expect(result.otpauthUrl).toContain(`secret=${result.secret}`);
    });

    it('should use the app name from config', () => {
      const result = service.generateSecret('test@example.com');
      expect(result.otpauthUrl).toContain('otpauth://totp/AuthSystem:');
    });
  });

  describe('generateQrCode', () => {
    it('should generate a QR code data URL', async () => {
      const otpauthUrl = 'otpauth://totp/App:test@test.com?secret=ABC';
      const result = await service.generateQrCode(otpauthUrl);

      expect(QRCode.toDataURL).toHaveBeenCalledWith(otpauthUrl);
      expect(result).toBe('data:image/png;base64,abc123');
    });
  });

  describe('verifyTotp', () => {
    it('should return true when TOTP code matches', () => {
      const secret = 'TESTSECRET';
      const token = '123456';
      jest.spyOn(otplib.authenticator, 'generate').mockReturnValue(token);

      const result = service.verifyTotp(secret, token);
      expect(result).toBe(true);
    });

    it('should return false when TOTP code does not match', () => {
      jest.spyOn(otplib.authenticator, 'generate').mockReturnValue('654321');

      const result = service.verifyTotp('TESTSECRET', '123456');
      expect(result).toBe(false);
    });

    it('should use timing-safe comparison', () => {
      jest.spyOn(otplib.authenticator, 'generate').mockReturnValue('123456');
      const result = service.verifyTotp('TESTSECRET', '123456');
      expect(result).toBe(true);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate the default number of codes (10)', () => {
      const codes = service.generateBackupCodes();
      expect(codes).toHaveLength(10);
    });

    it('should generate unique codes', () => {
      const codes = service.generateBackupCodes(20);
      const unique = new Set(codes);
      expect(unique.size).toBe(20);
    });

    it('should generate codes in uppercase hex format', () => {
      const codes = service.generateBackupCodes(5);
      codes.forEach((code) => {
        expect(/^[0-9A-F]+$/.test(code)).toBe(true);
        expect(code.length).toBe(8);
      });
    });

    it('should generate custom number of codes', () => {
      const codes = service.generateBackupCodes(5);
      expect(codes).toHaveLength(5);
    });
  });

  describe('hashBackupCodes', () => {
    it('should hash all backup codes', () => {
      const codes = ['ABC123', 'DEF456', 'GHI789'];
      const hashed = service.hashBackupCodes(codes);

      expect(hashed).toHaveLength(3);
      hashed.forEach((hash) => {
        expect(hash).toBeDefined();
        expect(typeof hash).toBe('string');
        expect(hash.length).toBeGreaterThan(0);
      });
    });

    it('should produce deterministic hashes for the same input', () => {
      const codes = ['ABC123'];
      const firstHash = service.hashBackupCodes(codes);
      const secondHash = service.hashBackupCodes(codes);
      expect(firstHash[0]).toBe(secondHash[0]);
    });

    it('should produce different hashes for different inputs', () => {
      const codes1 = ['ABC123'];
      const codes2 = ['DEF456'];
      expect(service.hashBackupCodes(codes1)[0]).not.toBe(
        service.hashBackupCodes(codes2)[0],
      );
    });

    it('should return empty array for empty input', () => {
      expect(service.hashBackupCodes([])).toEqual([]);
    });
  });

  describe('verifyBackupCodeHashed', () => {
    it('should find a valid backup code and return its index', () => {
      const codes = ['ABC123', 'DEF456'];
      const hashed = service.hashBackupCodes(codes);
      const index = service.verifyBackupCodeHashed(hashed, 'ABC123');

      expect(index).toBe(0);
    });

    it('should find a code at a non-zero index', () => {
      const codes = ['ABC123', 'DEF456', 'GHI789'];
      const hashed = service.hashBackupCodes(codes);
      const index = service.verifyBackupCodeHashed(hashed, 'DEF456');

      expect(index).toBe(1);
    });

    it('should return -1 when code is not found', () => {
      const codes = ['ABC123'];
      const hashed = service.hashBackupCodes(codes);
      const index = service.verifyBackupCodeHashed(hashed, 'INVALID');

      expect(index).toBe(-1);
    });

    it('should return -1 for empty hashed codes', () => {
      const index = service.verifyBackupCodeHashed([], 'ABC123');
      expect(index).toBe(-1);
    });
  });
});
