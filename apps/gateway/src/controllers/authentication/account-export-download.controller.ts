import {
  Controller,
  Get,
  Head,
  Inject,
  Param,
  ParseUUIDPipe,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
  BadGatewayException,
  HttpException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { AuthCommands, ServiceTokens } from '@optimistic-tanuki/constants';
import { firstValueFrom, timeout } from 'rxjs';
import type { Request, Response } from 'express';
import { once } from 'node:events';
import { AuthGuard } from '../../auth/auth.guard';
import { User, UserDetails } from '../../decorators/user.decorator';

interface DownloadMetadata {
  downloadId: string;
  sizeBytes: number;
  sha256: string;
  fileName: string;
  mimeType: string;
  expiresAt: string;
}

/** A05 streams verified, session-bound chunks; the client never receives a storage capability. */
@Controller('authentication/account-export')
@UseGuards(AuthGuard)
export class AccountExportDownloadController {
  constructor(
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly auth: ClientProxy
  ) {}

  @Head(':jobId/download')
  async inspect(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @User() user: UserDetails,
    @Req() request: Request & { credential?: string },
    @Res() response: Response
  ): Promise<void> {
    if (
      !user ||
      !['client-interface', 'local-hub'].includes(user.appId || '') ||
      !request.credential
    )
      throw new ForbiddenException('Export download is unavailable');
    const context = {
      jobId,
      accountId: user.userId,
      appId: user.appId,
      token: request.credential,
    };
    const metadata = await this.rpc<DownloadMetadata>(
      AuthCommands.OpenAccountExportDownload,
      context
    );
    try {
      if (!validMetadata(metadata))
        throw new BadGatewayException('Invalid export download metadata');
    } finally {
      if (metadata?.downloadId)
        await this.rpc(AuthCommands.CloseAccountExportDownload, {
          ...context,
          downloadId: metadata.downloadId,
        });
    }
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('Vary', 'Cookie, Authorization');
    response.setHeader('Content-Type', 'application/x-tar');
    response.setHeader('Content-Length', metadata.sizeBytes);
    response.status(200).end();
  }

  @Get(':jobId/download')
  async download(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @User() user: UserDetails,
    @Req() request: Request & { credential?: string },
    @Res() response: Response
  ): Promise<void> {
    if (
      !user ||
      !['client-interface', 'local-hub'].includes(user.appId || '') ||
      !request.credential
    )
      throw new ForbiddenException('Export download is unavailable');
    const context = {
      jobId,
      accountId: user.userId,
      appId: user.appId,
      token: request.credential,
    };
    let metadata: DownloadMetadata | undefined;
    const abort = new AbortController();
    const closed = () => abort.abort();
    response.once('close', closed);
    try {
      metadata = await this.rpc<DownloadMetadata>(
        AuthCommands.OpenAccountExportDownload,
        context
      );
      if (!validMetadata(metadata))
        throw new BadGatewayException('Invalid export download metadata');
      const range = exportByteRange(request.headers.range, metadata.sizeBytes);
      if (abort.signal.aborted) return;
      response.status(range.partial ? 206 : 200);
      response.setHeader('Content-Type', 'application/x-tar');
      response.setHeader(
        'Content-Disposition',
        'attachment; filename="account-export.tar"'
      );
      response.setHeader('Content-Length', range.end - range.start + 1);
      response.setHeader('Cache-Control', 'private, no-store');
      response.setHeader('Vary', 'Cookie, Authorization');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Accept-Ranges', 'bytes');
      response.setHeader('ETag', `"${metadata.sha256}"`);
      if (range.partial)
        response.setHeader(
          'Content-Range',
          `bytes ${range.start}-${range.end}/${metadata.sizeBytes}`
        );
      for (let offset = range.start; offset <= range.end; ) {
        if (abort.signal.aborted) return;
        const length = Math.min(65536, range.end - offset + 1);
        const chunk = await this.rpc<{
          bytesBase64: string;
          offset: number;
          eof: boolean;
        }>(AuthCommands.ReadAccountExportDownload, {
          ...context,
          downloadId: metadata.downloadId,
          offset,
          length,
        });
        if (abort.signal.aborted) return;
        if (
          !chunk ||
          chunk.offset !== offset ||
          typeof chunk.bytesBase64 !== 'string' ||
          chunk.bytesBase64.length > Math.ceil(length / 3) * 4
        )
          throw new BadGatewayException('Invalid export chunk');
        const bytes = Buffer.from(chunk.bytesBase64, 'base64');
        if (
          bytes.length !== length ||
          bytes.toString('base64') !== chunk.bytesBase64 ||
          chunk.eof !== (offset + length === metadata.sizeBytes)
        )
          throw new BadGatewayException('Invalid export chunk');
        offset += length;
        if (!response.write(bytes))
          await once(response, 'drain', { signal: abort.signal });
      }
      response.end();
    } catch (error) {
      if (
        error instanceof HttpException &&
        error.getStatus() === 416 &&
        metadata
      )
        response.setHeader('Content-Range', `bytes */${metadata.sizeBytes}`);
      if (response.headersSent) {
        response.destroy();
        return;
      }
      for (const header of ['Content-Disposition', 'Content-Length', 'ETag'])
        response.removeHeader(header);
      if (!abort.signal.aborted) throw error;
    } finally {
      response.removeListener('close', closed);
      if (metadata?.downloadId)
        await this.rpc(AuthCommands.CloseAccountExportDownload, {
          ...context,
          downloadId: metadata.downloadId,
        }).catch(() => undefined);
    }
  }

  private rpc<T>(cmd: string, request: Record<string, unknown>): Promise<T> {
    return firstValueFrom(
      this.auth.send<T>({ cmd }, request).pipe(timeout(10000))
    );
  }
}

export function exportByteRange(
  value: unknown,
  size: number
): { start: number; end: number; partial: boolean } {
  if (value === undefined) return { start: 0, end: size - 1, partial: false };
  const match = typeof value === 'string' && /^bytes=(\d*)-(\d*)$/.exec(value);
  const invalid = () => {
    throw new HttpException('Requested range is unavailable', 416);
  };
  if (!match || (!match[1] && !match[2])) return invalid();
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return invalid();
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start >= size ||
      end < start
    )
      return invalid();
    end = Math.min(end, size - 1);
  }
  return { start, end, partial: true };
}

function validMetadata(value: DownloadMetadata): boolean {
  return (
    !!value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.downloadId
    ) &&
    Number.isSafeInteger(value.sizeBytes) &&
    value.sizeBytes > 0 &&
    value.sizeBytes <= 512 * 1024 * 1024 &&
    /^[0-9a-f]{64}$/i.test(value.sha256) &&
    value.fileName === 'account-export.tar' &&
    value.mimeType === 'application/x-tar'
  );
}
