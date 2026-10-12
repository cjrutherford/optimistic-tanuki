import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { pipeline } from 'node:stream/promises';

import { InternalMediaService } from './internal-media.service';

@Controller('internal/media')
export class InternalMediaController {
  constructor(
    private readonly mediaService: InternalMediaService,
    private readonly configService: ConfigService
  ) {}

  @Get(':id')
  async stream(
    @Param('id') id: string,
    @Headers('x-internal-media-token') token: string | undefined,
    @Headers('x-internal-media-viewer') viewer: string | undefined,
    @Headers('x-internal-media-timestamp') timestamp: string | undefined,
    @Headers('x-internal-media-signature') signature: string | undefined,
    @Headers('range') range: string | undefined,
    @Res() response: Response,
    @Req() request?: Request
  ): Promise<void> {
    const expectedToken = this.configService.get<string>('internalMediaToken');
    if (!expectedToken || token !== expectedToken) {
      throw new ForbiddenException('Internal media token is required');
    }

    const viewerAuthorized = this.verifyViewerAssertion(
      id,
      viewer,
      timestamp,
      signature,
      expectedToken
    );
    const abortController = new AbortController();
    let media: Awaited<ReturnType<InternalMediaService['open']>> | undefined;
    const onRequestAborted = (): void => abortController.abort();
    const onResponseClosed = (): void => {
      if (!response.writableEnded) abortController.abort();
    };
    request?.once('aborted', onRequestAborted);
    response.once?.('close', onResponseClosed);
    try {
      media = await this.mediaService.open(
        id,
        range,
        viewerAuthorized,
        abortController.signal
      );
    } catch (error) {
      request?.removeListener('aborted', onRequestAborted);
      response.removeListener?.('close', onResponseClosed);
      if (!request?.aborted && !response.destroyed) throw error;
      return;
    }
    if (media.statusCode === 416) {
      response.setHeader('Content-Range', media.contentRange);
      response.status(416).end();
      request?.removeListener('aborted', onRequestAborted);
      response.removeListener?.('close', onResponseClosed);
      return;
    }

    response.status(media.statusCode);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', media.contentType);
    response.setHeader('Content-Length', String(media.contentLength));
    if (media.contentRange) {
      response.setHeader('Content-Range', media.contentRange);
    }
    try {
      await pipeline(media.stream, response);
    } finally {
      request?.removeListener('aborted', onRequestAborted);
      response.removeListener?.('close', onResponseClosed);
      if ('cleanup' in media) await media.cleanup();
    }
  }

  private verifyViewerAssertion(
    id: string,
    viewer: string | undefined,
    timestamp: string | undefined,
    signature: string | undefined,
    token: string
  ): boolean {
    if (!viewer || !timestamp || !signature || !/^\d{13}$/.test(timestamp)) {
      return false;
    }
    if (Math.abs(Date.now() - Number(timestamp)) > 30_000) return false;
    const expected = createHmac('sha256', token)
      .update(`${id}:${viewer}:${timestamp}`)
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, 'hex');
    } catch {
      return false;
    }
    return (
      supplied.length === expected.length && timingSafeEqual(expected, supplied)
    );
  }
}
