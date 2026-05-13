import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('webauthn_credentials')
export class WebAuthnCredential {
  @PrimaryColumn({ type: 'varchar', length: 255 })
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'bytea' })
  publicKey: Buffer;

  @Column({ type: 'integer' })
  counter: number;

  @Column({ name: 'device_type', type: 'varchar', length: 64, nullable: true })
  deviceType: string;

  @Column({ type: 'boolean', nullable: true })
  backedUp: boolean;

  @Column({ type: 'text', nullable: true })
  transports: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
