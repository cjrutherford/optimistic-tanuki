import {
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';

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
    @Res() response: Response
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
    const media = await this.mediaService.open(id, range, viewerAuthorized);
    if (media.statusCode === 416) {
      response.setHeader('Content-Range', media.contentRange);
      response.status(416).end();
      return;
    }

    response.status(media.statusCode);
    response.setHeader('Accept-Ranges', 'bytes');
    response.setHeader('Content-Type', media.contentType);
    response.setHeader('Content-Length', String(media.contentLength));
    if (media.contentRange) {
      response.setHeader('Content-Range', media.contentRange);
    }
    media.stream.pipe(response);
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
