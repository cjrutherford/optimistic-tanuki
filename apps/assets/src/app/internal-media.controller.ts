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
import { GuardianAssetActor } from './guardian-asset-authorization.service';

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
    @Req() request?: Request,
    @Headers('x-internal-media-guardian-timestamp') guardianTimestamp?: string,
    @Headers('x-internal-media-guardian') guardianPayload?: string,
    @Headers('x-internal-media-guardian-signature') guardianSignature?: string
  ): Promise<void> {
    const expectedToken = this.configService.get<string>('internalMediaToken');
    if (!expectedToken || token !== expectedToken) {
      throw new ForbiddenException('Internal media token is required');
    }

    const guardianActor = this.verifyGuardianAssertion(
      id, guardianTimestamp, guardianPayload, guardianSignature, expectedToken
    );
    const viewerAuthorized = !!guardianActor || this.verifyViewerAssertion(
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
        abortController.signal,
        guardianActor
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

  private verifyGuardianAssertion(
    id: string,
    timestamp: string | undefined,
    payload: string | undefined,
    signature: string | undefined,
    token: string
  ): GuardianAssetActor | undefined {
    if (!timestamp && !payload && !signature) return undefined;
    if (!timestamp || !payload || !signature || !/^\d{13}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > 30_000) {
      throw new ForbiddenException('Invalid guardian media assertion');
    }
    const expected = createHmac('sha256', token).update(`${id}:${timestamp}:${payload}`).digest();
    let supplied: Buffer;
    try { supplied = Buffer.from(signature, 'hex'); } catch { throw new ForbiddenException('Invalid guardian media assertion'); }
    if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) throw new ForbiddenException('Invalid guardian media assertion');
    try {
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      if (Buffer.from(decoded, 'utf8').toString('base64url') !== payload) throw new Error('noncanonical');
      const value = JSON.parse(decoded) as Record<string, unknown>;
      if (JSON.stringify(value) !== decoded) throw new Error('noncanonical-json');
      const keys = Object.keys(value).sort();
      if (keys.join(',') !== 'actorUserId,appId,operation,targetProfileId' ||
          typeof value.actorUserId !== 'string' || !value.actorUserId ||
          typeof value.targetProfileId !== 'string' || !value.targetProfileId ||
          !['client-interface', 'local-hub'].includes(String(value.appId)) ||
          value.operation !== 'content.view') throw new Error('invalid');
      return {
        actorUserId: value.actorUserId,
        targetProfileId: value.targetProfileId,
        appId: value.appId as string,
        operation: 'content.view',
      };
    } catch {
      throw new ForbiddenException('Invalid guardian media assertion');
    }
  }
}
