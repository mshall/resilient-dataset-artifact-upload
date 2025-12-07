/**
 * Redis client configuration and setup
 */

import Redis from 'ioredis';
import { config } from './index';
import { logger } from '../utils/logger';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    redisClient.on('connect', () => {
      logger.info('Redis connection established');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis connection error', { error: err });
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });
  }

  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}

/**
 * Get chunk metadata key
 */
export function getChunkKey(uploadId: string, chunkIndex: number): string {
  return `chunk:${uploadId}:${chunkIndex}`;
}

/**
 * Get upload session key
 */
export function getUploadSessionKey(uploadId: string): string {
  return `upload:${uploadId}`;
}

/**
 * Get all chunk keys for an upload
 */
export function getChunkKeysPattern(uploadId: string): string {
  return `chunk:${uploadId}:*`;
}

