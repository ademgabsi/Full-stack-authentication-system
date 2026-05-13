import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Webhook } from '../../entities/webhook.entity';
import { WebhookDelivery } from '../../entities/webhook-delivery.entity';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Webhook, WebhookDelivery])],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
