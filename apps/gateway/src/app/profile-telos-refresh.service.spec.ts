import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  ProfileCommands,
  ProfileTelosCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import { ProfileTelosRefreshService } from './profile-telos-refresh.service';

describe('ProfileTelosRefreshService', () => {
  let service: ProfileTelosRefreshService;
  let profileClient: jest.Mocked<ClientProxy>;
  let telosDocsClient: jest.Mocked<ClientProxy>;
  const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(async () => {
    profileClient = {
      send: jest.fn().mockReturnValue(
        of({
          id: 'profile-1',
          profileName: 'Avery',
          appScope: 'global',
          interests: 'planning,design',
          skills: 'writing,strategy',
        })
      ),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    telosDocsClient = {
      send: jest.fn().mockReturnValue(of({})),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileTelosRefreshService,
        {
          provide: ServiceTokens.PROFILE_SERVICE,
          useValue: profileClient,
        },
        {
          provide: ServiceTokens.TELOS_DOCS_SERVICE,
          useValue: telosDocsClient,
        },
      ],
    }).compile();

    service = module.get(ProfileTelosRefreshService);
  });

  it('coalesces queued source refreshes for the same namespace and profile', async () => {
    const sourceClient = {
      send: jest
        .fn()
        .mockReturnValueOnce(
          of([
            {
              sourceType: 'social:summary',
              sourceId: 'profile-1',
              content: 'first',
            },
          ])
        )
        .mockReturnValueOnce(
          of([
            {
              sourceType: 'social:summary',
              sourceId: 'profile-1',
              content: 'second',
            },
          ])
        ),
    } as unknown as ClientProxy;

    service.queueSourceRefresh({
      profileId: 'profile-1',
      namespaceKey: 'social',
      sourceClient,
      sourceCommand: 'social-get-profile-facts',
      logContext: 'social profile-1',
    });
    service.queueSourceRefresh({
      profileId: 'profile-1',
      namespaceKey: 'social',
      sourceClient,
      sourceCommand: 'social-get-profile-facts',
      logContext: 'social profile-1',
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    await flushPromises();

    expect((sourceClient.send as jest.Mock).mock.calls).toHaveLength(1);
    expect(telosDocsClient.send).toHaveBeenCalledWith(
      { cmd: ProfileTelosCommands.UPSERT_SOURCE },
      expect.objectContaining({
        profileId: 'profile-1',
        facts: expect.any(Array),
      })
    );
  });
});
