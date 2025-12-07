/**
 * Upload Controller
 * Handles HTTP requests for upload endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { UploadService } from '../services/uploadService';
import { ChunkService } from '../services/chunkService';
import { ValidationService } from '../services/validationService';
import { AIIntegrationService } from '../services/aiIntegrationService';
import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class UploadController {
  private uploadService: UploadService;
  private chunkService: ChunkService;
  private validationService: ValidationService;
  private aiIntegrationService: AIIntegrationService;

  constructor() {
    this.uploadService = new UploadService();
    this.chunkService = new ChunkService();
    this.validationService = new ValidationService();
    this.aiIntegrationService = new AIIntegrationService();
  }

  /**
   * POST /api/upload/init
   * Initialize a new upload session
   */
  async initializeUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { fileName, fileSize, fileType, checksum, metadata } = req.body;
      const userId = req.userId;

      // Validate file type
      const typeValidation = this.validationService.validateFileType(fileType, fileName);
      if (!typeValidation.isValid) {
        throw new AppError(typeValidation.errors.join(', '), 400, 'VALIDATION_ERROR');
      }

      // Validate file size
      const sizeValidation = this.validationService.validateFileSize(
        fileSize,
        config.upload.maxFileSize
      );
      if (!sizeValidation.isValid) {
        throw new AppError(sizeValidation.errors.join(', '), 400, 'VALIDATION_ERROR');
      }

      const response = await this.uploadService.initializeUpload(
        {
          fileName,
          fileSize,
          fileType,
          checksum,
          metadata,
        },
        userId
      );

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/upload/chunk
   * Upload a single chunk (idempotent)
   */
  async uploadChunk(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uploadId, chunkIndex, totalChunks, data } = req.body;

      // Verify upload session exists
      const session = await this.uploadService.getUploadSession(uploadId);

      // Validate chunk index
      if (chunkIndex < 0 || chunkIndex >= session.totalChunks) {
        throw new AppError(
          `Invalid chunk index ${chunkIndex}. Must be between 0 and ${session.totalChunks - 1}`,
          400,
          'VALIDATION_ERROR'
        );
      }

      // Decode base64 data
      let chunkData: Buffer;
      try {
        chunkData = Buffer.from(data, 'base64');
      } catch (error) {
        throw new AppError('Invalid base64 data', 400, 'VALIDATION_ERROR');
      }

      // Store chunk (idempotent)
      const result = await this.chunkService.storeChunk(uploadId, chunkIndex, chunkData);

      // Update session status if needed
      if (session.status === 'INIT') {
        await this.uploadService.updateUploadStatus(uploadId, 'UPLOADING');
      }

      // Get current progress
      const uploadedChunks = await this.chunkService.getChunkCount(uploadId);

      if (result.alreadyExists) {
        res.status(200).json({
          chunkIndex,
          status: 'already_uploaded',
          message: 'Chunk already uploaded successfully',
          progress: {
            uploaded: uploadedChunks,
            total: session.totalChunks,
            percentage: (uploadedChunks / session.totalChunks) * 100,
          },
        });
      } else {
        res.status(200).json({
          chunkIndex,
          status: 'uploaded',
          progress: {
            uploaded: uploadedChunks,
            total: session.totalChunks,
            percentage: (uploadedChunks / session.totalChunks) * 100,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/upload/status/:uploadId
   * Get upload status and missing chunks
   */
  async getUploadStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uploadId } = req.params;
      const status = await this.uploadService.getUploadStatus(uploadId);
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/upload/complete
   * Complete upload, reassemble chunks, and trigger AI pipeline
   */
  async completeUpload(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { uploadId } = req.body;
      const session = await this.uploadService.getUploadSession(uploadId);

      // Update status to ASSEMBLING
      await this.uploadService.updateUploadStatus(uploadId, 'ASSEMBLING');

      // Reassemble chunks
      let finalFilePath: string;
      try {
        finalFilePath = await this.chunkService.reassembleChunks(
          uploadId,
          session.fileName,
          session.totalChunks
        );
      } catch (error) {
        await this.uploadService.failUpload(uploadId);
        throw error;
      }

      // Validate file
      const validation = await this.validationService.validateFile(
        finalFilePath,
        session.fileType,
        session.fileName,
        session.fileSize,
        config.upload.maxFileSize,
        session.checksum
      );

      if (!validation.isValid) {
        await this.uploadService.failUpload(uploadId);
        throw new AppError(
          `Validation failed: ${validation.errors.join(', ')}`,
          400,
          'VALIDATION_ERROR'
        );
      }

      // Extract metadata
      const extractedMetadata = await this.validationService.extractMetadata(
        finalFilePath,
        session.fileType
      );

      // Update session with final file path
      await this.uploadService.completeUpload(uploadId, finalFilePath);

      // Trigger AI pipeline asynchronously
      const aiPipelineResult = await this.aiIntegrationService.processUpload(
        finalFilePath,
        { ...session.metadata, ...extractedMetadata }
      );

      // Cleanup temporary chunks (async, don't wait)
      this.chunkService.cleanupChunks(uploadId).catch((error) => {
        logger.error('Failed to cleanup chunks', { uploadId, error });
      });

      res.status(200).json({
        uploadId,
        status: 'completed',
        filePath: finalFilePath,
        message: 'Upload completed successfully, AI processing initiated',
        aiPipeline: {
          status: aiPipelineResult.status,
          estimatedTime: aiPipelineResult.estimatedTime || '5-10 minutes',
          jobId: aiPipelineResult.jobId,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

