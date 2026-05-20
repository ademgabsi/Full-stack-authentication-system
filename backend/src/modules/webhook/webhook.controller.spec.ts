import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';
import { Webhook, WebhookEvent } from '../../entities/webhook.entity';
import { DeliveryStatus } from '../../entities/webhook-delivery.entity';

const mockWebhookService = {
  listWebhooks: jest.fn(),
  getAvailableEvents: jest.fn(),
  getDeliveryStats: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  listDeliveries: jest.fn(),
};

describe('WebhookController', () => {
  let controller: WebhookController;
  let webhookService: typeof mockWebhookService;

  const testWebhook: Webhook = {
    id: 'wh-1',
    name: 'Test Webhook',
    url: 'https://example.com/hook',
    secret: 'secret-key',
    events: [WebhookEvent.USER_REGISTERED, WebhookEvent.USER_LOGIN],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [{ provide: WebhookService, useValue: mockWebhookService }],
    }).compile();

    controller = module.get<WebhookController>(WebhookController);
    webhookService = module.get(WebhookService);
  });

  describe('listWebhooks', () => {
    it('should return paginated webhooks', async () => {
      mockWebhookService.listWebhooks.mockResolvedValue({
        webhooks: [testWebhook],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });
      const result = await controller.listWebhooks({ page: 1, limit: 20 });
      expect(result.webhooks).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass search and event filters', async () => {
      mockWebhookService.listWebhooks.mockResolvedValue({ webhooks: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      await controller.listWebhooks({ search: 'test', event: 'user.login' });
      expect(mockWebhookService.listWebhooks).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test', event: 'user.login' }),
      );
    });
  });

  describe('getAvailableEvents', () => {
    it('should return available event types', async () => {
      mockWebhookService.getAvailableEvents.mockReturnValue([
        { value: 'user.registered', label: 'User Registered' },
      ]);
      const result = controller.getAvailableEvents();
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('getDeliveryStats', () => {
    it('should return delivery statistics', async () => {
      mockWebhookService.getDeliveryStats.mockResolvedValue({
        totalDeliveries: 100,
        successfulDeliveries: 80,
        failedDeliveries: 15,
        pendingDeliveries: 5,
        recentDeliveries: [],
      });
      const result = await controller.getDeliveryStats();
      expect(result.totalDeliveries).toBe(100);
    });
  });

  describe('getWebhook', () => {
    it('should return webhook by id', async () => {
      mockWebhookService.findById.mockResolvedValue(testWebhook);
      const result = await controller.getWebhook('wh-1');
      expect(result.id).toBe('wh-1');
    });

    it('should throw NotFoundException for nonexistent webhook', async () => {
      mockWebhookService.findById.mockResolvedValue(null);
      await expect(controller.getWebhook('nonexistent')).rejects.toThrow('Webhook not found');
    });
  });

  describe('createWebhook', () => {
    it('should create a webhook', async () => {
      mockWebhookService.create.mockResolvedValue(testWebhook);
      const result = await controller.createWebhook({
        name: 'New Hook',
        url: 'https://example.com/hook',
        events: [WebhookEvent.USER_LOGIN],
      });
      expect(result).toHaveProperty('id');
    });
  });

  describe('updateWebhook', () => {
    it('should update a webhook', async () => {
      mockWebhookService.update.mockResolvedValue({ ...testWebhook, name: 'Updated' });
      const result = await controller.updateWebhook('wh-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteWebhook', () => {
    it('should delete a webhook', async () => {
      mockWebhookService.delete.mockResolvedValue(undefined);
      const result = await controller.deleteWebhook('wh-1');
      expect(result.message).toContain('deleted');
      expect(mockWebhookService.delete).toHaveBeenCalledWith('wh-1');
    });
  });

  describe('listDeliveries', () => {
    it('should return paginated deliveries for a webhook', async () => {
      mockWebhookService.listDeliveries.mockResolvedValue({
        deliveries: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0,
      });
      const result = await controller.listDeliveries('wh-1', {});
      expect(result).toHaveProperty('deliveries');
    });

    it('should pass status and event filters', async () => {
      mockWebhookService.listDeliveries.mockResolvedValue({ deliveries: [], total: 0, page: 1, limit: 20, totalPages: 0 });
      await controller.listDeliveries('wh-1', { status: DeliveryStatus.FAILED, event: 'user.login' });
      expect(mockWebhookService.listDeliveries).toHaveBeenCalledWith('wh-1',
        expect.objectContaining({ status: 'failed', event: 'user.login' }),
      );
    });
  });
});
