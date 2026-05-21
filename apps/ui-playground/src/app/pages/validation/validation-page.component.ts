import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuroraRibbonComponent } from '@optimistic-tanuki/motion-ui';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
} from '@optimistic-tanuki/common-ui';
import { SelectComponent, TextInputComponent } from '@optimistic-tanuki/form-ui';
import { PersonalityPreviewComponent } from '@optimistic-tanuki/theme-ui';
import { AppBarComponent } from '@optimistic-tanuki/navigation-ui';
import {
  NotificationBellComponent,
  type Notification,
} from '@optimistic-tanuki/notification-ui';
import {
  ComposeComponent,
  type CommentDto,
  type PostDto,
} from '@optimistic-tanuki/social-ui';
import { LoginBlockComponent } from '@optimistic-tanuki/auth-ui';
import { BannerComponent } from '@optimistic-tanuki/profile-ui';
import {
  ContactBubbleComponent,
  type ChatContact,
} from '@optimistic-tanuki/chat-ui';
import {
  MessageComponent,
  MessageService,
  type MessageLevelType,
} from '@optimistic-tanuki/message-ui';
import {
  GlobalSearchComponent,
  SearchService,
  type SearchResponse,
  type SearchResult,
} from '@optimistic-tanuki/search-ui';
import {
  PersonaSelectionMenuComponent,
  PersonaService,
} from '@optimistic-tanuki/persona-ui';
import { AgGridUiComponent, type ColDef } from '@optimistic-tanuki/ag-grid-ui';
import { ProductCardComponent } from '@optimistic-tanuki/store-ui';
import type { PersonaTelosDto, ProfileDto } from '@optimistic-tanuki/ui-models';
import { Observable, of } from 'rxjs';
import { IndexChipComponent, PageShellComponent } from '../../shared';

type ValidationLibrary = {
  id: string;
  name: string;
  packageName: string;
  path: string;
  focus: string;
};

class ValidationSearchService {
  private readonly users: SearchResult[] = [
    {
      id: 'user-1',
      type: 'user',
      title: 'Ari Stone',
      subtitle: 'Developer Experience Lead',
      imageUrl: 'https://placehold.co/96x96/0f172a/e2e8f0?text=AS',
    },
  ];

  private readonly posts: SearchResult[] = [
    {
      id: 'post-1',
      type: 'post',
      title: 'Personality Distinctness Sweep',
      subtitle: 'Integrated validation board update',
      highlight: 'Compare all 12 personalities against the same component surface.',
    },
  ];

  search(query: string): Observable<SearchResponse> {
    const normalized = query.toLowerCase();

    return of({
      users: this.users.filter((result) =>
        result.title.toLowerCase().includes(normalized)
      ),
      communities: [],
      posts: this.posts.filter((result) =>
        result.title.toLowerCase().includes(normalized)
      ),
      total: 2,
    });
  }

  getTrending(): Observable<SearchResult[]> {
    return of(this.posts);
  }

  getSuggestedUsers(): Observable<SearchResult[]> {
    return of(this.users);
  }

  getSuggestedCommunities(): Observable<SearchResult[]> {
    return of([]);
  }
}

class ValidationPersonaService {
  getAllPersonas() {
    return of<PersonaTelosDto[]>([
      {
        id: 'persona-1',
        name: 'Design System Editor',
        description: 'Refines token naming, previews, and validation heuristics.',
        goals: ['Compare personalities', 'Reduce ambiguity'],
        skills: ['design systems', 'documentation'],
        interests: ['playgrounds', 'tokens'],
        limitations: ['No production access'],
        strengths: ['Naming clarity'],
        objectives: ['Keep validation surfaces coherent'],
        coreObjective: 'Make differences obvious and reviewable.',
        exampleResponses: ['This personality collapses into classic.'],
        promptTemplate: 'Act as a design system editor.',
      },
    ]);
  }
}

@Component({
  selector: 'pg-validation-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PageShellComponent,
    IndexChipComponent,
    AuroraRibbonComponent,
    ButtonComponent,
    CardComponent,
    BadgeComponent,
    TextInputComponent,
    SelectComponent,
    PersonalityPreviewComponent,
    AppBarComponent,
    NotificationBellComponent,
    ComposeComponent,
    LoginBlockComponent,
    BannerComponent,
    ContactBubbleComponent,
    MessageComponent,
    GlobalSearchComponent,
    PersonaSelectionMenuComponent,
    AgGridUiComponent,
    ProductCardComponent,
  ],
  providers: [
    { provide: SearchService, useClass: ValidationSearchService },
    { provide: PersonaService, useClass: ValidationPersonaService },
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/theme-lib"
      title="Validation Board"
      description="Integrated personality sweep for the reusable UI libraries. Switch personalities in the global toolbar to confirm that typography, surfaces, spacing, borders, and interaction tone remain both complete and visually distinct."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (library of libraries; track library.id) {
        <pg-index-chip [id]="library.id" [label]="library.name" />
        }
      </ng-container>

      <section class="validation-grid">
        @for (library of libraries; track library.id) {
        <article class="validation-card" [attr.id]="library.id">
          <header class="validation-card__header">
            <div>
              <p class="validation-card__package">{{ library.packageName }}</p>
              <h3>{{ library.name }}</h3>
            </div>
            <a [routerLink]="library.path">Open page</a>
          </header>

          <p class="validation-card__focus">{{ library.focus }}</p>

          <div class="validation-preview">
            @switch (library.id) { @case ('motion-ui') {
            <otui-aurora-ribbon height="14rem" [reducedMotion]="true" />
            } @case ('common-ui') {
            <div class="common-preview">
              <otui-button variant="primary">Primary</otui-button>
              <otui-button variant="secondary">Secondary</otui-button>
              <otui-badge variant="success">Stable</otui-badge>
              <otui-card>
                <h4>Shared surface</h4>
                <p>Buttons, copy rhythm, and card treatment should all shift with personality.</p>
              </otui-card>
            </div>
            } @case ('form-ui') {
            <div class="form-preview">
              <lib-text-input
                label="Workspace name"
                placeholder="Curated validation board"
                [(ngModel)]="workspaceName"
              />
              <lib-select [options]="personalityOptions" [(ngModel)]="selectedPersonalityLabel" />
            </div>
            } @case ('theme-ui') {
            <div class="theme-preview">
              <lib-personality-preview />
            </div>
            } @case ('navigation-ui') {
            <div class="navigation-preview">
              <otui-app-bar />
            </div>
            } @case ('notification-ui') {
            <div class="notification-preview">
              <notif-notification-bell
                [notifications]="notificationsSignal"
                [unreadCount]="unreadCount"
              />
            </div>
            } @case ('social-ui') {
            <div class="social-preview">
              <lib-social-compose [profileId]="'demo-profile'" />
            </div>
            } @case ('store-ui') {
            <div class="store-preview">
              <store-product-card [product]="sampleProduct" />
            </div>
            } @case ('auth-ui') {
            <div class="auth-preview">
              <lib-login-block
                title="Welcome back"
                description="Confirm the auth shell shifts tone with each personality."
              />
            </div>
            } @case ('profile-ui') {
            <div class="profile-preview">
              <lib-banner
                [profileName]="selectedProfile.profileName"
                [profileImage]="selectedProfile.profilePic"
                [backgroundImage]="selectedProfile.coverPic"
              />
            </div>
            } @case ('chat-ui') {
            <div class="chat-preview">
              <lib-contact-bubble [contacts]="contacts" />
            </div>
            } @case ('message-ui') {
            <div class="message-preview">
              <lib-message />
            </div>
            } @case ('search-ui') {
            <div class="search-preview">
              <search-global-search />
            </div>
            } @case ('persona-ui') {
            <div class="persona-preview">
              <lib-persona-selection-menu />
            </div>
            } @case ('ag-grid-ui') {
            <div class="grid-preview">
              <otui-ag-grid [rowData]="rowData" [columnDefs]="columnDefs" height="260px" />
            </div>
            } }
          </div>
        </article>
        }
      </section>
    </pg-page-shell>
  `,
  styles: [
    `
      .validation-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .validation-card {
        display: grid;
        gap: 0.85rem;
        padding: 1rem;
        border: 1px solid color-mix(in srgb, var(--border) 92%, transparent);
        border-radius: var(--personality-card-radius, 1.35rem);
        background:
          linear-gradient(
            180deg,
            color-mix(in srgb, var(--surface) 96%, transparent),
            color-mix(in srgb, var(--background) 98%, transparent)
          ),
          var(--page-background-pattern, none);
        box-shadow: var(--personality-card-shadow, var(--shadow-lg));
        overflow: hidden;
      }

      .validation-card__header {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
      }

      .validation-card__package {
        margin: 0 0 0.3rem;
        color: color-mix(in srgb, var(--primary) 74%, var(--foreground));
        font: 600 0.72rem/1 var(--font-mono);
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .validation-card__header h3 {
        margin: 0;
        font-family: var(--font-heading);
        font-size: 1.2rem;
        letter-spacing: -0.03em;
      }

      .validation-card__header a {
        color: var(--foreground);
        text-decoration: none;
        white-space: nowrap;
        font-weight: 600;
      }

      .validation-card__focus {
        margin: 0;
        color: color-mix(in srgb, var(--foreground) 72%, var(--background));
        font-size: 0.92rem;
        line-height: 1.55;
      }

      .validation-preview {
        min-height: 220px;
        padding: 0.75rem;
        border: 1px solid color-mix(in srgb, var(--border) 82%, transparent);
        border-radius: calc(var(--personality-card-radius, 1.35rem) - 0.35rem);
        background: color-mix(in srgb, var(--surface) 88%, transparent);
        overflow: hidden;
      }

      .common-preview,
      .form-preview {
        display: grid;
        gap: 0.9rem;
      }

      .common-preview otui-card {
        display: block;
      }

      .theme-preview {
        min-height: 480px;
      }

      .notification-preview,
      .message-preview {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 220px;
      }

      .store-preview,
      .auth-preview,
      .profile-preview,
      .search-preview,
      .persona-preview,
      .grid-preview,
      .social-preview,
      .chat-preview {
        min-height: 220px;
      }

      @media (max-width: 1100px) {
        .validation-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .validation-card {
          padding: 0.9rem;
        }

        .validation-card__header {
          flex-direction: column;
        }

        .validation-preview {
          padding: 0.65rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ValidationPageComponent {
  readonly importSnippet = `import { ThemeValidationHarnessComponent, PREDEFINED_PERSONALITIES } from '@optimistic-tanuki/theme-lib';`;
  readonly messageService = inject(MessageService);

  workspaceName = 'Validation board';
  selectedPersonalityLabel = 'classic';

  readonly personalityOptions = [
    { value: 'classic', label: 'Classic' },
    { value: 'architect', label: 'Architect' },
    { value: 'electric', label: 'Electric' },
  ];

  readonly libraries: ValidationLibrary[] = [
    {
      id: 'motion-ui',
      name: 'Motion UI',
      packageName: '@optimistic-tanuki/motion-ui',
      path: '/motion-ui',
      focus: 'Atmosphere, glow behavior, and depth treatment should shift with the active personality.',
    },
    {
      id: 'common-ui',
      name: 'Common UI',
      packageName: '@optimistic-tanuki/common-ui',
      path: '/common-ui',
      focus: 'Buttons, badges, and core card surfaces are the fastest way to catch token regressions.',
    },
    {
      id: 'form-ui',
      name: 'Form UI',
      packageName: '@optimistic-tanuki/form-ui',
      path: '/form-ui',
      focus: 'Inputs should reflect personality spacing, border treatment, and focus rhythm without losing clarity.',
    },
    {
      id: 'theme-ui',
      name: 'Theme UI',
      packageName: '@optimistic-tanuki/theme-ui',
      path: '/theme-ui',
      focus: 'The preview surface exposes typography, palette, spacing, shadows, and radius all in one place.',
    },
    {
      id: 'navigation-ui',
      name: 'Navigation UI',
      packageName: '@optimistic-tanuki/navigation-ui',
      path: '/navigation-ui',
      focus: 'Navigation chrome should feel like it belongs to the same personality system as the content surfaces.',
    },
    {
      id: 'notification-ui',
      name: 'Notification UI',
      packageName: '@optimistic-tanuki/notification-ui',
      path: '/notification-ui',
      focus: 'Alert affordances and unread emphasis should stay legible across personalities and modes.',
    },
    {
      id: 'social-ui',
      name: 'Social UI',
      packageName: '@optimistic-tanuki/social-ui',
      path: '/social-ui',
      focus: 'Rich composition panels reveal whether personality styles hold up in denser editorial layouts.',
    },
    {
      id: 'store-ui',
      name: 'Store UI',
      packageName: '@optimistic-tanuki/store-ui',
      path: '/store-ui',
      focus: 'Commerce cards surface elevation, CTA hierarchy, and pricing emphasis quickly.',
    },
    {
      id: 'auth-ui',
      name: 'Auth UI',
      packageName: '@optimistic-tanuki/auth-ui',
      path: '/auth-ui',
      focus: 'Authentication shells should feel distinct without losing trust or form clarity.',
    },
    {
      id: 'profile-ui',
      name: 'Profile UI',
      packageName: '@optimistic-tanuki/profile-ui',
      path: '/profile-ui',
      focus: 'Identity banners test large-image framing, heading treatment, and tone-setting surfaces.',
    },
    {
      id: 'chat-ui',
      name: 'Chat UI',
      packageName: '@optimistic-tanuki/chat-ui',
      path: '/chat-ui',
      focus: 'Conversation rows are useful for checking compact density and recency metadata styles.',
    },
    {
      id: 'message-ui',
      name: 'Message UI',
      packageName: '@optimistic-tanuki/message-ui',
      path: '/message-ui',
      focus: 'Transient feedback should inherit personality tone instead of reverting to a generic system style.',
    },
    {
      id: 'search-ui',
      name: 'Search UI',
      packageName: '@optimistic-tanuki/search-ui',
      path: '/search-ui',
      focus: 'Lookup flows are sensitive to spacing, typography hierarchy, and focus treatment.',
    },
    {
      id: 'persona-ui',
      name: 'Persona UI',
      packageName: '@optimistic-tanuki/persona-ui',
      path: '/persona-ui',
      focus: 'Assistant pickers should remain visibly distinct while preserving readable structure.',
    },
    {
      id: 'ag-grid-ui',
      name: 'AG Grid UI',
      packageName: '@optimistic-tanuki/ag-grid-ui',
      path: '/ag-grid-ui',
      focus: 'Dense tables catch weak token integration fast, especially borders, stripes, and row emphasis.',
    },
  ];

  readonly selectedProfile: ProfileDto = {
    id: 'profile-1',
    profileName: 'Ari Stone',
    profilePic: 'https://placehold.co/120x120/0f172a/e2e8f0?text=AS',
    coverPic:
      'https://placehold.co/1200x320/1e293b/e2e8f0?text=Validation+Banner',
    userId: 'user-1',
    bio: 'Developer experience lead with a bias toward polished internal tools.',
    location: 'Savannah, GA',
    occupation: 'Engineer',
    interests: 'Design systems, docs, platform UX',
    skills: 'Angular, UI systems',
    created_at: new Date('2026-01-10T10:00:00Z'),
  };

  readonly contacts: ChatContact[] = [
    {
      id: 'peer-profile',
      name: 'Mika Vale',
      avatarUrl: 'https://placehold.co/96x96/334155/e2e8f0?text=MV',
      lastMessage: 'The validation route makes personality drift much easier to spot.',
      lastMessageTime: '2026-04-03T14:05:00Z',
    },
  ];

  readonly notifications: Notification[] = [
    {
      id: 'notif-1',
      recipientId: 'demo-profile',
      type: 'comment',
      title: 'New comment',
      body: 'reviewed the theme validation sweep.',
      senderId: 'peer-profile',
      senderName: 'Mika Vale',
      senderAvatar: 'https://placehold.co/96x96/334155/e2e8f0?text=MV',
      isRead: false,
      createdAt: new Date('2026-04-03T12:05:00Z'),
    },
  ];

  readonly notificationsSignal = signal(this.notifications);
  readonly unreadCount = signal(1);

  readonly sampleProduct = {
    id: 'product-1',
    name: 'Validation Kit',
    description: 'A representative commerce surface for personality sweeps.',
    price: 49,
    imageUrl: '',
    stock: 9,
    type: 'digital',
  };

  readonly rowData = [
    { component: 'Primary Button', library: 'common-ui', check: 'shadow + radius' },
    { component: 'Login Block', library: 'auth-ui', check: 'form shell + hierarchy' },
    { component: 'Global Search', library: 'search-ui', check: 'input density + focus' },
  ];

  readonly columnDefs: ColDef[] = [
    { field: 'component', headerName: 'Component' },
    { field: 'library', headerName: 'Library' },
    { field: 'check', headerName: 'Validation Focus' },
  ];

  constructor() {
    if (this.messageService.messages().length === 0) {
      this.seedMessage('Validation board loaded.', 'success');
      this.seedMessage('Switch personalities from the global toolbar.', 'info');
    }
  }

  private seedMessage(content: string, type: MessageLevelType): void {
    this.messageService.addMessage({ content, type });
  }
}
