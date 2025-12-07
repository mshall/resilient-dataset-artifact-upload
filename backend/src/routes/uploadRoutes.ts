/**
 * Upload routes
 */

import { Router } from 'express';
import { z } from 'zod';
import { UploadController } from '../controllers/uploadController';
import { validateBody, validateParams } from '../middleware/validation';
import { optionalAuth } from '../middleware/auth';
import { uploadLimiter, chunkUploadLimiter } from '../middleware/rateLimit';

const router = Router();
const uploadController = new UploadController();

// Validation schemas
const uploadInitSchema = z.object({
  fileName: z.string().min(1).max(500),
  fileSize: z.number().int().positive(),
  fileType: z.string().min(1).max(100),
  checksum: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const chunkUploadSchema = z.object({
  uploadId: z.string().min(1),
  chunkIndex: z.number().int().nonnegative(),
  totalChunks: z.number().int().positive(),
  data: z.string().min(1), // base64 encoded
});

const uploadIdSchema = z.object({
  uploadId: z.string().min(1),
});

const completeUploadSchema = z.object({
  uploadId: z.string().min(1),
});

// Routes
router.post(
  '/init',
  optionalAuth,
  uploadLimiter,
  validateBody(uploadInitSchema),
  uploadController.initializeUpload.bind(uploadController)
);

router.post(
  '/chunk',
  optionalAuth,
  chunkUploadLimiter,
  validateBody(chunkUploadSchema),
  uploadController.uploadChunk.bind(uploadController)
);

router.get(
  '/status/:uploadId',
  optionalAuth,
  validateParams(uploadIdSchema),
  uploadController.getUploadStatus.bind(uploadController)
);

router.post(
  '/complete',
  optionalAuth,
  uploadLimiter,
  validateBody(completeUploadSchema),
  uploadController.completeUpload.bind(uploadController)
);

export default router;

