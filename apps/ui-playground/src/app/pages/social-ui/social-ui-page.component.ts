import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import {
  CommentComponent,
  CommentListComponent,
  ComposeComponent,
  PostComponent,
  type CommentDto,
  type PostDto,
} from '@optimistic-tanuki/social-ui';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

@Component({
  selector: 'pg-social-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    ComposeComponent,
    CommentComponent,
    CommentListComponent,
    PostComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/social-ui"
      title="Social UI"
      description="Social components for posts, comments, and content composition."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card [element]="el" [config]="configs[el.id]">
        @switch (el.id) { @case ('compose') {
        <div class="preview-padded">
          <lib-social-compose [profileId]="'demo-profile'" />
        </div>
        } @case ('comment') {
        <div class="preview-padded">
          <lib-comment [profileId]="'demo-profile'" />
        </div>
        } @case ('comment-list') {
        <div class="preview-padded">
          <lib-comment-list
            [comments]="comments"
            [availableProfiles]="availableProfiles"
          />
        </div>
        } @case ('post') {
        <div class="preview-padded">
          <lib-post
            [content]="post"
            [comments]="comments"
            [availableProfiles]="availableProfiles"
            [profile]="authorProfile"
            [currentUserId]="'demo-profile'"
            [profileId]="'demo-profile'"
            [shareUrl]="'https://example.com/playground/post/demo-post'"
          />
        </div>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-padded {
        padding: 1.5rem;
        min-height: 200px;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialUiPageComponent {
  readonly importSnippet = `import { ComposeComponent, CommentComponent, CommentListComponent, PostComponent } from '@optimistic-tanuki/social-ui';`;
  configs: Record<string, ElementConfig> = {};

  readonly availableProfiles = {
    'demo-profile': {
      id: 'demo-profile',
      name: 'Ari Stone',
      avatar: 'https://placehold.co/96x96/0f172a/e2e8f0?text=AS',
    },
    'peer-profile': {
      id: 'peer-profile',
      name: 'Mika Vale',
      avatar: 'https://placehold.co/96x96/1e293b/e2e8f0?text=MV',
    },
  };
  readonly authorProfile = this.availableProfiles['demo-profile'];
  readonly comments: CommentDto[] = [
    {
      id: 'comment-1',
      content: 'Curated playground previews make it easier to compare component tone.',
      postId: 'demo-post',
      userId: 'demo-user',
      profileId: 'peer-profile',
    },
  ];
  readonly post: PostDto = {
    id: 'demo-post',
    title: 'Curated Playground Direction',
    content:
      '<p>This demo post shows the editorial side of the social toolkit with comments close by.</p>',
    userId: 'demo-user',
    profileId: 'demo-profile',
    createdAt: new Date('2026-04-03T09:00:00Z'),
    comments: this.comments,
    links: [{ url: 'https://example.com/design-system' }],
  };

  readonly elements: PlaygroundElement[] = [
    {
      id: 'compose',
      title: 'Compose',
      headline: 'Post composer',
      importName: 'ComposeComponent',
      selector: 'lib-social-compose',
      summary: 'Rich text editor for composing posts.',
      props: [],
    },
    {
      id: 'comment',
      title: 'Comment',
      headline: 'Inline reply composer',
      importName: 'CommentComponent',
      selector: 'lib-comment',
      summary: 'Reply composer with rich text controls and inline media hooks.',
      props: [],
    },
    {
      id: 'comment-list',
      title: 'Comment List',
      headline: 'Threaded conversation stack',
      importName: 'CommentListComponent',
      selector: 'lib-comment-list',
      summary: 'Comment thread renderer that resolves profile stubs for replies.',
      props: [],
    },
    {
      id: 'post',
      title: 'Post',
      headline: 'Rich social post surface',
      importName: 'PostComponent',
      selector: 'lib-post',
      summary: 'Complete social post card with content, links, and threaded comments.',
      props: [],
    },
  ];

  constructor() {
    for (const el of this.elements) {
      this.configs[el.id] = {};
    }
  }

  resetConfig(id: string): void {
    this.configs[id] = {};
  }
}
