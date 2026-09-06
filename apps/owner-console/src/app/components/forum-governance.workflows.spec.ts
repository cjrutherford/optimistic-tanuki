import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';
import {
  ThreadDto,
  TopicDto,
  ForumPostDto,
} from '@optimistic-tanuki/ui-models';

import { ForumGovernanceComponent } from './forum-governance.component';
import { ForumModerationReport, ForumService } from '../services/forum.service';

const topics = () =>
  [
    {
      id: 'topic-1',
      title: 'Introductions',
      visibility: 'public',
      isPinned: false,
      isLocked: false,
    },
    {
      id: 'topic-2',
      title: 'Rules',
      visibility: 'private',
      isPinned: true,
      isLocked: true,
    },
  ] as TopicDto[];

const threads = () =>
  [
    {
      id: 'thread-1',
      title: 'Welcome',
      topicId: 'topic-1',
      visibility: 'public',
      isPinned: false,
      isLocked: false,
    },
    {
      id: 'thread-2',
      title: 'Locked',
      topicId: 'topic-1',
      visibility: 'private',
      isPinned: true,
      isLocked: true,
    },
  ] as ThreadDto[];

const posts = () =>
  [
    { id: 'post-1', threadId: 'thread-1', content: 'Flagged' },
  ] as ForumPostDto[];

const reports = (): ForumModerationReport[] =>
  [
    {
      id: 'report-1',
      reporterId: 'profile-2',
      contentType: 'post',
      contentId: 'post-1',
      reason: 'harassment',
      status: 'pending',
      adminNotes: '',
      createdAt: new Date(),
    },
    {
      id: 'report-2',
      reporterId: 'profile-3',
      contentType: 'thread',
      contentId: 'thread-1',
      reason: 'spam',
      status: 'reviewed',
      createdAt: new Date(),
    },
  ] as ForumModerationReport[];

describe('ForumGovernanceComponent workflows', () => {
  const forumService = {
    getTopics: jest.fn(),
    getThreads: jest.fn(),
    getPosts: jest.fn(),
    getReports: jest.fn(),
    updateTopic: jest.fn(),
    updateThread: jest.fn(),
    updateReport: jest.fn(),
    moderateThread: jest.fn(),
    moderatePost: jest.fn(),
  };

  let queryParams: Record<string, string>;

  beforeEach(async () => {
    jest.clearAllMocks();
    queryParams = {};

    forumService.getTopics.mockReturnValue(of(topics()));
    forumService.getThreads.mockReturnValue(of(threads()));
    forumService.getPosts.mockReturnValue(of(posts()));
    forumService.getReports.mockReturnValue(of(reports()));
    forumService.updateTopic.mockReturnValue(of({ id: 'topic-1' }));
    forumService.updateThread.mockReturnValue(of({ id: 'thread-1' }));
    forumService.updateReport.mockImplementation((id: string, dto: never) =>
      of({ ...reports()[0], id, ...(dto as object) })
    );
    forumService.moderateThread.mockReturnValue(of({ id: 'thread-1' }));
    forumService.moderatePost.mockReturnValue(of({ id: 'post-1' }));

    await TestBed.configureTestingModule({
      imports: [ForumGovernanceComponent, RouterTestingModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: {
                get: (key: string) => queryParams[key] ?? null,
              },
            },
          },
        },
        { provide: ForumService, useValue: forumService },
      ],
    }).compileComponents();
  });

  const create = () => {
    const fixture = TestBed.createComponent(ForumGovernanceComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  describe('handoff context', () => {
    it('is empty when the operator did not arrive from community ops', () => {
      const component = create();

      expect(component.handoffContext).toBeNull();
    });

    it('fills unknown handoff fields with defaults', () => {
      queryParams = { source: 'community-ops' };

      const component = create();

      expect(component.handoffContext).toEqual({
        source: 'community-ops',
        entityType: 'entity',
        entityId: '',
        communityId: '',
        communityName: 'Unknown community',
        entityTitle: 'Unknown entity',
      });
    });
  });

  describe('counters', () => {
    it('counts locked and private topics and threads plus pending reports', () => {
      const component = create();

      expect(component.lockedTopicCount).toBe(1);
      expect(component.privateTopicCount).toBe(1);
      expect(component.lockedThreadCount).toBe(1);
      expect(component.privateThreadCount).toBe(1);
      expect(component.pendingReportCount).toBe(1);
    });
  });

  describe('load failures', () => {
    it.each([
      ['getTopics', 'Failed to load forum topics'],
      ['getThreads', 'Failed to load forum threads'],
      ['getPosts', 'Failed to load forum posts'],
      ['getReports', 'Failed to load forum reports'],
    ])('reports a %s failure', (method, message) => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      (forumService as Record<string, jest.Mock>)[method].mockReturnValue(
        throwError(() => new Error('boom'))
      );

      const component = create();

      expect(component.error).toBe(message);
    });
  });

  describe('topic moderation', () => {
    it('toggles the pinned flag', () => {
      const component = create();
      const topic = component.topics[0];

      component.toggleTopicPinned(topic);

      expect(forumService.updateTopic).toHaveBeenCalledWith('topic-1', {
        isPinned: true,
      });
      expect(topic.isPinned).toBe(true);
    });

    it('changes visibility only when it actually differs', () => {
      const component = create();
      const topic = component.topics[0];

      component.setTopicVisibility(topic, 'public');
      expect(forumService.updateTopic).not.toHaveBeenCalled();

      component.setTopicVisibility(topic, 'private');
      expect(forumService.updateTopic).toHaveBeenCalledWith('topic-1', {
        visibility: 'private',
      });
      expect(topic.visibility).toBe('private');
    });
  });

  describe('thread moderation', () => {
    it('toggles lock and pinned flags', () => {
      const component = create();
      const thread = component.threads[0];

      component.toggleThreadLock(thread);
      expect(forumService.updateThread).toHaveBeenCalledWith('thread-1', {
        isLocked: true,
      });
      expect(thread.isLocked).toBe(true);

      component.toggleThreadPinned(thread);
      expect(forumService.updateThread).toHaveBeenCalledWith('thread-1', {
        isPinned: true,
      });
      expect(thread.isPinned).toBe(true);
    });

    it('changes visibility only when it actually differs', () => {
      const component = create();
      const thread = component.threads[1];

      component.setThreadVisibility(thread, 'private');
      expect(forumService.updateThread).not.toHaveBeenCalled();

      component.setThreadVisibility(thread, 'public');
      expect(thread.visibility).toBe('public');
    });
  });

  describe('report drafts', () => {
    it('seeds a draft for every loaded report', () => {
      const component = create();

      expect(component.getReportDraft(component.reports[0])).toEqual({
        status: 'pending',
        adminNotes: '',
      });
      expect(component.getReportDraft(component.reports[1])).toEqual({
        status: 'reviewed',
        adminNotes: '',
      });
    });

    it('falls back to the report itself for an unseeded draft', () => {
      const component = create();

      const orphan = {
        id: 'report-99',
        status: 'dismissed',
        adminNotes: 'Old note',
      } as ForumModerationReport;

      expect(component.getReportDraft(orphan)).toEqual({
        status: 'dismissed',
        adminNotes: 'Old note',
      });
    });

    it('patches a single draft field, creating the draft if needed', () => {
      const component = create();

      component.updateReportDraft('report-1', 'adminNotes', 'Triaged');
      expect(component.getReportDraft(component.reports[0])).toEqual({
        status: 'pending',
        adminNotes: 'Triaged',
      });

      component.updateReportDraft('report-new', 'status', 'actioned');
      expect(component.reportDrafts['report-new']).toEqual({
        status: 'actioned',
        adminNotes: '',
      });
    });

    it('saves the draft back onto the report list', () => {
      const component = create();

      component.updateReportDraft('report-1', 'status', 'reviewed');
      component.updateReportDraft('report-1', 'adminNotes', 'Triaged');
      component.saveReport(component.reports[0]);

      expect(forumService.updateReport).toHaveBeenCalledWith('report-1', {
        status: 'reviewed',
        adminNotes: 'Triaged',
      });
      expect(component.reports[0].status).toBe('reviewed');
      expect(component.reportDrafts['report-1'].adminNotes).toBe('Triaged');
    });

    it('reports a save failure', () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      forumService.updateReport.mockReturnValue(
        throwError(() => new Error('boom'))
      );
      const component = create();

      component.saveReport(component.reports[0]);

      expect(component.error).toBe('Failed to update forum report');
    });
  });

  describe('lookups', () => {
    it('finds threads and posts by id', () => {
      const component = create();

      expect(component.findThread('thread-1')?.title).toBe('Welcome');
      expect(component.findThread('missing')).toBeUndefined();
      expect(component.findPost('post-1')?.id).toBe('post-1');
      expect(component.findPost('missing')).toBeUndefined();
    });

    it('defaults an unset moderation status to visible', () => {
      const component = create();

      expect(component.getModerationStatus({})).toBe('visible');
      expect(
        component.getModerationStatus({ moderationStatus: 'hidden' })
      ).toBe('hidden');
    });
  });

  describe('direct content moderation', () => {
    it('ignores a missing thread or post', () => {
      const component = create();

      component.applyThreadModeration(undefined, 'hidden');
      component.applyPostModeration(undefined, 'hidden');

      expect(forumService.moderateThread).not.toHaveBeenCalled();
      expect(forumService.moderatePost).not.toHaveBeenCalled();
    });

    it('hides a thread without a linked report', () => {
      const component = create();
      const thread = component.threads[0];

      component.applyThreadModeration(thread, 'hidden');

      expect(forumService.moderateThread).toHaveBeenCalledWith('thread-1', {
        moderationStatus: 'hidden',
        adminNotes: undefined,
      });
      expect(component.getModerationStatus(thread)).toBe('hidden');
      expect(forumService.updateReport).not.toHaveBeenCalled();
    });

    it('actions the linked report after hiding a thread', () => {
      const component = create();

      component.updateReportDraft('report-2', 'adminNotes', 'Spam removed');
      component.applyThreadModeration(
        component.threads[0],
        'hidden',
        component.reports[1]
      );

      expect(forumService.moderateThread).toHaveBeenCalledWith('thread-1', {
        moderationStatus: 'hidden',
        adminNotes: 'Spam removed',
      });
      expect(forumService.updateReport).toHaveBeenCalledWith('report-2', {
        status: 'actioned',
        adminNotes: 'Spam removed',
      });
    });

    it('reports a thread moderation failure', () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      forumService.moderateThread.mockReturnValue(
        throwError(() => new Error('boom'))
      );
      const component = create();

      component.applyThreadModeration(component.threads[0], 'hidden');

      expect(component.error).toBe('Failed to moderate forum thread');
    });

    it('hides a post and actions the linked report', () => {
      const component = create();

      component.updateReportDraft('report-1', 'adminNotes', 'Removed');
      component.applyPostModeration(
        component.posts[0],
        'hidden',
        component.reports[0]
      );

      expect(forumService.moderatePost).toHaveBeenCalledWith('post-1', {
        moderationStatus: 'hidden',
        adminNotes: 'Removed',
      });
      expect(forumService.updateReport).toHaveBeenCalledWith('report-1', {
        status: 'actioned',
        adminNotes: 'Removed',
      });
    });

    it('reports a post moderation failure', () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      forumService.moderatePost.mockReturnValue(
        throwError(() => new Error('boom'))
      );
      const component = create();

      component.applyPostModeration(component.posts[0], 'hidden');

      expect(component.error).toBe('Failed to moderate forum post');
    });
  });

  describe('moderation driven from a report', () => {
    it('moderates the reported thread and actions the report', () => {
      const component = create();

      component.applyReportContentModeration(component.reports[1], 'hidden');

      expect(forumService.moderateThread).toHaveBeenCalledWith('thread-1', {
        moderationStatus: 'hidden',
        adminNotes: '',
      });
      expect(component.getModerationStatus(component.threads[0])).toBe(
        'hidden'
      );
      expect(forumService.updateReport).toHaveBeenCalledWith('report-2', {
        status: 'actioned',
        adminNotes: '',
      });
    });

    it('still actions the report when the reported thread is not loaded', () => {
      const component = create();

      component.applyReportContentModeration(
        { ...component.reports[1], contentId: 'thread-missing' },
        'hidden'
      );

      expect(forumService.moderateThread).toHaveBeenCalledWith(
        'thread-missing',
        expect.anything()
      );
      expect(forumService.updateReport).toHaveBeenCalled();
    });

    it('reports a thread moderation failure from the report path', () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      forumService.moderateThread.mockReturnValue(
        throwError(() => new Error('boom'))
      );
      const component = create();

      component.applyReportContentModeration(component.reports[1], 'hidden');

      expect(component.error).toBe('Failed to moderate forum thread');
    });

    it('moderates the reported post and actions the report', () => {
      const component = create();

      component.applyReportContentModeration(component.reports[0], 'hidden');

      expect(forumService.moderatePost).toHaveBeenCalledWith('post-1', {
        moderationStatus: 'hidden',
        adminNotes: '',
      });
      expect(component.getModerationStatus(component.posts[0])).toBe('hidden');
      expect(forumService.updateReport).toHaveBeenCalledWith('report-1', {
        status: 'actioned',
        adminNotes: '',
      });
    });

    it('still actions the report when the reported post is not loaded', () => {
      const component = create();

      component.applyReportContentModeration(
        { ...component.reports[0], contentId: 'post-missing' },
        'hidden'
      );

      expect(forumService.updateReport).toHaveBeenCalled();
    });

    it('reports a post moderation failure from the report path', () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      forumService.moderatePost.mockReturnValue(
        throwError(() => new Error('boom'))
      );
      const component = create();

      component.applyReportContentModeration(component.reports[0], 'hidden');

      expect(component.error).toBe('Failed to moderate forum post');
    });

    it('reports a failure to finalise the report after moderation', () => {
      jest.spyOn(console, 'error').mockImplementation(() => undefined);
      forumService.updateReport.mockReturnValue(
        throwError(() => new Error('boom'))
      );
      const component = create();

      component.applyReportContentModeration(component.reports[0], 'hidden');

      expect(component.error).toBe('Failed to update forum report');
    });
  });
});
