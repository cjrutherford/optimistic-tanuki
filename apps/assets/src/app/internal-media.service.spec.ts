import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { AssetType, StorageStrategy } from '@optimistic-tanuki/models';

import { AppService } from './app.service';
import { InternalMediaService } from './internal-media.service';

jest.mock('node:fs', () => ({
  createReadStream: jest.fn(),
}));

jest.mock('node:fs/promises', () => ({
  stat: jest.fn(),
}));

describe('InternalMediaService', () => {
  const asset = {
    id: 'asset-1',
    name: 'episode.mp4',
    storagePath: 'assets/asset-1/episode.mp4',
    storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
    type: AssetType.VIDEO,
  } as any;
  const stream = { pipe: jest.fn() } as any;
  let appService: Pick<AppService, 'retrieveAsset'>;
  let configService: Pick<ConfigService, 'get'>;
  let service: InternalMediaService;

  beforeEach(() => {
    appService = { retrieveAsset: jest.fn().mockResolvedValue(asset) };
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'storagePath') return '/srv/assets';
        return undefined;
      }),
    };
    service = new InternalMediaService(
      appService as AppService,
      configService as ConfigService
    );
    (stat as jest.Mock).mockResolvedValue({ size: 100, isFile: () => true });
    (createReadStream as jest.Mock).mockReturnValue(stream);
  });

  it('opens a requested byte range as a partial MP4 stream', async () => {
    const result = await service.open('asset-1', 'bytes=10-19');

    expect(appService.retrieveAsset).toHaveBeenCalledWith({ id: 'asset-1' });
    expect(createReadStream).toHaveBeenCalledWith(
      '/srv/assets/assets/asset-1/episode.mp4',
      { start: 10, end: 19 }
    );
    expect(result).toEqual(
      expect.objectContaining({
        statusCode: 206,
        contentType: 'video/mp4',
        contentLength: 10,
        contentRange: 'bytes 10-19/100',
        stream,
      })
    );
  });

  it('opens the full file when no byte range is requested', async () => {
    const result = await service.open('asset-1');

    expect(createReadStream).toHaveBeenCalledWith(
      '/srv/assets/assets/asset-1/episode.mp4'
    );
    expect(result).toEqual(
      expect.objectContaining({
        statusCode: 200,
        contentLength: 100,
      })
    );
    expect(result).not.toHaveProperty('contentRange');
  });

  it('returns an unsatisfied range response for bytes beyond the file', async () => {
    await expect(service.open('asset-1', 'bytes=100-')).resolves.toEqual({
      statusCode: 416,
      contentRange: 'bytes */100',
    });
  });

  it('does not resolve storage paths outside local asset storage', async () => {
    (appService.retrieveAsset as jest.Mock).mockResolvedValue({
      ...asset,
      storagePath: '../secrets.txt',
    });

    await expect(service.open('asset-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('maps a missing asset record to an HTTP-safe not found response', async () => {
    (appService.retrieveAsset as jest.Mock).mockRejectedValue(
      new Error('Asset with id asset-1 not found')
    );

    await expect(service.open('asset-1')).rejects.toBeInstanceOf(
      NotFoundException
    );
  });
});
