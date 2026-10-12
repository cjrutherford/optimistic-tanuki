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
      expect.any(AbortSignal)
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
      expect.any(AbortSignal)
    );
  });

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
