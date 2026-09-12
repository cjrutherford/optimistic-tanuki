import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { AppController } from './app.controller';
import { WorkspaceService } from './services/workspace.service';

describe('AppController', () => {
  let app: TestingModule;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: WorkspaceService,
          useValue: {
            resolve: jest
              .fn()
              .mockResolvedValue({ workspaceId: 'workspace-1' }),
            listOwned: jest
              .fn()
              .mockResolvedValue([{ workspaceId: 'workspace-1' }]),
            resolveOwned: jest
              .fn()
              .mockResolvedValue({ workspaceId: 'workspace-1' }),
          },
        },
      ],
    }).compile();
  });

  describe('resolve', () => {
    it('delegates canonical identity resolution to WorkspaceService', async () => {
      const appController = app.get<AppController>(AppController);
      await expect(
        appController.resolve({
          appScope: 'business-site',
          kind: 'business-site',
          slug: 'north-star-coaching',
        })
      ).resolves.toEqual({ workspaceId: 'workspace-1' });
    });
  });

  it('delegates owner-filtered discovery and lookup to WorkspaceService', async () => {
    const appController = app.get<AppController>(AppController);
    const owner = { ownerUserId: 'user-1', ownerProfileId: 'profile-1' };

    await expect(appController.listOwned(owner)).resolves.toEqual([
      { workspaceId: 'workspace-1' },
    ]);
    await expect(
      appController.resolveOwned({ ...owner, workspaceId: 'workspace-1' })
    ).resolves.toEqual({ workspaceId: 'workspace-1' });
  });

  it('serializes malformed owned selectors as structured RPC bad requests', async () => {
    const appController = app.get<AppController>(AppController);
    const service = app.get<WorkspaceService>(WorkspaceService);
    service.resolveOwned = jest
      .fn()
      .mockRejectedValue(
        new BadRequestException('Workspace ID must be a valid UUID')
      );

    try {
      await appController.resolveOwned({
        workspaceId: 'p43-a',
        ownerUserId: 'owner-1',
        ownerProfileId: 'profile-1',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual(
        expect.objectContaining({
          statusCode: 400,
          message: 'Workspace ID must be a valid UUID',
        })
      );
    }
  });

  it('serializes a foreign owned workspace as structured RPC not-found', async () => {
    const appController = app.get<AppController>(AppController);
    const service = app.get<WorkspaceService>(WorkspaceService);
    service.resolveOwned = jest
      .fn()
      .mockRejectedValue(new NotFoundException('Workspace was not found'));

    try {
      await appController.resolveOwned({
        workspaceId: '123e4567-e89b-12d3-a456-426614174001',
        ownerUserId: 'owner-1',
        ownerProfileId: 'profile-1',
      });
      fail('Expected a structured RPC not-found error');
    } catch (error) {
      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual(
        expect.objectContaining({
          statusCode: 404,
          message: 'Workspace was not found',
        })
      );
    }
  });
});
