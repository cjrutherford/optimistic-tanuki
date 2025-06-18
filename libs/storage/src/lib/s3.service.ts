import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export interface S3ServiceOptions {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

export const defaultS3ServiceOptions: S3ServiceOptions = {
  endpoint: 'http://localhost:9000', // Default MinIO endpoint
  region: 'us-east-1', // Default region
  accessKeyId: 'minioadmin', // Default MinIO access key  
  secretAccessKey: 'minioadmin', // Default MinIO secret key
  bucketName: 'my-bucket', // Default bucket name
};

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(
    private readonly l: Logger,
    private readonly options: S3ServiceOptions,
  ) {
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

  async uploadObject(key: string, body: Buffer, contentType?: string): Promise<void> {
    this.l.log(`S3Service: Uploading object to s3://${this.bucketName}/${key}`);
    const uploadParams = {
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
    };
    await this.s3Client.send(new PutObjectCommand(uploadParams));
    this.l.log(`S3Service: Object uploaded successfully: s3://${this.bucketName}/${key}`);
  }

  async deleteObject(key: string): Promise<void> {
    this.l.log(`S3Service: Deleting object from s3://${this.bucketName}/${key}`);
    const deleteParams = {
      Bucket: this.bucketName,
      Key: key,
    };
    try {
        await this.s3Client.send(new DeleteObjectCommand(deleteParams));
        this.l.log(`S3Service: Object deleted successfully: s3://${this.bucketName}/${key}`);
    } catch (error) {
        if (error.name === 'NoSuchKey') {
             this.l.warn(`S3Service: Attempted to delete non-existent object at s3://${this.bucketName}/${key}`);
        } else {
            this.l.error(`S3Service: Failed to delete object at s3://${this.bucketName}/${key}: ${error.message}`);
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
        const response = await this.s3Client.send(new GetObjectCommand(getParams));

        if (!response.Body) {
            throw new Error(`No content body received for object at s3://${this.bucketName}/${key}`);
        }

        const stream = response.Body as Readable;
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(chunk as Buffer);
        }
        const fileContent = Buffer.concat(chunks);

        this.l.log(`S3Service: Object content retrieved from s3://${this.bucketName}/${key}`);
        return fileContent;

    } catch (error) {
        this.l.error(`S3Service: Failed to get object from s3://${this.bucketName}/${key}: ${error.message}`);
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
}