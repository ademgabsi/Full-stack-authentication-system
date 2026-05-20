import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../../modules/auth/dto/register.dto';
import { LoginDto } from '../../modules/auth/dto/login.dto';
import { VerifyEmailDto } from '../../modules/auth/dto/verify-email.dto';
import { MfaVerifyDto } from '../../modules/auth/dto/mfa-verify.dto';
import { MfaEnableDto } from '../../modules/auth/dto/mfa-enable.dto';
import { MfaDisableDto } from '../../modules/auth/dto/mfa-disable.dto';
import { MfaBackupCodeVerifyDto } from '../../modules/auth/dto/mfa-backup-code-verify.dto';
import { ForgotPasswordDto, ResetPasswordDto } from '../../modules/auth/dto/forgot-password.dto';
import { ResendVerificationDto } from '../../modules/auth/dto/resend-verification.dto';
import { UpdateProfileDto } from '../../modules/users/dto/update-profile.dto';
import { ChangePasswordDto } from '../../modules/users/dto/change-password.dto';
import { IsStrongPasswordConstraint } from './is-strong-password';

async function getErrors(dtoInstance: object) {
  const errors = await validate(dtoInstance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return errors;
}

describe('DTO Validation', () => {
  describe('RegisterDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'StrongPass1!',
        fullName: 'John Doe',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with invalid email', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'not-an-email',
        password: 'StrongPass1!',
        fullName: 'John Doe',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('email');
    });

    it('should fail with empty email', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: '',
        password: 'StrongPass1!',
        fullName: 'John Doe',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with short password', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'Short1!',
        fullName: 'John Doe',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('should fail with password missing uppercase', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'weakpassword1!',
        fullName: 'John Doe',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with password missing number', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'WeakPassword!',
        fullName: 'John Doe',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with password missing special char', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'WeakPassword1',
        fullName: 'John Doe',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with short fullName', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'StrongPass1!',
        fullName: 'A',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should allow optional captchaToken', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'StrongPass1!',
        fullName: 'John Doe',
        captchaToken: 'captcha-token-123',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should reject non-whitelisted properties', async () => {
      const dto = plainToInstance(RegisterDto, {
        email: 'test@example.com',
        password: 'StrongPass1!',
        fullName: 'John Doe',
        isAdmin: true,
      } as any);
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('LoginDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: 'anypassword',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with missing email', async () => {
      const dto = plainToInstance(LoginDto, {
        password: 'anypassword',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should allow optional fingerprint', async () => {
      const dto = plainToInstance(LoginDto, {
        email: 'test@example.com',
        password: 'pass',
        fingerprint: { screenResolution: '1920x1080', timezone: 'UTC' },
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('VerifyEmailDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(VerifyEmailDto, {
        email: 'test@example.com',
        code: '123456',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with code not 6 digits', async () => {
      const dto = plainToInstance(VerifyEmailDto, {
        email: 'test@example.com',
        code: '12345',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('MfaVerifyDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(MfaVerifyDto, {
        tempToken: '550e8400-e29b-41d4-a716-446655440000',
        totpCode: '123456',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with non-uuid tempToken', async () => {
      const dto = plainToInstance(MfaVerifyDto, {
        tempToken: 'not-a-uuid',
        totpCode: '123456',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with non-6-digit totpCode', async () => {
      const dto = plainToInstance(MfaVerifyDto, {
        tempToken: '550e8400-e29b-41d4-a716-446655440000',
        totpCode: '12345',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('should fail with non-numeric totpCode', async () => {
      const dto = plainToInstance(MfaVerifyDto, {
        tempToken: '550e8400-e29b-41d4-a716-446655440000',
        totpCode: 'abcdef',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('MfaEnableDto', () => {
    it('should pass with valid 6-digit code', async () => {
      const dto = plainToInstance(MfaEnableDto, { totpCode: '123456' });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('MfaDisableDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(MfaDisableDto, {
        password: 'StrongPass1!',
        totpCode: '123456',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should pass without optional totpCode', async () => {
      const dto = plainToInstance(MfaDisableDto, {
        password: 'StrongPass1!',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('MfaBackupCodeVerifyDto', () => {
    it('should pass with valid backup code (8 chars)', async () => {
      const dto = plainToInstance(MfaBackupCodeVerifyDto, {
        tempToken: '550e8400-e29b-41d4-a716-446655440000',
        backupCode: 'ABCD1234',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with wrong backup code length', async () => {
      const dto = plainToInstance(MfaBackupCodeVerifyDto, {
        tempToken: '550e8400-e29b-41d4-a716-446655440000',
        backupCode: 'ABC',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ForgotPasswordDto', () => {
    it('should pass with valid email', async () => {
      const dto = plainToInstance(ForgotPasswordDto, { email: 'test@example.com' });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('ResetPasswordDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(ResetPasswordDto, {
        email: 'test@example.com',
        code: '123456',
        password: 'NewStrongPass1!',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with weak new password', async () => {
      const dto = plainToInstance(ResetPasswordDto, {
        email: 'test@example.com',
        code: '123456',
        password: 'weak',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ResendVerificationDto', () => {
    it('should pass with valid email', async () => {
      const dto = plainToInstance(ResendVerificationDto, { email: 'test@example.com' });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('UpdateProfileDto', () => {
    it('should pass with just fullName', async () => {
      const dto = plainToInstance(UpdateProfileDto, { fullName: 'New Name' });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail when email is changed without currentPassword', async () => {
      const dto = plainToInstance(UpdateProfileDto, { email: 'new@example.com' });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.property === 'currentPassword')).toBe(true);
    });

    it('should pass when email is changed with currentPassword', async () => {
      const dto = plainToInstance(UpdateProfileDto, {
        email: 'new@example.com',
        currentPassword: 'StrongPass1!',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });
  });

  describe('ChangePasswordDto', () => {
    it('should pass with valid data', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'OldPass1!',
        newPassword: 'NewStrongPass1!',
      });
      const errors = await getErrors(dto);
      expect(errors).toHaveLength(0);
    });

    it('should fail with weak new password', async () => {
      const dto = plainToInstance(ChangePasswordDto, {
        currentPassword: 'OldPass1!',
        newPassword: 'weak',
      });
      const errors = await getErrors(dto);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('IsStrongPassword Validator', () => {
    const validator = new IsStrongPasswordConstraint();

    it('should reject empty password', () => {
      expect(validator.validate('')).toBe(false);
    });

    it('should reject password without uppercase', () => {
      expect(validator.validate('lowercase1!')).toBe(false);
    });

    it('should reject password without lowercase', () => {
      expect(validator.validate('UPPERCASE1!')).toBe(false);
    });

    it('should reject password without number', () => {
      expect(validator.validate('UpperCase!')).toBe(false);
    });

    it('should reject password without special character', () => {
      expect(validator.validate('UpperCase1')).toBe(false);
    });

    it('should accept strong password', () => {
      expect(validator.validate('StrongPass1!')).toBe(true);
    });

    it('should accept complex password with multiple special chars', () => {
      expect(validator.validate('C0mpl3x!P@ssw0rd')).toBe(true);
    });

    it('should return descriptive error message', () => {
      expect(validator.defaultMessage()).toContain('uppercase');
      expect(validator.defaultMessage()).toContain('lowercase');
      expect(validator.defaultMessage()).toContain('number');
      expect(validator.defaultMessage()).toContain('special character');
    });
  });
});
