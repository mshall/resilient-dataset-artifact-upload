/**
 * S3/MinIO storage configuration
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const AWS = require('aws-sdk');
import { config } from './index';
import { logger } from '../utils/logger';

let s3Client: AWS.S3 | null = null;

export function getS3Client(): AWS.S3 {
  if (!s3Client) {
    const s3Config: AWS.S3.ClientConfiguration = {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
      region: config.s3.region,
      s3ForcePathStyle: true, // Required for MinIO
    };

    if (config.s3.endpoint) {
      s3Config.endpoint = config.s3.endpoint;
    }

    if (!config.s3.useSSL) {
      s3Config.sslEnabled = false;
    }

    s3Client = new AWS.S3(s3Config);
    logger.info('S3 client initialized', { endpoint: config.s3.endpoint, bucket: config.s3.bucket });
  }

  return s3Client;
}

/**
 * Initialize S3 bucket if it doesn't exist
 */
export async function initStorage(): Promise<void> {
  const s3 = getS3Client();
  
  try {
    // Check if bucket exists
    try {
      await s3.headBucket({ Bucket: config.s3.bucket }).promise();
      logger.info(`S3 bucket '${config.s3.bucket}' exists`);
    } catch (error) {
      // Bucket doesn't exist, create it
      if ((error as AWS.AWSError).statusCode === 404) {
        await s3.createBucket({ Bucket: config.s3.bucket }).promise();
        logger.info(`S3 bucket '${config.s3.bucket}' created`);
      } else {
        throw error;
      }
    }
  } catch (error) {
    logger.error('Failed to initialize storage', { error });
    // Don't throw in development - allow local FS fallback
    if (config.server.nodeEnv === 'production') {
      throw error;
    }
  }
}

/**
 * Get path for temporary chunk storage
 */
export function getChunkPath(uploadId: string, chunkIndex: number): string {
  return `temp-chunks/${uploadId}/chunk_${chunkIndex}`;
}

/**
 * Get path for final assembled file
 */
export function getFinalFilePath(uploadId: string, fileName: string): string {
  return `datasets/${uploadId}/${uploadId}_${fileName}`;
}

