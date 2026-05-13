import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { User, UserRole } from '../../src/entities/user.entity';
import { DeviceFingerprint } from '../../src/entities/device-fingerprint.entity';
import { AnomalyLog } from '../../src/entities/anomaly-log.entity';
import { StepUpChallenge } from '../../src/entities/step-up-challenge.entity';
import { RefreshToken } from '../../src/entities/refresh-token.entity';

describe('Device Fingerprint & Anomaly Detection (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let testUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [
            User,
            DeviceFingerprint,
            AnomalyLog,
            StepUpChallenge,
            RefreshToken,
          ],
          synchronize: true,
        }),
        AppModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Create test user
    const userRepo = dataSource.getRepository(User);
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    testUser = await userRepo.save({
      email: 'test@example.com',
      passwordHash,
      fullName: 'Test User',
      role: UserRole.USER,
      isVerified: true,
      isActive: true,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up fingerprint/anomaly data between tests
    await dataSource.getRepository(DeviceFingerprint).delete({});
    await dataSource.getRepository(AnomalyLog).delete({});
    await dataSource.getRepository(StepUpChallenge).delete({});
    await dataSource.getRepository(RefreshToken).delete({});
  });

  describe('POST /auth/login', () => {
    it('should login normally for first-time user (no previous fingerprints)', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          fingerprint: {
            screenResolution: '1920x1080',
            timezone: 'America/New_York',
          },
        });

      // First login creates fingerprint but since no previous sessions exist,
      // only new_device might trigger but risk score stays below threshold
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });

    it('should create fingerprint record on login', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          fingerprint: {
            screenResolution: '1920x1080',
            timezone: 'America/New_York',
          },
        });

      const fingerprints = await dataSource
        .getRepository(DeviceFingerprint)
        .find({ where: { userId: testUser.id } });

      expect(fingerprints).toHaveLength(1);
      expect(fingerprints[0].loginCount).toBe(1);
    });

    it('should return tokens for known device on subsequent login', async () => {
      // First login to establish fingerprint
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          fingerprint: {
            screenResolution: '1920x1080',
            timezone: 'America/New_York',
          },
        });

      // Same device login
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          fingerprint: {
            screenResolution: '1920x1080',
            timezone: 'America/New_York',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
    });
  });

  describe('Admin endpoints', () => {
    let adminToken: string;

    beforeAll(async () => {
      const userRepo = dataSource.getRepository(User);
      const admin = await userRepo.save({
        email: 'admin@example.com',
        passwordHash: await bcrypt.hash('AdminPass123!', 10),
        fullName: 'Admin User',
        role: UserRole.ADMIN,
        isVerified: true,
        isActive: true,
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'AdminPass123!',
        });

      adminToken = loginRes.body.accessToken;
    });

    it('should list anomalies (admin only)', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/anomalies')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('anomalies');
    });

    it('should list user fingerprints (admin only)', async () => {
      // Create a fingerprint first
      const fpRepo = dataSource.getRepository(DeviceFingerprint);
      await fpRepo.save({
        userId: testUser.id,
        fingerprintHash: 'testhash',
        browser: 'Chrome',
        os: 'Windows',
      });

      const response = await request(app.getHttpServer())
        .get(`/admin/users/${testUser.id}/fingerprints`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
