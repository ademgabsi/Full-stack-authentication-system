import { RedisThrottlerStorage } from './redis-throttler.storage';
import Redis from 'ioredis';

const mockRedisInstance = {
  defineCommand: jest.fn(),
  on: jest.fn(),
  throttlerIncrement: jest.fn(),
} as unknown as Redis;

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    storage = new RedisThrottlerStorage(mockRedisInstance);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should define the throttlerIncrement command on Redis', () => {
      expect(mockRedisInstance.defineCommand).toHaveBeenCalledWith(
        'throttlerIncrement',
        expect.objectContaining({
          numberOfKeys: 1,
          lua: expect.any(String),
        }),
      );
    });

    it('should set up Redis event listeners', () => {
      expect(mockRedisInstance.on).toHaveBeenCalledWith('ready', expect.any(Function));
      expect(mockRedisInstance.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('increment with Redis', () => {
    beforeEach(() => {
      (storage as any).redisReady = true;
    });

    it('should use Redis for increment', async () => {
      (mockRedisInstance as any).throttlerIncrement.mockResolvedValue([5, 30000, 0, 0]);

      const result = await storage.increment('key1', 60000, 10, 0, 'default');

      expect(result).toEqual({
        totalHits: 5,
        timeToExpire: 30000,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('should return blocked status when hits exceed limit', async () => {
      (mockRedisInstance as any).throttlerIncrement.mockResolvedValue([11, 25000, 1, 60000]);

      const result = await storage.increment('key1', 60000, 10, 60000, 'default');

      expect(result.isBlocked).toBe(true);
      expect(result.timeToBlockExpire).toBe(60000);
    });

    it('should fall back to in-memory on Redis error', async () => {
      (mockRedisInstance as any).throttlerIncrement.mockRejectedValue(new Error('Redis error'));

      const result = await storage.increment('key1', 60000, 10, 0, 'default');

      expect(result.totalHits).toBe(1);
      expect(result.isBlocked).toBe(false);
    });
  });

  describe('increment in-memory fallback', () => {
    it('should increment hits and return correct values', async () => {
      const result1 = await storage.increment('key1', 60000, 10, 0, 'default');
      expect(result1.totalHits).toBe(1);

      const result2 = await storage.increment('key1', 60000, 10, 0, 'default');
      expect(result2.totalHits).toBe(2);
    });

    it('should block when hits exceed limit', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.increment('key2', 60000, 4, 60000, 'default');
      }

      const result = await storage.increment('key2', 60000, 4, 60000, 'default');
      expect(result.isBlocked).toBe(true);
      expect(result.timeToBlockExpire).toBeGreaterThan(0);
    });

    it('should reset counter when TTL expires', async () => {
      await storage.increment('key3', 1000, 10, 0, 'default');
      expect((await storage.increment('key3', 1000, 10, 0, 'default')).totalHits).toBe(2);

      jest.advanceTimersByTime(2000);

      expect((await storage.increment('key3', 1000, 10, 0, 'default')).totalHits).toBe(1);
    });

    it('should mark as blocked when limit is exceeded even if blockDuration is 0', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.increment('key4', 60000, 4, 0, 'default');
      }

      const result = await storage.increment('key4', 60000, 4, 0, 'default');
      expect(result.isBlocked).toBe(true);
      expect(result.timeToBlockExpire).toBe(0);
    });
  });
});
