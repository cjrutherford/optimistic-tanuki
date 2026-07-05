import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { ForumGovernanceComponent } from './forum-governance.component';
import { ForumService } from '../services/forum.service';

describe('ForumGovernanceComponent', () => {
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

  beforeEach(async () => {
    jest.clearAllMocks();
    forumService.getTopics.mockReturnValue(
      of([
        {
          id: 'topic-1',
          title: 'Introductions',
          description: 'Start here',
          userId: 'user-1',
          profileId: 'profile-1',
          visibility: 'public',
          isPinned: false,
          isLocked: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );
    forumService.getThreads.mockReturnValue(
      of([
        {
          id: 'thread-1',
          title: 'Welcome thread',
          description: 'Welcome',
          content: 'Hello',
          userId: 'user-1',
          profileId: 'profile-1',
          topicId: 'topic-1',
          visibility: 'public',
          isPinned: false,
          isLocked: false,
          viewCount: 12,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );
    forumService.getPosts.mockReturnValue(
      of([
        {
          id: 'post-1',
          threadId: 'thread-1',
          content: 'Flagged reply',
          userId: 'user-1',
          profileId: 'profile-1',
          isEdited: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])
    );
    forumService.getReports.mockReturnValue(
      of([
        {
          id: 'report-1',
          reporterId: 'profile-2',
          contentType: 'post',
          contentId: 'post-1',
          reason: 'harassment',
          description: 'Needs review',
          status: 'pending',
          adminNotes: '',
          createdAt: new Date(),
        },
      ])
    );
    forumService.updateTopic.mockReturnValue(of({ id: 'topic-1' }));
    forumService.updateThread.mockReturnValue(of({ id: 'thread-1' }));
    forumService.updateReport.mockReturnValue(
      of({
        id: 'report-1',
        reporterId: 'profile-2',
        contentType: 'post',
        contentId: 'post-1',
        reason: 'harassment',
        description: 'Needs review',
        status: 'reviewed',
        adminNotes: 'Triaged',
        createdAt: new Date(),
      })
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
                get: (key: string) =>
                  ((
                    {
                      source: 'community-ops',
                      entityType: 'community',
                      entityId: 'community-1',
                      communityId: 'community-1',
                      communityName: 'Makers Guild',
                      entityTitle: 'Makers Guild',
                    } as Record<string, string>
                  )[key] ?? null),
              },
            },
          },
        },
        { provide: ForumService, useValue: forumService },
      ],
    }).compileComponents();
  });

  it('loads topics and threads for moderation on init', () => {
    const fixture = TestBed.createComponent(ForumGovernanceComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance as any;
    expect(forumService.getTopics).toHaveBeenCalled();
    expect(forumService.getThreads).toHaveBeenCalled();
    expect(forumService.getPosts).toHaveBeenCalled();
    expect(forumService.getReports).toHaveBeenCalled();
    expect(component.topics.length).toBe(1);
    expect(component.threads.length).toBe(1);
    expect(component.posts.length).toBe(1);
    expect(component.reports.length).toBe(1);
  });

  it('updates topic lock state through the forum service', () => {
    const fixture = TestBed.createComponent(ForumGovernanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.toggleTopicLock(component.topics[0]);

    expect(forumService.updateTopic).toHaveBeenCalledWith('topic-1', {
      isLocked: true,
    });
  });

  it('updates thread visibility through the forum service', () => {
    const fixture = TestBed.createComponent(ForumGovernanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.setThreadVisibility(component.threads[0], 'private');

    expect(forumService.updateThread).toHaveBeenCalledWith('thread-1', {
      visibility: 'private',
    });
  });

  it('applies soft moderation to a reported forum post', () => {
    const fixture = TestBed.createComponent(ForumGovernanceComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as any;

    component.reportDrafts['report-1'] = {
      status: 'actioned',
      adminNotes: 'Hidden pending moderator follow-up',
    };

    component.applyPostModeration(
      component.posts[0],
      'hidden',
      component.reports[0]
    );

    expect(forumService.moderatePost).toHaveBeenCalledWith('post-1', {
      moderationStatus: 'hidden',
      adminNotes: 'Hidden pending moderator follow-up',
    });
    expect(forumService.updateReport).toHaveBeenCalledWith(
      'report-1',
      expect.objectContaining({
        status: 'actioned',
      })
    );
  });

  it('renders the scoped Community Ops handoff context when opened from a community', () => {
    const fixture = TestBed.createComponent(ForumGovernanceComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Opened from Community Ops'
    );
    expect(fixture.nativeElement.textContent).toContain('Makers Guild');
  });
});
