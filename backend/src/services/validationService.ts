/**
 * Validation Service
 * Validates file types, checksums, schemas, and content
 */

import * as crypto from 'crypto';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ValidationResult } from '../types';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

export class ValidationService {
  private readonly allowedMimeTypes = [
    'application/json',
    'application/jsonl',
    'text/json',
    'text/csv',
    'text/plain',
    'application/octet-stream',
  ];

  private readonly allowedExtensions = ['.json', '.jsonl', '.csv', '.txt', '.bin', '.dat'];

  /**
   * Validate file type
   */
  validateFileType(fileType: string, fileName: string): ValidationResult {
    const errors: string[] = [];
    
    // Check MIME type
    if (!this.allowedMimeTypes.includes(fileType.toLowerCase())) {
      errors.push(`File type '${fileType}' is not allowed`);
    }

    // Check file extension
    const ext = path.extname(fileName).toLowerCase();
    if (!this.allowedExtensions.includes(ext)) {
      errors.push(`File extension '${ext}' is not allowed`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate file size
   */
  validateFileSize(fileSize: number, maxSize: number): ValidationResult {
    if (fileSize <= 0) {
      return {
        isValid: false,
        errors: ['File size must be greater than 0'],
      };
    }

    if (fileSize > maxSize) {
      return {
        isValid: false,
        errors: [`File size ${fileSize} exceeds maximum allowed size ${maxSize}`],
      };
    }

    return {
      isValid: true,
      errors: [],
    };
  }

  /**
   * Calculate SHA-256 checksum of a file
   */
  async calculateChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(`sha256:${hash.digest('hex')}`));
      stream.on('error', reject);
    });
  }

  /**
   * Validate checksum
   */
  async validateChecksum(filePath: string, expectedChecksum: string): Promise<ValidationResult> {
    try {
      if (!expectedChecksum) {
        return {
          isValid: true,
          errors: [],
          warnings: ['No checksum provided for validation'],
        };
      }

      const actualChecksum = await this.calculateChecksum(filePath);

      if (actualChecksum !== expectedChecksum) {
        return {
          isValid: false,
          errors: [
            `Checksum mismatch. Expected: ${expectedChecksum}, Actual: ${actualChecksum}`,
          ],
        };
      }

      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      logger.error('Failed to validate checksum', { filePath, error });
      return {
        isValid: false,
        errors: [`Failed to validate checksum: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Validate JSON schema (basic validation)
   */
  async validateJsonSchema(filePath: string): Promise<ValidationResult> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();

      if (ext === '.json') {
        try {
          JSON.parse(content);
          return {
            isValid: true,
            errors: [],
          };
        } catch (error) {
          return {
            isValid: false,
            errors: [`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`],
          };
        }
      }

      if (ext === '.jsonl') {
        const lines = content.split('\n').filter((line) => line.trim().length > 0);
        const errors: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          try {
            JSON.parse(lines[i]);
          } catch (error) {
            errors.push(`Line ${i + 1}: Invalid JSON - ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }

        return {
          isValid: errors.length === 0,
          errors,
        };
      }

      // For other file types, just check if file is readable
      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      logger.error('Failed to validate schema', { filePath, error });
      return {
        isValid: false,
        errors: [`Failed to validate schema: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Comprehensive validation
   */
  async validateFile(
    filePath: string,
    fileType: string,
    fileName: string,
    fileSize: number,
    maxSize: number,
    expectedChecksum?: string
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    // Validate file type
    const typeValidation = this.validateFileType(fileType, fileName);
    if (!typeValidation.isValid) {
      errors.push(...typeValidation.errors);
    }

    // Validate file size
    const sizeValidation = this.validateFileSize(fileSize, maxSize);
    if (!sizeValidation.isValid) {
      errors.push(...sizeValidation.errors);
    }

    // Validate checksum if provided
    if (expectedChecksum) {
      const checksumValidation = await this.validateChecksum(filePath, expectedChecksum);
      if (!checksumValidation.isValid) {
        errors.push(...checksumValidation.errors);
      }
    }

    // Validate schema for JSON files
    if (fileName.endsWith('.json') || fileName.endsWith('.jsonl')) {
      const schemaValidation = await this.validateJsonSchema(filePath);
      if (!schemaValidation.isValid) {
        errors.push(...schemaValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Extract metadata from file
   */
  async extractMetadata(filePath: string, fileType: string): Promise<Record<string, unknown>> {
    const metadata: Record<string, unknown> = {
      filePath,
      fileType,
      extractedAt: new Date().toISOString(),
    };

    try {
      const ext = path.extname(filePath).toLowerCase();
      const stats = await fs.stat(filePath);

      metadata.fileSize = stats.size;
      metadata.size = stats.size;

      if (ext === '.json') {
        const content = await fs.readFile(filePath, 'utf-8');
        const parsed = JSON.parse(content);
        
        if (Array.isArray(parsed)) {
          metadata.rowCount = parsed.length;
          metadata.type = 'array';
          if (parsed.length > 0) {
            metadata.sampleKeys = Object.keys(parsed[0]);
          }
        } else if (typeof parsed === 'object') {
          metadata.type = 'object';
          metadata.keys = Object.keys(parsed);
        }
      } else if (ext === '.jsonl') {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim().length > 0);
        metadata.rowCount = lines.length;
        
        if (lines.length > 0) {
          try {
            const firstLine = JSON.parse(lines[0]);
            metadata.sampleKeys = Object.keys(firstLine);
          } catch {
            // Ignore parse errors
          }
        }
      } else if (ext === '.csv') {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim().length > 0);
        metadata.rowCount = lines.length;
        
        if (lines.length > 0) {
          metadata.columns = lines[0].split(',').map((col) => col.trim());
        }
      }

      return metadata;
    } catch (error) {
      logger.warn('Failed to extract metadata', { filePath, error });
      return metadata;
    }
  }
}

