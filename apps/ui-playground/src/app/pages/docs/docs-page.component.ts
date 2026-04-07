import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  PageShellComponent,
  IndexChipComponent,
  ElementCardComponent,
} from '../../shared';

interface LibraryDoc {
  id: string;
  name: string;
  package: string;
  description: string;
  category: 'ui' | 'core';
}

@Component({
  selector: 'pg-docs-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    PageShellComponent,
    IndexChipComponent,
    ElementCardComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/source"
      title="Documentation"
      description="Explore UI libraries, core utilities, and integration guides for the Optimistic Tanuki platform."
      [importSnippet]="installSnippet"
    >
      <ng-container slot="index">
        @for (lib of uiLibraries; track lib.id) {
        <pg-index-chip [id]="lib.id" [label]="lib.name" />
        }
      </ng-container>

      <div class="doc-intro">
        <div class="doc-card">
          <h3>Library Organization</h3>
          <p>
            This monorepo contains UI libraries (published to npm as
            <code>@optimistic-tanuki/*</code>) and core utilities. The main
            monorepo is <strong>private</strong> while individual libraries are
            published as <strong>public npm packages</strong>.
          </p>
          <div class="doc-meta">
            <span class="meta-tag">Monorepo: <strong>Private</strong></span>
            <span class="meta-tag">Libraries: <strong>Public npm</strong></span>
            <span class="meta-tag">Package Manager: <strong>pnpm</strong></span>
          </div>
        </div>

        <div class="doc-card">
          <h3>Package Manager Migration</h3>
          <p>
            Successfully migrated from npm to pnpm for improved workspace
            management, faster installs, and better disk space utilization.
          </p>
          <pre class="code-block"><code>pnpm install
pnpm exec nx build</code></pre>
        </div>
      </div>

      <section class="doc-section">
        <h2>UI Libraries</h2>
        <div class="library-grid">
          @for (lib of uiLibraries; track lib.id) {
          <a [routerLink]="'/' + lib.id" class="library-card">
            <span class="lib-name">{{ lib.name }}</span>
            <span class="lib-package">{{ lib.package }}</span>
            <p class="lib-desc">{{ lib.description }}</p>
          </a>
          }
        </div>
      </section>

      <section class="doc-section">
        <h2>Core Libraries</h2>
        <div class="library-grid">
          @for (lib of coreLibraries; track lib.id) {
          <div class="library-card library-card-disabled">
            <span class="lib-name">{{ lib.name }}</span>
            <span class="lib-package">{{ lib.package }}</span>
            <p class="lib-desc">{{ lib.description }}</p>
          </div>
          }
        </div>
      </section>

      <section class="doc-section">
        <h2>Migration Notes</h2>
        <div class="notes-card">
          <h4>Repository Structure</h4>
          <ul>
            <li>
              <strong>Main monorepo</strong>: Private repository
              (@optimistic-tanuki/source)
            </li>
            <li>
              <strong>Library repos</strong>: Individual public repos under
              optimistic-tanuki org
            </li>
            <li>
              <strong>npm packages</strong>: @optimistic-tanuki/[lib-name]
            </li>
          </ul>
        </div>
        <div class="notes-card">
          <h4>pnpm Workspace</h4>
          <ul>
            <li>
              Root <code>pnpm-workspace.yaml</code> defines package locations
            </li>
            <li>
              Libraries in <code>libs/*</code> and apps in <code>apps/*</code>
            </li>
            <li>All CI workflows updated to use pnpm instead of npm</li>
          </ul>
        </div>
      </section>
    </pg-page-shell>
  `,
  styles: [
    `
      .doc-intro {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .doc-card {
        padding: 1.25rem;
        border: 1px solid rgba(129, 168, 222, 0.16);
        border-radius: 1rem;
        background: rgba(8, 13, 22, 0.56);
      }

      .doc-card h3 {
        margin: 0 0 0.75rem;
        font-family: var(--font-heading);
        font-size: 1.1rem;
        letter-spacing: -0.02em;
        color: var(--primary);
      }

      .doc-card p {
        margin: 0;
        color: var(--muted);
        font-size: 0.92rem;
        line-height: 1.6;
      }

      .doc-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        margin-top: 1rem;
      }

      .meta-tag {
        padding: 0.35rem 0.65rem;
        border-radius: 0.5rem;
        background: rgba(59, 130, 246, 0.15);
        font-size: 0.75rem;
        color: var(--primary);
      }

      .code-block {
        margin-top: 1rem;
        padding: 0.85rem;
        border-radius: 0.75rem;
        background: rgba(5, 10, 18, 0.84);
        font-size: 0.8rem;
        color: #d9ebff;
      }

      .doc-section {
        margin-bottom: 2rem;
      }

      .doc-section h2 {
        font-family: var(--font-heading);
        font-size: 1.3rem;
        margin: 0 0 1rem;
        color: var(--foreground);
      }

      .library-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 0.85rem;
      }

      .library-card {
        display: block;
        padding: 1rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 0.9rem;
        background: rgba(8, 13, 22, 0.48);
        text-decoration: none;
        color: inherit;
        transition: all 0.2s ease;
      }

      .library-card:hover {
        border-color: var(--primary);
        background: rgba(59, 130, 246, 0.08);
      }

      .library-card-disabled {
        opacity: 0.65;
      }

      .lib-name {
        display: block;
        font-weight: 600;
        font-size: 0.95rem;
        color: var(--foreground);
      }

      .lib-package {
        display: block;
        font-family: var(--font-mono);
        font-size: 0.7rem;
        color: var(--primary);
        margin: 0.25rem 0 0.5rem;
      }

      .lib-desc {
        margin: 0;
        font-size: 0.8rem;
        color: var(--muted);
        line-height: 1.5;
      }

      .notes-card {
        padding: 1rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 0.85rem;
        background: rgba(8, 13, 22, 0.4);
        margin-bottom: 0.75rem;
      }

      .notes-card h4 {
        margin: 0 0 0.65rem;
        font-size: 0.9rem;
        color: var(--primary);
      }

      .notes-card ul {
        margin: 0;
        padding-left: 1.25rem;
      }

      .notes-card li {
        font-size: 0.85rem;
        color: var(--muted);
        margin-bottom: 0.35rem;
      }

      .notes-card li:last-child {
        margin-bottom: 0;
      }

      code {
        font-family: var(--font-mono);
        background: rgba(59, 130, 246, 0.12);
        padding: 0.15rem 0.35rem;
        border-radius: 0.3rem;
        font-size: 0.85em;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocsPageComponent {
  readonly installSnippet = `pnpm add @optimistic-tanuki/common-ui`;

  readonly uiLibraries: LibraryDoc[] = [
    {
      id: 'common-ui',
      name: 'Common UI',
      package: '@optimistic-tanuki/common-ui',
      description: 'Core UI primitives: buttons, cards, spinners, badges',
      category: 'ui',
    },
    {
      id: 'theme-ui',
      name: 'Theme UI',
      package: '@optimistic-tanuki/theme-ui',
      description: 'Theme management and design system components',
      category: 'ui',
    },
    {
      id: 'form-ui',
      name: 'Form UI',
      package: '@optimistic-tanuki/form-ui',
      description: 'Form controls, inputs, validation components',
      category: 'ui',
    },
    {
      id: 'navigation-ui',
      name: 'Navigation UI',
      package: '@optimistic-tanuki/navigation-ui',
      description: 'Navigation patterns: menus, breadcrumbs, tabs',
      category: 'ui',
    },
    {
      id: 'social-ui',
      name: 'Social UI',
      package: '@optimistic-tanuki/social-ui',
      description: 'Social features: posts, comments, reactions',
      category: 'ui',
    },
    {
      id: 'notification-ui',
      name: 'Notification UI',
      package: '@optimistic-tanuki/notification-ui',
      description: 'Toasts, alerts, and notification systems',
      category: 'ui',
    },
    {
      id: 'store-ui',
      name: 'Store UI',
      package: '@optimistic-tanuki/store-ui',
      description: 'E-commerce components: cart, products, checkout',
      category: 'ui',
    },
    {
      id: 'auth-ui',
      name: 'Auth UI',
      package: '@optimistic-tanuki/auth-ui',
      description: 'Authentication UI: login, register, password reset',
      category: 'ui',
    },
    {
      id: 'profile-ui',
      name: 'Profile UI',
      package: '@optimistic-tanuki/profile-ui',
      description: 'User profile components and settings',
      category: 'ui',
    },
    {
      id: 'chat-ui',
      name: 'Chat UI',
      package: '@optimistic-tanuki/chat-ui',
      description: 'Chat and messaging interface components',
      category: 'ui',
    },
    {
      id: 'message-ui',
      name: 'Message UI',
      package: '@optimistic-tanuki/message-ui',
      description: 'Message display and conversation UI',
      category: 'ui',
    },
    {
      id: 'search-ui',
      name: 'Search UI',
      package: '@optimistic-tanuki/search-ui',
      description: 'Search components: inputs, results, filters',
      category: 'ui',
    },
    {
      id: 'persona-ui',
      name: 'Persona UI',
      package: '@optimistic-tanuki/persona-ui',
      description: 'Avatar, identity, and persona components',
      category: 'ui',
    },
    {
      id: 'ag-grid-ui',
      name: 'AG Grid UI',
      package: '@optimistic-tanuki/ag-grid-ui',
      description: 'AG Grid integration and enhancements',
      category: 'ui',
    },
    {
      id: 'motion-ui',
      name: 'Motion UI',
      package: '@optimistic-tanuki/motion-ui',
      description: 'Animation and motion utilities',
      category: 'ui',
    },
  ];

  readonly coreLibraries: LibraryDoc[] = [
    {
      id: 'theme-lib',
      name: 'Theme Lib',
      package: '@optimistic-tanuki/theme-lib',
      description: 'Theme service, tokens, and utilities',
      category: 'core',
    },
    {
      id: 'compose-lib',
      name: 'Compose Lib',
      package: '@optimistic-tanuki/compose-lib',
      description: 'Composition utilities for Angular',
      category: 'core',
    },
    {
      id: 'constants',
      name: 'Constants',
      package: '@optimistic-tanuki/constants',
      description: 'Shared constants and tokens',
      category: 'core',
    },
    {
      id: 'models',
      name: 'Models',
      package: '@optimistic-tanuki/models',
      description: 'Shared TypeScript interfaces and types',
      category: 'core',
    },
    {
      id: 'database',
      name: 'Database',
      package: '@optimistic-tanuki/database',
      description: 'Database connection and TypeORM setup',
      category: 'core',
    },
    {
      id: 'encryption',
      name: 'Encryption',
      package: '@optimistic-tanuki/encryption',
      description: 'Cryptographic utilities',
      category: 'core',
    },
    {
      id: 'logger',
      name: 'Logger',
      package: '@optimistic-tanuki/logger',
      description: 'Logging service and utilities',
      category: 'core',
    },
    {
      id: 'storage',
      name: 'Storage',
      package: '@optimistic-tanuki/storage',
      description: 'Storage utilities',
      category: 'core',
    },
  ];
}
