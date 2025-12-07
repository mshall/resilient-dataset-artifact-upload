/**
 * Upload Service
 * Manages upload session lifecycle and state
 */

import { v4 as uuidv4 } from 'uuid';
import { Pool } from 'pg';
import { getPool, withTransaction } from '../config/database';
import { getRedisClient, getUploadSessionKey } from '../config/redis';
import { config } from '../config';
import {
  UploadSession,
  UploadStatus,
  UploadInitRequest,
  UploadInitResponse,
  UploadStatusResponse,
} from '../types';
import { logger } from '../utils/logger';
import { NotFoundError, ValidationError, AppError } from '../utils/errors';
import { ChunkService } from './chunkService';

export class UploadService {
  private pool: Pool;
  private redis = getRedisClient();
  private chunkService: ChunkService;

  constructor() {
    this.pool = getPool();
    this.chunkService = new ChunkService();
  }

  /**
   * Initialize a new upload session
   */
  async initializeUpload(request: UploadInitRequest, userId?: string): Promise<UploadInitResponse> {
    // Validate file size
    if (request.fileSize > config.upload.maxFileSize) {
      throw new ValidationError(
        `File size ${request.fileSize} exceeds maximum allowed size ${config.upload.maxFileSize}`
      );
    }

    // Calculate total chunks
    const totalChunks = Math.ceil(request.fileSize / config.upload.chunkSize);
    
    if (totalChunks === 0) {
      throw new ValidationError('File size must be greater than 0');
    }

    const uploadId = `upl_${uuidv4().replace(/-/g, '')}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.upload.expiryHours);

    const session: UploadSession = {
      uploadId,
      userId,
      fileName: request.fileName,
      fileSize: request.fileSize,
      fileType: request.fileType,
      checksum: request.checksum,
      totalChunks,
      status: 'INIT',
      filePath: null,
      metadata: request.metadata || {},
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt,
    };

    // Store in database
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO uploads (
          upload_id, user_id, file_name, file_size, file_type, checksum,
          total_chunks, status, file_path, metadata, created_at, updated_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          session.uploadId,
          session.userId || null,
          session.fileName,
          session.fileSize,
          session.fileType,
          session.checksum || null,
          session.totalChunks,
          session.status,
          session.filePath,
          JSON.stringify(session.metadata),
          session.createdAt,
          session.updatedAt,
          session.expiresAt,
        ]
      );
    });

    // Cache in Redis for fast access
    const sessionKey = getUploadSessionKey(uploadId);
    await this.redis.setex(
      sessionKey,
      config.upload.expiryHours * 3600,
      JSON.stringify(session)
    );

    logger.info('Upload session initialized', { uploadId, fileName: request.fileName, totalChunks });

    return {
      uploadId,
      chunkSize: config.upload.chunkSize,
      totalChunks,
      uploadUrl: '/api/upload/chunk',
      expiresAt: expiresAt.toISOString(),
    };
  }

  /**
   * Get upload session
   */
  async getUploadSession(uploadId: string): Promise<UploadSession> {
    // Try Redis cache first
    const sessionKey = getUploadSessionKey(uploadId);
    const cached = await this.redis.get(sessionKey);
    
    if (cached) {
      return JSON.parse(cached) as UploadSession;
    }

    // Fallback to database
    const result = await this.pool.query(
      'SELECT * FROM uploads WHERE upload_id = $1',
      [uploadId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError(`Upload session ${uploadId} not found`);
    }

    const row = result.rows[0];
    const session: UploadSession = {
      uploadId: row.upload_id,
      userId: row.user_id,
      fileName: row.file_name,
      fileSize: parseInt(row.file_size, 10),
      fileType: row.file_type,
      checksum: row.checksum,
      totalChunks: row.total_chunks,
      status: row.status as UploadStatus,
      filePath: row.file_path,
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      expiresAt: new Date(row.expires_at),
    };

    // Cache for next time
    await this.redis.setex(sessionKey, config.upload.expiryHours * 3600, JSON.stringify(session));

    return session;
  }

  /**
   * Get upload status with missing chunks
   */
  async getUploadStatus(uploadId: string): Promise<UploadStatusResponse> {
    const session = await this.getUploadSession(uploadId);
    const uploadedChunks = await this.chunkService.getChunkCount(uploadId);
    const missingChunks = await this.chunkService.getMissingChunks(uploadId, session.totalChunks);

    return {
      uploadId: session.uploadId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      totalChunks: session.totalChunks,
      uploadedChunks,
      missingChunks,
      status: session.status,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    };
  }

  /**
   * Update upload status
   */
  async updateUploadStatus(
    uploadId: string,
    status: UploadStatus,
    filePath?: string
  ): Promise<void> {
    await withTransaction(async (client) => {
      const updateFields: string[] = ['status = $1', 'updated_at = $2'];
      const values: unknown[] = [status, new Date()];

      if (filePath) {
        updateFields.push('file_path = $3');
        values.push(filePath);
      }

      await client.query(
        `UPDATE uploads SET ${updateFields.join(', ')} WHERE upload_id = $${updateFields.length + 1}`,
        [...values, uploadId]
      );
    });

    // Invalidate cache
    const sessionKey = getUploadSessionKey(uploadId);
    await this.redis.del(sessionKey);

    logger.info('Upload status updated', { uploadId, status, filePath });
  }

  /**
   * Mark upload as completed
   */
  async completeUpload(uploadId: string, filePath: string): Promise<void> {
    await this.updateUploadStatus(uploadId, 'COMPLETED', filePath);
  }

  /**
   * Mark upload as failed
   */
  async failUpload(uploadId: string): Promise<void> {
    await this.updateUploadStatus(uploadId, 'FAILED');
  }

  /**
   * Check if upload has expired
   */
  async isUploadExpired(uploadId: string): Promise<boolean> {
    const session = await this.getUploadSession(uploadId);
    return new Date() > session.expiresAt;
  }

  /**
   * Cleanup expired uploads
   */
  async cleanupExpiredUploads(): Promise<number> {
    const result = await this.pool.query(
      `SELECT upload_id FROM uploads 
       WHERE expires_at < NOW() AND status NOT IN ('COMPLETED', 'FAILED')`
    );

    let cleaned = 0;
    for (const row of result.rows) {
      try {
        await this.chunkService.cleanupChunks(row.upload_id);
        await this.updateUploadStatus(row.upload_id, 'FAILED');
        cleaned++;
      } catch (error) {
        logger.error('Failed to cleanup expired upload', {
          uploadId: row.upload_id,
          error,
        });
      }
    }

    logger.info('Expired uploads cleaned up', { count: cleaned });
    return cleaned;
  }
}

