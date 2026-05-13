import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum StepUpType {
  EMAIL_OTP = 'email_otp',
  MFA = 'mfa',
}

@Entity('step_up_challenges')
@Index(['tokenHash'])
@Index(['userId'])
export class StepUpChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 64, name: 'token_hash' })
  tokenHash: string;

  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'varchar', length: 20 })
  type: StepUpType;

  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'boolean', default: false })
  used: boolean;

  @Column({ type: 'simple-json', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
