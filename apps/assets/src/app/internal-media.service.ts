import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageStrategy } from '@optimistic-tanuki/models';
import { basename, extname } from 'node:path';
import { Readable } from 'node:stream';

import { AppService } from './app.service';

export type MediaStreamResult = {
  statusCode: 200 | 206;
  contentType: string;
  contentLength: number;
  contentRange?: string;
  stream: Readable;
  cleanup: () => Promise<void>;
};

export type UnsatisfiedMediaRange = {
  statusCode: 416;
  contentRange: string;
};

@Injectable()
export class InternalMediaService {
  private readonly maxPlaintextBytes: number;

  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService
  ) {
    const configured = this.configService.get<number>('mediaMaxReadBytes');
    this.maxPlaintextBytes =
      Number.isSafeInteger(configured) && (configured as number) > 0
        ? (configured as number)
        : 1024 * 1024 * 1024;
  }

  async open(
    id: string,
    range?: string,
    viewerAuthorized = false,
    signal?: AbortSignal
  ): Promise<MediaStreamResult | UnsatisfiedMediaRange> {
    let asset: Awaited<ReturnType<AppService['retrieveAsset']>>;
    try {
      asset = await this.appService.retrieveAsset({ id });
    } catch {
      throw new NotFoundException(`Asset with id ${id} not found`);
    }
    if (
      (asset.audienceCommunityIds?.length ||
        asset.audienceRestrictions?.length) &&
      !viewerAuthorized
    ) {
      throw new NotFoundException(`Asset with id ${id} not found`);
    }
    if (
      asset.storageStrategy !== StorageStrategy.LOCAL_BLOCK_STORAGE &&
      asset.storageStrategy !== StorageStrategy.REMOTE_BLOCK_STORAGE
    ) {
      throw new NotFoundException(`Asset with id ${id} cannot be streamed`);
    }

    const content = await this.appService.openAuthenticatedMedia(asset, {
      maxPlaintextBytes: this.maxPlaintextBytes,
      signal,
    });
    const byteRange = this.parseRange(range, content.size);
    if (byteRange === null) {
      await content.cleanup();
      return { statusCode: 416, contentRange: `bytes */${content.size}` };
    }

    const start = byteRange?.start ?? 0;
    const end = byteRange?.end ?? content.size - 1;
    return {
      statusCode: byteRange ? 206 : 200,
      contentType: this.getContentType(asset.name),
      contentLength: content.size === 0 ? 0 : end - start + 1,
      ...(byteRange
        ? { contentRange: `bytes ${start}-${end}/${content.size}` }
        : {}),
      stream: content.createReadStream(
        content.size === 0 ? undefined : start,
        content.size === 0 ? undefined : end
      ),
      cleanup: content.cleanup,
    };
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
