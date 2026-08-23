import { Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { LearningDataService } from './learning-data.service';

@Component({
  selector: 'learning-layout',
  imports: [RouterLink, RouterLinkActive, AsyncPipe],
  template: ` <header class="topbar">
      <a routerLink="/dashboard">Tanuki Learning Studio</a
      ><span>Internal curriculum · TypeScript · Go · C++ · Rust</span>
    </header>
    <div class="studio">
      <aside>
        <a routerLink="/dashboard" class="brand">Learning paths</a>
        <nav>
          <a
            routerLink="/dashboard"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            >Dashboard</a
          >@if (dashboard$ | async; as paths) {@for (path of paths; track
          path.program.id) {
          <p>{{ path.program.displayName }}</p>
          @for (offering of path.program.offerings; track offering.id) {@for
          (module of offering.modules; track module.id) {<a
            [routerLink]="['/module', path.program.id, module.id]"
            routerLinkActive="active"
            >{{ module.title }}</a
          >}}}}
        </nav>
      </aside>
      <main><ng-content></ng-content></main>
    </div>`,
  styles: [
    `
      .topbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.85rem 1.3rem;
        border-bottom: 1px solid var(--lx-border-soft);
        background: var(--lx-bg);
        color: var(--lx-text-subtle);
        font: 0.72rem ui-monospace, monospace;
      }
      .topbar a {
        color: var(--lx-accent);
        font-weight: 800;
        text-decoration: none;
      }
      .studio {
        display: grid;
        grid-template-columns: 250px minmax(0, 1fr);
        min-height: calc(100vh - 45px);
        background: var(--lx-bg);
        color: var(--lx-text-body);
      }
      .studio aside {
        padding: 1.25rem 0.75rem;
        border-right: 1px solid var(--lx-border-soft);
        background: var(--lx-surface);
      }
      .brand {
        display: block;
        padding: 0.6rem 0.7rem;
        color: var(--lx-accent);
        font-weight: 800;
        text-decoration: none;
      }
      .studio nav {
        display: grid;
        gap: 0.2rem;
        margin-top: 1.25rem;
      }
      .studio nav p {
        margin: 1.1rem 0.7rem 0.25rem;
        color: var(--lx-text-subtle);
        font: 700 0.65rem ui-monospace, monospace;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }
      .studio nav a {
        padding: 0.55rem 0.7rem;
        color: var(--lx-text-muted);
        text-decoration: none;
        font-size: 0.84rem;
      }
      .studio nav a.active,
      .studio nav a:hover {
        background: var(--lx-surface-active);
        color: var(--lx-text);
        border-left: 2px solid var(--lx-accent);
      }
      .studio main {
        min-width: 0;
        padding: 2.25rem;
      }
      @media (max-width: 760px) {
        .topbar span {
          display: none;
        }
        .studio {
          display: block;
        }
        .studio aside {
          border-right: 0;
          border-bottom: 1px solid var(--lx-border-soft);
          overflow: auto;
        }
        .studio nav {
          display: flex;
          width: max-content;
        }
        .studio nav p {
          display: none;
        }
        .studio main {
          padding: 1.3rem;
        }
      }
    `,
  ],
})
export class LearningLayoutComponent {
  readonly dashboard$ = inject(LearningDataService).dashboard();
}
