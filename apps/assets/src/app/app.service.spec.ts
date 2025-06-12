import { Test } from '@nestjs/testing';
import { AppService } from './app.service';
import { Logger } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import AssetEntity from '../entities/asset.entity';
import { STORAGE_ADAPTERS, StorageAdapter } from '@optimistic-tanuki/storage';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';


describe('AppService Constructor', () => {
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
      // Add other methods as needed for your tests
      // For example, you might want to mock a method like `retrieve` if it's used in your service
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
      const dto = { name: 'test', type: 'image' } as any;
      const asset = { id: '1', ...dto };
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue(asset);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);

      const result = await appService.createAsset(dto);

      expect(result).toEqual(asset);
      expect(assetRepo.create).toHaveBeenCalledWith(dto);
      expect(storageAdapter.create).toHaveBeenCalledWith(asset);
      expect(assetRepo.save).toHaveBeenCalledWith({ ...asset, ...asset });
    });

    it('should log an error if asset creation fails', async () => {
      const dto = { name: 'test', type: 'image' } as any;
      jest.spyOn(assetRepo, 'create').mockReturnValue({} as AssetEntity);
      jest.spyOn(storageAdapter, 'create').mockRejectedValue(new Error('Storage error'));

      await expect(appService.createAsset(dto)).rejects.toThrow(new RpcException('Failed to create asset'));
      expect(logger.error).toHaveBeenCalledWith('Error creating asset:', expect.any(Error));
    });

    it('should log the creation of an asset', async () => {
      const dto = { name: 'test', type: 'image' } as any;
      const asset = { id: '1', ...dto };
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue(asset);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);
      const logSpy = jest.spyOn(logger, 'log');

      await appService.createAsset(dto);

      expect(logSpy).toHaveBeenCalledWith('Creating asset with data:', dto);
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

      await expect(appService.removeAsset(handle)).rejects.toThrow(new RpcException(`Asset with id ${handle.id} not found`));
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

      await expect(appService.retrieveAsset(handle)).rejects.toThrow(new RpcException(`Asset with id ${handle.id} not found`));
    });

    it('should log the retrieval of an asset', async () => {
      const handle = { id: '1' } as any;
      const asset = { id: '1', name: 'test', type: 'image' } as AssetEntity;
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue(asset);
      const logSpy = jest.spyOn(logger, 'log');

      await appService.retrieveAsset(handle);

      expect(logSpy).toHaveBeenCalledWith('Retrieving asset with data:', handle);
    });
  });
});
