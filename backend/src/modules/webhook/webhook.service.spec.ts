import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WebhookService } from './webhook.service';
import { Webhook, WebhookEvent } from '../../entities/webhook.entity';
import { WebhookDelivery, DeliveryStatus } from '../../entities/webhook-delivery.entity';

const mockWebhookRepo = {
  create: jest.fn((dto) => ({ id: 'wh-1', ...dto })),
  save: jest.fn((entity) => Promise.resolve({ id: 'wh-1', ...entity, createdAt: new Date(), updatedAt: new Date() })),
  findOne: jest.fn(),
  find: jest.fn(),
  remove: jest.fn(() => Promise.resolve()),
  createQueryBuilder: jest.fn(),
};

const mockDeliveryRepo = {
  create: jest.fn((dto) => ({ id: 'del-1', ...dto })),
  save: jest.fn((entity) => Promise.resolve(entity)),
  update: jest.fn(() => Promise.resolve()),
  find: jest.fn(),
  count: jest.fn(() => Promise.resolve(0)),
  createQueryBuilder: jest.fn(),
};

describe('WebhookService', () => {
  let service: WebhookService;
  let webhookRepo: typeof mockWebhookRepo;
  let deliveryRepo: typeof mockDeliveryRepo;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        { provide: getRepositoryToken(Webhook), useValue: mockWebhookRepo },
        { provide: getRepositoryToken(WebhookDelivery), useValue: mockDeliveryRepo },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    webhookRepo = module.get(getRepositoryToken(Webhook));
    deliveryRepo = module.get(getRepositoryToken(WebhookDelivery));
  });

  describe('create', () => {
    it('should create a webhook with auto-generated secret', async () => {
      const dto = {
        name: 'Test Webhook',
        url: 'https://example.com/hook',
        events: [WebhookEvent.USER_REGISTERED],
      };
      const result = await service.create(dto);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('secret');
      expect(result.secret).toHaveLength(64); // 32 bytes hex
    });

    it('should fail with invalid event types', async () => {
      const dto = {
        name: 'Test',
        url: 'https://example.com/hook',
        events: ['invalid.event' as WebhookEvent],
      };
      await expect(service.create(dto)).rejects.toThrow('Invalid events');
    });

    it('should fail with non-http URL', async () => {
      const dto = {
        name: 'Test',
        url: 'ftp://example.com/hook',
        events: [WebhookEvent.USER_REGISTERED],
      };
      await expect(service.create(dto)).rejects.toThrow('http or https');
    });

    it('should fail with localhost URL', async () => {
      const dto = {
        name: 'Test',
        url: 'http://127.0.0.1:3000/hook',
        events: [WebhookEvent.USER_REGISTERED],
      };
      await expect(service.create(dto)).rejects.toThrow('private');
    });

    it('should fail with 10.x.x.x URL', async () => {
      const dto = {
        name: 'Test',
        url: 'http://10.0.0.1/hook',
        events: [WebhookEvent.USER_REGISTERED],
      };
      await expect(service.create(dto)).rejects.toThrow('private');
    });

    it('should fail with 192.168.x.x URL', async () => {
      const dto = {
        name: 'Test',
        url: 'http://192.168.1.1/hook',
        events: [WebhookEvent.USER_REGISTERED],
      };
      await expect(service.create(dto)).rejects.toThrow('private');
    });

    it('should allow creation with isActive = false', async () => {
      const dto = {
        name: 'Inactive',
        url: 'https://example.com/hook',
        events: [WebhookEvent.USER_REGISTERED],
        isActive: false,
      };
      const result = await service.create(dto);
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should update webhook fields', async () => {
      const existing = {
        id: 'wh-1',
        name: 'Old',
        url: 'https://old.example.com',
        secret: 'secret',
        events: [WebhookEvent.USER_REGISTERED],
        isActive: true,
      };
      mockWebhookRepo.findOne.mockResolvedValue(existing);
      const result = await service.update('wh-1', {
        name: 'New Name',
        isActive: false,
      });
      expect(result).toBeDefined();
      expect(mockWebhookRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for nonexistent webhook', async () => {
      mockWebhookRepo.findOne.mockResolvedValue(null);
      await expect(service.update('nonexistent', { name: 'Test' })).rejects.toThrow('Webhook not found');
    });
  });

  describe('delete', () => {
    it('should delete a webhook', async () => {
      mockWebhookRepo.findOne.mockResolvedValue({ id: 'wh-1', name: 'Test' });
      await service.delete('wh-1');
      expect(mockWebhookRepo.remove).toHaveBeenCalled();
    });

    it('should throw NotFoundException for nonexistent webhook', async () => {
      mockWebhookRepo.findOne.mockResolvedValue(null);
      await expect(service.delete('nonexistent')).rejects.toThrow('Webhook not found');
    });
  });

  describe('findById', () => {
    it('should return webhook by id', async () => {
      const webhook = { id: 'wh-1', name: 'Test', url: 'https://example.com', secret: 's', events: [], isActive: true };
      mockWebhookRepo.findOne.mockResolvedValue(webhook);
      const result = await service.findById('wh-1');
      expect(result).toBe(webhook);
    });

    it('should return null for nonexistent', async () => {
      mockWebhookRepo.findOne.mockResolvedValue(null);
      expect(await service.findById('nonexistent')).toBeNull();
    });
  });

  describe('listWebhooks', () => {
    it('should return paginated webhooks', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockWebhookRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listWebhooks({ page: 1, limit: 10 });
      expect(result).toHaveProperty('webhooks');
      expect(result).toHaveProperty('total');
    });

    it('should filter by search and event', async () => {
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockWebhookRepo.createQueryBuilder.mockReturnValue(qb);

      await service.listWebhooks({
        search: 'test',
        event: 'user.registered',
      });
      expect(qb.andWhere).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAvailableEvents', () => {
    it('should return list of available webhook events', () => {
      const events = service.getAvailableEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('value');
      expect(events[0]).toHaveProperty('label');
    });
  });

  describe('listDeliveries', () => {
    it('should return paginated deliveries', async () => {
      mockWebhookRepo.findOne.mockResolvedValue({ id: 'wh-1' });
      const qb = {
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockDeliveryRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listDeliveries('wh-1', {});
      expect(result).toHaveProperty('deliveries');
      expect(result).toHaveProperty('total');
    });

    it('should throw when webhook not found', async () => {
      mockWebhookRepo.findOne.mockResolvedValue(null);
      await expect(service.listDeliveries('nonexistent', {})).rejects.toThrow('Webhook not found');
    });
  });

  describe('getDeliveryStats', () => {
    it('should return delivery stats', async () => {
      mockDeliveryRepo.count.mockResolvedValueOnce(100);
      mockDeliveryRepo.count.mockResolvedValueOnce(80);
      mockDeliveryRepo.count.mockResolvedValueOnce(15);
      mockDeliveryRepo.count.mockResolvedValueOnce(5);
      mockDeliveryRepo.find.mockResolvedValue([]);

      const result = await service.getDeliveryStats();
      expect(result).toHaveProperty('totalDeliveries', 100);
      expect(result).toHaveProperty('successfulDeliveries', 80);
      expect(result).toHaveProperty('failedDeliveries', 15);
      expect(result).toHaveProperty('pendingDeliveries', 5);
    });
  });

  describe('dispatchEvent', () => {
    it('should dispatch event to matching active webhooks', async () => {
      const webhooks = [
        { id: 'wh-1', url: 'https://example.com/hook', name: 'Hook1', secret: 's1',
          events: [WebhookEvent.USER_REGISTERED, WebhookEvent.USER_LOGIN], isActive: true, createdAt: new Date(), updatedAt: new Date() },
        { id: 'wh-2', url: 'https://example.com/hook2', name: 'Hook2', secret: 's2',
          events: [WebhookEvent.USER_LOGIN], isActive: true, createdAt: new Date(), updatedAt: new Date() },
      ];
      mockWebhookRepo.find.mockResolvedValue(webhooks);

      // Mock fetch internally - we need to mock global fetch
      const originalFetch = global.fetch;
      global.fetch = jest.fn(() =>
        Promise.resolve(new Response('OK', { status: 200 })),
      ) as jest.Mock;

      await service.dispatchEvent(WebhookEvent.USER_REGISTERED, { userId: 'user-1' });

      expect(mockWebhookRepo.find).toHaveBeenCalledWith({ where: { isActive: true } });

      global.fetch = originalFetch;
    });
  });
});
