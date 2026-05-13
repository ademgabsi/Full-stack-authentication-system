import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AnomalyType {
  NEW_DEVICE = 'new_device',
  NEW_IP = 'new_ip',
  NEW_LOCATION = 'new_location',
  IMPOSSIBLE_TRAVEL = 'impossible_travel',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
}

@Entity('anomaly_logs')
@Index(['userId'])
@Index(['createdAt'])
export class AnomalyLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string;

  @Column({ type: 'uuid', name: 'fingerprint_id', nullable: true })
  fingerprintId: string;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'varchar', length: 30, name: 'anomaly_type' })
  anomalyType: AnomalyType;

  @Column({
    type: 'float',
    default: 0.0,
    name: 'risk_score',
  })
  riskScore: number;

  @Column({ type: 'simple-json', nullable: true })
  details: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'user_agent' })
  userAgent: string;

  @Column({ type: 'boolean', default: false, name: 'step_up_issued' })
  stepUpIssued: boolean;

  @Column({ type: 'boolean', default: false, name: 'step_up_completed' })
  stepUpCompleted: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
