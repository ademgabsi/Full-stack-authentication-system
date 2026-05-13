import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookEvent {
  USER_REGISTERED = 'user.registered',
  USER_LOCKED = 'user.locked',
  USER_UNLOCKED = 'user.unlocked',
  USER_DEACTIVATED = 'user.deactivated',
  USER_EMAIL_VERIFIED = 'user.email_verified',
  MFA_ENABLED = 'mfa.enabled',
  MFA_DISABLED = 'mfa.disabled',
  USER_PASSWORD_CHANGED = 'user.password_changed',
  USER_PASSWORD_RESET = 'user.password_reset',
  USER_ROLE_CHANGED = 'user.role_changed',
  USER_LOGIN = 'user.login',
  USER_LOGIN_FAILED = 'user.login_failed',
}

@Entity('webhooks')
@Index(['isActive'])
export class Webhook {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 2048 })
  url: string;

  @Column({ type: 'varchar', length: 64 })
  secret: string;

  @Column({ type: 'simple-json' })
  events: WebhookEvent[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
