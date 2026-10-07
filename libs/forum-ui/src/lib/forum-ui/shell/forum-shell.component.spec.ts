import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ProfileService } from '../services/profile.service';
import { ForumShellComponent } from './forum-shell.component';
import { ForumService } from '../services/forum.service';

describe('Forum thread reply context', () => {
  it('uses the cookie-session profile id when no legacy token profile is available', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ForumService, useValue: {} },
        { provide: ProfileService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const shell = TestBed.runInInjectionContext(
      () => new ForumShellComponent()
    );
    shell.currentUserId = 'session-profile-id';
    expect(shell.getUploadProfileId()).toBe('session-profile-id');
    shell.userProfile.set({ id: 'selected-profile-id' });
    expect(shell.getUploadProfileId()).toBe('selected-profile-id');
  });

  it('loads the owning topic and its threads before opening a contextual reply', async () => {
    const thread = { id: 'thread', topicId: 'topic' };
    const topic = { id: 'topic', title: 'Topic' };
    const service = {
      getThread: jest.fn().mockResolvedValue(thread),
      getTopic: jest.fn().mockResolvedValue(topic),
      getThreadsByTopic: jest.fn().mockResolvedValue([thread]),
      getPostsByThread: jest.fn().mockResolvedValue([]),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ForumService, useValue: service },
        { provide: ProfileService, useValue: {} },
        { provide: Router, useValue: {} },
        { provide: ActivatedRoute, useValue: {} },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const shell = TestBed.runInInjectionContext(
      () => new ForumShellComponent()
    );
    await (shell as any).loadThread('thread');
    expect(shell.currentTopic()).toEqual(topic);
    expect(shell.threads()).toEqual([thread]);
    expect(shell.currentThread()).toEqual(thread);
  });
});
