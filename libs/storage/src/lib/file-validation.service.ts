import { Injectable, Logger } from '@nestjs/common';

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedFilename?: string;
}

export interface FileTypeConfig {
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  maxSizeBytes?: number;
}

@Injectable()
export class FileValidationService {
  private readonly logger = new Logger(FileValidationService.name);

  // Default file type configurations
  private readonly fileTypeConfigs: Record<string, FileTypeConfig> = {
    image: {
      allowedMimeTypes: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
      maxSizeBytes: 10 * 1024 * 1024, // 10MB
    },
    document: {
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/markdown',
      ],
      allowedExtensions: [
        '.pdf',
        '.doc',
        '.docx',
        '.xls',
        '.xlsx',
        '.txt',
        '.md',
      ],
      maxSizeBytes: 25 * 1024 * 1024, // 25MB
    },
    video: {
      allowedMimeTypes: [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/webm',
        'video/x-matroska',
        'video/x-msvideo',
        'video/x-ms-wmv',
        'video/x-flv',
        'video/mp2t',
        'application/vnd.apple.mpegurl',
        'application/x-mpegurl',
        'video/x-ms-asf',
      ],
      allowedExtensions: [
        '.mp4',
        '.mpeg',
        '.mpg',
        '.mov',
        '.webm',
        '.mkv',
        '.avi',
        '.wmv',
        '.flv',
        '.m4v',
        '.ts',
        '.m3u8',
      ],
    },
    audio: {
      allowedMimeTypes: [
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/webm',
        'audio/ogg',
      ],
      allowedExtensions: ['.mp3', '.wav', '.webm', '.ogg'],
      maxSizeBytes: 20 * 1024 * 1024, // 20MB
    },
  };

  /**
   * Validate a file based on type, size, and mime type
   */
  validateFile(
    filename: string,
    mimeType: string,
    sizeBytes: number,
    fileType: 'image' | 'document' | 'video' | 'audio',
  ): FileValidationResult {
    const errors: string[] = [];
    const config = this.fileTypeConfigs[fileType];

    if (!config) {
      errors.push(`Unknown file type: ${fileType}`);
      return { isValid: false, errors };
    }

    // Validate file extension
    const extension = this.getFileExtension(filename);
    if (!config.allowedExtensions.includes(extension.toLowerCase())) {
      errors.push(
        `File extension ${extension} not allowed. Allowed extensions: ${config.allowedExtensions.join(
          ', ',
        )}`,
      );
    }

    // Validate MIME type
    if (!config.allowedMimeTypes.includes(mimeType.toLowerCase())) {
      errors.push(
        `MIME type ${mimeType} not allowed. Allowed types: ${config.allowedMimeTypes.join(
          ', ',
        )}`,
      );
    }

    // Validate file size
    if (config.maxSizeBytes !== undefined && sizeBytes > config.maxSizeBytes) {
      const maxSizeMB = (config.maxSizeBytes / (1024 * 1024)).toFixed(2);
      const actualSizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      errors.push(
        `File size ${actualSizeMB}MB exceeds maximum allowed size of ${maxSizeMB}MB`,
      );
    }

    // Validate filename for malicious patterns
    const filenameValidation = this.validateFilename(filename);
    if (!filenameValidation.isValid) {
      errors.push(...filenameValidation.errors);
    }

    if (errors.length > 0) {
      this.logger.warn(
        `File validation failed for ${filename}: ${errors.join(', ')}`,
      );
      return { isValid: false, errors };
    }

    return {
      isValid: true,
      errors: [],
      sanitizedFilename: filenameValidation.sanitizedFilename,
    };
  }

  /**
   * Sanitize and validate filename
   */
  private validateFilename(filename: string): FileValidationResult {
    const errors: string[] = [];

    // Check for null bytes (potential security issue)
    if (filename.includes('\0')) {
      errors.push('Filename contains null bytes');
    }

    // Check for path traversal attempts
    if (
      filename.includes('..') ||
      filename.includes('/') ||
      filename.includes('\\')
    ) {
      errors.push('Filename contains path traversal characters');
    }

    // Check for overly long filenames
    if (filename.length > 255) {
      errors.push('Filename exceeds maximum length of 255 characters');
    }

    // Sanitize filename: remove special characters except dots, dashes, underscores
    const sanitized = filename
      .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .replace(/^\.+/, '') // Remove leading dots
      .toLowerCase();

    if (sanitized !== filename) {
      this.logger.log(`Filename sanitized: ${filename} -> ${sanitized}`);
    }

    if (errors.length > 0) {
      return { isValid: false, errors };
    }

    return { isValid: true, errors: [], sanitizedFilename: sanitized };
  }

  /**
   * Get file extension from filename
   */
  private getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
      return '';
    }
    return filename.substring(lastDotIndex);
  }

  /**
   * Get allowed MIME types for a file type
   */
  getAllowedMimeTypes(
    fileType: 'image' | 'document' | 'video' | 'audio',
  ): string[] {
    return this.fileTypeConfigs[fileType]?.allowedMimeTypes || [];
  }

  /**
   * Get max file size for a file type
   */
  getMaxFileSize(fileType: 'image' | 'document' | 'video' | 'audio'): number {
    return this.fileTypeConfigs[fileType]?.maxSizeBytes || 0;
  }
}
