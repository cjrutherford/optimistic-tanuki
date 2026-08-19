import { Test, TestingModule } from '@nestjs/testing';
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
          kind: 'business-site',
          slug: 'north-star-coaching',
        })
      ).resolves.toEqual({ workspaceId: 'workspace-1' });
    });
  });
});
