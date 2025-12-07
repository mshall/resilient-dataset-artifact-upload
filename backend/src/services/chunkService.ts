/**
 * Chunk Service
 * Handles chunk storage, retrieval, and reassembly
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { getRedisClient, getChunkKey, getChunkKeysPattern } from '../config/redis';
import { getS3Client, getChunkPath, getFinalFilePath } from '../config/storage';
import { config } from '../config';
import { ChunkMetadata } from '../types';
import { logger } from '../utils/logger';
import { NotFoundError, AppError } from '../utils/errors';

export class ChunkService {
  private redis = getRedisClient();
  private s3 = getS3Client();
  private useS3: boolean;

  constructor() {
    // Use S3 in production, local FS in development
    this.useS3 = config.server.nodeEnv === 'production' || config.s3.endpoint !== 'http://localhost:9000';
  }

  /**
   * Store a chunk (idempotent)
   */
  async storeChunk(
    uploadId: string,
    chunkIndex: number,
    data: Buffer
  ): Promise<{ alreadyExists: boolean; size: number }> {
    const chunkKey = getChunkKey(uploadId, chunkIndex);
    
    // Check if chunk already exists (idempotency)
    const existingChunk = await this.redis.get(chunkKey);
    if (existingChunk) {
      logger.debug('Chunk already exists', { uploadId, chunkIndex });
      const metadata = JSON.parse(existingChunk) as ChunkMetadata;
      return { alreadyExists: true, size: metadata.size };
    }

    // Store chunk
    const tempDir = path.join(config.upload.tempDir, uploadId);
    const chunkPath = path.join(tempDir, `chunk_${chunkIndex}`);
    
    await fs.ensureDir(tempDir);
    await fs.writeFile(chunkPath, data);

    // Store metadata in Redis
    const metadata: ChunkMetadata = {
      uploadId,
      chunkIndex,
      path: chunkPath,
      size: data.length,
      uploadedAt: new Date(),
    };

    await this.redis.setex(chunkKey, config.upload.expiryHours * 3600, JSON.stringify(metadata));

    // Optionally store in S3 for production
    if (this.useS3) {
      try {
        const s3Path = getChunkPath(uploadId, chunkIndex);
        await this.s3
          .putObject({
            Bucket: config.s3.bucket,
            Key: s3Path,
            Body: data,
            ContentType: 'application/octet-stream',
          })
          .promise();
        
        logger.debug('Chunk stored in S3', { uploadId, chunkIndex, s3Path });
      } catch (error) {
        logger.warn('Failed to store chunk in S3, using local storage', { error });
        // Continue with local storage
      }
    }

    logger.info('Chunk stored successfully', { uploadId, chunkIndex, size: data.length });
    return { alreadyExists: false, size: data.length };
  }

  /**
   * Get chunk metadata
   */
  async getChunkMetadata(uploadId: string, chunkIndex: number): Promise<ChunkMetadata | null> {
    const chunkKey = getChunkKey(uploadId, chunkIndex);
    const data = await this.redis.get(chunkKey);
    
    if (!data) {
      return null;
    }

    return JSON.parse(data) as ChunkMetadata;
  }

  /**
   * Get all chunk indices for an upload
   */
  async getChunkIndices(uploadId: string): Promise<number[]> {
    const pattern = getChunkKeysPattern(uploadId);
    const keys = await this.redis.keys(pattern);
    
    return keys
      .map((key: string) => {
        const match = key.match(/chunk:.*:(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter((index): index is number => index !== null)
      .sort((a: number, b: number) => a - b);
  }

  /**
   * Get missing chunk indices
   */
  async getMissingChunks(uploadId: string, totalChunks: number): Promise<number[]> {
    const uploadedIndices = await this.getChunkIndices(uploadId);
    const uploadedSet = new Set(uploadedIndices);
    
    const missing: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      if (!uploadedSet.has(i)) {
        missing.push(i);
      }
    }

    return missing;
  }

  /**
   * Reassemble chunks into final file
   */
  async reassembleChunks(
    uploadId: string,
    fileName: string,
    totalChunks: number
  ): Promise<string> {
    const chunkIndices = await this.getChunkIndices(uploadId);
    
    if (chunkIndices.length !== totalChunks) {
      const missing = await this.getMissingChunks(uploadId, totalChunks);
      throw new AppError(
        `Cannot reassemble: missing chunks [${missing.join(', ')}]`,
        400,
        'MISSING_CHUNKS',
        { missingChunks: missing }
      );
    }

    const finalDir = path.join(config.upload.finalDir, uploadId);
    await fs.ensureDir(finalDir);
    
    const finalFilePath = path.join(finalDir, fileName);
    const writeStream = fs.createWriteStream(finalFilePath);

    // Read and concatenate chunks in order
    for (let i = 0; i < totalChunks; i++) {
      const metadata = await this.getChunkMetadata(uploadId, i);
      if (!metadata) {
        throw new NotFoundError(`Chunk ${i} not found`);
      }

      // Read from S3 if available, otherwise local FS
      let chunkData: Buffer;
      
      if (this.useS3) {
        try {
          const s3Path = getChunkPath(uploadId, i);
          const s3Object = await this.s3
            .getObject({ Bucket: config.s3.bucket, Key: s3Path })
            .promise();
          
          chunkData = s3Object.Body as Buffer;
        } catch (error) {
          // Fallback to local storage
          chunkData = await fs.readFile(metadata.path);
        }
      } else {
        chunkData = await fs.readFile(metadata.path);
      }

      writeStream.write(chunkData);
    }

    writeStream.end();
    
    // Wait for stream to finish
    await new Promise<void>((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    logger.info('Chunks reassembled successfully', { uploadId, fileName, totalChunks });

    // Upload final file to S3 if enabled
    if (this.useS3) {
      try {
        const s3FinalPath = getFinalFilePath(uploadId, fileName);
        const finalFileData = await fs.readFile(finalFilePath);
        
        await this.s3
          .putObject({
            Bucket: config.s3.bucket,
            Key: s3FinalPath,
            Body: finalFileData,
            ContentType: 'application/octet-stream',
          })
          .promise();
        
        logger.info('Final file uploaded to S3', { uploadId, s3Path: s3FinalPath });
      } catch (error) {
        logger.warn('Failed to upload final file to S3', { error });
      }
    }

    return finalFilePath;
  }

  /**
   * Cleanup chunks for an upload
   */
  async cleanupChunks(uploadId: string): Promise<void> {
    const chunkIndices = await this.getChunkIndices(uploadId);
    const pattern = getChunkKeysPattern(uploadId);
    const keys = await this.redis.keys(pattern);

    // Delete Redis keys
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }

    // Delete local files
    const tempDir = path.join(config.upload.tempDir, uploadId);
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
    }

    // Delete S3 chunks
    if (this.useS3) {
      try {
        const deletePromises = chunkIndices.map((index) => {
          const s3Path = getChunkPath(uploadId, index);
          return this.s3.deleteObject({ Bucket: config.s3.bucket, Key: s3Path }).promise();
        });
        
        await Promise.all(deletePromises);
      } catch (error) {
        logger.warn('Failed to cleanup S3 chunks', { error });
      }
    }

    logger.info('Chunks cleaned up', { uploadId, chunkCount: chunkIndices.length });
  }

  /**
   * Get chunk count for an upload
   */
  async getChunkCount(uploadId: string): Promise<number> {
    const indices = await this.getChunkIndices(uploadId);
    return indices.length;
  }
}

