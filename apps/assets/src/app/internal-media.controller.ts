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
import { InternalGuardianMediaAssertion } from '@optimistic-tanuki/models';
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
    @Headers('x-internal-media-guardian-signature') guardianSignature?: string,
    @Headers('x-internal-media-authorization') mediaPayload?: string,
    @Headers('x-internal-media-authorization-signature') mediaSignature?: string
  ): Promise<void> {
    const expectedToken = this.configService.get<string>('internalMediaToken');
    if (!expectedToken || token !== expectedToken) {
      throw new ForbiddenException('Internal media token is required');
    }

    const guardianActor = this.verifyGuardianAssertion(
      id,
      guardianTimestamp,
      guardianPayload,
      guardianSignature,
      expectedToken
    );
    const signedViewerProfileId = this.verifyViewerAssertion(
      id,
      viewer,
      timestamp,
      signature,
      expectedToken
    );
    const viewerAuthorized = signedViewerProfileId !== undefined;
    const mediaAssertion = this.verifyMediaAssertion(
      id,
      range,
      request?.path,
      request?.originalUrl?.split('?', 1)[0],
      mediaPayload,
      mediaSignature,
      expectedToken
    );
    const verifiedGuardianActor: GuardianAssetActor | undefined =
      mediaAssertion?.accessMode === 'guardian-library'
        ? mediaAssertion.viewerUserId
          ? {
              actorUserId: mediaAssertion.viewerUserId,
              targetProfileId: mediaAssertion.dependentProfileId,
              appId: mediaAssertion.appId,
              operation: 'content.view',
            }
          : undefined
        : guardianActor;
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
        verifiedGuardianActor,
        mediaAssertion,
        signedViewerProfileId
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
  ): string | undefined {
    if (!viewer || !timestamp || !signature || !/^\d{13}$/.test(timestamp)) {
      return undefined;
    }
    if (Math.abs(Date.now() - Number(timestamp)) > 30_000) return undefined;
    const expected = createHmac('sha256', token)
      .update(`${id}:${viewer}:${timestamp}`)
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, 'hex');
    } catch {
      return undefined;
    }
    return supplied.length === expected.length &&
      timingSafeEqual(expected, supplied)
      ? viewer
      : undefined;
  }

  private verifyMediaAssertion(
    id: string,
    range: string | undefined,
    requestPath: string | undefined,
    rawRequestPath: string | undefined,
    payload: string | undefined,
    signature: string | undefined,
    token: string
  ): InternalGuardianMediaAssertion | undefined {
    if (!payload && !signature) return undefined;
    if (!payload || !signature)
      throw new ForbiddenException('Invalid media authorization assertion');
    const expected = createHmac('sha256', token)
      .update(`${id}:${payload}`)
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, 'hex');
    } catch {
      throw new ForbiddenException('Invalid media authorization assertion');
    }
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(expected, supplied)
    )
      throw new ForbiddenException('Invalid media authorization assertion');
    try {
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      if (Buffer.from(decoded, 'utf8').toString('base64url') !== payload)
        throw new Error('noncanonical');
      const value = JSON.parse(decoded) as Record<string, unknown>;
      const canonical: InternalGuardianMediaAssertion = {
        version: value.version as 1,
        assetId: value.assetId as string,
        viewerUserId: value.viewerUserId as string | null,
        viewerProfileId: value.viewerProfileId as string | null,
        appId: value.appId as string,
        dependentProfileId: value.dependentProfileId as string,
        resourceType:
          value.resourceType as InternalGuardianMediaAssertion['resourceType'],
        resourceId: value.resourceId as string | null,
        path: value.path as string,
        internalPath: value.internalPath as string,
        range: value.range as string | null,
        accessMode:
          value.accessMode as InternalGuardianMediaAssertion['accessMode'],
        issuedAt: value.issuedAt as number,
      };
      const expectedKeys =
        'accessMode,appId,assetId,dependentProfileId,internalPath,issuedAt,path,range,resourceId,resourceType,version,viewerProfileId,viewerUserId';
      if (
        JSON.stringify(canonical) !== decoded ||
        Object.keys(value).sort().join(',') !== expectedKeys ||
        canonical.version !== 1 ||
        canonical.assetId !== id ||
        !['client-interface', 'local-hub'].includes(canonical.appId) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          canonical.dependentProfileId
        ) ||
        canonical.path !== `/api/asset/${id}` ||
        canonical.internalPath !== `/internal/media/${id}` ||
        requestPath !== canonical.internalPath ||
        rawRequestPath !== canonical.internalPath ||
        canonical.range !== (range ?? null) ||
        !Number.isSafeInteger(canonical.issuedAt) ||
        Math.abs(Date.now() - canonical.issuedAt) > 30_000 ||
        !['published', 'guardian-library', 'dependent-owner'].includes(
          canonical.accessMode
        ) ||
        (canonical.accessMode === 'published'
          ? !['post', 'comment'].includes(canonical.resourceType ?? '') ||
            !canonical.resourceId ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              canonical.resourceId
            )
          : canonical.resourceType !== null || canonical.resourceId !== null) ||
        (canonical.viewerProfileId !== null &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            canonical.viewerProfileId
          )) ||
        (canonical.viewerUserId !== null &&
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            canonical.viewerUserId
          )) ||
        (canonical.accessMode === 'guardian-library' &&
          !canonical.viewerUserId) ||
        (canonical.accessMode === 'dependent-owner' &&
          (!canonical.viewerUserId ||
            canonical.viewerProfileId !== canonical.dependentProfileId))
      )
        throw new Error('invalid');
      return canonical;
    } catch {
      throw new ForbiddenException('Invalid media authorization assertion');
    }
  }

  private verifyGuardianAssertion(
    id: string,
    timestamp: string | undefined,
    payload: string | undefined,
    signature: string | undefined,
    token: string
  ): GuardianAssetActor | undefined {
    if (!timestamp && !payload && !signature) return undefined;
    if (
      !timestamp ||
      !payload ||
      !signature ||
      !/^\d{13}$/.test(timestamp) ||
      Math.abs(Date.now() - Number(timestamp)) > 30_000
    ) {
      throw new ForbiddenException('Invalid guardian media assertion');
    }
    const expected = createHmac('sha256', token)
      .update(`${id}:${timestamp}:${payload}`)
      .digest();
    let supplied: Buffer;
    try {
      supplied = Buffer.from(signature, 'hex');
    } catch {
      throw new ForbiddenException('Invalid guardian media assertion');
    }
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(expected, supplied)
    )
      throw new ForbiddenException('Invalid guardian media assertion');
    try {
      const decoded = Buffer.from(payload, 'base64url').toString('utf8');
      if (Buffer.from(decoded, 'utf8').toString('base64url') !== payload)
        throw new Error('noncanonical');
      const value = JSON.parse(decoded) as Record<string, unknown>;
      if (JSON.stringify(value) !== decoded)
        throw new Error('noncanonical-json');
      const keys = Object.keys(value).sort();
      if (
        keys.join(',') !== 'actorUserId,appId,operation,targetProfileId' ||
        typeof value.actorUserId !== 'string' ||
        !value.actorUserId ||
        typeof value.targetProfileId !== 'string' ||
        !value.targetProfileId ||
        !['client-interface', 'local-hub'].includes(String(value.appId)) ||
        value.operation !== 'content.view'
      )
        throw new Error('invalid');
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
