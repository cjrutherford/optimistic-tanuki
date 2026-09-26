import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  GetObjectCommand,
  GetObjectLockConfigurationCommand,
  ObjectLockEnabled,
  ObjectLockLegalHoldStatus,
  ObjectLockMode,
  PutBucketVersioningCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

import { Readable } from 'stream';

export type S3ObjectLockLegalHold = 'ON' | 'OFF';

export interface ObjectLockSettings {
  mode: ObjectLockMode;
  retainUntilDate?: Date;
  legalHold?: S3ObjectLockLegalHold;
}

export interface UploadObjectOptions {
  metadata?: Record<string, string>;
  objectLock?: ObjectLockSettings;
}

export interface ObjectLockReadiness {
  bucketName: string;
  versioningEnabled: boolean;
  objectLockEnabled: boolean;
  ready: boolean;
  detail: string;
}

export interface S3ServiceOptions {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  objectLock?: ObjectLockSettings;
  requireVersioningForObjectLock?: boolean;
}

export interface SignedUrlOptions {
  key: string;
  expiresIn?: number; // Expiration time in seconds (default: 3600 = 1 hour)
  contentType?: string;
}

export interface SignedUrlResult {
  url: string;
  key: string;
  expiresAt: Date;
}

export const S3_ENV = {
  endpoint: 'VAULT_STORAGE_S3_ENDPOINT',
  region: 'VAULT_STORAGE_S3_REGION',
  accessKeyId: 'VAULT_STORAGE_S3_ACCESS_KEY_ID',
  secretAccessKey: 'VAULT_STORAGE_S3_SECRET_ACCESS_KEY',
  bucketName: 'VAULT_STORAGE_S3_BUCKET',
  objectLockMode: 'VAULT_STORAGE_OBJECT_LOCK_MODE',
  objectLockRetainDays: 'VAULT_STORAGE_OBJECT_LOCK_RETAIN_DAYS',
  objectLockLegalHold: 'VAULT_STORAGE_OBJECT_LOCK_LEGAL_HOLD',
  requireVersioning: 'VAULT_STORAGE_OBJECT_LOCK_REQUIRE_VERSIONING',
} as const;

export const S3_LOCAL_DEV_ENDPOINT = 'http://localhost:9000';
export const S3_DEFAULT_REGION = 'us-east-1';

export function resolveObjectLockSettings(
  env: NodeJS.ProcessEnv = process.env
): ObjectLockSettings | undefined {
  const mode = env[S3_ENV.objectLockMode]?.trim().toUpperCase();
  if (!mode) {
    return undefined;
  }
  if (
    mode !== ObjectLockMode.COMPLIANCE &&
    mode !== ObjectLockMode.GOVERNANCE
  ) {
    throw new ServiceUnavailableException(
      `${S3_ENV.objectLockMode} must be ${ObjectLockMode.COMPLIANCE} or ${ObjectLockMode.GOVERNANCE}; got "${mode}".`
    );
  }

  const legalHoldRaw = env[S3_ENV.objectLockLegalHold]?.trim().toUpperCase();
  if (legalHoldRaw && legalHoldRaw !== 'ON' && legalHoldRaw !== 'OFF') {
    throw new ServiceUnavailableException(
      `${S3_ENV.objectLockLegalHold} must be ON or OFF; got "${legalHoldRaw}".`
    );
  }

  const retainDaysRaw = env[S3_ENV.objectLockRetainDays]?.trim();
  let retainUntilDate: Date | undefined;
  if (retainDaysRaw) {
    const retainDays = Number.parseInt(retainDaysRaw, 10);
    if (!Number.isInteger(retainDays) || retainDays <= 0) {
      throw new ServiceUnavailableException(
        `${S3_ENV.objectLockRetainDays} must be a positive number of days; got "${retainDaysRaw}".`
      );
    }
    retainUntilDate = new Date(Date.now() + retainDays * 24 * 60 * 60 * 1000);
  }

  return {
    mode: mode as ObjectLockMode,
    ...(retainUntilDate ? { retainUntilDate } : {}),
    ...(legalHoldRaw
      ? { legalHold: legalHoldRaw as S3ObjectLockLegalHold }
      : {}),
  };
}

export function resolveS3ServiceOptions(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<S3ServiceOptions> = {}
): S3ServiceOptions {
  const accessKeyId =
    overrides.accessKeyId?.trim() || env[S3_ENV.accessKeyId]?.trim() || '';
  const secretAccessKey =
    overrides.secretAccessKey?.trim() ||
    env[S3_ENV.secretAccessKey]?.trim() ||
    '';
  const bucketName =
    overrides.bucketName?.trim() || env[S3_ENV.bucketName]?.trim() || '';

  const missing: string[] = [];
  if (!accessKeyId) {
    missing.push(S3_ENV.accessKeyId);
  }
  if (!secretAccessKey) {
    missing.push(S3_ENV.secretAccessKey);
  }
  if (!bucketName) {
    missing.push(S3_ENV.bucketName);
  }
  if (missing.length > 0) {
    throw new ServiceUnavailableException(
      `S3-compatible storage is not configured: set ${missing.join(
        ', '
      )}. Credentials are never defaulted; the bucket may not be written without them.`
    );
  }

  const objectLock = overrides.objectLock ?? resolveObjectLockSettings(env);
  const requireVersioning =
    overrides.requireVersioningForObjectLock ??
    env[S3_ENV.requireVersioning] !== 'false';

  return {
    endpoint:
      overrides.endpoint?.trim() ||
      env[S3_ENV.endpoint]?.trim() ||
      S3_LOCAL_DEV_ENDPOINT,
    region:
      overrides.region?.trim() ||
      env[S3_ENV.region]?.trim() ||
      S3_DEFAULT_REGION,
    accessKeyId,
    secretAccessKey,
    bucketName,
    ...(objectLock ? { objectLock } : {}),
    requireVersioningForObjectLock: requireVersioning,
  };
}

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private objectLockReadiness?: Promise<ObjectLockReadiness>;

  constructor(
    private readonly l: Logger,
    private readonly options: S3ServiceOptions
  ) {
    if (!options.accessKeyId || !options.secretAccessKey) {
      throw new ServiceUnavailableException(
        'S3Service requires explicit accessKeyId and secretAccessKey; refusing to start with default credentials.'
      );
    }
    this.l.log(`S3Service initialized for bucket: ${options.bucketName}`);
    this.bucketName = options.bucketName;
    this.s3Client = new S3Client({
      endpoint: this.options.endpoint,
      region: this.options.region,
      credentials: {
        accessKeyId: this.options.accessKeyId,
        secretAccessKey: this.options.secretAccessKey,
      },
      forcePathStyle: true, // Often needed for S3-compatible storage like MinIO
    });
  }

  /**
   * Generate a pre-signed URL for uploading a file directly to S3
   */
  async generateUploadUrl(options: SignedUrlOptions): Promise<SignedUrlResult> {
    const expiresIn = options.expiresIn || 3600; // Default 1 hour
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    this.l.log(
      `S3Service: Generating upload URL for s3://${this.bucketName}/${options.key} (expires in ${expiresIn}s)`
    );

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: options.key,
      ContentType: options.contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    this.l.log(
      `S3Service: Upload URL generated for ${
        options.key
      }, expires at ${expiresAt.toISOString()}`
    );

    return {
      url,
      key: options.key,
      expiresAt,
    };
  }

  /**
   * Generate a pre-signed URL for downloading a file from S3
   */
  async generateDownloadUrl(
    options: SignedUrlOptions
  ): Promise<SignedUrlResult> {
    const expiresIn = options.expiresIn || 3600; // Default 1 hour
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    this.l.log(
      `S3Service: Generating download URL for s3://${this.bucketName}/${options.key} (expires in ${expiresIn}s)`
    );

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: options.key,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn });

    this.l.log(
      `S3Service: Download URL generated for ${
        options.key
      }, expires at ${expiresAt.toISOString()}`
    );

    return {
      url,
      key: options.key,
      expiresAt,
    };
  }

  async uploadObject(
    key: string,
    body: Buffer,
    contentType?: string,
    options: UploadObjectOptions = {}
  ): Promise<void> {
    const objectLock = this.resolveObjectLock(options.objectLock);
    if (objectLock && this.options.requireVersioningForObjectLock !== false) {
      const readiness = await this.getObjectLockReadiness();
      if (!readiness.ready) {
        throw new ServiceUnavailableException(readiness.detail);
      }
    }

    this.l.log(`S3Service: Uploading object to s3://${this.bucketName}/${key}`);
    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(options.metadata ? { Metadata: options.metadata } : {}),
      ...(objectLock
        ? {
            ObjectLockMode: objectLock.mode,
            ObjectLockRetainUntilDate: objectLock.retainUntilDate,
            ObjectLockLegalHoldStatus: objectLock.legalHold as
              | ObjectLockLegalHoldStatus
              | undefined,
          }
        : {}),
    };
    await this.s3Client.send(new PutObjectCommand(uploadParams));
    this.l.log(
      `S3Service: Object uploaded successfully: s3://${this.bucketName}/${key}${
        objectLock ? ` (object lock ${objectLock.mode})` : ''
      }`
    );
  }

  async getObjectLockReadiness(): Promise<ObjectLockReadiness> {
    if (!this.objectLockReadiness) {
      this.objectLockReadiness = this.probeObjectLockReadiness();
    }
    return this.objectLockReadiness;
  }

  resetObjectLockReadinessCache(): void {
    this.objectLockReadiness = undefined;
  }

  async enableBucketVersioning(): Promise<void> {
    await this.s3Client.send(
      new PutBucketVersioningCommand({
        Bucket: this.bucketName,
        VersioningConfiguration: { Status: 'Enabled' },
      })
    );
    this.resetObjectLockReadinessCache();
    this.l.log(
      `S3Service: Enabled bucket versioning on s3://${this.bucketName}, which is a prerequisite for Object Lock`
    );
  }

  async deleteObject(key: string): Promise<void> {
    this.l.log(
      `S3Service: Deleting object from s3://${this.bucketName}/${key}`
    );
    const deleteParams = {
      Bucket: this.bucketName,
      Key: key,
    };
    try {
      await this.s3Client.send(new DeleteObjectCommand(deleteParams));
      this.l.log(
        `S3Service: Object deleted successfully: s3://${this.bucketName}/${key}`
      );
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        this.l.warn(
          `S3Service: Attempted to delete non-existent object at s3://${this.bucketName}/${key}`
        );
      } else {
        this.l.error(
          `S3Service: Failed to delete object at s3://${this.bucketName}/${key}: ${error.message}`
        );
        throw error;
      }
    }
  }

  async getObject(key: string): Promise<Buffer> {
    this.l.log(`S3Service: Getting object from s3://${this.bucketName}/${key}`);
    const getParams = {
      Bucket: this.bucketName,
      Key: key,
    };
    try {
      const response = await this.s3Client.send(
        new GetObjectCommand(getParams)
      );

      if (!response.Body) {
        throw new Error(
          `No content body received for object at s3://${this.bucketName}/${key}`
        );
      }

      const stream = response.Body as Readable;
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk as Uint8Array);
      }
      const fileContent = Buffer.concat(chunks);

      this.l.log(
        `S3Service: Object content retrieved from s3://${this.bucketName}/${key}`
      );
      return fileContent;
    } catch (error: any) {
      this.l.error(
        `S3Service: Failed to get object from s3://${this.bucketName}/${key}: ${error.message}`
      );
      throw error;
    }
  }

  // Helper to extract key from S3 path
  getKeyFromPath(s3Path: string): string {
    const prefix = `s3://${this.bucketName}/`;
    if (!s3Path.startsWith(prefix)) {
      throw new Error(`Invalid S3 path format: ${s3Path}`);
    }
    return s3Path.replace(prefix, '');
  }

  private resolveObjectLock(
    requested?: ObjectLockSettings
  ): ObjectLockSettings | undefined {
    const objectLock = requested ?? this.options.objectLock;
    if (!objectLock) {
      return undefined;
    }

    if (
      objectLock.mode !== ObjectLockMode.COMPLIANCE &&
      objectLock.mode !== ObjectLockMode.GOVERNANCE
    ) {
      throw new BadRequestException(
        `Unsupported Object Lock mode "${String(objectLock.mode)}".`
      );
    }

    if (
      objectLock.legalHold &&
      objectLock.legalHold !== 'ON' &&
      objectLock.legalHold !== 'OFF'
    ) {
      throw new BadRequestException(
        `Unsupported Object Lock legal hold status "${String(
          objectLock.legalHold
        )}".`
      );
    }

    if (
      objectLock.retainUntilDate &&
      objectLock.retainUntilDate.getTime() <= Date.now()
    ) {
      throw new BadRequestException(
        'Object Lock retain-until date must be in the future.'
      );
    }

    return objectLock;
  }

  private async probeObjectLockReadiness(): Promise<ObjectLockReadiness> {
    const bucket = this.bucketName;
    const versioning = await this.s3Client.send(
      new GetBucketVersioningCommand({ Bucket: bucket })
    );
    const versioningEnabled = versioning.Status === 'Enabled';

    let objectLockEnabled = false;
    try {
      const lockConfiguration = await this.s3Client.send(
        new GetObjectLockConfigurationCommand({ Bucket: bucket })
      );
      objectLockEnabled =
        lockConfiguration.ObjectLockConfiguration?.ObjectLockEnabled ===
        ObjectLockEnabled.Enabled;
    } catch (error: any) {
      this.l.warn(
        `S3Service: Object Lock configuration probe failed for s3://${bucket}: ${error.message}`
      );
      return {
        bucketName: bucket,
        versioningEnabled,
        objectLockEnabled: false,
        ready: false,
        detail: `Object Lock could not be confirmed on s3://${bucket}: ${error.message}. Object Lock is mandatory for vault retention, so the upload is denied.`,
      };
    }

    const ready = versioningEnabled && objectLockEnabled;
    const detail = ready
      ? `s3://${bucket} has versioning and Object Lock enabled; retention headers will be honoured.`
      : `s3://${bucket} is not Object Lock ready (versioning ${
          versioningEnabled
            ? 'enabled'
            : `status "${String(versioning.Status)}"`
        }, Object Lock ${
          objectLockEnabled ? 'enabled' : 'not enabled'
        }). S3 Object Lock requires bucket versioning to be enabled at bucket creation; the upload is denied.`;

    return {
      bucketName: bucket,
      versioningEnabled,
      objectLockEnabled,
      ready,
      detail,
    };
  }
}
