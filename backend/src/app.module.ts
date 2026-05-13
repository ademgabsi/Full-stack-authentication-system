import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import Redis from 'ioredis';
import { AppConfigModule } from './config/config.module';
import { AppConfigService } from './config/app-config.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { AuditModule } from './modules/audit/audit.module';
import { CaptchaModule } from './modules/captcha/captcha.module';
import { BreachPasswordModule } from './modules/auth/breach-password.module';
import { WebAuthnModule } from './modules/auth/webauthn.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RedisThrottlerStorage } from './common/storage/redis-throttler.storage';

function getSslConfig(sslEnabled: boolean) {
  if (!sslEnabled) return false;

  if (process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false') {
    return { rejectUnauthorized: false };
  }

  return {
    rejectUnauthorized: true,
    ca: process.env.DB_SSL_CA,
    cert: process.env.DB_SSL_CERT,
    key: process.env.DB_SSL_KEY,
  };
}

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => ({
        type: 'postgres' as const,
        host: configService.dbConfig.host,
        port: configService.dbConfig.port,
        username: configService.dbConfig.username,
        password: configService.dbConfig.password,
        database: configService.dbConfig.database,
        ssl: getSslConfig(configService.dbConfig.ssl),
        entities: [__dirname + '/entities/*.entity{.ts,.js}'],
        synchronize: configService.dbConfig.synchronize,
        autoLoadEntities: true,
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const redis = new Redis({
          host: configService.redisHost,
          port: configService.redisPort,
          password: configService.redisPassword,
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          retryStrategy: (times) => Math.min(times * 200, 5000),
          lazyConnect: true,
        });

        redis.on('error', () => {});

        return {
          throttlers: [
            { name: 'short', ttl: 1000, limit: 3 },
            { name: 'medium', ttl: 10000, limit: 20 },
            { name: 'long', ttl: 60000, limit: 100 },
          ],
          storage: new RedisThrottlerStorage(redis),
        };
      },
    }),
    AuditModule,
    CaptchaModule,
    BreachPasswordModule,
    AuthModule,
    WebAuthnModule,
    UsersModule,
    AdminModule,
    WebhookModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
