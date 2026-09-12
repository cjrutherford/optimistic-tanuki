import { Logger, NotFoundException } from '@nestjs/common';
import { ConfigurationsService } from './configurations.service';

describe('ConfigurationsService public resolution', () => {
  const snapshot = {
    name: 'Stable v1',
    description: 'Committed release',
    domain: 'stable.example.com',
    landingPage: { sections: [], layout: 'single-column' },
    routes: [],
    features: {},
    theme: {},
    active: true,
  };

  function serviceWith(rows: unknown[]) {
    const repository = {
      find: jest.fn().mockResolvedValue(rows),
      findOne: jest.fn(),
    };
    return {
      service: new ConfigurationsService(
        repository as any,
        {} as any,
        {} as any,
        { log: jest.fn(), warn: jest.fn() } as unknown as Logger
      ),
      repository,
    };
  }

  it('resolves the committed snapshot even when the editable domain and active flag change', async () => {
    const { service, repository } = serviceWith([
      {
        id: '66666666-6666-4666-8666-666666666666',
        // These are draft fields and must not control public resolution.
        domain: 'new.example.com',
        active: false,
        release: {
          status: 'changes-pending',
          publishedVersion: 1,
          publishedSnapshot: snapshot,
          history: [{ version: 1, action: 'publish', snapshot }],
        },
      },
    ]);

    await expect(
      service.getPublishedConfigurationByDomain('stable.example.com')
    ).resolves.toEqual(
      expect.objectContaining({
        name: 'Stable v1',
        domain: 'stable.example.com',
        publishedVersion: 1,
      })
    );
    await expect(
      service.getPublishedConfigurationByDomain('new.example.com')
    ).rejects.toThrow(NotFoundException);
    expect(repository.find).toHaveBeenCalledWith();
  });

  it('treats an unconfirmed snapshot without a matching history entry as absent', async () => {
    const { service } = serviceWith([
      {
        id: '66666666-6666-4666-8666-666666666666',
        domain: 'stable.example.com',
        active: true,
        release: {
          status: 'published',
          publishedVersion: 1,
          publishedSnapshot: snapshot,
          history: [],
        },
      },
    ]);

    await expect(
      service.getPublishedConfigurationByDomain('stable.example.com')
    ).rejects.toThrow(NotFoundException);
  });

  it('fails closed when legacy data contains duplicate confirmed domain claims', async () => {
    const { service } = serviceWith([
      {
        id: '66666666-6666-4666-8666-666666666666',
        release: {
          status: 'published',
          publishedVersion: 1,
          publishedSnapshot: snapshot,
          history: [
            { version: 1, action: 'publish', releaseNotes: 'A', snapshot },
          ],
        },
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        release: {
          status: 'published',
          publishedVersion: 1,
          publishedSnapshot: snapshot,
          history: [
            { version: 1, action: 'publish', releaseNotes: 'B', snapshot },
          ],
        },
      },
    ]);

    await expect(
      service.getPublishedConfigurationByDomain('stable.example.com')
    ).rejects.toThrow(NotFoundException);
  });

  it('normalizes committed and requested domains consistently', async () => {
    const committed = { ...snapshot, domain: 'Stable.Example.com.' };
    const { service } = serviceWith([
      {
        id: '66666666-6666-4666-8666-666666666666',
        release: {
          status: 'published',
          publishedVersion: 1,
          publishedSnapshot: committed,
          history: [
            {
              version: 1,
              action: 'publish',
              releaseNotes: 'A',
              snapshot: committed,
            },
          ],
        },
      },
    ]);

    await expect(
      service.getPublishedConfigurationByDomain('  stable.example.com  ')
    ).resolves.toEqual(
      expect.objectContaining({
        domain: 'Stable.Example.com.',
        publishedVersion: 1,
      })
    );
  });

  it.each(['joinable', 'request-only', 'private'] as const)(
    'does not resolve a %s snapshot through the anonymous domain path',
    async (accessPolicy) => {
      const { service } = serviceWith([
        {
          id: '66666666-6666-4666-8666-666666666666',
          release: {
            status: 'published',
            publishedVersion: 1,
            publishedSnapshot: { ...snapshot, accessPolicy },
            history: [
              {
                version: 1,
                action: 'publish',
                snapshot: { ...snapshot, accessPolicy },
              },
            ],
          },
        },
      ]);

      await expect(
        service.getPublishedConfigurationByDomain('stable.example.com')
      ).rejects.toThrow(NotFoundException);
    }
  );

  it('does not return an internal context for a non-public domain', async () => {
    const { service } = serviceWith([
      {
        id: '66666666-6666-4666-8666-666666666666',
        workspaceId: '77777777-7777-4777-8777-777777777777',
        appScope: 'configurable-client',
        release: {
          status: 'published',
          publishedVersion: 1,
          publishedSnapshot: { ...snapshot, accessPolicy: 'private' },
          history: [
            {
              version: 1,
              action: 'publish',
              snapshot: { ...snapshot, accessPolicy: 'private' },
            },
          ],
        },
      },
    ]);

    await expect(
      service.getPublishedConfigurationContextByDomain('stable.example.com')
    ).rejects.toThrow(NotFoundException);
  });
});
