import { Component, Input, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { LearningDataService } from './learning-data.service';
import { LearningAuthService, SignedInPerson } from './learning-auth.service';

@Component({
  selector: 'learning-layout',
  imports: [RouterLink, RouterLinkActive, AsyncPipe],
  template: ` <header class="topbar">
      <a routerLink="/">Let&rsquo;s Go</a>
      <span class="tagline">Learn anything, in the open</span>
      <!--
        The only place the app says who you are, and the only way in for
        somebody who is not signed in. Reading is open to everyone, so this is
        an invitation rather than a gate.
      -->
      <span class="session">
        @if (person(); as signedIn) {
        <span class="who">{{ signedIn.name }}</span>
        <a routerLink="/author">Write</a>
        <button type="button" (click)="signOut()">Sign out</button>
        } @else {
        <a routerLink="/sign-in">Sign in</a>
        }
      </span>
    </header>
    <div class="studio">
      <aside aria-label="Course navigation">
        <a routerLink="/" class="brand">Catalog</a>
        <nav>
          <a
            routerLink="/"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: true }"
            >Browse courses</a
          ><a routerLink="/dashboard" routerLinkActive="active"
            >Your progress</a
          >
          <!--
            Modules appear only for the course being read. This sidebar used to
            list every module of every track on every page, which is forty
            entries before a visitor has chosen anything.
          -->
          @if (trackId) {@if (dashboard$ | async; as paths) {@for (path of
          paths; track path.program.id) {@if (path.program.id === trackId) {
          <p>{{ path.program.displayName }}</p>
          @for (offering of path.program.offerings; track offering.id) {@for
          (module of offering.modules; track module.id) {<a
            [routerLink]="['/module', path.program.id, module.id]"
            routerLinkActive="active"
            >{{ module.title }}</a
          >}}}}}}
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
        font: 0.72rem var(--lx-font-mono, ui-monospace, monospace);
      }
      .topbar > a {
        color: var(--lx-accent);
        font-weight: 800;
        text-decoration: none;
      }
      .tagline {
        flex: 1;
      }
      .session {
        display: flex;
        gap: 0.8rem;
        align-items: center;
      }
      .session .who {
        color: var(--lx-text);
        font-weight: 700;
      }
      .session a {
        color: var(--lx-accent);
        text-decoration: none;
      }
      .session button {
        border: 0;
        background: transparent;
        color: var(--lx-text-muted);
        font: inherit;
        cursor: pointer;
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
        font: 700 0.65rem var(--lx-font-mono, ui-monospace, monospace);
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
        /*
          Only the tagline goes. This used to hide every span in the bar,
          which took the whole session block with it once one was added:
          on a phone there was no way to sign in, sign out, or reach Write.
        */
        .tagline {
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
  private readonly auth = inject(LearningAuthService);
  private readonly router = inject(Router);

  readonly person = signal<SignedInPerson | null>(null);

  constructor() {
    this.auth.me().subscribe((person) => this.person.set(person));
  }

  protected signOut(): void {
    this.auth.logout().subscribe(() => {
      this.person.set(null);
      // A full reload, because everything on the page was fetched as the
      // person who is now signed out.
      this.router.navigateByUrl('/').then(() => location.reload());
    });
  }

  /**
   * The course being read, if any.
   *
   * Absent on the catalog and the dashboard, which is what keeps the module
   * list out of the way until somebody has chosen something.
   */
  @Input() trackId = '';

  readonly dashboard$ = inject(LearningDataService).dashboard();
}
