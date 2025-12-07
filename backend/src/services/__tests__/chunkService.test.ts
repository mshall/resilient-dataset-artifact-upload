/**
 * Tests for ChunkService
 */

import { ChunkService } from '../chunkService';
import { getRedisClient } from '../../config/redis';
import * as fs from 'fs-extra';

jest.mock('../../config/redis');
jest.mock('fs-extra');

describe('ChunkService', () => {
  let chunkService: ChunkService;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      keys: jest.fn(),
    };

    (getRedisClient as jest.Mock).mockReturnValue(mockRedis);
    (fs.ensureDir as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    (fs.writeFile as jest.Mock) = jest.fn().mockResolvedValue(undefined);
    (fs.readFile as jest.Mock) = jest.fn().mockResolvedValue(Buffer.from('test data'));
    (fs.createWriteStream as jest.Mock) = jest.fn().mockReturnValue({
      write: jest.fn(),
      end: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          setTimeout(callback, 0);
        }
      }),
    });

    chunkService = new ChunkService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('storeChunk', () => {
    it('should store chunk if not exists', async () => {
      mockRedis.get = jest.fn().mockResolvedValue(null);
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      const result = await chunkService.storeChunk('test-upload', 0, Buffer.from('test'));

      expect(result.alreadyExists).toBe(false);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should return alreadyExists if chunk exists', async () => {
      const existingChunk = JSON.stringify({
        uploadId: 'test-upload',
        chunkIndex: 0,
        path: '/tmp/chunk_0',
        size: 100,
        uploadedAt: new Date(),
      });

      mockRedis.get = jest.fn().mockResolvedValue(existingChunk);

      const result = await chunkService.storeChunk('test-upload', 0, Buffer.from('test'));

      expect(result.alreadyExists).toBe(true);
      expect(result.size).toBe(100);
    });
  });

  describe('getChunkIndices', () => {
    it('should return chunk indices', async () => {
      mockRedis.keys = jest.fn().mockResolvedValue([
        'chunk:test-upload:0',
        'chunk:test-upload:1',
        'chunk:test-upload:2',
      ]);

      const indices = await chunkService.getChunkIndices('test-upload');

      expect(indices).toEqual([0, 1, 2]);
    });
  });

  describe('getMissingChunks', () => {
    it('should return missing chunks', async () => {
      mockRedis.keys = jest.fn().mockResolvedValue([
        'chunk:test-upload:0',
        'chunk:test-upload:2',
      ]);

      const missing = await chunkService.getMissingChunks('test-upload', 5);

      expect(missing).toEqual([1, 3, 4]);
    });
  });
});

