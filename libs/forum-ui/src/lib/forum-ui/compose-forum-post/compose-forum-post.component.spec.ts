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

  it('binds pending uploads to private topic and thread owner context', () => {
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
    composer.availableTopics = [
      {
        id: 'topic',
        title: 'Private',
        visibility: 'private',
        profileId: 'topic-owner',
      } as any,
      {
        id: 'public-topic',
        title: 'Public',
        visibility: 'public',
        profileId: 'topic-owner',
      } as any,
    ];
    composer.availableThreads = [
      {
        id: 'thread',
        topicId: 'public-topic',
        title: 'Private',
        visibility: 'private',
        profileId: 'thread-owner',
      } as any,
    ];

    composer.selectedTopicId = 'topic';
    expect((composer as any).getAssetAudienceRestrictions()).toEqual([
      { type: 'owner', profileId: 'topic-owner' },
    ]);

    composer.selectedTopicId = 'public-topic';
    composer.selectedThreadId = 'thread';
    expect((composer as any).getAssetAudienceRestrictions()).toEqual([
      { type: 'owner', profileId: 'thread-owner' },
    ]);
  });

  it('keeps pending uploads public in a public topic and thread', () => {
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
    composer.availableTopics = [
      {
        id: 'public-topic',
        title: 'Public',
        visibility: 'public',
        profileId: 'owner',
      } as any,
    ];
    composer.availableThreads = [
      {
        id: 'public-thread',
        topicId: 'public-topic',
        title: 'Public',
        visibility: 'public',
        profileId: 'owner',
      } as any,
    ];
    composer.selectedTopicId = 'public-topic';
    composer.selectedThreadId = 'public-thread';

    expect((composer as any).getAssetAudienceRestrictions()).toEqual([]);
  });

  it('preserves an uploaded image URL from editor HTML through post submission', () => {
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
    const url =
      'https://local.test/api/asset/123e4567-e89b-42d3-a456-426614174000';
    const editorHtml = `<p>Attached</p><img src="${url}" alt="image" title="uploaded">`;
    composer.content = (composer as any).sanitize(editorHtml);
    let submitted: { content: string } | undefined;
    composer.postSubmitted.subscribe((value) => (submitted = value));

    composer.onSubmit();

    expect(submitted?.content).toContain(`<img src="${url}"`);
    expect(submitted?.content).toContain('alt="image"');
  });
});
