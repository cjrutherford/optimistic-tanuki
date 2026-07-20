import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageStrategy } from '@optimistic-tanuki/models';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { basename, extname, resolve, sep } from 'node:path';
import { ReadStream } from 'node:fs';

import { AppService } from './app.service';

export type MediaStreamResult = {
  statusCode: 200 | 206;
  contentType: string;
  contentLength: number;
  contentRange?: string;
  stream: ReadStream;
};

export type UnsatisfiedMediaRange = {
  statusCode: 416;
  contentRange: string;
};

@Injectable()
export class InternalMediaService {
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

    const byteRange = this.parseRange(range, fileStats.size);
    if (byteRange === null) {
      return { statusCode: 416, contentRange: `bytes */${fileStats.size}` };
    }

    if (!byteRange) {
      return {
        statusCode: 200,
        contentType: this.getContentType(asset.name),
        contentLength: fileStats.size,
        stream: createReadStream(filePath),
      };
    }

    const { start, end } = byteRange;
    return {
      statusCode: 206,
      contentType: this.getContentType(asset.name),
      contentLength: end - start + 1,
      contentRange: `bytes ${start}-${end}/${fileStats.size}`,
      stream: createReadStream(filePath, { start, end }),
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
