import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Res,
  ServiceUnavailableException,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { Public } from '../../decorators/public.decorator';
import { gatewayWriteLimit } from '../../app/throttler-config';
import { IdentityThrottlerGuard } from '../learning/identity-throttler.guard';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const formats = ['csv', 'jsonl'];
interface ResponseHeaders {
  setHeader(name: string, value: string): unknown;
}

/**
 * Per-request budget. The export is built on demand, so this is a real cost:
 * a handful a minute per caller is plenty for a person downloading a file.
 */
const PUBLIC_EXPORT_THROTTLE = {
  long: {
    limit: gatewayWriteLimit(
      'THROTTLE_DIRECTORY_PUBLIC_EXPORT_LIMIT',
      6,
      120,
      1000
    ),
    ttl: 60000,
  },
};

/**
 * Public self-service download of a town's listings. There is deliberately no
 * permission guard: anyone may ask. What may leave is decided entirely by
 * Directory (a distinct, default-off publicExport rights grant per field) and
 * nothing here can widen it. The route is throttled per caller and the answer
 * is never cached, so a withdrawal or rights change applies on the next call.
 */
@Controller('directory/towns')
export class DirectoryPublicExportController {
  @Public()
  @UseGuards(IdentityThrottlerGuard)
  @Throttle(PUBLIC_EXPORT_THROTTLE)
  @Get(':id/public-export')
  @Header('Cache-Control', 'no-store')
  async download(
    @Param('id') id: string,
    @Query('format') format: string | undefined,
    @Res({ passthrough: true }) res: ResponseHeaders
  ): Promise<StreamableFile> {
    if (!uuid.test(id)) throw new BadRequestException('Invalid town');
    const chosen = format ?? 'csv';
    if (typeof chosen !== 'string' || !formats.includes(chosen))
      throw new BadRequestException('Invalid format');
    const base = process.env.DIRECTORY_INTERNAL_URL;
    const secret = process.env.DIRECTORY_LOCAL_EVALUATION_SECRET;
    if (
      process.env.DIRECTORY_LOCAL_EVALUATION !== 'true' ||
      !base ||
      !secret ||
      Buffer.byteLength(secret) < 32
    )
      throw new ServiceUnavailableException('Export unavailable');
    let response: Response;
    try {
      response = await fetch(
        `${base.replace(
          /\/$/,
          ''
        )}/internal/public-export/${id}?format=${chosen}`,
        {
          headers: { authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(20000),
          redirect: 'error',
        }
      );
    } catch {
      throw new ServiceUnavailableException('Export unavailable');
    }
    if (response.status === 404) {
      await response.body?.cancel().catch(() => undefined);
      throw new NotFoundException(
        'No public export is available for this town'
      );
    }
    if (response.status === 400) {
      await response.body?.cancel().catch(() => undefined);
      throw new BadRequestException('Invalid request');
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel().catch(() => undefined);
      throw new ServiceUnavailableException('Export unavailable');
    }
    for (const name of [
      'content-type',
      'content-disposition',
      'x-row-count',
      'x-export-truncated',
    ]) {
      const value = response.headers.get(name);
      if (value) res.setHeader(name, value);
    }
    res.setHeader('cache-control', 'no-store');
    res.setHeader('x-content-type-options', 'nosniff');
    return new StreamableFile(
      Readable.fromWeb(response.body as unknown as WebReadableStream)
    );
  }
}
