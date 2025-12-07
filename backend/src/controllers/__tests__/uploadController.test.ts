/**
 * Tests for UploadController
 */

import { Request, Response, NextFunction } from 'express';
import { UploadController } from '../uploadController';
import { UploadService } from '../../services/uploadService';
import { ChunkService } from '../../services/chunkService';

jest.mock('../../services/uploadService');
jest.mock('../../services/chunkService');

describe('UploadController', () => {
  let controller: UploadController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    controller = new UploadController();
    mockRequest = {
      body: {},
      params: {},
      userId: 'test-user',
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('initializeUpload', () => {
    it('should initialize upload successfully', async () => {
      mockRequest.body = {
        fileName: 'test.json',
        fileSize: 1048576,
        fileType: 'application/json',
      };

      const mockUploadService = controller['uploadService'] as jest.Mocked<UploadService>;
      mockUploadService.initializeUpload = jest.fn().mockResolvedValue({
        uploadId: 'test-id',
        chunkSize: 1048576,
        totalChunks: 1,
        uploadUrl: '/api/upload/chunk',
        expiresAt: new Date().toISOString(),
      });

      await controller.initializeUpload(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });

  describe('uploadChunk', () => {
    it('should upload chunk successfully', async () => {
      mockRequest.body = {
        uploadId: 'test-id',
        chunkIndex: 0,
        totalChunks: 1,
        data: Buffer.from('test').toString('base64'),
      };

      const mockUploadService = controller['uploadService'] as jest.Mocked<UploadService>;
      mockUploadService.getUploadSession = jest.fn().mockResolvedValue({
        uploadId: 'test-id',
        fileName: 'test.json',
        fileSize: 1048576,
        fileType: 'application/json',
        totalChunks: 1,
        status: 'INIT',
      } as any);

      const mockChunkService = controller['chunkService'] as jest.Mocked<ChunkService>;
      mockChunkService.storeChunk = jest.fn().mockResolvedValue({
        alreadyExists: false,
        size: 100,
      });
      mockChunkService.getChunkCount = jest.fn().mockResolvedValue(1);

      await controller.uploadChunk(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalled();
    });
  });
});

