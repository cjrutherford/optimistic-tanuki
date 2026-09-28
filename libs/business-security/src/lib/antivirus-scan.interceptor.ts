import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as net from 'net';
import { Observable } from 'rxjs';

export const EICAR_TEST_STRING =
  'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*';
export const MAX_SCAN_BYTES = 25 * 1024 * 1024;
export const MAX_RESPONSE_BYTES = 64 * 1024;
export const DEFAULT_ABSOLUTE_DEADLINE_MS = 30000;

export type AntivirusScanStatus = 'clean' | 'infected';

export interface AntivirusScanResult {
  clean: boolean;
  status: AntivirusScanStatus;
  engine: string;
  signature?: string;
}

export interface AntivirusScanOptions {
  host?: string;
  port?: number;
  socketTimeoutMs?: number;
  absoluteDeadlineMs?: number;
  maxScanBytes?: number;
  maxResponseBytes?: number;
  socketFactory?: () => net.Socket;
}

class ClamAVResponseLimitError extends Error {}
class ClamAVDeadlineError extends Error {}

@Injectable()
export class AntivirusScanInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AntivirusScanInterceptor.name);
  private readonly clamavHost: string;
  private readonly clamavPort: number;
  private readonly socketTimeoutMs: number;
  private readonly absoluteDeadlineMs: number;
  private readonly maxScanBytes: number;
  private readonly maxResponseBytes: number;
  private readonly socketFactory: () => net.Socket;

  constructor(@Optional() options: AntivirusScanOptions = {}) {
    const environmentPort = Number.parseInt(
      process.env['CLAMAV_PORT'] || '3310',
      10
    );
    this.clamavHost = options.host || process.env['CLAMAV_HOST'] || '127.0.0.1';
    this.clamavPort =
      options.port ||
      (Number.isInteger(environmentPort) ? environmentPort : 3310);
    this.socketTimeoutMs = options.socketTimeoutMs || 3000;
    this.absoluteDeadlineMs =
      options.absoluteDeadlineMs || DEFAULT_ABSOLUTE_DEADLINE_MS;
    this.maxScanBytes = options.maxScanBytes || MAX_SCAN_BYTES;
    this.maxResponseBytes = options.maxResponseBytes || MAX_RESPONSE_BYTES;
    this.socketFactory = options.socketFactory || (() => new net.Socket());
  }

  async intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest();
    if (!req) {
      throw new BadRequestException('File upload is required');
    }

    let bufferToScan: Buffer | null = null;
    const fileName = 'upload.bin';
    const hasMultipartFile = req.file !== undefined && req.file !== null;
    const hasBase64File = req.body?.fileBase64 !== undefined;

    if (hasMultipartFile && hasBase64File) {
      throw new BadRequestException(
        'Provide either a multipart file or fileBase64, not both.'
      );
    }

    if (hasMultipartFile) {
      if (!Buffer.isBuffer(req.file.buffer)) {
        throw new BadRequestException('Multipart file upload is invalid.');
      }
      bufferToScan = req.file.buffer;
    } else if (hasBase64File) {
      if (typeof req.body.fileBase64 !== 'string') {
        throw new BadRequestException('fileBase64 must be a base64 string.');
      }
      bufferToScan = this.decodeBase64Upload(req.body.fileBase64);
    }

    if (!bufferToScan) {
      throw new BadRequestException('File upload is required');
    }

    const scanResult = await this.scanBuffer(bufferToScan, fileName);
    if (scanResult.status === 'infected') {
      this.logger.warn('Malware detected in upload; file upload rejected.');
      throw new BadRequestException(
        'Malware detected by ClamAV scanner: file upload rejected.'
      );
    }

    req.antivirusStatus = scanResult.status;
    req.antivirusEngine = scanResult.engine;
    return next.handle();
  }

  private decodeBase64Upload(value: string): Buffer {
    if (value.length === 0) {
      throw new BadRequestException('File upload is required');
    }
    const maxEncodedLength = Math.ceil(this.maxScanBytes / 3) * 4;
    if (value.length > maxEncodedLength) {
      throw new PayloadTooLargeException(
        'Upload exceeds the 25 MiB scan limit.'
      );
    }
    if (
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        value
      )
    ) {
      throw new BadRequestException('fileBase64 must be valid base64.');
    }
    const decoded = Buffer.from(value, 'base64');
    if (decoded.toString('base64') !== value) {
      throw new BadRequestException('fileBase64 must be valid base64.');
    }
    if (decoded.length > this.maxScanBytes) {
      throw new PayloadTooLargeException(
        'Upload exceeds the 25 MiB scan limit.'
      );
    }
    return decoded;
  }

  async scanBuffer(
    buffer: Buffer,
    _fileName = 'upload.bin'
  ): Promise<AntivirusScanResult> {
    if (buffer.length > this.maxScanBytes) {
      throw new PayloadTooLargeException(
        'Upload exceeds the 25 MiB scan limit.'
      );
    }

    try {
      return await this.streamToClamav(buffer);
    } catch (error) {
      if (error instanceof ClamAVResponseLimitError) {
        throw new ServiceUnavailableException(
          'ClamAV response exceeded the 64 KiB limit.'
        );
      }
      if (error instanceof ClamAVDeadlineError) {
        throw new ServiceUnavailableException('ClamAV scan deadline exceeded.');
      }
      throw new ServiceUnavailableException('ClamAV service is unavailable');
    }
  }

  private streamToClamav(buffer: Buffer): Promise<AntivirusScanResult> {
    return new Promise((resolve, reject) => {
      const socket = this.socketFactory();
      let response = '';
      let responseBytes = 0;
      let settled = false;
      let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

      const finish = (action: () => void): void => {
        if (settled) {
          return;
        }
        settled = true;
        if (deadlineTimer) {
          clearTimeout(deadlineTimer);
        }
        socket.destroy();
        action();
      };

      socket.setTimeout(this.socketTimeoutMs);
      deadlineTimer = setTimeout(() => {
        finish(() => reject(new ClamAVDeadlineError()));
      }, this.absoluteDeadlineMs);
      socket.on('data', (data) => {
        if (settled) {
          return;
        }
        responseBytes += data.length;
        if (responseBytes > this.maxResponseBytes) {
          finish(() => reject(new ClamAVResponseLimitError()));
          return;
        }
        response += data.toString('utf8');
      });
      socket.on('timeout', () => {
        finish(() => reject(new Error('ClamAV socket timeout')));
      });
      socket.on('error', (error) => {
        finish(() => reject(error));
      });
      socket.on('end', () => {
        try {
          const result = this.parseResponse(response);
          finish(() => resolve(result));
        } catch (error) {
          finish(() => reject(error));
        }
      });

      try {
        socket.connect(this.clamavPort, this.clamavHost, () => {
          this.writePayload(socket, buffer).catch((error) => {
            finish(() => reject(error));
          });
        });
      } catch (error) {
        finish(() => reject(error));
      }
    });
  }

  private async writePayload(
    socket: net.Socket,
    buffer: Buffer
  ): Promise<void> {
    await this.writeWithBackpressure(socket, Buffer.from('zINSTREAM\0'));

    const chunkSize = 2048;
    for (let index = 0; index < buffer.length; index += chunkSize) {
      const chunk = buffer.subarray(index, index + chunkSize);
      const lengthBuffer = Buffer.alloc(4);
      lengthBuffer.writeUInt32BE(chunk.length, 0);
      await this.writeWithBackpressure(socket, lengthBuffer);
      await this.writeWithBackpressure(socket, chunk);
    }

    const zeroLength = Buffer.alloc(4);
    zeroLength.writeUInt32BE(0, 0);
    await this.writeWithBackpressure(socket, zeroLength);
  }

  private writeWithBackpressure(
    socket: net.Socket,
    data: string | Buffer
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const onDrain = (): void => {
        socket.removeListener('error', onError);
        resolve();
      };
      const onError = (error: Error): void => {
        socket.removeListener('drain', onDrain);
        reject(error);
      };

      socket.once('error', onError);
      try {
        if (socket.write(data)) {
          socket.removeListener('error', onError);
          resolve();
        } else {
          socket.once('drain', onDrain);
        }
      } catch (error) {
        socket.removeListener('error', onError);
        socket.removeListener('drain', onDrain);
        reject(error);
      }
    });
  }

  private parseResponse(rawResponse: string): AntivirusScanResult {
    const response = rawResponse
      .replace(/^[\0\r\n]+/, '')
      .replace(/[\0\r\n]+$/, '');

    if (response === 'stream: OK') {
      return {
        clean: true,
        status: 'clean',
        engine: 'ClamAV-Daemon',
      };
    }

    const match = /^stream: ([^\0\r\n]+) FOUND$/.exec(response);
    if (!match || !match[1].trim()) {
      throw new Error('Invalid ClamAV response');
    }

    return {
      clean: false,
      status: 'infected',
      engine: 'ClamAV-Daemon',
      signature: match[1].trim(),
    };
  }
}
