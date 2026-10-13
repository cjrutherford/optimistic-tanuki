import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
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

describe('Forum parent deletion', () => {
  const topic = {
    id: 'topic-1',
    title: 'Empty topic',
    description: '',
    userId: 'author',
    profileId: 'author-profile',
  } as any;
  const thread = {
    id: 'thread-1',
    title: 'Empty thread',
    description: '',
    userId: 'author',
    profileId: 'author-profile',
    topicId: 'topic-1',
  } as any;

  function createShell(service: Record<string, jest.Mock> = {}) {
    const router = { navigate: jest.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: ForumService, useValue: service },
        { provide: ProfileService, useValue: {} },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: {} },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const shell = TestBed.runInInjectionContext(
      () => new ForumShellComponent()
    );
    shell.currentUserId = 'author-profile';
    shell.isLoggedIn.set(true);
    return { shell, router };
  }

  it('shows delete affordances only for the exact author with the scoped permission', () => {
    const { shell } = createShell();
    shell.userValidPermissions = ['forum.topic.delete', 'forum.thread.delete'];
    shell.currentTopic.set(topic);
    shell.currentThread.set(thread);

    expect(shell.canDeleteTopic(topic)).toBe(true);
    expect(shell.canDeleteThread(thread)).toBe(true);
    expect(shell.canDeleteTopic({ ...topic, profileId: 'other-profile' })).toBe(
      false
    );
    shell.userValidPermissions = ['forum.topic.delete'];
    expect(shell.canDeleteThread(thread)).toBe(false);
  });

  it('renders the delete control and shared confirmation modal for an authorized author', async () => {
    const scrollTo = jest
      .spyOn(window, 'scrollTo')
      .mockImplementation(() => undefined);
    const service = {
      getTopics: jest.fn().mockResolvedValue([]),
      deleteTopic: jest.fn().mockResolvedValue(undefined),
    };
    const router = { navigate: jest.fn() };
    TestBed.configureTestingModule({
      imports: [ForumShellComponent],
      providers: [
        { provide: ForumService, useValue: service },
        { provide: ProfileService, useValue: {} },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { data: of({}), params: of({}) },
        },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });
    const fixture = TestBed.createComponent(ForumShellComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    const shell = fixture.componentInstance;
    shell.isLoggedIn.set(true);
    shell.currentUserId = 'author-profile';
    shell.userValidPermissions = ['forum.topic.delete'];
    shell.currentTopic.set(topic);
    fixture.detectChanges();

    const deleteButton = fixture.nativeElement.querySelector(
      'otui-card.topic-header otui-button'
    );
    expect(deleteButton).not.toBeNull();
    shell.requestTopicDeletion(topic);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('.modal-dialog[role="alertdialog"]')
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('[role="alertdialog"]')
    ).toHaveLength(1);
    expect(
      fixture.nativeElement
        .querySelector('.forum-delete-confirmation')
        .getAttribute('role')
    ).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('no threads');
    fixture.destroy();
    scrollTo.mockRestore();
  });

  it('requires explicit confirmation before deleting an authored empty thread', async () => {
    const service = { deleteThread: jest.fn().mockResolvedValue(undefined) };
    const { shell, router } = createShell(service);
    shell.userValidPermissions = ['forum.thread.delete'];
    shell.currentTopic.set(topic);
    shell.currentThread.set(thread);

    shell.requestThreadDeletion(thread);
    expect(service.deleteThread).not.toHaveBeenCalled();
    expect(shell.pendingDeletion()?.id).toBe(thread.id);

    await shell.confirmDeletion();
    expect(service.deleteThread).toHaveBeenCalledWith(thread.id);
    expect(router.navigate).toHaveBeenCalledWith(['/forum/topic', topic.id]);
    expect(shell.pendingDeletion()).toBeNull();
  });

  it('preserves the selected parent and offers a retry after a temporary delete failure', async () => {
    const service = {
      deleteTopic: jest.fn().mockRejectedValue({ status: 503 }),
      getTopics: jest.fn().mockResolvedValue([topic]),
    };
    const { shell, router } = createShell(service);
    shell.userValidPermissions = ['forum.topic.delete'];
    shell.currentTopic.set(topic);
    shell.requestTopicDeletion(topic);

    await shell.confirmDeletion();
    expect(shell.currentTopic()).toEqual(topic);
    expect(shell.pendingDeletion()?.id).toBe(topic.id);
    expect(shell.deletionError()).toMatch(/temporarily unavailable/i);
    expect(shell.deletionRetryable()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('explains that a non-empty parent cannot be deleted and never cascades', async () => {
    const service = {
      deleteTopic: jest.fn().mockRejectedValue({ status: 409 }),
      getTopics: jest.fn().mockResolvedValue([topic]),
    };
    const { shell, router } = createShell(service);
    shell.userValidPermissions = ['forum.topic.delete'];
    shell.currentTopic.set(topic);
    shell.requestTopicDeletion(topic);

    await shell.confirmDeletion();
    expect(shell.currentTopic()).toEqual(topic);
    expect(shell.deletionError()).toMatch(/threads or posts/i);
    expect(shell.deletionRetryable()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
