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
    @Headers('range') range: string | undefined,
    @Res() response: Response
  ): Promise<void> {
    const expectedToken = this.configService.get<string>('internalMediaToken');
    if (!expectedToken || token !== expectedToken) {
      throw new ForbiddenException('Internal media token is required');
    }

    const media = await this.mediaService.open(id, range);
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
}
