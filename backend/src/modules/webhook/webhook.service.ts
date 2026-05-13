import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, createHmac, randomUUID } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';
import { Webhook, WebhookEvent } from '../../entities/webhook.entity';
import {
  WebhookDelivery,
  DeliveryStatus,
} from '../../entities/webhook-delivery.entity';
import {
  CreateWebhookDto,
  UpdateWebhookDto,
  ListWebhooksQueryDto,
  ListDeliveriesQueryDto,
} from './dto';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Webhook)
    private webhookRepository: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private deliveryRepository: Repository<WebhookDelivery>,
  ) {}

  async create(dto: CreateWebhookDto): Promise<Webhook> {
    this.validateEvents(dto.events);
    await this.validateUrl(dto.url);

    const secret = randomBytes(32).toString('hex');
    const webhook = this.webhookRepository.create({
      name: dto.name,
      url: dto.url,
      secret,
      events: dto.events,
      isActive: dto.isActive ?? true,
    });
    return this.webhookRepository.save(webhook);
  }

  async update(id: string, dto: UpdateWebhookDto): Promise<Webhook> {
    const webhook = await this.findById(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    if (dto.events) {
      this.validateEvents(dto.events);
    }

    if (dto.url) {
      await this.validateUrl(dto.url);
    }

    Object.assign(webhook, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.url !== undefined && { url: dto.url }),
      ...(dto.events !== undefined && { events: dto.events }),
      ...(dto.isActive !== undefined && { isActive: dto.isActive }),
    });

    return this.webhookRepository.save(webhook);
  }

  async delete(id: string): Promise<void> {
    const webhook = await this.findById(id);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }
    await this.webhookRepository.remove(webhook);
  }

  async findById(id: string): Promise<Webhook | null> {
    return this.webhookRepository.findOne({ where: { id } });
  }

  async listWebhooks(query: ListWebhooksQueryDto) {
    const qb = this.webhookRepository.createQueryBuilder('webhook');

    if (query.search) {
      qb.andWhere('webhook.name ILIKE :search OR webhook.url ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    if (query.event) {
      qb.andWhere('webhook.events @> :event::jsonb', {
        event: JSON.stringify([query.event]),
      });
    }

    qb.orderBy('webhook.createdAt', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [webhooks, total] = await qb.getManyAndCount();
    return {
      webhooks,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async listDeliveries(webhookId: string, query: ListDeliveriesQueryDto) {
    const webhook = await this.findById(webhookId);
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    const qb = this.deliveryRepository.createQueryBuilder('delivery');

    qb.andWhere('delivery.webhookId = :webhookId', { webhookId });

    if (query.status) {
      qb.andWhere('delivery.status = :status', { status: query.status });
    }

    if (query.event) {
      qb.andWhere('delivery.event = :event', { event: query.event });
    }

    qb.orderBy('delivery.createdAt', 'DESC');

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    qb.skip((page - 1) * limit).take(limit);

    const [deliveries, total] = await qb.getManyAndCount();
    return {
      deliveries,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getDeliveryStats() {
    const totalDeliveries = await this.deliveryRepository.count();

    const successfulDeliveries = await this.deliveryRepository.count({
      where: { status: DeliveryStatus.SUCCESS },
    });

    const failedDeliveries = await this.deliveryRepository.count({
      where: { status: DeliveryStatus.FAILED },
    });

    const pendingDeliveries = await this.deliveryRepository.count({
      where: { status: DeliveryStatus.PENDING },
    });

    const recentDeliveries = await this.deliveryRepository.find({
      order: { createdAt: 'DESC' },
      take: 10,
      relations: ['webhook'],
    });

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      pendingDeliveries,
      recentDeliveries,
    };
  }

  getAvailableEvents(): { value: WebhookEvent; label: string }[] {
    return Object.entries(WebhookEvent).map(([key, value]) => ({
      value,
      label: key
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' '),
    }));
  }

  async dispatchEvent(
    event: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const webhooks = await this.webhookRepository.find({
      where: { isActive: true },
    });

    const matchingWebhooks = webhooks.filter((w) =>
      w.events.includes(event as WebhookEvent),
    );

    await Promise.allSettled(
      matchingWebhooks.map((webhook) =>
        this.deliverWebhook(webhook, event, payload),
      ),
    );
  }

  private async deliverWebhook(
    webhook: Webhook,
    event: string,
    payload: Record<string, any>,
  ): Promise<void> {
    const deliveryId = randomUUID();

    const deliveryPayload = {
      id: deliveryId,
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    const secret = webhook.secret;
    const signature = createHmac('sha256', secret)
      .update(JSON.stringify(deliveryPayload))
      .digest('hex');

    const delivery = this.deliveryRepository.create({
      id: deliveryId,
      webhookId: webhook.id,
      event,
      payload: deliveryPayload,
      status: DeliveryStatus.PENDING,
      attempts: 0,
    });
    await this.deliveryRepository.save(delivery);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': event,
          'X-Webhook-Delivery-Id': delivery.id,
        },
        body: JSON.stringify(deliveryPayload),
        signal: AbortSignal.timeout(10000),
      });

      const responseBody = await response.text().catch(() => '');

      if (response.ok) {
        await this.deliveryRepository.update(delivery.id, {
          status: DeliveryStatus.SUCCESS,
          responseStatus: response.status,
          responseBody: responseBody.substring(0, 5000),
          attempts: 1,
        });
      } else {
        await this.deliveryRepository.update(delivery.id, {
          status: DeliveryStatus.FAILED,
          responseStatus: response.status,
          responseBody: responseBody.substring(0, 5000),
          attempts: 1,
        });
        this.logger.warn(
          `Webhook delivery failed: ${webhook.name} (${webhook.id}) -> ${response.status}`,
        );
      }
    } catch (error) {
      await this.deliveryRepository.update(delivery.id, {
        status: DeliveryStatus.FAILED,
        responseBody: error instanceof Error ? error.message : 'Unknown error',
        attempts: 1,
      });
      this.logger.warn(
        `Webhook delivery failed: ${webhook.name} (${webhook.id}) -> ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private validateEvents(events: WebhookEvent[]): void {
    const validEvents = Object.values(WebhookEvent);
    const invalidEvents = events.filter((e) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      throw new BadRequestException(
        `Invalid events: ${invalidEvents.join(', ')}. Valid events: ${validEvents.join(', ')}`,
      );
    }
  }

  private async validateUrl(url: string): Promise<void> {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new BadRequestException('Webhook URL must use http or https');
      }

      const hostname = parsed.hostname;
      if (isIP(hostname)) {
        if (
          hostname === '127.0.0.1' ||
          hostname === '0.0.0.0' ||
          hostname === '::1' ||
          hostname === '::' ||
          hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('172.') ||
          hostname.startsWith('fc') ||
          hostname.startsWith('fd') ||
          hostname.startsWith('fe80:')
        ) {
          throw new BadRequestException(
            'Webhook URL targets a private or reserved IP address',
          );
        }
        const secondOctet = hostname.split('.')[1];
        if (
          hostname.startsWith('172.') &&
          secondOctet &&
          parseInt(secondOctet) >= 16 &&
          parseInt(secondOctet) <= 31
        ) {
          throw new BadRequestException(
            'Webhook URL targets a private IP address range',
          );
        }
        return;
      }

      try {
        const addresses = await lookup(hostname, { all: true });
        for (const addr of addresses) {
          const ip = addr.address;
          if (
            ip === '127.0.0.1' ||
            ip === '0.0.0.0' ||
            ip === '::1' ||
            ip === '::' ||
            ip.startsWith('10.') ||
            ip.startsWith('192.168.') ||
            ip.startsWith('fc') ||
            ip.startsWith('fd') ||
            ip.startsWith('fe80:')
          ) {
            throw new BadRequestException(
              'Webhook URL resolves to a private or reserved IP address',
            );
          }
          if (ip.startsWith('172.')) {
            const secondOctet = ip.split('.')[1];
            if (
              secondOctet &&
              parseInt(secondOctet) >= 16 &&
              parseInt(secondOctet) <= 31
            ) {
              throw new BadRequestException(
                'Webhook URL resolves to a private IP address',
              );
            }
          }
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
        this.logger.warn(
          `DNS lookup failed for webhook URL hostname: ${hostname}`,
        );
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Invalid webhook URL');
    }
  }
}
