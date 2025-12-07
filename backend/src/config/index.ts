/**
 * Configuration management
 */

import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '5000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/upload_db',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'upload_db',
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASSWORD || 'password',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },
  s3: {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'uploads',
    region: process.env.S3_REGION || 'us-east-1',
    useSSL: process.env.S3_USE_SSL === 'true',
  },
  upload: {
    chunkSize: parseInt(process.env.CHUNK_SIZE || '1048576', 10), // 1 MB
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10737418240', 10), // 10 GB
    tempDir: process.env.UPLOAD_TEMP_DIR || './uploads/temp',
    finalDir: process.env.UPLOAD_FINAL_DIR || './uploads/final',
    expiryHours: parseInt(process.env.UPLOAD_EXPIRY_HOURS || '24', 10),
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    apiKey: process.env.API_KEY || 'your-api-key-change-in-production',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
} as const;

