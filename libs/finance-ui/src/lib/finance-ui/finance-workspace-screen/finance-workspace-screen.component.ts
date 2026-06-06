import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ot-finance-workspace-screen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="workspace-screen">
      <header class="workspace-header">
        <div class="workspace-copy">
          <p class="eyebrow">{{ eyebrow }}</p>
          <h1>{{ title }}</h1>
          <p class="lede">{{ lede }}</p>
        </div>

        <div class="workspace-actions">
          <ng-content select="[screen-actions]"></ng-content>
        </div>
      </header>

      <section class="workspace-toolbar">
        <ng-content select="[screen-toolbar]"></ng-content>
      </section>

      <section class="workspace-main">
        <ng-content></ng-content>
      </section>

      @if (status) {
      <p class="status-copy">{{ status }}</p>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .workspace-screen {
        display: grid;
        gap: 1rem;
        color: var(--foreground, #1f2937);
        font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif);
      }

      .workspace-header {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: var(--border-radius-lg, 18px);
        border: 1px solid
          color-mix(in srgb, var(--border, #94a3b8) 35%, transparent);
        background: linear-gradient(
          135deg,
          color-mix(
            in srgb,
            var(--surface, #ffffff) 88%,
            var(--primary, #2563eb) 12%
          ),
          color-mix(in srgb, var(--surface, #ffffff) 94%, transparent)
        );
      }

      .workspace-copy {
        display: grid;
        gap: 0.5rem;
        max-width: 56rem;
      }

      .eyebrow {
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.75rem;
        color: var(--muted, #6b7280);
      }

      h1 {
        margin: 0;
        font-size: clamp(1.75rem, 3vw, 2.4rem);
        line-height: 1.1;
      }

      .lede,
      .status-copy {
        margin: 0;
        color: var(--muted, #6b7280);
      }

      .workspace-actions {
        display: flex;
        justify-content: end;
        align-items: start;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .workspace-toolbar,
      .workspace-main {
        display: grid;
        gap: 1rem;
      }

      :host ::ng-deep .workspace-panel,
      :host ::ng-deep .workspace-grid-panel {
        background: var(--surface, #ffffff);
        border-radius: var(--border-radius-lg, 18px);
        border: 1px solid
          color-mix(in srgb, var(--border, #94a3b8) 30%, transparent);
        box-shadow: var(--shadow-sm, 0 1px 2px rgba(15, 23, 42, 0.08));
      }

      :host ::ng-deep .workspace-panel {
        padding: 1rem;
      }

      :host ::ng-deep .workspace-grid-panel {
        padding: 0.75rem;
      }

      :host ::ng-deep .workspace-panel-title {
        margin: 0 0 0.35rem;
        font-size: 1rem;
      }

      :host ::ng-deep .workspace-panel-copy {
        margin: 0;
        color: var(--muted, #6b7280);
      }

      :host ::ng-deep .workspace-form,
      :host ::ng-deep .workspace-filter-row {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
        gap: 0.75rem;
      }

      :host ::ng-deep .workspace-form input,
      :host ::ng-deep .workspace-form select,
      :host ::ng-deep .workspace-form button,
      :host ::ng-deep .workspace-filter-row input,
      :host ::ng-deep .workspace-filter-row select,
      :host ::ng-deep .workspace-filter-row button,
      :host ::ng-deep .workspace-actions button {
        min-height: 2.75rem;
        padding: 0.75rem 0.9rem;
        border-radius: var(--border-radius-md, 12px);
        border: 1px solid
          color-mix(in srgb, var(--border, #94a3b8) 36%, transparent);
        background: var(--background, #ffffff);
        color: var(--foreground, #1f2937);
      }

      :host ::ng-deep .workspace-form button,
      :host ::ng-deep .workspace-actions button,
      :host ::ng-deep .workspace-button-primary {
        background: var(--primary, #2563eb);
        color: var(--background, #ffffff);
        border-color: color-mix(
          in srgb,
          var(--primary, #2563eb) 70%,
          transparent
        );
        font-weight: 700;
      }

      :host ::ng-deep .workspace-button-danger {
        background: #991b1b;
        color: #ffffff;
        border-color: rgba(153, 27, 27, 0.45);
      }

      @media (max-width: 720px) {
        .workspace-header {
          grid-template-columns: 1fr;
          display: grid;
        }

        .workspace-actions {
          justify-content: start;
        }
      }
    `,
  ],
})
export class FinanceWorkspaceScreenComponent {
  @Input({ required: true }) eyebrow = '';
  @Input({ required: true }) title = '';
  @Input({ required: true }) lede = '';
  @Input() status = '';
}
