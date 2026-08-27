import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { InternalMediaController } from './internal-media.controller';
import { InternalMediaService } from './internal-media.service';

describe('InternalMediaController', () => {
  const stream = { pipe: jest.fn() } as any;
  let mediaService: Pick<InternalMediaService, 'open'>;
  let configService: Pick<ConfigService, 'get'>;
  let controller: InternalMediaController;

  const response = () => {
    const value = {
      setHeader: jest.fn(),
      status: jest.fn(),
      end: jest.fn(),
    };
    value.status.mockReturnValue(value);
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
      stream,
    });
    const res = response();

    await controller.stream(
      'asset-1',
      'gateway-secret',
      'bytes=10-19',
      res as any
    );

    expect(mediaService.open).toHaveBeenCalledWith('asset-1', 'bytes=10-19');
    expect(res.status).toHaveBeenCalledWith(206);
    expect(res.setHeader).toHaveBeenCalledWith('Accept-Ranges', 'bytes');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Range',
      'bytes 10-19/100'
    );
    expect(res.setHeader).toHaveBeenCalledWith('Content-Length', '10');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
    expect(stream.pipe).toHaveBeenCalledWith(res);
  });

  it('rejects requests without the configured internal media token', async () => {
    await expect(
      controller.stream('asset-1', 'wrong-secret', undefined, response() as any)
    ).rejects.toBeInstanceOf(ForbiddenException);
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
      'bytes=100-',
      res as any
    );

    expect(res.status).toHaveBeenCalledWith(416);
    expect(res.setHeader).toHaveBeenCalledWith('Content-Range', 'bytes */100');
    expect(res.end).toHaveBeenCalled();
  });
});
