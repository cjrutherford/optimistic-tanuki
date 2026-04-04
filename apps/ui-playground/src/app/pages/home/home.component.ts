import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

type LibraryCard = {
  path: string;
  name: string;
  description: string;
  componentCount: number;
  category: string;
};

@Component({
  selector: 'pg-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="home-shell">
      <header class="hero">
        <div class="hero-copy">
          <span class="hero-kicker">Developer Toolkit</span>
          <h1>UI Playground</h1>
          <p class="tagline">
            Explore the optimistic-tanuki design system as a curated engineering
            surface: import paths, live previews, configurable props, and
            implementation-ready examples.
          </p>

          <div class="hero-actions">
            <a class="primary-action" routerLink="/common-ui">Start With Core UI</a>
            <a class="secondary-action" routerLink="/theme-ui">Browse Theme Controls</a>
          </div>
        </div>

        <aside class="hero-panels">
          <div class="metric-panel">
            <span class="metric-value">{{ libraries.length }}</span>
            <span class="metric-label">Libraries in scope</span>
          </div>
          <div class="metric-panel">
            <span class="metric-value">{{ totalComponents }}</span>
            <span class="metric-label">Curated components</span>
          </div>
          <div class="note-panel">
            <span class="panel-kicker">Best Use</span>
            <p>Reach for this first when you need the shortest path from component discovery to implementation.</p>
          </div>
        </aside>
      </header>

      <section class="content-section">
        <div class="section-heading">
          <span class="section-kicker">Browse</span>
          <h2>Library Catalog</h2>
          <p>Grouped by intent so the first scan tells you where to dig next.</p>
        </div>

        <section class="library-grid">
          @for (lib of libraries; track lib.path) {
          <a class="library-card" [routerLink]="lib.path">
            <span class="category">{{ lib.category }}</span>
            <h3>{{ lib.name }}</h3>
            <p>{{ lib.description }}</p>
            <div class="card-footer">
              <span class="count">{{ lib.componentCount }} components</span>
              <span class="arrow">Open</span>
            </div>
          </a>
          }
        </section>
      </section>

      <section class="content-section quick-start">
        <div class="section-heading">
          <span class="section-kicker">Install</span>
          <h2>Quick Start</h2>
          <p>Start small: pull in a component package and the shared theme layer.</p>
        </div>

        <div class="quick-start-grid">
          <pre><code>npm install @optimistic-tanuki/common-ui @optimistic-tanuki/theme-lib</code></pre>
          <div class="quick-start-copy">
            <p>All UI libraries are published as standalone Angular components. Import what you need, then refine inputs in the playground before wiring them into feature code.</p>
          </div>
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .home-shell {
        width: min(1240px, 100%);
        margin: 0 auto;
        padding: 2rem 0 3rem;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(260px, 0.95fr);
        gap: 1rem;
        margin-bottom: 1.5rem;
      }

      .hero-copy,
      .metric-panel,
      .note-panel,
      .content-section {
        border: 1px solid rgba(129, 168, 222, 0.12);
        background:
          radial-gradient(circle at top right, rgba(125, 183, 255, 0.12), transparent 35%),
          linear-gradient(180deg, rgba(15, 24, 38, 0.84), rgba(8, 14, 24, 0.94));
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      }

      .hero-copy {
        padding: 1.4rem 1.45rem 1.5rem;
        border-radius: 1.7rem;
      }

      .hero-kicker,
      .section-kicker,
      .panel-kicker,
      .category {
        display: block;
        color: color-mix(in srgb, var(--primary) 72%, white);
        font: 600 0.72rem/1 'IBM Plex Mono', monospace;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }

      h1 {
        margin: 0.8rem 0 0;
        font-size: clamp(3rem, 7vw, 5.8rem);
        font-family: var(--font-heading);
        letter-spacing: -0.05em;
        line-height: 0.92;
      }

      .tagline {
        max-width: 52ch;
        margin: 1rem 0 0;
        font-size: 1.05rem;
        line-height: 1.7;
        color: var(--muted);
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
        margin-top: 1.25rem;
      }

      .primary-action,
      .secondary-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 2.85rem;
        padding: 0.75rem 1rem;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 600;
        transition:
          transform 160ms ease,
          border-color 160ms ease,
          background 160ms ease;
      }

      .primary-action {
        background: linear-gradient(135deg, rgba(125, 183, 255, 0.96), rgba(120, 240, 214, 0.82));
        color: #07101b;
      }

      .secondary-action {
        border: 1px solid rgba(129, 168, 222, 0.18);
        background: rgba(8, 14, 24, 0.78);
        color: #dcecff;
      }

      .primary-action:hover,
      .secondary-action:hover {
        transform: translateY(-1px);
      }

      .hero-panels {
        display: grid;
        gap: 0.9rem;
      }

      .metric-panel,
      .note-panel {
        padding: 1rem 1rem 1.05rem;
        border-radius: 1.25rem;
      }

      .metric-value {
        display: block;
        font-family: var(--font-heading);
        font-size: 2.4rem;
        line-height: 0.95;
        letter-spacing: -0.05em;
      }

      .metric-label {
        display: block;
        margin-top: 0.45rem;
        color: var(--muted);
        font: 500 0.76rem/1.35 'IBM Plex Mono', monospace;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .note-panel p,
      .section-heading p,
      .quick-start-copy p {
        margin: 0.65rem 0 0;
        color: var(--muted);
        line-height: 1.6;
      }

      .content-section {
        padding: 1.1rem;
        border-radius: 1.4rem;
        margin-bottom: 1.2rem;
      }

      .section-heading {
        margin-bottom: 0.95rem;
      }

      .section-heading h2 {
        margin: 0.35rem 0 0;
        font-size: 1.45rem;
        font-family: var(--font-heading);
        letter-spacing: -0.03em;
      }

      .library-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
        gap: 1rem;
      }

      .library-card {
        display: grid;
        gap: 0.55rem;
        padding: 1.15rem;
        border: 1px solid rgba(129, 168, 222, 0.12);
        border-radius: 1.2rem;
        background: linear-gradient(180deg, rgba(18, 27, 42, 0.88), rgba(11, 18, 30, 0.96));
        text-decoration: none;
        color: inherit;
        transition:
          transform 180ms ease,
          border-color 180ms ease,
          box-shadow 180ms ease;
      }

      .library-card:hover {
        transform: translateY(-2px);
        border-color: rgba(129, 168, 222, 0.24);
        box-shadow: 0 14px 30px rgba(0, 0, 0, 0.24);
      }

      .library-card h3 {
        margin: 0;
        font-size: 1.25rem;
        font-family: var(--font-heading);
        letter-spacing: -0.02em;
      }

      .library-card p {
        margin: 0;
        color: var(--muted);
        font-size: 0.93rem;
        line-height: 1.55;
      }

      .card-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.8rem;
        margin-top: 0.3rem;
      }

      .count,
      .arrow {
        font: 600 0.74rem/1 'IBM Plex Mono', monospace;
      }

      .count {
        color: #90f0de;
      }

      .arrow {
        color: #dcecff;
      }

      .quick-start-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(240px, 0.9fr);
        gap: 1rem;
        align-items: start;
      }

      pre {
        margin: 0;
        padding: 1rem;
        border-radius: 1rem;
        background: rgba(5, 10, 18, 0.9);
        border: 1px solid rgba(129, 168, 222, 0.14);
        color: #d9ebff;
        font-size: 0.9rem;
        overflow-x: auto;
      }

      @media (max-width: 960px) {
        .hero,
        .quick-start-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .home-shell {
          padding: 1rem 0 2rem;
        }

        .hero-copy,
        .metric-panel,
        .note-panel,
        .content-section {
          padding: 0.95rem;
          border-radius: 1.15rem;
        }

        h1 {
          font-size: clamp(2.35rem, 12vw, 3.4rem);
        }

        .tagline {
          font-size: 0.98rem;
          line-height: 1.6;
        }

        .hero-actions {
          display: grid;
          grid-template-columns: 1fr;
        }

        .library-grid {
          grid-template-columns: 1fr;
        }

        .library-card {
          padding: 1rem;
        }

        .section-heading h2 {
          font-size: 1.15rem;
        }
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly libraries: LibraryCard[] = [
    {
      path: '/motion-ui',
      name: 'Motion UI',
      description:
        'Ambient backgrounds and decorative motion primitives built with CSS and Three.js.',
      componentCount: 9,
      category: 'Decorative',
    },
    {
      path: '/common-ui',
      name: 'Common UI',
      description:
        'Core UI primitives: buttons, cards, modals, tables, lists, and layout components.',
      componentCount: 18,
      category: 'Core',
    },
    {
      path: '/form-ui',
      name: 'Form UI',
      description:
        'Form inputs: text fields, checkboxes, radio buttons, selects, and file uploads.',
      componentCount: 6,
      category: 'Forms',
    },
    {
      path: '/theme-ui',
      name: 'Theme UI',
      description:
        'Theming controls: palette selectors, personality previews, and design token managers.',
      componentCount: 6,
      category: 'Theming',
    },
    {
      path: '/navigation-ui',
      name: 'Navigation UI',
      description:
        'Navigation components: app bars, sidebars, and navigation menus.',
      componentCount: 3,
      category: 'Navigation',
    },
    {
      path: '/social-ui',
      name: 'Social UI',
      description:
        'Social components: posts, comments, compose editors, and activity feeds.',
      componentCount: 4,
      category: 'Social',
    },
    {
      path: '/notification-ui',
      name: 'Notification UI',
      description:
        'Notification components: bells, lists, and real-time update indicators.',
      componentCount: 2,
      category: 'Feedback',
    },
    {
      path: '/store-ui',
      name: 'Store UI',
      description:
        'E-commerce components: product cards, lists, shopping carts, and donations.',
      componentCount: 4,
      category: 'Commerce',
    },
    {
      path: '/auth-ui',
      name: 'Auth UI',
      description:
        'Authentication workflow primitives for login, registration, email confirmation, and MFA.',
      componentCount: 4,
      category: 'Workflow',
    },
    {
      path: '/profile-ui',
      name: 'Profile UI',
      description:
        'Profile management surfaces for selectors, editors, and identity banners.',
      componentCount: 3,
      category: 'Workflow',
    },
    {
      path: '/chat-ui',
      name: 'Chat UI',
      description:
        'Conversation primitives for contact rosters and embedded chat windows.',
      componentCount: 2,
      category: 'Workflow',
    },
    {
      path: '/message-ui',
      name: 'Message UI',
      description:
        'Dismissible message stack for system alerts and inline workflow feedback.',
      componentCount: 1,
      category: 'Workflow',
    },
    {
      path: '/search-ui',
      name: 'Search UI',
      description:
        'Search and exploration surfaces for people, communities, and content discovery.',
      componentCount: 2,
      category: 'Discovery',
    },
    {
      path: '/persona-ui',
      name: 'Persona UI',
      description:
        'Assistant persona picker for selecting AI helpers and working modes.',
      componentCount: 1,
      category: 'Discovery',
    },
    {
      path: '/ag-grid-ui',
      name: 'AG Grid UI',
      description:
        'Theme-aware enterprise data grid wrapper for dense application tables.',
      componentCount: 1,
      category: 'Data',
    },
  ];

  get totalComponents(): number {
    return this.libraries.reduce(
      (total, library) => total + library.componentCount,
      0
    );
  }
}
