/**
 * Core types and interfaces for the upload system
 */

export type UploadStatus = 'INIT' | 'UPLOADING' | 'ASSEMBLING' | 'COMPLETED' | 'FAILED';

export interface UploadSession {
  uploadId: string;
  userId?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  checksum?: string;
  totalChunks: number;
  status: UploadStatus;
  filePath: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface ChunkMetadata {
  uploadId: string;
  chunkIndex: number;
  path: string;
  size: number;
  uploadedAt: Date;
  checksum?: string;
}

export interface UploadInitRequest {
  fileName: string;
  fileSize: number;
  fileType: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
}

export interface UploadInitResponse {
  uploadId: string;
  chunkSize: number;
  totalChunks: number;
  uploadUrl: string;
  expiresAt: string;
}

export interface ChunkUploadRequest {
  uploadId: string;
  chunkIndex: number;
  totalChunks: number;
  data: string; // base64 encoded
}

export interface ChunkUploadResponse {
  chunkIndex: number;
  status: 'uploaded' | 'already_uploaded';
  progress?: {
    uploaded: number;
    total: number;
    percentage: number;
  };
  message?: string;
}

export interface UploadStatusResponse {
  uploadId: string;
  fileName: string;
  fileSize: number;
  totalChunks: number;
  uploadedChunks: number;
  missingChunks: number[];
  status: UploadStatus;
  createdAt: string;
  expiresAt: string;
}

export interface UploadCompleteRequest {
  uploadId: string;
}

export interface UploadCompleteResponse {
  uploadId: string;
  status: 'completed';
  filePath: string;
  message: string;
  aiPipeline: {
    status: 'initiated';
    estimatedTime: string;
  };
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface AIPipelineResult {
  status: 'initiated' | 'completed' | 'failed';
  estimatedTime?: string;
  jobId?: string;
  errors?: string[];
}

