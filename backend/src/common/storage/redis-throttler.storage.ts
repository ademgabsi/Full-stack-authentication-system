import { Injectable, Logger } from '@nestjs/common';
import { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

export interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const INCREMENT_SCRIPT = `
local key = KEYS[1]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])

local totalHits = redis.call('INCR', key)
if totalHits == 1 then
  redis.call('PEXPIRE', key, ttl)
end

local timeToExpire = redis.call('PTTL', key)
if timeToExpire < 0 then
  timeToExpire = ttl
end

local isBlocked = false
local timeToBlockExpire = 0

if totalHits > limit and blockDuration > 0 then
  local blockKey = key .. ':block'
  local blockExists = redis.call('GET', blockKey)
  if not blockExists then
    redis.call('SET', blockKey, '1', 'PX', blockDuration)
    timeToBlockExpire = blockDuration
  else
    timeToBlockExpire = redis.call('PTTL', blockKey)
  end
  isBlocked = true
elseif totalHits > limit then
  isBlocked = true
end

return { totalHits, timeToExpire, isBlocked and 1 or 0, timeToBlockExpire }
`;

type InMemoryRecord = {
  totalHits: number;
  expiresAt: number;
  isBlocked: boolean;
  blockExpiresAt: number;
};

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;
  private redisReady = false;
  private readonly fallback = new Map<string, InMemoryRecord>();

  constructor(redis: Redis) {
    this.redis = redis;
    this.redis.defineCommand('throttlerIncrement', {
      numberOfKeys: 1,
      lua: INCREMENT_SCRIPT,
    });

    this.redis.on('ready', () => {
      if (!this.redisReady) {
        this.logger.log('Redis connected — rate limiting uses Redis');
      }
      this.redisReady = true;
    });

    this.redis.on('error', (err) => {
      if (this.redisReady) {
        this.logger.warn(
          `Redis connection lost — falling back to in-memory rate limiting: ${err.message}`,
        );
      }
      this.redisReady = false;
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (this.redisReady) {
      try {
        const result = await (this.redis as any).throttlerIncrement(
          `throttler:${key}`,
          ttl,
          limit,
          blockDuration,
        );
        return {
          totalHits: result[0],
          timeToExpire: result[1],
          isBlocked: result[2] === 1,
          timeToBlockExpire: result[3],
        };
      } catch {
        this.redisReady = false;
        this.logger.warn(
          'Redis operation failed — falling back to in-memory rate limiting',
        );
      }
    }

    return this.incrementInMemory(key, ttl, limit, blockDuration);
  }

  private incrementInMemory(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
  ): ThrottlerStorageRecord {
    const now = Date.now();
    let record = this.fallback.get(key);

    if (!record || record.expiresAt <= now) {
      record = { totalHits: 0, expiresAt: now + ttl, isBlocked: false, blockExpiresAt: 0 };
    }

    record.totalHits += 1;
    const timeToExpire = Math.max(0, record.expiresAt - now);

    if (record.totalHits > limit) {
      record.isBlocked = true;
      if (blockDuration > 0 && record.blockExpiresAt <= now) {
        record.blockExpiresAt = now + blockDuration;
      }
    }

    this.fallback.set(key, record);
    this.cleanup(now);

    return {
      totalHits: record.totalHits,
      timeToExpire,
      isBlocked: record.isBlocked,
      timeToBlockExpire: record.isBlocked
        ? Math.max(0, record.blockExpiresAt - now)
        : 0,
    };
  }

  private cleanup(now: number) {
    if (this.fallback.size > 10000) {
      for (const [k, v] of this.fallback) {
        if (v.expiresAt <= now) this.fallback.delete(k);
      }
    }
  }
}
