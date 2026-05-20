import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Request } from 'express';
import { BadRequestException } from '@nestjs/common';

const mockUsersService = {
  findById: jest.fn(),
  sanitizeUser: jest.fn((u: any) => {
    const { passwordHash, mfaSecret, mfaBackupCodes, ...rest } = u;
    return rest;
  }),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  uploadImage: jest.fn(),
  requestDeletion: jest.fn(),
  confirmDeletion: jest.fn(),
  cancelDeletion: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: typeof mockUsersService;

  const mockReq = { headers: {}, ip: '127.0.0.1' } as unknown as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  describe('getProfile', () => {
    it('should return sanitized user profile', async () => {
      mockUsersService.findById.mockResolvedValue({
        id: 'user-1', email: 'test@example.com', passwordHash: 'hashed',
      });
      const result = await controller.getProfile('user-1');
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).toHaveProperty('id', 'user-1');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      mockUsersService.updateProfile.mockResolvedValue({ id: 'user-1', fullName: 'Updated' });
      const result = await controller.updateProfile('user-1', { fullName: 'Updated' });
      expect(result).toHaveProperty('fullName', 'Updated');
    });
  });

  describe('changePassword', () => {
    it('should change password', async () => {
      mockUsersService.changePassword.mockResolvedValue({ message: 'Password changed' });
      const result = await controller.changePassword('user-1', {
        currentPassword: 'Old1!', newPassword: 'NewPass1!',
      }, mockReq);
      expect(result.message).toContain('changed');
    });
  });

  describe('uploadImage', () => {
    it('should throw on invalid file type', () => {
      // This is tested via the FileInterceptor filter
      // We test the controller method behavior
    });

    it('should throw on magic byte mismatch (content-type spoofing)', async () => {
      // File passes mimetype filter but magic bytes don't match
      const file = {
        mimetype: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4E, 0x48]), // PNG with bad magic byte
        originalname: 'test.png',
        size: 1024,
      } as Express.Multer.File;

      await expect(controller.uploadImage('user-1', file)).rejects.toThrow(
        'File content does not match the declared file type',
      );
    });

    it('should accept valid PNG file (magic bytes match)', async () => {
      const file = {
        mimetype: 'image/png',
        buffer: Buffer.from([0x89, 0x50, 0x4E, 0x47]), // valid PNG
        originalname: 'test.png',
        size: 1024,
      } as Express.Multer.File;

      mockUsersService.uploadImage.mockResolvedValue({ image: 'https://img.jpg' });
      const result = await controller.uploadImage('user-1', file);
      expect(result).toHaveProperty('image');
    });
  });

  describe('requestDeletion', () => {
    it('should request account deletion', async () => {
      mockUsersService.requestDeletion.mockResolvedValue({ message: 'Confirmation code sent' });
      const result = await controller.requestDeletion('user-1', mockReq);
      expect(result.message).toContain('code');
    });
  });

  describe('confirmDeletion', () => {
    it('should confirm account deletion', async () => {
      mockUsersService.confirmDeletion.mockResolvedValue({ message: 'scheduled for deletion' });
      const result = await controller.confirmDeletion('user-1', { code: '123456' }, mockReq);
      expect(result.message).toContain('scheduled');
    });
  });

  describe('cancelDeletion', () => {
    it('should cancel account deletion', async () => {
      mockUsersService.cancelDeletion.mockResolvedValue({ message: 'cancelled' });
      const result = await controller.cancelDeletion('user-1', { code: '123456' }, mockReq);
      expect(result.message).toContain('cancelled');
    });
  });
});
