import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  PostCommands,
  PrivacyCommands,
  WorkspaceCommands,
} from '@optimistic-tanuki/constants';
import { PrivacyController } from './privacy.controller';
import { PERMISSION_TARGET_KEY } from '../../../decorators/permissions.decorator';

describe('PrivacyController report workspace scope', () => {
  it('uses the selected community as the moderator decision permission target', () => {
    expect(
      Reflect.getMetadata(
        PERMISSION_TARGET_KEY,
        PrivacyController.prototype.updateReportStatus
      )
    ).toEqual({ source: 'query', path: 'communityId' });
  });

  it('derives a community post report workspace from the authoritative target', async () => {
    const socialClient = {
      send: jest.fn((pattern: any) => {
        if (pattern?.cmd === PostCommands.FIND) {
          return of({ id: 'post-1', communityId: 'community-1' });
        }

        return of({ id: 'report-1' });
      }),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest.fn(() => of({ workspaceId: 'workspace-1' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      workspaceClient
    ) as PrivacyController;

    await controller.reportContent(
      {
        contentType: 'post',
        contentId: 'post-1',
        reason: 'spam',
      },
      { profileId: 'reporter-profile-1' } as any,
      'client-interface'
    );

    expect(workspaceClient.send).toHaveBeenCalledWith(
      WorkspaceCommands.RESOLVE_BY_SOURCE,
      {
        appScope: 'client-interface',
        source: { service: 'social', sourceId: 'community-1' },
        requireActive: true,
      }
    );
    expect(socialClient.send).toHaveBeenLastCalledWith(
      { cmd: PrivacyCommands.REPORT_CONTENT },
      expect.objectContaining({
        appScope: 'client-interface',
        workspaceId: 'workspace-1',
      })
    );
  });

  it('keeps app-scoped profile reports unscoped', async () => {
    const socialClient = {
      send: jest.fn(() => of({ id: 'report-1' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      workspaceClient
    ) as PrivacyController;

    await controller.reportContent(
      {
        contentType: 'profile',
        contentId: 'profile-2',
        reason: 'spam',
      },
      { profileId: 'reporter-profile-1' } as any,
      'social'
    );

    expect(workspaceClient.send).not.toHaveBeenCalled();
    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: PrivacyCommands.REPORT_CONTENT },
      expect.objectContaining({ appScope: 'social', workspaceId: null })
    );
  });

  it('forwards the resolved workspace when a moderator lists reports', async () => {
    const socialClient = {
      send: jest.fn(() => of([])),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      {}
    ) as PrivacyController;

    await (controller as any).getAllReports({
      workspaceContext: { workspace: { workspaceId: 'workspace-1' } },
    });

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: PrivacyCommands.GET_ALL_REPORTS },
      { workspaceId: 'workspace-1' }
    );
  });

  it('does not expose a missing report outside the resolved workspace', async () => {
    const socialClient = {
      send: jest.fn(() => of(null)),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      {}
    ) as PrivacyController;

    await expect(
      (controller as any).updateReportStatus(
        'report-other-workspace',
        { status: 'reviewed' },
        { workspaceContext: { workspace: { workspaceId: 'workspace-1' } } }
      )
    ).rejects.toThrow('Content report was not found in this workspace.');
  });
});
