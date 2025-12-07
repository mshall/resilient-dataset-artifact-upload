/**
 * Integration tests for upload endpoints
 * Note: These tests require running Redis, PostgreSQL, and S3/MinIO
 * Run with: npm run test:integration
 */

import request from 'supertest';
import { createApp } from '../../app';

describe('Upload API Integration Tests', () => {
  let app: any;

  beforeAll(async () => {
    app = await createApp();
  });

  describe('POST /api/upload/init', () => {
    it('should initialize upload session', async () => {
      const response = await request(app)
        .post('/api/upload/init')
        .send({
          fileName: 'test.json',
          fileSize: 1048576,
          fileType: 'application/json',
        })
        .expect(201);

      expect(response.body).toHaveProperty('uploadId');
      expect(response.body).toHaveProperty('totalChunks');
      expect(response.body).toHaveProperty('chunkSize');
    });

    it('should reject invalid file size', async () => {
      await request(app)
        .post('/api/upload/init')
        .send({
          fileName: 'test.json',
          fileSize: -1,
          fileType: 'application/json',
        })
        .expect(400);
    });
  });

  describe('GET /api/upload/status/:uploadId', () => {
    it('should return 404 for non-existent upload', async () => {
      await request(app)
        .get('/api/upload/status/non-existent-id')
        .expect(404);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
    });
  });
});

