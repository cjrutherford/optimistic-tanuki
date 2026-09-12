import {
  ContentReport,
  ReportReason,
} from '../../entities/content-report.entity';
import { toModerationCase } from './content-report-moderation-case';

describe('Social content report moderation adapter', () => {
  it('maps an app-scoped pending report into the shared open-case vocabulary', () => {
    const moderationCase = toModerationCase({
      id: 'report-1',
      reporterId: 'profile-reporter',
      contentType: 'post',
      contentId: 'post-1',
      reason: ReportReason.HARASSMENT,
      description: 'Targeted harassment.',
      status: 'pending',
      appScope: 'social',
      workspaceId: null,
      createdAt: new Date('2026-08-23T00:00:00.000Z'),
    } as ContentReport);

    expect(moderationCase).toMatchObject({
      id: 'social:report-1',
      appScope: 'social',
      workspaceId: null,
      status: 'open',
      subject: { domain: 'social', resourceType: 'post', resourceId: 'post-1' },
    });
  });
});
