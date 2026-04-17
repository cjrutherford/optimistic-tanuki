import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FinCommanderImportWorkbenchComponent } from '@optimistic-tanuki/fin-commander-imports';

@Component({
  selector: 'fc-imports-page',
  standalone: true,
  imports: [CommonModule, FinCommanderImportWorkbenchComponent],
  template: `
    <section class="page">
      <header class="page-header">
        <span class="eyebrow">Imports</span>
        <h2>Transaction intake and reconciliation</h2>
      </header>
      <div class="workbench-container">
        <fc-fin-commander-import-workbench></fc-fin-commander-import-workbench>
      </div>
    </section>
  `,
  styles: [
    `
      .page {
        display: grid;
        gap: 1.5rem;
      }

      .page-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .eyebrow {
        display: inline-block;
        padding: 0.25rem 0.7rem;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.62rem;
        font-weight: 700;
        color: var(--warning, #f59e0b);
        background: color-mix(
          in srgb,
          var(--warning, #f59e0b) 12%,
          transparent
        );
        border-radius: var(--fc-button-radius, 9999px);
      }

      h2 {
        margin: 0;
        font-family: var(
          --fc-font-heading,
          var(--font-heading, 'Sora', sans-serif)
        );
        font-size: clamp(1.2rem, 2.5vw, 1.5rem);
        font-weight: 600;
        color: var(--foreground);
      }

      .workbench-container {
        background: color-mix(in srgb, var(--surface) 88%, transparent);
        backdrop-filter: blur(12px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 50%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        padding: 1.5rem;
        box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
      }
    `,
  ],
})
export class ImportsPageComponent {}
