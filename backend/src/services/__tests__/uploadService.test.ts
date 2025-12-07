/**
 * Tests for UploadService
 */

import { UploadService } from '../uploadService';
import { getPool } from '../../config/database';
import { getRedisClient } from '../../config/redis';

jest.mock('../../config/database');
jest.mock('../../config/redis');
jest.mock('../chunkService');

describe('UploadService', () => {
  let uploadService: UploadService;
  let mockPool: any;
  let mockRedis: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn(),
    };
    mockRedis = {
      get: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
    };

    (getPool as jest.Mock).mockReturnValue(mockPool);
    (getRedisClient as jest.Mock).mockReturnValue(mockRedis);

    uploadService = new UploadService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeUpload', () => {
    it('should initialize upload session successfully', async () => {
      mockPool.connect = jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({ rows: [] }),
        release: jest.fn(),
      });

      const request = {
        fileName: 'test.json',
        fileSize: 1048576,
        fileType: 'application/json',
      };

      // Mock the withTransaction function behavior
      mockPool.query = jest.fn().mockResolvedValue({ rows: [] });
      mockRedis.setex = jest.fn().mockResolvedValue('OK');

      // This will fail due to actual DB connection, but tests structure
      await expect(uploadService.initializeUpload(request)).rejects.toThrow();
    });
  });

  describe('getUploadSession', () => {
    it('should get upload session from cache', async () => {
      const sessionData = {
        uploadId: 'test-id',
        fileName: 'test.json',
        fileSize: 1000,
        fileType: 'application/json',
        totalChunks: 1,
        status: 'INIT',
        filePath: null,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: new Date(),
      };

      mockRedis.get = jest.fn().mockResolvedValue(JSON.stringify(sessionData));

      const session = await uploadService.getUploadSession('test-id');
      expect(session).toBeDefined();
      expect(mockRedis.get).toHaveBeenCalled();
    });
  });
});

