import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Webhook } from './webhook.entity';

export enum DeliveryStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('webhook_deliveries')
@Index(['webhookId', 'createdAt'])
@Index(['status'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'webhook_id' })
  webhookId: string;

  @Column({ type: 'varchar', length: 100 })
  event: string;

  @Column({ type: 'jsonb' })
  payload: object;

  @Column({ type: 'integer', nullable: true, name: 'response_status' })
  responseStatus: number;

  @Column({ type: 'text', nullable: true, name: 'response_body' })
  responseBody: string;

  @Column({
    type: 'enum',
    enum: DeliveryStatus,
    default: DeliveryStatus.PENDING,
  })
  status: DeliveryStatus;

  @Column({ type: 'integer', default: 0, name: 'attempts' })
  attempts: number;

  @Column({ type: 'timestamp', nullable: true, name: 'next_retry_at' })
  nextRetryAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Webhook, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhook_id' })
  webhook: Webhook;
}
