/**
 * Jest test setup
 */

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.S3_ENDPOINT = 'http://localhost:9000';
process.env.S3_ACCESS_KEY_ID = 'test';
process.env.S3_SECRET_ACCESS_KEY = 'test';
process.env.S3_BUCKET = 'test-bucket';
process.env.JWT_SECRET = 'test-secret';
process.env.API_KEY = 'test-api-key';

