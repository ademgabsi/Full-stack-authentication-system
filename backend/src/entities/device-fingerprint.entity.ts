import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('device_fingerprints')
@Index(['userId', 'fingerprintHash'])
export class DeviceFingerprint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', name: 'fingerprint_hash', length: 64 })
  fingerprintHash: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  browser: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  os: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'device_type' })
  deviceType: string;

  @Column({
    type: 'varchar',
    length: 50,
    nullable: true,
    name: 'screen_resolution',
  })
  screenResolution: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  timezone: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  language: string;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'country_code' })
  countryCode: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({
    type: 'timestamp',
    name: 'first_seen_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  firstSeenAt: Date;

  @Column({
    type: 'timestamp',
    name: 'last_seen_at',
    default: () => 'CURRENT_TIMESTAMP',
  })
  lastSeenAt: Date;

  @Column({ type: 'int', default: 0, name: 'login_count' })
  loginCount: number;

  @Column({ type: 'boolean', name: 'is_trusted', default: false })
  isTrusted: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_revoked' })
  isRevoked: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
