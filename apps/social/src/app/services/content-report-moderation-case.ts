import {
  createModerationCase,
  ModerationCase,
  ModerationReason,
} from '@optimistic-tanuki/models';
import { ContentReport } from '../../entities/content-report.entity';

export function toModerationCase(report: ContentReport): ModerationCase {
  return createModerationCase({
    id: `social:${report.id}`,
    workspaceId: report.workspaceId,
    appScope: report.appScope,
    subject: {
      domain: 'social',
      resourceType: report.contentType,
      resourceId: report.contentId,
      workspaceId: report.workspaceId,
    },
    reporterId: report.reporterId,
    reason: report.reason as ModerationReason,
    evidence: report.description
      ? [{ kind: 'text', value: report.description }]
      : [],
    retention: { deleteAfter: '2027-08-23T00:00:00.000Z' },
    occurredAt: report.createdAt.toISOString(),
  });
}
