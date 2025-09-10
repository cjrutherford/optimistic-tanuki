import { STORAGE_ADAPTERS, StorageAdapter } from '@optimistic-tanuki/storage';

import { AppService } from './app.service';
import AssetEntity from '../entities/asset.entity';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('AppService', () => {
  let appService: AppService;
  let logger: Logger;
  let assetRepo: Repository<AssetEntity>;
  let storageAdapter: StorageAdapter;

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

    const moduleRef = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: Logger, useValue: logger },
        { provide: getRepositoryToken(AssetEntity), useValue: assetRepo },
        { provide: STORAGE_ADAPTERS, useValue: storageAdapter },
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
      jest
        .spyOn(storageAdapter, 'create')
        .mockResolvedValue({
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
      expect(assetRepo.create).toHaveBeenCalledWith({ name: 'test.png', storageStrategy: 'local_block_storage', type: 'image', profileId: undefined });;
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
        new RpcException('Failed to create asset')
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Error creating asset:',
        expect.any(Error)
      );
    });

    it('should log the creation of an asset', async () => {
      const dto = { name: 'test', type: 'image', content: ''} as any;
      const asset = { id: '1', ...dto };
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest
        .spyOn(storageAdapter, 'create')
        .mockResolvedValue({
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

      expect(logSpy).toHaveBeenCalledWith('Creating asset with data:', dto.name, dto.profileId, dto.type, dto.content.length);
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
        new RpcException(`Asset with id ${handle.id} not found`)
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
        new RpcException(`Asset with id ${handle.id} not found`)
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
        handle
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
        new RpcException(`Failed to read asset with id ${handle.id}`)
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
        content.length
      );
    });
  });
});
