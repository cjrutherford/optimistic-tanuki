import {
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as net from 'net';

export const MAX_SCAN_BYTES = 25 * 1024 * 1024;
export const MAX_RESPONSE_BYTES = 64 * 1024;
export const DEFAULT_ABSOLUTE_DEADLINE_MS = 30000;
export const DEFAULT_SOCKET_TIMEOUT_MS = 3000;
export const DEFAULT_CHUNK_BYTES = 2048;
export const CLAMAV_ENGINE = 'ClamAV-Daemon';

export const CLAMAV_ENV = {
  host: 'CLAMAV_HOST',
  port: 'CLAMAV_PORT',
  socketTimeoutMs: 'CLAMAV_SOCKET_TIMEOUT_MS',
  absoluteDeadlineMs: 'CLAMAV_SCAN_DEADLINE_MS',
  maxScanBytes: 'VAULT_STORAGE_CLAMAV_MAX_SCAN_BYTES',
} as const;

export interface VirusScanResult {
  isClean: boolean;
  scanDate: Date;
  threats?: string[];
  scanner: string;
}

export interface VirusScanServiceOptions {
  host?: string;
  port?: number;
  socketTimeoutMs?: number;
  absoluteDeadlineMs?: number;
  maxScanBytes?: number;
  maxResponseBytes?: number;
  chunkSize?: number;
  socketFactory?: () => net.Socket;
  env?: NodeJS.ProcessEnv;
}

class ClamAVResponseLimitError extends Error {}
class ClamAVDeadlineError extends Error {}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  const code = (error as { code?: string } | null)?.code;
  return code ? `${String(error)} (${code})` : String(error);
}

@Injectable()
export class VirusScanService {
  private readonly logger = new Logger(VirusScanService.name);
  private readonly env: NodeJS.ProcessEnv;
  private readonly host?: string;
  private readonly port: number;
  private readonly socketTimeoutMs: number;
  private readonly absoluteDeadlineMs: number;
  private readonly maxScanBytes: number;
  private readonly maxResponseBytes: number;
  private readonly chunkSize: number;
  private readonly socketFactory: () => net.Socket;

  constructor(options: VirusScanServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.host = options.host ?? this.env[CLAMAV_ENV.host]?.trim();
    this.port =
      options.port ?? this.readPositiveInt(this.env[CLAMAV_ENV.port], 3310);
    this.socketTimeoutMs =
      options.socketTimeoutMs ??
      this.readPositiveInt(this.env[CLAMAV_ENV.socketTimeoutMs], 3000);
    this.absoluteDeadlineMs =
      options.absoluteDeadlineMs ??
      this.readPositiveInt(this.env[CLAMAV_ENV.absoluteDeadlineMs], 30000);
    this.maxScanBytes =
      options.maxScanBytes ??
      this.readPositiveInt(this.env[CLAMAV_ENV.maxScanBytes], MAX_SCAN_BYTES);
    this.maxResponseBytes = options.maxResponseBytes ?? MAX_RESPONSE_BYTES;
    this.chunkSize = options.chunkSize ?? DEFAULT_CHUNK_BYTES;
    this.socketFactory = options.socketFactory ?? (() => new net.Socket());
  }

  async scanFile(
    fileBuffer: Buffer,
    _filename: string
  ): Promise<VirusScanResult> {
    if (!this.isConfigured()) {
      this.logger.error(
        `Virus scan denied: ${CLAMAV_ENV.host} is not set, so no scanner can be reached.`
      );
      throw new ServiceUnavailableException(
        'No virus scanner is configured; file processing is denied.'
      );
    }

    if (!Buffer.isBuffer(fileBuffer)) {
      throw new ServiceUnavailableException(
        'Virus scanning requires the file bytes, not a lazy reference.'
      );
    }

    if (fileBuffer.length > this.maxScanBytes) {
      throw new PayloadTooLargeException(
        `Upload exceeds the ${Math.floor(
          this.maxScanBytes / (1024 * 1024)
        )} MiB scan limit.`
      );
    }

    const outcome = await this.streamToClamav(fileBuffer);
    return {
      isClean: outcome.clean,
      scanDate: new Date(),
      ...(outcome.signature ? { threats: [outcome.signature] } : {}),
      scanner: CLAMAV_ENGINE,
    };
  }

  async isAvailable(): Promise<boolean> {
    if (!this.isConfigured()) {
      return false;
    }
    return new Promise<boolean>((resolve) => {
      const socket = this.socketFactory();
      let settled = false;
      const finish = (available: boolean): void => {
        if (settled) {
          return;
        }
        settled = true;
        socket.destroy();
        resolve(available);
      };
      socket.setTimeout(this.socketTimeoutMs);
      socket.on('timeout', () => finish(false));
      socket.on('error', () => finish(false));
      socket.on('close', () => finish(false));
      socket.on('end', () => finish(true));
      socket.on('data', () => undefined);
      socket.resume();
      try {
        socket.connect(this.port, this.host as string, () => {
          socket.write('zPING\0');
        });
      } catch {
        finish(false);
      }
    });
  }

  getScannerInfo(): { name: string; version: string; protocol: string } {
    return this.isConfigured()
      ? {
          name: CLAMAV_ENGINE,
          version: `${this.host}:${this.port}`,
          protocol: 'zINSTREAM',
        }
      : { name: 'Unavailable', version: 'N/A', protocol: 'zINSTREAM' };
  }

  isConfigured(): boolean {
    return typeof this.host === 'string' && this.host.length > 0;
  }

  private readPositiveInt(raw: string | undefined, fallback: number): number {
    if (!raw || !raw.trim()) {
      return fallback;
    }
    const parsed = Number.parseInt(raw.trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private async streamToClamav(buffer: Buffer): Promise<{
    clean: boolean;
    signature?: string;
  }> {
    try {
      return await this.exchangeWithClamav(buffer);
    } catch (error) {
      if (error instanceof ClamAVResponseLimitError) {
        throw new ServiceUnavailableException(
          'ClamAV response exceeded the 64 KiB limit; the scan did not complete.'
        );
      }
      if (error instanceof ClamAVDeadlineError) {
        throw new ServiceUnavailableException(
          'ClamAV scan deadline exceeded; the scan did not complete.'
        );
      }
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(`Virus scan failed closed: ${describeError(error)}`);
      throw new ServiceUnavailableException(
        'ClamAV service is unavailable; file processing is denied.'
      );
    }
  }

  private exchangeWithClamav(buffer: Buffer): Promise<{
    clean: boolean;
    signature?: string;
  }> {
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
        finish(() =>
          reject(new ServiceUnavailableException('ClamAV socket timeout'))
        );
      });
      socket.on('error', (error) => {
        finish(() => reject(error));
      });
      socket.on('end', () => {
        try {
          const parsed = this.parseResponse(response);
          finish(() => resolve(parsed));
        } catch (error) {
          finish(() => reject(error));
        }
      });

      try {
        socket.connect(this.port, this.host as string, () => {
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

    for (let index = 0; index < buffer.length; index += this.chunkSize) {
      const chunk = buffer.subarray(index, index + this.chunkSize);
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

  private parseResponse(rawResponse: string): {
    clean: boolean;
    signature?: string;
  } {
    const response = rawResponse
      .replace(/^[\0\r\n]+/, '')
      .replace(/[\0\r\n]+$/, '');

    if (response === 'stream: OK') {
      return { clean: true };
    }

    const match = /^stream: ([^\0\r\n]+) FOUND$/.exec(response);
    if (!match || !match[1].trim()) {
      throw new Error('Invalid ClamAV response');
    }

    return { clean: false, signature: match[1].trim() };
  }
}
