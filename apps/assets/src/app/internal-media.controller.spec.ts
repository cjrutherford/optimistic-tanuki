import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { Readable, Writable } from 'node:stream';

import { InternalMediaController } from './internal-media.controller';
import { InternalMediaService } from './internal-media.service';

describe('InternalMediaController', () => {
  const stream = () => Readable.from([Buffer.from('media-bytes')]);
  let mediaService: Pick<InternalMediaService, 'open'>;
  let configService: Pick<ConfigService, 'get'>;
  let controller: InternalMediaController;

  const response = () => {
    let body = Buffer.alloc(0);
    const value = Object.assign(
      new Writable({
        write(chunk, _encoding, callback) {
          body = Buffer.concat([body, Buffer.from(chunk)]);
          callback();
        },
      }),
      { setHeader: jest.fn(), status: jest.fn() }
    ) as any;
    value.status.mockReturnValue(value);
    const end = value.end.bind(value);
    value.end = jest.fn((...args: any[]) => end(...args));
    value.readBody = () => body;
    return value;
  };

  beforeEach(() => {
    mediaService = { open: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('gateway-secret') };
    controller = new InternalMediaController(
      mediaService as InternalMediaService,
      configService as ConfigService
    );
  });

  it('streams an authorized range response with media headers', async () => {
    (mediaService.open as jest.Mock).mockResolvedValue({
      statusCode: 206,
      contentType: 'video/mp4',
      contentLength: 10,
      contentRange: 'bytes 10-19/100',
      stream: stream(),
    });
    const res = response();

    await controller.stream(
      'asset-1',
      'gateway-secret',
      undefined,
      undefined,
      undefined,
      'bytes=10-19',
      res as any
    );

    expect(mediaService.open).toHaveBeenCalledWith(
      'asset-1',
      'bytes=10-19',
      false,
      expect.any(AbortSignal),
      undefined,
      undefined,
      undefined
    );
    expect(res.status).toHaveBeenCalledWith(206);
    expect(res.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Range',
      'bytes 10-19/100'
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', '10');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
    expect(res.readBody()).toEqual(Buffer.from('media-bytes'));
  });

  it('rejects requests without the configured internal media token', async () => {
    await expect(
      controller.stream(
        'asset-1',
        'wrong-secret',
        undefined,
        undefined,
        undefined,
        undefined,
        response() as any
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts only a fresh gateway-signed viewer assertion for private delivery', async () => {
    (mediaService.open as jest.Mock).mockResolvedValue({
      statusCode: 200,
      contentType: 'image/png',
      contentLength: 8,
      stream: stream(),
    });
    const timestamp = String(Date.now());
    const viewer = 'profile-1';
    const signature = createHmac('sha256', 'gateway-secret')
      .update(`asset-1:${viewer}:${timestamp}`)
      .digest('hex');

    await controller.stream(
      'asset-1',
      'gateway-secret',
      viewer,
      timestamp,
      signature,
      undefined,
      response() as any
    );

    expect(mediaService.open).toHaveBeenCalledWith(
      'asset-1',
      undefined,
      true,
      expect.any(AbortSignal),
      undefined,
      undefined,
      'profile-1'
    );
  });

  it('accepts a fresh guardian assertion bound to actor, dependent profile, app, operation, and asset', async () => {
    (mediaService.open as jest.Mock).mockResolvedValue({
      statusCode: 200,
      contentType: 'image/png',
      contentLength: 8,
      stream: stream(),
    });
    const timestamp = String(Date.now());
    const payload = Buffer.from(
      JSON.stringify({
        actorUserId: 'guardian-1',
        targetProfileId: 'dependent-profile',
        appId: 'client-interface',
        operation: 'content.view',
      })
    ).toString('base64url');
    const signature = createHmac('sha256', 'gateway-secret')
      .update(`asset-1:${timestamp}:${payload}`)
      .digest('hex');

    await controller.stream(
      'asset-1',
      'gateway-secret',
      undefined,
      undefined,
      undefined,
      undefined,
      response() as any,
      undefined,
      timestamp,
      payload,
      signature
    );

    expect(mediaService.open).toHaveBeenCalledWith(
      'asset-1',
      undefined,
      false,
      expect.any(AbortSignal),
      expect.objectContaining({
        actorUserId: 'guardian-1',
        targetProfileId: 'dependent-profile',
        appId: 'client-interface',
      }),
      undefined,
      undefined
    );
  });

  it('rejects extra fields in a signed guardian assertion', async () => {
    const timestamp = String(Date.now());
    const payload = Buffer.from(
      JSON.stringify({
        actorUserId: 'guardian-1',
        targetProfileId: 'dependent-profile',
        appId: 'client-interface',
        operation: 'content.view',
        profileId: 'forged',
      })
    ).toString('base64url');
    const signature = createHmac('sha256', 'gateway-secret')
      .update(`asset-1:${timestamp}:${payload}`)
      .digest('hex');
    await expect(
      controller.stream(
        'asset-1',
        'gateway-secret',
        undefined,
        undefined,
        undefined,
        undefined,
        response() as any,
        undefined,
        timestamp,
        payload,
        signature
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mediaService.open).not.toHaveBeenCalled();
  });

  it('rejects a valid HMAC when the actual internal path is an encoded alias', async () => {
    const id = '123e4567-e89b-42d3-a456-426614174000';
    const assertion = {
      version: 1,
      assetId: id,
      viewerUserId: null,
      viewerProfileId: null,
      appId: 'client-interface',
      dependentProfileId: '223e4567-e89b-42d3-a456-426614174000',
      resourceType: 'post',
      resourceId: '323e4567-e89b-42d3-a456-426614174000',
      path: `/api/asset/${id}`,
      internalPath: `/internal/media/${id}`,
      range: null,
      accessMode: 'published',
      issuedAt: Date.now(),
    };
    const payload = Buffer.from(JSON.stringify(assertion)).toString(
      'base64url'
    );
    const signature = createHmac('sha256', 'gateway-secret')
      .update(`${id}:${payload}`)
      .digest('hex');
    const request = {
      path: `/internal%2Fmedia/${id}`,
      originalUrl: `/internal%2Fmedia/${id}`,
      once: jest.fn(),
      removeListener: jest.fn(),
    } as any;

    await expect(
      controller.stream(
        id,
        'gateway-secret',
        undefined,
        undefined,
        undefined,
        undefined,
        response() as any,
        request,
        undefined,
        undefined,
        undefined,
        payload,
        signature
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mediaService.open).not.toHaveBeenCalled();
  });

  it.each([
    [
      'range',
      (id: string) => ({
        assetId: id,
        range: 'bytes=0-3',
        path: `/api/asset/${id}`,
      }),
    ],
    [
      'public path',
      (id: string) => ({ assetId: id, range: null, path: `/asset/${id}` }),
    ],
    [
      'asset claim',
      (id: string) => ({
        assetId: '423e4567-e89b-42d3-a456-426614174000',
        range: null,
        path: `/api/asset/${id}`,
      }),
    ],
  ])(
    'rejects a correctly signed staged assertion with a mismatched %s claim',
    async (_label, claim) => {
      const id = '123e4567-e89b-42d3-a456-426614174000';
      const claims = claim(id);
      const assertion = {
        version: 1,
        assetId: claims.assetId,
        viewerUserId: null,
        viewerProfileId: null,
        appId: 'client-interface',
        dependentProfileId: '223e4567-e89b-42d3-a456-426614174000',
        resourceType: 'post',
        resourceId: '323e4567-e89b-42d3-a456-426614174000',
        path: claims.path,
        internalPath: `/internal/media/${id}`,
        range: claims.range,
        accessMode: 'published',
        issuedAt: Date.now(),
      };
      const payload = Buffer.from(JSON.stringify(assertion)).toString(
        'base64url'
      );
      const signature = createHmac('sha256', 'gateway-secret')
        .update(`${id}:${payload}`)
        .digest('hex');
      const request = {
        path: `/internal/media/${id}`,
        originalUrl: `/internal/media/${id}`,
        once: jest.fn(),
        removeListener: jest.fn(),
      } as any;
      const actualRange = _label === 'range' ? 'bytes=4-7' : undefined;
      await expect(
        controller.stream(
          id,
          'gateway-secret',
          undefined,
          undefined,
          undefined,
          actualRange,
          response() as any,
          request,
          undefined,
          undefined,
          undefined,
          payload,
          signature
        )
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(mediaService.open).not.toHaveBeenCalled();
    }
  );

  it('returns a 416 response with the file size for an invalid byte range', async () => {
    (mediaService.open as jest.Mock).mockResolvedValue({
      statusCode: 416,
      contentRange: 'bytes */100',
    });
    const res = response();

    await controller.stream(
      'asset-1',
      'gateway-secret',
      undefined,
      undefined,
      undefined,
      'bytes=100-',
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(416);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes */100');
    expect(res.end).toHaveBeenCalled();
  });
});
