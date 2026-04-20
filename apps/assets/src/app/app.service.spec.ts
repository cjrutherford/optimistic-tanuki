import {
  STORAGE_ADAPTERS,
  StorageAdapter,
  FileValidationService,
  VirusScanService,
} from '@optimistic-tanuki/storage';

import { AppService } from './app.service';
import AssetEntity from '../entities/asset.entity';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as nodeFs from 'node:fs/promises';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
}));

describe('AppService', () => {
  let appService: AppService;
  let logger: Logger;
  let assetRepo: Repository<AssetEntity>;
  let storageAdapter: StorageAdapter;
  let fileValidationService: FileValidationService;
  let virusScanService: VirusScanService;

  beforeEach(async () => {
    logger = new Logger();
    // Mock logger.error and logger.log as Jest functions
    logger.error = jest.fn();
    logger.log = jest.fn();
    assetRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
      // Add other methods as needed for your tests
    } as unknown as Repository<AssetEntity>;
    storageAdapter = {
      create: jest.fn(),
      remove: jest.fn(),
      read: jest.fn(),
      retrieve: jest.fn(),
    } as StorageAdapter;
    fileValidationService = {
      validateFile: jest.fn().mockReturnValue({ isValid: true }),
    } as unknown as FileValidationService;
    virusScanService = {
      scanFile: jest
        .fn()
        .mockResolvedValue({ isClean: true, scanner: 'clamav' }),
    } as unknown as VirusScanService;

    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: Logger, useValue: logger },
        { provide: getRepositoryToken(AssetEntity), useValue: assetRepo },
        { provide: STORAGE_ADAPTERS, useValue: storageAdapter },
        { provide: FileValidationService, useValue: fileValidationService },
        { provide: VirusScanService, useValue: virusScanService },
      ],
    }).compile();

    appService = moduleRef.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(appService).toBeDefined();
  });

  it('should inject Logger', () => {
    expect((appService as any).l).toBe(logger);
  });

  it('should inject assetRepo', () => {
    expect((appService as any).assetRepo).toBe(assetRepo);
  });

  it('should inject storageAdapter', () => {
    expect((appService as any).storageAdapter).toBe(storageAdapter);
  });

  describe('createAsset', () => {
    it('should create an asset and return it', async () => {
      const dto = { name: 'test', type: 'image', content: '' } as any;
      const asset = { id: '1', ...dto };
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        storageStrategy: asset.storageStrategy,
        storagePath: 'some/path',
        profileId: asset.profileId,
        content: Buffer.from('some_content'),
      });
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);

      const result = await appService.createAsset(dto);

      expect(result).toEqual(asset);
      expect(assetRepo.create).toHaveBeenCalledWith({
        name: 'test',
        storageStrategy: 'local_block_storage',
        type: 'image',
        profileId: undefined,
      });
      expect(storageAdapter.create).toHaveBeenCalledWith(asset);
      expect(assetRepo.save).toHaveBeenCalledWith({
        ...asset,
        storagePath: 'some/path',
        content: Buffer.from('some_content'),
        profileId: asset.profileId,
        storageStrategy: asset.storageStrategy,
      });
    });

    it('should log an error if asset creation fails', async () => {
      const dto = { name: 'test', type: 'image' } as any;
      jest.spyOn(assetRepo, 'create').mockReturnValue({} as AssetEntity);
      jest
        .spyOn(storageAdapter, 'create')
        .mockRejectedValue(new Error('Storage error'));

      await expect(appService.createAsset(dto)).rejects.toThrow(
        new RpcException('Failed to create asset'),
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Error creating asset:',
        expect.any(Error),
      );
    });

    it('should log the creation of an asset', async () => {
      const dto = { name: 'test', type: 'image', content: '' } as any;
      const asset = { id: '1', ...dto };
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        storageStrategy: asset.storageStrategy,
        storagePath: 'some/path',
        profileId: asset.profileId,
        content: Buffer.from('some_content'),
      });
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);
      const logSpy = jest.spyOn(logger, 'log');

      await appService.createAsset(dto);

      expect(logSpy).toHaveBeenCalledWith(
        'Creating asset with data:',
        dto.name,
        dto.profileId,
        dto.type,
        dto.content.length,
      );
    });

    it('should create an asset with base64 content and validation/scanning', async () => {
      const dto = {
        name: 'test',
        type: 'image',
        content: Buffer.from('test').toString('base64'),
        fileExtension: 'jpg',
      } as any;
      const createdAsset = {
        id: '1',
        name: 'sanitized_test.jpg',
        type: 'image',
      } as any;
      jest.spyOn(assetRepo, 'create').mockReturnValue(createdAsset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue(createdAsset);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(createdAsset);
      jest.spyOn(fileValidationService, 'validateFile').mockReturnValue({
        isValid: true,
        sanitizedFilename: 'sanitized_test',
      } as any);

      const result = await appService.createAsset(dto);

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(
        'test',
        'image/jpeg',
        expect.any(Number),
        'image',
      );
      expect(virusScanService.scanFile).toHaveBeenCalled();
      expect(result.name).toBe('sanitized_test.jpg');
    });

    it('preserves a single filename extension when the name already includes one', async () => {
      const dto = {
        name: 'episode.mkv',
        type: 'video',
        content: Buffer.from('video').toString('base64'),
        fileExtension: 'mkv',
        profileId: 'profile-1',
      } as any;
      const asset = { id: '1', ...dto } as any;
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue(asset);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);

      await appService.createAsset(dto);

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(
        'episode.mkv',
        'video/x-matroska',
        expect.any(Number),
        'video',
      );
      expect(assetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'episode.mkv',
        }),
      );
    });

    it('accepts hls manifest files with the correct mime type', async () => {
      const dto = {
        name: 'stream.m3u8',
        type: 'video',
        content: Buffer.from('#EXTM3U').toString('base64'),
        fileExtension: 'm3u8',
      } as any;
      const asset = { id: '1', ...dto } as any;
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue(asset);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);

      await appService.createAsset(dto);

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(
        'stream.m3u8',
        'application/vnd.apple.mpegurl',
        expect.any(Number),
        'video',
      );
    });

    it('accepts rpc-serialized buffer content for large video assets', async () => {
      const dto = {
        name: 'episode.mp4',
        type: 'video',
        content: {
          type: 'Buffer',
          data: [0, 1, 2, 3],
        },
        fileExtension: 'mp4',
        profileId: '00000000-0000-0000-0000-000000000001',
      } as any;
      const asset = { id: '1', ...dto } as any;
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue(asset);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);

      await appService.createAsset(dto);

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(
        'episode.mp4',
        'video/mp4',
        4,
        'video',
      );
      expect(virusScanService.scanFile).toHaveBeenCalledWith(
        Buffer.from([0, 1, 2, 3]),
        'episode.mp4',
      );
      expect(
        (storageAdapter.create as jest.Mock).mock.calls[0][0].content,
      ).toEqual(Buffer.from([0, 1, 2, 3]));
    });

    it('creates an asset from sourcePath without requiring inline content', async () => {
      const dto = {
        name: 'episode.mp4',
        type: 'video',
        sourcePath: '/tmp/imports/episode.mp4',
        fileExtension: 'mp4',
        profileId: '00000000-0000-0000-0000-000000000001',
      } as any;
      const asset = { id: '1', ...dto } as any;
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue(asset);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);
      (nodeFs.readFile as jest.Mock).mockResolvedValue(Buffer.from('video'));

      await appService.createAsset(dto);

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(
        'episode.mp4',
        'video/mp4',
        expect.any(Number),
        'video',
      );
      expect(virusScanService.scanFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        'episode.mp4',
      );
      expect(storageAdapter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sourcePath: '/tmp/imports/episode.mp4',
        }),
      );
    });

    it('should throw RpcException if file validation fails', async () => {
      const dto = { name: 'test', type: 'image', content: 'abc' } as any;
      jest
        .spyOn(fileValidationService, 'validateFile')
        .mockReturnValue({ isValid: false, errors: ['Invalid size'] } as any);

      await expect(appService.createAsset(dto)).rejects.toThrow(RpcException);
      expect(logger.error).toHaveBeenCalledWith('File validation failed:', [
        'Invalid size',
      ]);
    });

    it('should throw RpcException if virus scan fails', async () => {
      const dto = { name: 'test', type: 'image', content: 'abc' } as any;
      jest
        .spyOn(fileValidationService, 'validateFile')
        .mockReturnValue({ isValid: true } as any);
      jest.spyOn(virusScanService, 'scanFile').mockResolvedValue({
        isClean: false,
        threats: ['Eicar-Test-Signature'],
      } as any);

      await expect(appService.createAsset(dto)).rejects.toThrow(RpcException);
      expect(logger.error).toHaveBeenCalledWith('Virus scan failed:', [
        'Eicar-Test-Signature',
      ]);
    });

    it('should handle buffer content in createAsset', async () => {
      const dto = {
        name: 'test',
        type: 'image',
        content: Buffer.from('test'),
        fileExtension: 'pdf',
      } as any;
      const asset = { id: '1', ...dto };
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue(asset);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);

      await appService.createAsset(dto);
      expect(fileValidationService.validateFile).toHaveBeenCalledWith(
        'test',
        'application/pdf',
        4,
        'image',
      );
    });

    it('should handle unknown file extension', async () => {
      const dto = {
        name: 'test',
        type: 'image',
        content: 'abc',
        fileExtension: 'unknown',
      } as any;
      const asset = { id: '1', ...dto };
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue(asset);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);

      await appService.createAsset(dto);
      expect(fileValidationService.validateFile).toHaveBeenCalledWith(
        'test',
        'application/octet-stream',
        expect.any(Number),
        'image',
      );
    });
  });

  describe('removeAsset', () => {
    it('should remove an asset', async () => {
      const handle = { id: '1' } as any;
      const asset = { id: '1' } as AssetEntity;
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue(asset);
      jest.spyOn(storageAdapter, 'remove').mockResolvedValue();
      jest.spyOn(assetRepo, 'remove').mockResolvedValue(asset);

      await appService.removeAsset(handle);

      expect(assetRepo.findOneBy).toHaveBeenCalledWith({ id: handle.id });
      expect(storageAdapter.remove).toHaveBeenCalledWith(asset);
      expect(assetRepo.remove).toHaveBeenCalledWith(asset);
    });

    it('should throw an error if asset not found', async () => {
      const handle = { id: '1' } as any;
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue(null);

      await expect(appService.removeAsset(handle)).rejects.toThrow(
        new RpcException(`Asset with id ${handle.id} not found`),
      );
    });

    it('should log the removal of an asset', async () => {
      const handle = { id: '1' } as any;
      const asset = { id: '1' } as AssetEntity;
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue(asset);
      jest.spyOn(storageAdapter, 'remove').mockResolvedValue();
      const logSpy = jest.spyOn(logger, 'log');

      await appService.removeAsset(handle);

      expect(logSpy).toHaveBeenCalledWith('Removing asset with data:', handle);
    });
  });

  describe('retrieveAsset', () => {
    it('should retrieve an asset', async () => {
      const handle = { id: '1' } as any;
      const asset = { id: '1', name: 'test', type: 'image' } as AssetEntity;
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue(asset);

      const result = await appService.retrieveAsset(handle);

      expect(result).toEqual(asset);
      expect(assetRepo.findOneBy).toHaveBeenCalledWith({ id: handle.id });
    });

    it('should throw an error if asset not found', async () => {
      const handle = { id: '1' } as any;
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue(null);

      await expect(appService.retrieveAsset(handle)).rejects.toThrow(
        new RpcException(`Asset with id ${handle.id} not found`),
      );
    });

    it('should log the retrieval of an asset', async () => {
      const handle = { id: '1' } as any;
      const asset = { id: '1', name: 'test', type: 'image' } as AssetEntity;
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue(asset);
      const logSpy = jest.spyOn(logger, 'log');

      await appService.retrieveAsset(handle);

      expect(logSpy).toHaveBeenCalledWith(
        'Retrieving asset with data:',
        handle,
      );
    });
  });

  describe('readAsset', () => {
    it('should read an asset', async () => {
      const handle = { id: '1' } as any;
      const asset = { id: '1', name: 'test', type: 'image' } as AssetEntity;
      const content = 'base64encodedstring';
      jest.spyOn(appService, 'retrieveAsset').mockResolvedValue(asset);
      jest.spyOn(storageAdapter, 'read').mockResolvedValue(content);

      const result = await appService.readAsset(handle);

      expect(result).toEqual(content);
      expect(appService.retrieveAsset).toHaveBeenCalledWith(handle);
      expect(storageAdapter.read).toHaveBeenCalledWith(asset);
    });

    it('should throw an error if asset content cannot be read', async () => {
      const handle = { id: '1' } as any;
      const asset = { id: '1', name: 'test', type: 'image' } as AssetEntity;
      jest.spyOn(appService, 'retrieveAsset').mockResolvedValue(asset);
      jest.spyOn(storageAdapter, 'read').mockResolvedValue(null);

      await expect(appService.readAsset(handle)).rejects.toThrow(
        new RpcException(`Failed to read asset with id ${handle.id}`),
      );
    });

    it('should log the reading of an asset', async () => {
      const handle = { id: '1' } as any;
      const asset = { id: '1', name: 'test', type: 'image' } as AssetEntity;
      const content = 'base64encodedstring';
      jest.spyOn(appService, 'retrieveAsset').mockResolvedValue(asset);
      jest.spyOn(storageAdapter, 'read').mockResolvedValue(content);
      const logSpy = jest.spyOn(logger, 'log');

      await appService.readAsset(handle);

      expect(logSpy).toHaveBeenCalledWith('Reading asset with data:', handle);
      expect(logSpy).toHaveBeenCalledWith('Retrieved asset:', asset);
      expect(logSpy).toHaveBeenCalledWith(
        'Read asset content length:',
        content.length,
      );
    });
  });
});
