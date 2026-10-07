import {
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageStrategy } from '@optimistic-tanuki/models';
import { stat } from 'node:fs/promises';
import { basename, extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';

import { AppService } from './app.service';

export type MediaStreamResult = {
  statusCode: 200 | 206;
  contentType: string;
  contentLength: number;
  contentRange?: string;
  stream: Readable;
};

export type UnsatisfiedMediaRange = {
  statusCode: 416;
  contentRange: string;
};

@Injectable()
export class InternalMediaService {
  private readonly maxPlaintextBytes = 25 * 1024 * 1024;
  private readonly maxStoredBytes = this.maxPlaintextBytes + 64 * 1024;

  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService
  ) {}

  async open(
    id: string,
    range?: string
  ): Promise<MediaStreamResult | UnsatisfiedMediaRange> {
    let asset: Awaited<ReturnType<AppService['retrieveAsset']>>;
    try {
      asset = await this.appService.retrieveAsset({ id });
    } catch {
      throw new NotFoundException(`Asset with id ${id} not found`);
    }
    if (asset.storageStrategy !== StorageStrategy.LOCAL_BLOCK_STORAGE) {
      throw new NotFoundException(`Asset with id ${id} is not locally stored`);
    }

    const filePath = this.resolveLocalPath(asset.storagePath);
    let fileStats: Awaited<ReturnType<typeof stat>>;
    try {
      fileStats = await stat(filePath);
    } catch {
      throw new NotFoundException(`Asset with id ${id} not found`);
    }

    if (!fileStats.isFile()) {
      throw new NotFoundException(`Asset with id ${id} not found`);
    }

    if (fileStats.size > this.maxStoredBytes) {
      throw new PayloadTooLargeException(
        `Stored media exceeds the ${this.maxPlaintextBytes}-byte authenticated retrieval limit.`
      );
    }

    // The adapter bounds the read from a single O_NOFOLLOW descriptor and
    // authenticates/decrypts the complete envelope before this returns.
    const content = await this.appService.readAssetContent(
      { id },
      this.maxStoredBytes
    );
    if (content.length > this.maxPlaintextBytes) {
      throw new PayloadTooLargeException(
        `Media exceeds the ${this.maxPlaintextBytes}-byte authenticated retrieval limit.`
      );
    }
    const byteRange = this.parseRange(range, content.length);
    if (byteRange === null) {
      return { statusCode: 416, contentRange: `bytes */${content.length}` };
    }

    const start = byteRange?.start ?? 0;
    const end = byteRange?.end ?? content.length - 1;
    const body = content.subarray(start, end + 1);
    return {
      statusCode: byteRange ? 206 : 200,
      contentType: this.getContentType(asset.name),
      contentLength: body.length,
      ...(byteRange
        ? { contentRange: `bytes ${start}-${end}/${content.length}` }
        : {}),
      stream: Readable.from([body]),
    };
  }

  private resolveLocalPath(storagePath: string): string {
    const storageRoot = resolve(
      this.configService.get<string>('storagePath') || '/usr/src/app/storage'
    );
    const filePath = resolve(storageRoot, storagePath);
    if (
      filePath !== storageRoot &&
      !filePath.startsWith(`${storageRoot}${sep}`)
    ) {
      throw new NotFoundException('Asset not found');
    }
    return filePath;
  }

  private parseRange(
    range: string | undefined,
    size: number
  ): { start: number; end: number } | undefined | null {
    if (!range) return undefined;

    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match || (match[1] === '' && match[2] === '')) return null;

    const [, rawStart, rawEnd] = match;
    if (rawStart === '') {
      const suffixLength = Number(rawEnd);
      if (
        !Number.isSafeInteger(suffixLength) ||
        suffixLength <= 0 ||
        size === 0
      ) {
        return null;
      }
      const start = Math.max(size - suffixLength, 0);
      return { start, end: size - 1 };
    }

    const start = Number(rawStart);
    const requestedEnd = rawEnd === '' ? size - 1 : Number(rawEnd);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(requestedEnd) ||
      start < 0 ||
      requestedEnd < start ||
      start >= size
    ) {
      return null;
    }

    return { start, end: Math.min(requestedEnd, size - 1) };
  }

  private getContentType(name: string): string {
    const contentTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.m4v': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.mkv': 'video/x-matroska',
      '.m3u8': 'application/vnd.apple.mpegurl',
      '.ts': 'video/mp2t',
    };
    return (
      contentTypes[extname(basename(name)).toLowerCase()] ||
      'application/octet-stream'
    );
  }
}
