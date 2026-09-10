import { Test, TestingModule } from '@nestjs/testing';
import { ConfigurationsController } from './configurations.controller';
import { ConfigurationsService } from '../app/configurations.service';
import { ConflictException, Logger, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import type { AppConfigRequestContext } from '@optimistic-tanuki/app-config-models';
import type { AppConfigContextResolutionRequest } from './app-config-context.contract';

describe('ConfigurationsController', () => {
  let controller: ConfigurationsController;
  let service: ConfigurationsService;

  const ownerContext: AppConfigRequestContext = {
    ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    ownerProfileId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    appScope: 'business-site',
    workspaceId: '123e4567-e89b-12d3-a456-426614174000',
    appInstanceId: '123e4567-e89b-12d3-a456-426614174001',
    membershipId: '123e4567-e89b-12d3-a456-426614174002',
    membershipRole: 'owner',
    membershipStatus: 'active',
  };
  const mockConfig = {
    id: 'config-1',
    name: 'Test App',
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConfigurationsController],
      providers: [
        {
          provide: ConfigurationsService,
          useValue: {
            createConfiguration: jest.fn().mockResolvedValue(mockConfig),
            getConfiguration: jest.fn().mockResolvedValue(mockConfig),
            getPublishedConfigurationByDomain: jest
              .fn()
              .mockResolvedValue(mockConfig),
            getConfigurationByName: jest.fn().mockResolvedValue(mockConfig),
            getConfigurationByContext: jest.fn().mockResolvedValue(mockConfig),
            getAllConfigurations: jest.fn().mockResolvedValue([mockConfig]),
            updateConfiguration: jest.fn().mockResolvedValue(mockConfig),
            publishConfiguration: jest.fn().mockResolvedValue(mockConfig),
            rollbackConfiguration: jest.fn().mockResolvedValue(mockConfig),
            deleteConfiguration: jest.fn().mockResolvedValue(undefined),
            resolveContext: jest.fn().mockResolvedValue(ownerContext),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ConfigurationsController>(ConfigurationsController);
    service = module.get<ConfigurationsService>(ConfigurationsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('resolveContext should dispatch the trusted identity and canonical app scope', async () => {
    const request: AppConfigContextResolutionRequest = {
      ownerUserId: ownerContext.ownerUserId,
      ownerProfileId: ownerContext.ownerProfileId,
      workspaceId: ownerContext.workspaceId!,
      appScope: ownerContext.appScope,
    };

    const result = await (
      controller as ConfigurationsController & {
        resolveContext: (
          value: AppConfigContextResolutionRequest
        ) => Promise<unknown>;
      }
    ).resolveContext(request);

    expect(service.resolveContext).toHaveBeenCalledWith(request);
    expect(result).toEqual(ownerContext);
  });

  it('preserves resolver denial status as a structured RPC error', async () => {
    const error = new NotFoundException('No app instance exists');
    (service.resolveContext as jest.Mock).mockRejectedValueOnce(error);

    try {
      await controller.resolveContext({
        ownerUserId: ownerContext.ownerUserId,
        ownerProfileId: ownerContext.ownerProfileId,
        workspaceId: ownerContext.workspaceId!,
        appScope: ownerContext.appScope,
      });
      fail('Expected a structured RPC not-found error');
    } catch (rpcError) {
      expect(rpcError).toBeInstanceOf(RpcException);
      expect((rpcError as RpcException).getError()).toEqual(
        expect.objectContaining({ statusCode: 404 })
      );
    }
  });

  it('createConfiguration should call service', async () => {
    const dto = { name: 'New' } as any;
    const result = await controller.createConfiguration({
      dto,
      context: ownerContext,
    });
    expect(service.createConfiguration).toHaveBeenCalledWith(dto, ownerContext);
    expect(result).toEqual(mockConfig);
  });

  it('getConfiguration should call service', async () => {
    const result = await controller.getConfiguration({
      id: '1',
      context: ownerContext,
    });
    expect(service.getConfiguration).toHaveBeenCalledWith('1', ownerContext);
    expect(result).toEqual(mockConfig);
  });

  it('getPublishedConfigurationByDomain should call service', async () => {
    const result = await controller.getPublishedConfigurationByDomain({
      domain: 'test',
    });
    expect(service.getPublishedConfigurationByDomain).toHaveBeenCalledWith(
      'test'
    );
    expect(result).toEqual(mockConfig);
  });

  it('getConfigurationByName should call service', async () => {
    const result = await controller.getConfigurationByName({
      name: 'test',
      context: ownerContext,
    });
    expect(service.getConfigurationByName).toHaveBeenCalledWith(
      'test',
      ownerContext
    );
    expect(result).toEqual(mockConfig);
  });

  it('getAllConfigurations should call service', async () => {
    const result = await controller.getAllConfigurations({
      context: ownerContext,
    });
    expect(service.getAllConfigurations).toHaveBeenCalledWith(ownerContext, {});
    expect(result).toEqual([mockConfig]);
  });

  it('getConfigurationByContext should call the single-context service lookup', async () => {
    const result = await (controller as any).getConfigurationByContext({
      context: ownerContext,
    });

    expect(service.getConfigurationByContext).toHaveBeenCalledWith(
      ownerContext
    );
    expect(result).toEqual(mockConfig);
  });

  it('serializes read denials as structured RPC errors for the Gateway', async () => {
    (service.getAllConfigurations as jest.Mock).mockRejectedValueOnce(
      new NotFoundException('Workspace configuration was not found')
    );

    await expect(
      controller.getAllConfigurations({ context: ownerContext })
    ).rejects.toBeInstanceOf(RpcException);

    try {
      await controller.getAllConfigurations({ context: ownerContext });
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual(
        expect.objectContaining({
          statusCode: 404,
          message: 'Workspace configuration was not found',
        })
      );
    }
  });

  it('updateConfiguration should call service', async () => {
    const dto = { name: 'Updated' } as any;
    const result = await controller.updateConfiguration({
      id: '1',
      dto,
      context: ownerContext,
    });
    expect(service.updateConfiguration).toHaveBeenCalledWith(
      '1',
      dto,
      ownerContext
    );
    expect(result).toEqual(mockConfig);
  });

  it('deleteConfiguration should call service', async () => {
    await controller.deleteConfiguration({ id: '1', context: ownerContext });
    expect(service.deleteConfiguration).toHaveBeenCalledWith('1', ownerContext);
  });

  it('deleteConfiguration should return the service acknowledgement', async () => {
    (service.deleteConfiguration as jest.Mock).mockResolvedValueOnce({
      deleted: true,
    });

    await expect(
      controller.deleteConfiguration({ id: '1', context: ownerContext })
    ).resolves.toEqual({ deleted: true });
  });

  it('deleteConfiguration should preserve a missing row as a structured RPC 404', async () => {
    (service.deleteConfiguration as jest.Mock).mockRejectedValueOnce(
      new NotFoundException('Configuration with ID 1 not found')
    );

    try {
      await controller.deleteConfiguration({ id: '1', context: ownerContext });
      fail('Expected a structured RPC not-found error');
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual(
        expect.objectContaining({ statusCode: 404 })
      );
    }
  });

  it('publishConfiguration should call service', async () => {
    const dto = { releaseNotes: 'Launch ready' } as any;
    const result = await controller.publishConfiguration({
      id: '1',
      dto,
      context: ownerContext,
    });
    expect(service.publishConfiguration).toHaveBeenCalledWith(
      '1',
      dto,
      ownerContext
    );
    expect(result).toEqual(mockConfig);
  });

  it('preserves a stale publish conflict as a structured RPC error', async () => {
    const dto = { releaseNotes: 'Launch ready', expectedRevision: 3 } as any;
    (service.publishConfiguration as jest.Mock).mockRejectedValueOnce(
      new ConflictException('Configuration changed elsewhere')
    );

    try {
      await controller.publishConfiguration({
        id: '1',
        dto,
        context: ownerContext,
      });
      fail('Expected a structured RPC conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual(
        expect.objectContaining({ statusCode: 409 })
      );
    }
  });

  it('rollbackConfiguration should call service', async () => {
    const dto = { version: 1, releaseNotes: 'Rollback' } as any;
    const result = await controller.rollbackConfiguration({
      id: '1',
      dto,
      context: ownerContext,
    });
    expect(service.rollbackConfiguration).toHaveBeenCalledWith(
      '1',
      dto,
      ownerContext
    );
    expect(result).toEqual(mockConfig);
  });
});
