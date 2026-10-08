import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  PostCommands,
  CommentCommands,
  PrivacyCommands,
  ClassifiedCommands,
  ProfileCommands,
  WorkspaceCommands,
} from '@optimistic-tanuki/constants';
import { PrivacyController } from './privacy.controller';
import {
  PERMISSION_TARGET_KEY,
  PERMISSIONS_KEY,
} from '../../../decorators/permissions.decorator';
import { WORKSPACE_CONTEXT_KEY } from '../../../decorators/workspace-context.decorator';

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

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND },
      { id: 'post-1', viewerProfileId: 'reporter-profile-1' }
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

  it('forwards the reporter on both reads when reporting a comment', async () => {
    const socialClient = {
      send: jest.fn((pattern: any) =>
        of(
          pattern.cmd === CommentCommands.FIND
            ? { postId: 'post-1' }
            : { id: 'post-1' }
        )
      ),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      {}
    ) as PrivacyController;
    await controller.reportContent(
      { contentType: 'comment', contentId: 'comment-1', reason: 'spam' },
      { profileId: 'reporter-profile-1' } as any,
      'social'
    );
    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: CommentCommands.FIND },
      { id: 'comment-1', viewerProfileId: 'reporter-profile-1' }
    );
    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: PostCommands.FIND },
      { id: 'post-1', viewerProfileId: 'reporter-profile-1' }
    );
  });

  it('keeps app-scoped profile reports unscoped', async () => {
    const socialClient = {
      send: jest.fn(() => of({ id: 'report-1' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest.fn(),
    } as unknown as jest.Mocked<ClientProxy>;
    const profileClient = {
      send: jest.fn(() => of({ id: 'profile-2' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      workspaceClient,
      undefined,
      undefined,
      profileClient
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
    expect(profileClient.send).toHaveBeenCalledWith(
      { cmd: ProfileCommands.Get },
      { id: 'profile-2' }
    );
    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: PrivacyCommands.REPORT_CONTENT },
      expect.objectContaining({ appScope: 'social', workspaceId: null })
    );
  });

  it('verifies a Local Hub listing in app scope before accepting a listing report', async () => {
    const socialClient = {
      send: jest.fn(() => of({ id: 'report-1' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const classifiedsClient = {
      send: jest.fn(() => of({ id: 'ad-1', appScope: 'local-hub' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      {},
      undefined,
      classifiedsClient
    ) as PrivacyController;

    await controller.reportContent(
      { contentType: 'classified', contentId: 'ad-1', reason: 'spam' },
      { profileId: 'reporter-1' } as any,
      'local-hub'
    );

    expect(classifiedsClient.send).toHaveBeenCalledWith(
      { cmd: ClassifiedCommands.FIND_BY_ID },
      { id: 'ad-1', appScope: 'local-hub' }
    );
    expect(socialClient.send).toHaveBeenLastCalledWith(
      { cmd: PrivacyCommands.REPORT_CONTENT },
      expect.objectContaining({
        reporterId: 'reporter-1',
        contentType: 'classified',
        workspaceId: null,
        appScope: 'local-hub',
      })
    );
  });

  it('rejects malformed report targets and unsupported reasons before any lookup', async () => {
    const socialClient = {
      send: jest.fn(() => of({})),
    } as unknown as jest.Mocked<ClientProxy>;
    const workspaceClient = {
      send: jest.fn(() => of({})),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      workspaceClient
    ) as PrivacyController;

    await expect(
      controller.reportContent(
        { contentType: 'post', contentId: ' ', reason: 'spam' },
        { profileId: 'reporter-1' } as any,
        'client-interface'
      )
    ).rejects.toThrow('Invalid content report request.');
    await expect(
      controller.reportContent(
        { contentType: 'post', contentId: 'post-1', reason: 'forged' },
        { profileId: 'reporter-1' } as any,
        'client-interface'
      )
    ).rejects.toThrow('Invalid content report request.');
    expect(socialClient.send).not.toHaveBeenCalled();
    expect(workspaceClient.send).not.toHaveBeenCalled();
  });

  it('rejects message reports until the conversation and message are verified', async () => {
    const socialClient = {
      send: jest.fn(() => of({ id: 'report-1' })),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      {}
    ) as PrivacyController;

    await expect(
      controller.reportContent(
        {
          contentType: 'message',
          contentId: 'forged-message-id',
          reason: 'harassment',
        },
        { profileId: 'reporter-profile-1' } as any,
        'client-interface'
      )
    ).rejects.toThrow('Message reports are unavailable');
    expect(socialClient.send).not.toHaveBeenCalled();
  });

  it('invalidates connected social feeds after mute and unmute changes', async () => {
    const socialClient = {
      send: jest.fn(() => of({ success: true })),
    } as unknown as jest.Mocked<ClientProxy>;
    const broadcastSocialContentInvalidated = jest.fn();
    const controller = new (PrivacyController as any)(
      socialClient,
      {},
      { broadcastSocialContentInvalidated }
    ) as PrivacyController;

    await controller.muteUser({ mutedId: 'muted-profile', duration: 60 }, {
      profileId: 'muter-profile',
    } as any);
    expect(socialClient.send).toHaveBeenLastCalledWith(
      { cmd: PrivacyCommands.MUTE_USER },
      { muterId: 'muter-profile', mutedId: 'muted-profile', duration: 60 }
    );
    expect(broadcastSocialContentInvalidated).toHaveBeenCalledTimes(1);
    await controller.unmuteUser('muted-profile', {
      profileId: 'muter-profile',
    } as any);
    expect(socialClient.send).toHaveBeenLastCalledWith(
      { cmd: PrivacyCommands.UNMUTE_USER },
      { muterId: 'muter-profile', mutedId: 'muted-profile' }
    );
    expect(broadcastSocialContentInvalidated).toHaveBeenCalledTimes(2);
  });

  it('does not broadcast feed invalidation when a mute RPC fails', async () => {
    const socialClient = {
      send: jest.fn(() => {
        throw new Error('social service unavailable');
      }),
    } as unknown as jest.Mocked<ClientProxy>;
    const broadcastSocialContentInvalidated = jest.fn();
    const controller = new (PrivacyController as any)(
      socialClient,
      {},
      { broadcastSocialContentInvalidated }
    ) as PrivacyController;

    await expect(
      controller.muteUser({ mutedId: 'muted-profile' }, {
        profileId: 'muter-profile',
      } as any)
    ).rejects.toThrow('social service unavailable');
    expect(broadcastSocialContentInvalidated).not.toHaveBeenCalled();
  });

  it('forwards the resolved workspace when a moderator lists reports', async () => {
    const socialClient = {
      send: jest.fn(() => of([])),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      {}
    ) as PrivacyController;

    await (controller as any).getAllReports(
      { workspaceContext: { workspace: { workspaceId: 'workspace-1' } } },
      'client-interface'
    );

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: PrivacyCommands.GET_ALL_REPORTS },
      { workspaceId: 'workspace-1', appScope: 'client-interface' }
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
        { workspaceContext: { workspace: { workspaceId: 'workspace-1' } } },
        { profileId: 'moderator-1' },
        'client-interface'
      )
    ).rejects.toThrow('Content report was not found in this workspace.');
  });

  it('requires a community-scoped moderator permission and binds the report, actor, and workspace', async () => {
    const socialClient = {
      send: jest.fn(() => of({ success: true })),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      {}
    ) as PrivacyController;

    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PrivacyController.prototype.moderateContent
      )
    ).toEqual({ permissions: ['community.manage'] });
    expect(
      Reflect.getMetadata(
        PERMISSION_TARGET_KEY,
        PrivacyController.prototype.moderateContent
      )
    ).toEqual({ source: 'query', path: 'communityId' });
    expect(
      Reflect.getMetadata(
        WORKSPACE_CONTEXT_KEY,
        PrivacyController.prototype.moderateContent
      )
    ).toEqual(
      expect.objectContaining({
        kind: 'community',
        source: 'query',
        path: 'communityId',
        strict: true,
      })
    );

    await (controller as any).moderateContent(
      {
        reportId: 'report-1',
        contentType: 'post',
        contentId: 'post-1',
        moderationStatus: 'hidden',
        adminNotes: 'Reviewed',
      },
      { profileId: 'moderator-1' },
      { workspaceContext: { workspace: { workspaceId: 'workspace-1' } } },
      'client-interface'
    );

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: PrivacyCommands.MODERATE_CONTENT },
      expect.objectContaining({
        reportId: 'report-1',
        appScope: 'client-interface',
        workspaceId: 'workspace-1',
        moderatedBy: 'moderator-1',
      })
    );
  });

  it('rejects unknown report and moderation statuses before forwarding', async () => {
    const socialClient = {
      send: jest.fn(() => of({})),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      {}
    ) as PrivacyController;

    await expect(
      (controller as any).updateReportStatus(
        'report-1',
        { status: 'concealed' },
        { workspaceContext: { workspace: { workspaceId: 'workspace-1' } } },
        { profileId: 'moderator-1' },
        'client-interface'
      )
    ).rejects.toThrow('Unsupported report status.');
    await expect(
      (controller as any).moderateContent(
        {
          reportId: 'report-1',
          contentType: 'post',
          contentId: 'post-1',
          moderationStatus: 'concealed',
        },
        { profileId: 'moderator-1' },
        { workspaceContext: { workspace: { workspaceId: 'workspace-1' } } },
        'client-interface'
      )
    ).rejects.toThrow('Unsupported content moderation request.');
    expect(socialClient.send).not.toHaveBeenCalled();
  });

  it('provides an app-scoped operator review path for workspace-free reports', async () => {
    const socialClient = {
      send: jest.fn(() => of([{ id: 'report-1' }])),
    } as unknown as jest.Mocked<ClientProxy>;
    const controller = new (PrivacyController as any)(
      socialClient,
      {}
    ) as PrivacyController;

    await expect(
      (controller as any).getOperatorReports('local-hub')
    ).resolves.toEqual([{ id: 'report-1' }]);
    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: PrivacyCommands.GET_ALL_REPORTS },
      { appScope: 'local-hub' }
    );
    expect(
      Reflect.getMetadata(
        PERMISSIONS_KEY,
        PrivacyController.prototype.getOperatorReports
      )
    ).toEqual({ permissions: ['content.report.review'] });
    await expect(
      (controller as any).getOperatorReports('client-interface')
    ).resolves.toEqual([{ id: 'report-1' }]);
    expect(socialClient.send).toHaveBeenLastCalledWith(
      { cmd: PrivacyCommands.GET_ALL_REPORTS },
      { appScope: 'client-interface' }
    );
  });
});
