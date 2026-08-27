import { Component, input, output } from '@angular/core';

/**
 * The offer to install the app.
 *
 * Deliberately quiet and deliberately dismissible. A browser only fires the
 * event behind this once, and a banner nobody asked for is the most-hated
 * pattern on the mobile web, so this sits at the foot of the page rather than
 * across the top of it and stays gone once refused.
 *
 * Presentational only. Whoever uses it owns the browser event, because that
 * event is not something a component in a library should be reaching for.
 */
@Component({
  selector: 'otlearn-install-prompt',
  template: `
    <aside class="prompt" role="complementary" aria-label="Install this app">
      <div class="words">
        <p class="headline">Keep it on your home screen</p>
        <p class="detail">
          Installed, it opens like an app and lessons you have read stay
          readable without a connection.
        </p>
      </div>
      <div class="actions">
        <button type="button" class="install" (click)="install.emit()">
          Install
        </button>
        <button type="button" class="dismiss" (click)="dismiss.emit()">
          Not now
        </button>
      </div>
    </aside>
  `,
  styles: [
    `
      .prompt {
        display: flex;
        gap: 1rem;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        margin-top: 2.5rem;
        padding: 1rem 1.1rem;
        border: 1px dashed var(--lx-border-strong, currentColor);
        border-radius: var(--lx-radius, 2px);
        background: var(--lx-well, transparent);
      }
      .words {
        display: grid;
        gap: 0.25rem;
        min-width: 0;
      }
      .headline {
        margin: 0;
        color: var(--lx-accent, currentColor);
        font: 700 0.72rem var(--lx-font-mono, ui-monospace, monospace);
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .detail {
        margin: 0;
        max-width: 52ch;
        color: var(--lx-text-muted, currentColor);
        font-size: 0.88rem;
        line-height: 1.5;
      }
      .actions {
        display: flex;
        gap: 0.6rem;
        align-items: center;
      }
      button {
        min-height: 44px;
        padding: 0.5rem 0.9rem;
        border-radius: var(--lx-radius, 2px);
        font: inherit;
        cursor: pointer;
      }
      .install {
        border: 1px solid var(--lx-accent, currentColor);
        background: transparent;
        color: var(--lx-accent, currentColor);
      }
      .dismiss {
        border: 0;
        background: transparent;
        color: var(--lx-text-muted, currentColor);
        text-decoration: underline;
      }
    `,
  ],
})
export class InstallPromptComponent {
  /** Only shown when the browser has actually offered an install. */
  readonly available = input<boolean>(false);

  readonly install = output<void>();
  readonly dismiss = output<void>();
}
