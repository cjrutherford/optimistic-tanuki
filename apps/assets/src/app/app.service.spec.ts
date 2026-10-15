import {
  STORAGE_ADAPTERS,
  StorageAdapter,
  FileValidationService,
  VirusScanService,
} from '@optimistic-tanuki/storage';

import { AppService } from './app.service';
import { GuardianAssetAuthorizationService } from './guardian-asset-authorization.service';
import { GuardianAssetActivity } from '../entities/guardian-asset-activity.entity';
import AssetEntity from '../entities/asset.entity';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RpcException } from '@nestjs/microservices';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as nodeFs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { Readable } from 'node:stream';

jest.mock('node:fs/promises', () => ({
  readFile: jest.fn(),
  open: jest.fn(),
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
      find: jest.fn(),
      findOneBy: jest.fn(),
      remove: jest.fn(),
      query: jest.fn(),
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
      getMaxSizeBytes: jest.fn().mockReturnValue(25 * 1024 * 1024),
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
        { provide: GuardianAssetAuthorizationService, useValue: { assertAccess: jest.fn().mockResolvedValue({ userId: 'dependent-user' }) } },
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

  it('rejects a guardian upload without bytes before reserving an asset row', async () => {
    await expect(appService.createGuardianAsset({
      actorUserId: 'guardian-user', targetProfileId: 'dependent-profile', appId: 'client-interface',
      asset: { name: 'photo.png', type: 'image', profileId: 'dependent-profile', content: '' } as any,
    })).rejects.toBeInstanceOf(RpcException);
    expect(assetRepo.create).not.toHaveBeenCalled();
    expect(storageAdapter.create).not.toHaveBeenCalled();
  });

  it('uses a server reservation ID and compensates storage when the audit insert fails', async () => {
    const reserved: any = { id: '11111111-1111-4111-8111-111111111111', lifecycleState: 'pending-upload', lifecycleLeaseUntil: new Date(Date.now() + 60_000) };
    (assetRepo as any).create = jest.fn((data) => ({ ...data }));
    (assetRepo as any).save = jest.fn().mockResolvedValue(reserved);
    (assetRepo as any).findOne = jest.fn().mockResolvedValue({ ...reserved });
    (assetRepo as any).delete = jest.fn().mockResolvedValue({ affected: 1 });
    (storageAdapter as any).reservationPath = jest.fn(() => 'assets/11111111-1111-4111-8111-111111111111/photo.png');
    (storageAdapter.create as jest.Mock).mockResolvedValue({
      ...reserved, name: 'photo.png', storagePath: 'assets/11111111-1111-4111-8111-111111111111/photo.png',
      profileId: 'dependent-profile', type: 'image', storageStrategy: 'local_block_storage',
    });
    const activityRepository = { save: jest.fn().mockRejectedValue(new Error('audit unavailable')) };
    const manager: any = {
      getRepository: (entity: unknown) => entity === GuardianAssetActivity ? activityRepository : assetRepo,
      transaction: async (work: (value: unknown) => unknown) => work(manager),
    };
    (assetRepo as any).manager = manager;

    await expect(appService.createGuardianAsset({
      actorUserId: 'guardian-user', targetProfileId: 'dependent-profile', appId: 'client-interface',
      asset: { id: 'attacker-chosen-id', name: 'photo.png', type: 'image', profileId: 'dependent-profile', content: Buffer.from('photo') } as any,
    })).rejects.toThrow('audit unavailable');

    expect(storageAdapter.create).toHaveBeenCalledWith(expect.objectContaining({ id: reserved.id }));
    expect(storageAdapter.create).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'attacker-chosen-id' }));
    expect(storageAdapter.remove).toHaveBeenCalledWith(expect.objectContaining({ id: reserved.id }));
    expect(activityRepository.save).toHaveBeenCalledTimes(1);
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
        id: expect.stringMatching(/^[0-9a-f-]{36}$/i),
        name: 'test',
        storageStrategy: 'local_block_storage',
        type: 'image',
        profileId: undefined,
        audienceCommunityIds: [],
        audienceRestrictions: [],
      });
      expect(storageAdapter.create).toHaveBeenCalledWith(expect.objectContaining({ id: expect.stringMatching(/^[0-9a-f-]{36}$/i) }));
      expect(assetRepo.save).toHaveBeenCalledWith({
        ...asset,
        storagePath: 'some/path',
        content: Buffer.from('some_content'),
        profileId: asset.profileId,
        storageStrategy: asset.storageStrategy,
      });
    });

    it('persists a community audience before the upload can be attached to content', async () => {
      const dto = {
        name: 'private.png',
        type: 'image',
        profileId: 'profile-1',
        communityId: 'community-1',
      } as any;
      const asset = {
        id: 'asset-1',
        name: dto.name,
        profileId: dto.profileId,
        type: dto.type,
        audienceCommunityIds: ['community-1'],
      } as any;
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        storageStrategy: asset.storageStrategy,
        storagePath: 'private.png',
        profileId: asset.profileId,
      } as any);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);

      await appService.createAsset(dto);

      expect(assetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ audienceCommunityIds: ['community-1'] })
      );
      expect(assetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ audienceCommunityIds: ['community-1'] })
      );
    });

    it('persists typed audience restrictions before returning an uploaded asset', async () => {
      const restriction = {
        type: 'followers',
        profileId: 'profile-1',
      } as const;
      const dto = {
        name: 'followers.png',
        type: 'image',
        profileId: 'profile-1',
        audienceRestrictions: [restriction],
      } as any;
      const asset = {
        id: 'asset-1',
        name: dto.name,
        profileId: dto.profileId,
        type: dto.type,
        audienceRestrictions: [restriction],
      } as any;
      jest.spyOn(assetRepo, 'create').mockReturnValue(asset);
      jest.spyOn(storageAdapter, 'create').mockResolvedValue({
        id: asset.id,
        name: asset.name,
        type: asset.type,
        storageStrategy: asset.storageStrategy,
        storagePath: 'followers.png',
        profileId: asset.profileId,
      } as any);
      jest.spyOn(assetRepo, 'save').mockResolvedValue(asset);

      await appService.createAsset(dto);

      expect(assetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ audienceRestrictions: [restriction] })
      );
      expect(assetRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ audienceRestrictions: [restriction] })
      );
    });

    it('merges restrictions atomically and monotonically', async () => {
      const owner = { type: 'owner', profileId: 'profile-1' } as const;
      const followerAudience = {
        type: 'followers',
        profileId: 'profile-1',
      } as const;
      (assetRepo.query as jest.Mock).mockResolvedValue([
        { id: 'asset-1', audienceRestrictions: [owner, followerAudience] },
      ]);

      await appService.addAudienceRestrictions({
        id: 'asset-1',
        restrictions: [owner],
      });
      await appService.addAudienceRestrictions({
        id: 'asset-1',
        restrictions: [followerAudience],
      });

      expect(assetRepo.query).toHaveBeenCalledTimes(2);
      expect(assetRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('jsonb_agg(DISTINCT restriction)'),
        [JSON.stringify([owner]), 'asset-1']
      );
    });

    it('adds community audiences monotonically without removing an existing restriction', async () => {
      (assetRepo.query as jest.Mock).mockResolvedValue([
        { id: 'asset-1', audienceCommunityIds: ['community-1', 'community-2'] },
      ]);

      await appService.addCommunityAudience({
        id: 'asset-1',
        communityId: 'community-2',
      });
      await appService.addCommunityAudience({
        id: 'asset-1',
        communityId: 'community-1',
      });

      expect(assetRepo.query).toHaveBeenCalledTimes(2);
      expect(assetRepo.query).toHaveBeenCalledWith(
        expect.stringContaining('"audienceCommunityIds" || $1::jsonb'),
        [JSON.stringify(['community-1']), 'asset-1']
      );
    });

    it('serializes concurrent audience additions as atomic JSONB merges', async () => {
      (assetRepo.query as jest.Mock).mockResolvedValue([
        { id: 'asset-1', audienceCommunityIds: [] },
      ]);

      await Promise.all([
        appService.addCommunityAudience({
          id: 'asset-1',
          communityId: 'community-1',
        }),
        appService.addCommunityAudience({
          id: 'asset-1',
          communityId: 'community-2',
        }),
      ]);

      expect(assetRepo.query).toHaveBeenCalledTimes(2);
      expect(
        (assetRepo.query as jest.Mock).mock.calls.every(
          ([sql]) =>
            sql.includes('UPDATE "asset_entity"') &&
            sql.includes('"audienceCommunityIds" || $1::jsonb')
        )
      ).toBe(true);
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
        'Creating asset:',
        dto.name,
        dto.type
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
        'test.jpg',
        'image/jpeg',
        expect.any(Number),
        'image'
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
        'video'
      );
      expect(assetRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'episode.mkv',
        })
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
        'video'
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
        'video'
      );
      expect(virusScanService.scanFile).toHaveBeenCalledWith(
        Buffer.from([0, 1, 2, 3]),
        'episode.mp4'
      );
      expect(
        (storageAdapter.create as jest.Mock).mock.calls[0][0].content
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
      const fileHandle = {
        stat: jest.fn().mockResolvedValue({
          isFile: () => true,
          size: 5,
          mtimeMs: 1,
        }),
        createReadStream: jest.fn(() => Readable.from([Buffer.from('video')])),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (nodeFs.open as jest.Mock).mockResolvedValue(fileHandle);

      await appService.createAsset(dto);

      expect(fileValidationService.validateFile).toHaveBeenCalledWith(
        'episode.mp4',
        'video/mp4',
        expect.any(Number),
        'video'
      );
      expect(virusScanService.scanFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        'episode.mp4'
      );
      expect(storageAdapter.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: Buffer.from('video'),
          sourcePath: undefined,
        })
      );
      expect(nodeFs.open).toHaveBeenCalledWith(
        '/tmp/imports/episode.mp4',
        expect.any(Number)
      );
      const openFlags = (nodeFs.open as jest.Mock).mock.calls[0][1] as number;
      expect(openFlags & fsConstants.O_NOFOLLOW).not.toBe(0);
      expect(fileHandle.createReadStream).toHaveBeenCalled();
      expect(fileHandle.close).toHaveBeenCalled();
    });

    it('rejects an oversized sourcePath from the opened descriptor before reading or saving', async () => {
      fileValidationService.getMaxSizeBytes = jest.fn().mockReturnValue(4);
      const fileHandle = {
        stat: jest.fn().mockResolvedValue({
          isFile: () => true,
          size: 5,
          mtimeMs: 1,
        }),
        createReadStream: jest.fn(),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (nodeFs.open as jest.Mock).mockResolvedValue(fileHandle);
      const dto = {
        name: 'large.mp4',
        type: 'video',
        sourcePath: '/tmp/imports/large.mp4',
        fileExtension: 'mp4',
      } as any;

      await expect(appService.createAsset(dto)).rejects.toThrow(RpcException);

      expect(fileHandle.stat).toHaveBeenCalledTimes(1);
      expect(fileHandle.createReadStream).not.toHaveBeenCalled();
      expect(fileHandle.close).toHaveBeenCalled();
      expect(virusScanService.scanFile).not.toHaveBeenCalled();
      expect(storageAdapter.create).not.toHaveBeenCalled();
      expect(assetRepo.save).not.toHaveBeenCalled();
    });

    it('stops a sourcePath stream that grows beyond the configured limit and closes its descriptor', async () => {
      fileValidationService.getMaxSizeBytes = jest.fn().mockReturnValue(4);
      const sourceStream = Readable.from([Buffer.from('12345')]);
      const fileHandle = {
        stat: jest.fn().mockResolvedValue({
          isFile: () => true,
          size: 4,
          mtimeMs: 1,
        }),
        createReadStream: jest.fn(() => sourceStream),
        close: jest.fn().mockResolvedValue(undefined),
      };
      (nodeFs.open as jest.Mock).mockResolvedValue(fileHandle);
      const dto = {
        name: 'growing.mp4',
        type: 'video',
        sourcePath: '/tmp/imports/growing.mp4',
        fileExtension: 'mp4',
      } as any;

      await expect(appService.createAsset(dto)).rejects.toThrow(RpcException);

      expect(fileHandle.createReadStream).toHaveBeenCalled();
      expect(fileHandle.close).toHaveBeenCalled();
      expect(virusScanService.scanFile).not.toHaveBeenCalled();
      expect(storageAdapter.create).not.toHaveBeenCalled();
      expect(assetRepo.save).not.toHaveBeenCalled();
    });

    it('rejects oversized base64 before decoding or scanning', async () => {
      const dto = {
        name: 'episode.mp4',
        type: 'video',
        content: 'A'.repeat(35 * 1024 * 1024),
        fileExtension: 'mp4',
      } as any;

      await expect(appService.createAsset(dto)).rejects.toThrow(RpcException);
      expect(fileValidationService.validateFile).not.toHaveBeenCalled();
      expect(virusScanService.scanFile).not.toHaveBeenCalled();
      expect(storageAdapter.create).not.toHaveBeenCalled();
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
        'test.pdf',
        'application/pdf',
        4,
        'image'
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
        'test.unknown',
        'application/octet-stream',
        expect.any(Number),
        'image'
      );
    });
  });

  describe('readAsset', () => {
    it('does not return bytes for a community asset through the untrusted RPC read path', async () => {
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue({
        id: 'asset-1',
        profileId: 'owner-profile',
        audienceCommunityIds: ['community-1'],
      } as AssetEntity);

      await expect(
        appService.readAsset({ id: 'asset-1', profileId: 'owner-profile' })
      ).rejects.toThrow('authorized media delivery path');
      expect(storageAdapter.read).not.toHaveBeenCalled();
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

      expect(assetRepo.findOneBy).toHaveBeenCalledWith({ id: handle.id, lifecycleState: 'active' });
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
      expect(assetRepo.findOneBy).toHaveBeenCalledWith({ id: handle.id, lifecycleState: 'active' });
    });

    it('should throw an error if asset not found', async () => {
      const handle = { id: '1' } as any;
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue(null);
      let error: RpcException | undefined;
      try {
        await appService.retrieveAsset(handle);
      } catch (caught) {
        error = caught as RpcException;
      }

      expect(error).toBeInstanceOf(RpcException);
      expect(error?.getError()).toEqual({
        statusCode: 404,
        message: 'Asset not found',
      });
    });

    it('should log the retrieval of an asset', async () => {
      const handle = { id: '1' } as any;
      const asset = { id: '1', name: 'test', type: 'image' } as AssetEntity;
      jest.spyOn(assetRepo, 'findOneBy').mockResolvedValue(asset);
      const logSpy = jest.spyOn(logger, 'log');

      await appService.retrieveAsset(handle);

      expect(logSpy).not.toHaveBeenCalledWith(
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

      expect(logSpy).not.toHaveBeenCalledWith('Retrieved asset:', asset);
    });
  });

  describe('listAssets', () => {
    it('should list assets by profile and type', async () => {
      const assets = [
        { id: '1', profileId: 'profile-1', type: 'image' },
      ] as AssetEntity[];
      jest.spyOn(assetRepo, 'find').mockResolvedValue(assets);

      const result = await appService.listAssets({
        profileId: 'profile-1',
        type: 'image' as any,
      });

      expect(result).toEqual(assets);
      expect(assetRepo.find).toHaveBeenCalledWith({
        where: { profileId: 'profile-1', type: 'image', lifecycleState: 'active' },
        order: { id: 'DESC' },
        take: 48,
      });
    });
  });
});
