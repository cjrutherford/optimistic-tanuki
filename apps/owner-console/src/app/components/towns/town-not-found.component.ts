import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Shown in place of a town page when the URL names a town that is not there. */
@Component({
  selector: 'app-town-not-found',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="not-found" role="alert">
      <h1>Town not found</h1>
      <p>
        There is no town with the id <code>{{ townId() }}</code
        >. It may have been removed, or the link may be wrong.
      </p>
      <a class="back" routerLink="/dashboard/towns">Back to all towns</a>
    </section>
  `,
  styles: [
    `
      .not-found {
        max-width: 40rem;
        padding: 24px;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: var(--personality-card-radius, 16px);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
        font-family: var(--font-body, inherit);
      }

      h1 {
        margin: 0 0 8px;
        font-family: var(--font-heading, inherit);
        font-size: var(--type-h2, 1.5rem);
      }

      code {
        font-family: var(--font-mono, monospace);
        overflow-wrap: anywhere;
      }

      .back {
        color: var(--primary-text, var(--primary));
        font-weight: 700;
      }
    `,
  ],
})
export class TownNotFoundComponent {
  readonly townId = input.required<string>();
}
