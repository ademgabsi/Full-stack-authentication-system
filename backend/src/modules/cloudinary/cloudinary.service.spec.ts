import { Test, TestingModule } from '@nestjs/testing';
import { CloudinaryService } from './cloudinary.service';
import { AppConfigService } from '../../config/app-config.service';

const mockConfigService = {
  cloudinaryConfig: {
    cloudName: 'test-cloud',
    apiKey: 'test-api-key',
    apiSecret: 'test-api-secret',
  },
};

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload_stream: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

const cloudinaryLib = require('cloudinary');

describe('CloudinaryService', () => {
  let service: CloudinaryService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CloudinaryService,
        { provide: AppConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<CloudinaryService>(CloudinaryService);
  });

  describe('constructor', () => {
    it('should configure cloudinary with config values', () => {
      expect(cloudinaryLib.v2.config).toHaveBeenCalledWith({
        cloud_name: 'test-cloud',
        api_key: 'test-api-key',
        api_secret: 'test-api-secret',
      });
    });
  });

  describe('uploadImage', () => {
    it('should upload an image and return the secure URL', async () => {
      const mockUploadCallback = jest.fn((opts, cb) => {
        setImmediate(() =>
          cb(null, { secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/profiles/abc123.jpg' }),
        );
        return { end: jest.fn() };
      });
      cloudinaryLib.v2.uploader.upload_stream.mockImplementation(mockUploadCallback);

      const file = {
        buffer: Buffer.from('fake-image-data'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      const result = await service.uploadImage(file);

      expect(result).toBe('https://res.cloudinary.com/test-cloud/image/upload/profiles/abc123.jpg');
      expect(cloudinaryLib.v2.uploader.upload_stream).toHaveBeenCalledWith(
        {
          folder: 'profiles',
          resource_type: 'image',
          transformation: [{ width: 500, height: 500, crop: 'limit' }],
        },
        expect.any(Function),
      );
    });

    it('should allow custom folder', async () => {
      cloudinaryLib.v2.uploader.upload_stream.mockImplementation((opts: any, cb: any) => {
        setImmediate(() => cb(null, { secure_url: 'url' }));
        return { end: jest.fn() };
      });

      const file = {
        buffer: Buffer.from('data'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      await service.uploadImage(file, 'custom-folder');

      expect(cloudinaryLib.v2.uploader.upload_stream).toHaveBeenCalledWith(
        expect.objectContaining({ folder: 'custom-folder' }),
        expect.any(Function),
      );
    });

    it('should reject on upload error', async () => {
      cloudinaryLib.v2.uploader.upload_stream.mockImplementation((opts: any, cb: any) => {
        setImmediate(() => cb(new Error('Upload failed'), null));
        return { end: jest.fn() };
      });

      const file = {
        buffer: Buffer.from('data'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      await expect(service.uploadImage(file)).rejects.toThrow('Upload failed');
    });

    it('should reject when result is null', async () => {
      cloudinaryLib.v2.uploader.upload_stream.mockImplementation((opts: any, cb: any) => {
        setImmediate(() => cb(null, null));
        return { end: jest.fn() };
      });

      const file = {
        buffer: Buffer.from('data'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      } as Express.Multer.File;

      await expect(service.uploadImage(file)).rejects.toThrow('Cloudinary upload failed');
    });
  });

  describe('deleteImage', () => {
    it('should delete an image by public ID', async () => {
      cloudinaryLib.v2.uploader.destroy.mockResolvedValue({ result: 'ok' });

      await service.deleteImage('profiles/abc123');

      expect(cloudinaryLib.v2.uploader.destroy).toHaveBeenCalledWith('profiles/abc123');
    });

    it('should reject deletion of public IDs outside profiles prefix', async () => {
      await service.deleteImage('avatars/abc123');

      expect(cloudinaryLib.v2.uploader.destroy).not.toHaveBeenCalled();
    });

    it('should log error but not throw on delete failure', async () => {
      cloudinaryLib.v2.uploader.destroy.mockRejectedValue(new Error('Delete failed'));

      await expect(
        service.deleteImage('profiles/abc123'),
      ).resolves.toBeUndefined();
    });
  });

  describe('getPublicIdFromUrl', () => {
    it('should extract public ID from a Cloudinary URL', () => {
      const url =
        'https://res.cloudinary.com/test-cloud/image/upload/v12345/profiles/abc123.jpg';

      const result = service.getPublicIdFromUrl(url);
      expect(result).toBe('profiles/abc123');
    });

    it('should handle URLs with nested paths', () => {
      const url =
        'https://res.cloudinary.com/test-cloud/image/upload/v1/profiles/subdir/abc123.png';

      const result = service.getPublicIdFromUrl(url);
      expect(result).toBe('profiles/subdir/abc123');
    });

    it('should return null when no upload path segment found', () => {
      const url = 'https://example.com/image.jpg';
      const result = service.getPublicIdFromUrl(url);
      expect(result).toBeNull();
    });

    it('should return null for invalid URLs', () => {
      const result = service.getPublicIdFromUrl('');
      expect(result).toBeNull();
    });
  });
});
