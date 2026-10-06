import { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ImageUploadService } from '@optimistic-tanuki/compose-lib';
import { ComposeForumPostComponent } from './compose-forum-post.component';

describe('Forum composer selection rendering', () => {
  it('keeps option identities stable between renders and updates them when the input changes', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: ImageUploadService, useValue: {} },
        {
          provide: ElementRef,
          useValue: new ElementRef(document.createElement('div')),
        },
      ],
    });
    const composer = TestBed.runInInjectionContext(
      () => new ComposeForumPostComponent()
    );
    composer.availableTopics = [{ id: 'topic', title: 'Topic' } as any];
    composer.availableThreads = [{ id: 'thread', title: 'Thread' } as any];
    const topics = composer.topicOptions;
    const threads = composer.threadOptions;
    expect(composer.topicOptions).toBe(topics);
    expect(composer.threadOptions).toBe(threads);
    composer.availableTopics = [{ id: 'new-topic', title: 'New topic' } as any];
    expect(composer.topicOptions).toContainEqual({
      value: 'new-topic',
      label: 'New topic',
    });
  });
});
