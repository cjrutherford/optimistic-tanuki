import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  FinCommanderPlanStore,
  FinCommanderScenario,
} from '@optimistic-tanuki/fin-commander-data-access';

function createScenarioId(): string {
  return `scenario-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

@Component({
  selector: 'fc-scenarios-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <span class="eyebrow">Scenarios</span>
        <h2>Model what-if assumptions</h2>
      </header>

      <!-- ── SCENARIO EDITOR ────────────────────────────────────── -->
      <form class="editor-card" (ngSubmit)="saveScenario()" novalidate>
        <div class="editor-header">
          <span class="editor-eyebrow">New Scenario</span>
          <h3 class="editor-title">Model a what-if</h3>
        </div>

        <div class="editor-grid">
          <div class="field">
            <label class="field-label" for="name">Scenario name</label>
            <input
              id="name"
              class="field-input"
              [(ngModel)]="draft.name"
              (ngModelChange)="onDraftChange()"
              name="name"
              placeholder="e.g., Job Change"
              required
            />
          </div>
          <div class="field field-wide">
            <label class="field-label" for="summary">Summary</label>
            <input
              id="summary"
              class="field-input"
              [(ngModel)]="draft.summary"
              (ngModelChange)="onDraftChange()"
              name="summary"
              placeholder="Brief description of the scenario"
              required
            />
          </div>

          <div class="assumption-section">
            <span class="assumption-section-label">First assumption</span>
          </div>

          <div class="field">
            <label class="field-label" for="assumptionLabel"
              >Assumption label</label
            >
            <input
              id="assumptionLabel"
              class="field-input"
              [(ngModel)]="assumptionLabel"
              (ngModelChange)="onDraftChange()"
              name="assumptionLabel"
              placeholder="e.g., Salary increase"
              required
            />
          </div>
          <div class="field">
            <label class="field-label" for="assumptionDelta">Delta</label>
            <input
              id="assumptionDelta"
              class="field-input"
              [(ngModel)]="assumptionDelta"
              (ngModelChange)="onDraftChange()"
              name="assumptionDelta"
              placeholder="+$15,000/year"
              required
            />
          </div>
          <div class="field">
            <label class="field-label" for="assumptionImpact"
              >Impact area</label
            >
            <select
              id="assumptionImpact"
              class="field-input field-select"
              [(ngModel)]="assumptionImpact"
              name="assumptionImpact"
            >
              <option value="income">💵 Income</option>
              <option value="spend">💸 Spend</option>
              <option value="savings">🏦 Savings</option>
              <option value="debt">📉 Debt</option>
            </select>
          </div>
        </div>

        <div class="editor-footer">
          @if (draftErrors().length > 0) {
          <ul class="hint-errors" role="alert" aria-live="assertive">
            @for (err of draftErrors(); track err) {
            <li>{{ err }}</li>
            }
          </ul>
          }
          <button
            type="submit"
            class="btn-primary"
            [disabled]="draftErrors().length > 0"
          >
            Create Scenario
            <span class="btn-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </form>

      <p class="sr-status" role="status" aria-live="polite">
        {{ statusMessage() }}
      </p>

      <!-- ── SCENARIOS GRID ──────────────────────────────────────── -->
      @if (scenarios().length > 0) {
      <div class="scenarios-grid">
        @for (scenario of scenarios(); track scenario.id; let i = $index) {
        <article class="scenario-card" [style.animation-delay]="i * 0.07 + 's'">
          <div class="scenario-header">
            <strong class="scenario-name">{{ scenario.name }}</strong>
            <span class="assumption-badge">
              {{ scenario.assumptions.length }}
              {{
                scenario.assumptions.length === 1 ? 'assumption' : 'assumptions'
              }}
            </span>
          </div>

          @if (scenario.summary) {
          <p class="scenario-summary">{{ scenario.summary }}</p>
          }

          <div class="assumptions-list">
            @for (assumption of scenario.assumptions; track assumption.id) {
            <div
              class="assumption-chip"
              [attr.data-impact]="assumption.impactArea"
            >
              <span class="impact-icon">{{
                getImpactIcon(assumption.impactArea)
              }}</span>
              <span class="assumption-label">{{ assumption.label }}</span>
              <span class="assumption-delta">{{ assumption.delta }}</span>
            </div>
            }
          </div>

          <div class="scenario-footer">
            @if (pendingDeleteId() === scenario.id) {
            <span class="confirm-prompt" role="alert">
              Delete this scenario?
            </span>
            <button type="button" class="btn-ghost" (click)="cancelDelete()">
              Cancel
            </button>
            <button
              type="button"
              class="btn-danger"
              (click)="confirmDelete(scenario.id)"
            >
              Confirm remove
            </button>
            } @else {
            <button
              type="button"
              class="btn-danger"
              (click)="requestDelete(scenario.id)"
              [attr.aria-label]="'Remove scenario ' + scenario.name"
            >
              Remove
            </button>
            }
          </div>
        </article>
        }
      </div>
      } @else {
      <div class="scenarios-empty">
        <span class="empty-glyph">◈</span>
        <p>No scenarios yet. Model your first what-if above.</p>
      </div>
      }
    </section>
  `,
  styles: [
    `
      @keyframes cardReveal {
        from {
          opacity: 0;
          transform: translateY(14px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      .page {
        display: grid;
        gap: 1.75rem;
      }

      .page-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.62rem;
        font-weight: 700;
        color: var(--secondary, var(--primary));
        background: color-mix(
          in srgb,
          var(--secondary, var(--primary)) 12%,
          transparent
        );
        border-radius: var(--fc-button-radius, 9999px);
      }

      h2 {
        margin: 0;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: clamp(1.2rem, 2.5vw, 1.5rem);
        font-weight: 700;
        color: var(--foreground);
      }

      /* ─── EDITOR CARD ────────────────────────────────────────── */
      .editor-card {
        background: color-mix(in srgb, var(--surface) 90%, transparent);
        backdrop-filter: blur(14px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--secondary, var(--primary)) 28%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        overflow: hidden;
        box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
      }

      .editor-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid
          color-mix(in srgb, var(--border) 35%, transparent);
        background: color-mix(
          in srgb,
          var(--secondary, var(--primary)) 5%,
          transparent
        );
        display: grid;
        gap: 0.2rem;
      }

      .editor-eyebrow {
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-weight: 700;
        color: var(--secondary, var(--primary));
      }

      .editor-title {
        margin: 0;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground);
      }

      .editor-grid {
        display: grid;
        gap: 1.1rem;
        grid-template-columns: repeat(2, 1fr);
        padding: 1.5rem;
      }

      .field {
        display: grid;
        gap: 0.4rem;
      }

      .field-wide {
        grid-column: span 2;
      }

      .assumption-section {
        grid-column: span 2;
        padding-top: 0.5rem;
        border-top: 1px solid color-mix(in srgb, var(--border) 30%, transparent);
      }

      .assumption-section-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-weight: 700;
        color: var(--muted);
      }

      .field-label {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--muted);
      }

      .field-input {
        width: 100%;
        padding: 0.8rem 1rem;
        border-radius: var(--fc-input-radius, 14px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 55%, transparent);
        background: color-mix(in srgb, var(--surface) 75%, transparent);
        color: var(--foreground);
        font: inherit;
        font-size: 0.9rem;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        outline: none;

        &:focus {
          border-color: var(--secondary, var(--primary));
          box-shadow: 0 0 0 3px
            color-mix(
              in srgb,
              var(--secondary, var(--primary)) 16%,
              transparent
            );
        }

        &::placeholder {
          color: color-mix(in srgb, var(--muted) 55%, transparent);
        }
      }

      .field-select {
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%2364748b' d='M6 8L0 0h12z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 1rem center;
        padding-right: 2.5rem;
        cursor: pointer;
      }

      .editor-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .hint-errors {
        list-style: disc inside;
        margin: 0 auto 0 0;
        padding: 0;
        display: grid;
        gap: 0.25rem;
        font-size: 0.78rem;
        color: var(--danger, #dc2626);
      }

      .sr-status {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .confirm-prompt {
        margin-right: auto;
        font-size: 0.78rem;
        font-weight: 600;
        color: var(--danger, #dc2626);
      }

      .btn-ghost {
        padding: 0.5rem 1.1rem;
        background: transparent;
        color: var(--foreground);
        font-size: 0.74rem;
        font-weight: 600;
        border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
        border-radius: var(--fc-button-radius, 9999px);
        cursor: pointer;
        margin-right: 0.5rem;
        transition: var(--fc-transition);

        &:hover {
          border-color: var(--primary);
          color: var(--primary);
        }
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.8rem 1.75rem;
        background: var(--secondary, var(--primary));
        color: var(--background);
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 0.88rem;
        font-weight: 700;
        border: none;
        border-radius: var(--fc-button-radius, 9999px);
        cursor: pointer;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px
            color-mix(
              in srgb,
              var(--secondary, var(--primary)) 38%,
              transparent
            );
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }

      .btn-arrow {
        font-size: 1rem;
      }

      /* ─── SCENARIOS GRID ─────────────────────────────────────── */
      .scenarios-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      }

      .scenario-card {
        display: grid;
        gap: 0.9rem;
        padding: 1.35rem;
        background: color-mix(in srgb, var(--surface) 88%, transparent);
        backdrop-filter: blur(10px);
        border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );
        animation: cardReveal 0.55s
          var(--fc-transition-easing, cubic-bezier(0.16, 1, 0.3, 1)) both;

        &:hover {
          transform: translateY(-4px);
          box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
          border-color: color-mix(
            in srgb,
            var(--secondary, var(--primary)) 35%,
            transparent
          );
        }
      }

      .scenario-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .scenario-name {
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--foreground);
        line-height: 1.3;
      }

      .assumption-badge {
        flex-shrink: 0;
        padding: 0.28rem 0.7rem;
        background: color-mix(
          in srgb,
          var(--secondary, var(--primary)) 12%,
          transparent
        );
        color: var(--secondary, var(--primary));
        font-size: 0.68rem;
        font-weight: 700;
        border-radius: var(--fc-button-radius, 9999px);
        white-space: nowrap;
      }

      .scenario-summary {
        margin: 0;
        font-size: 0.88rem;
        color: var(--muted);
        line-height: 1.55;
      }

      .assumptions-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .assumption-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        padding: 0.45rem 0.85rem;
        border-radius: var(--fc-button-radius, 9999px);
        font-size: 0.78rem;
        border: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
        background: color-mix(
          in srgb,
          var(--surface) 95%,
          var(--foreground) 5%
        );

        &[data-impact='income'] {
          background: color-mix(
            in srgb,
            var(--success, #22c55e) 10%,
            transparent
          );
          border-color: color-mix(
            in srgb,
            var(--success, #22c55e) 28%,
            transparent
          );
        }
        &[data-impact='spend'] {
          background: color-mix(
            in srgb,
            var(--warning, #f59e0b) 10%,
            transparent
          );
          border-color: color-mix(
            in srgb,
            var(--warning, #f59e0b) 28%,
            transparent
          );
        }
        &[data-impact='savings'] {
          background: color-mix(in srgb, var(--primary) 10%, transparent);
          border-color: color-mix(in srgb, var(--primary) 28%, transparent);
        }
        &[data-impact='debt'] {
          background: color-mix(
            in srgb,
            var(--danger, #dc2626) 10%,
            transparent
          );
          border-color: color-mix(
            in srgb,
            var(--danger, #dc2626) 28%,
            transparent
          );
        }
      }

      .impact-icon {
        font-size: 0.88rem;
      }

      .assumption-label {
        font-weight: 600;
        color: var(--foreground);
      }

      .assumption-delta {
        color: var(--muted);
        font-size: 0.75rem;
      }

      .scenario-footer {
        padding-top: 0.6rem;
        border-top: 1px solid color-mix(in srgb, var(--border) 25%, transparent);
        display: flex;
        justify-content: flex-end;
      }

      .btn-danger {
        padding: 0.5rem 1.1rem;
        background: color-mix(in srgb, var(--danger, #dc2626) 10%, transparent);
        color: var(--danger, #dc2626);
        font-size: 0.74rem;
        font-weight: 600;
        border: 1px solid
          color-mix(in srgb, var(--danger, #dc2626) 25%, transparent);
        border-radius: var(--fc-button-radius, 9999px);
        cursor: pointer;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          background: var(--danger, #dc2626);
          color: #fff;
          border-color: var(--danger, #dc2626);
        }
      }

      /* ─── EMPTY STATE ──────────────────────────────────────── */
      .scenarios-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 3rem 2rem;
        text-align: center;
        background: color-mix(in srgb, var(--surface) 85%, transparent);
        border: 1px dashed color-mix(in srgb, var(--border) 50%, transparent);
        border-radius: var(--fc-card-radius, 18px);

        p {
          margin: 0;
          font-size: 0.9rem;
          color: var(--muted);
        }
      }

      .empty-glyph {
        font-size: 2rem;
        color: var(--secondary, var(--primary));
        opacity: 0.4;
      }

      /* ─── RESPONSIVE ───────────────────────────────────────── */
      @media (max-width: 640px) {
        .editor-grid {
          grid-template-columns: 1fr;
        }
        .field-wide,
        .assumption-section {
          grid-column: span 1;
        }
      }
    `,
  ],
})
export class ScenariosPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(FinCommanderPlanStore);
  private readonly routePlanId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('planId'))),
    { initialValue: this.route.snapshot.paramMap.get('planId') }
  );

  readonly scenarios = signal<FinCommanderScenario[]>([]);
  readonly pendingDeleteId = signal<string | null>(null);
  readonly statusMessage = signal('');
  readonly draftVersion = signal(0);
  readonly draftErrors = computed(() => {
    this.draftVersion();
    const errors: string[] = [];
    if (!this.draft.name.trim()) errors.push('Scenario name is required.');
    if (!this.draft.summary.trim()) errors.push('Summary is required.');
    if (!this.assumptionLabel.trim())
      errors.push('Assumption label is required.');
    if (!this.assumptionDelta.trim())
      errors.push('Assumption delta is required.');
    return errors;
  });
  private planId = '';

  draft: FinCommanderScenario = {
    id: 'scenario-new',
    planId: this.planId,
    name: '',
    summary: '',
    assumptions: [],
  };

  assumptionLabel = '';
  assumptionDelta = '';
  assumptionImpact: 'income' | 'spend' | 'savings' | 'debt' = 'spend';

  constructor() {
    effect(() => {
      this.store.getScope();

      this.planId = this.routePlanId() ?? this.store.listPlans()[0]?.id ?? '';
      this.resetDraft();
      this.loadScenarios();
    });
  }

  getImpactIcon(impact: string): string {
    switch (impact) {
      case 'income':
        return '💵';
      case 'spend':
        return '💸';
      case 'savings':
        return '🏦';
      case 'debt':
        return '📉';
      default:
        return '📊';
    }
  }

  saveScenario() {
    this.bumpDraft();
    if (this.draftErrors().length > 0) return;
    const name = this.draft.name.trim();
    this.store.saveScenario({
      ...this.draft,
      id: createScenarioId(),
      assumptions: [
        {
          id: createScenarioId(),
          label: this.assumptionLabel,
          delta: this.assumptionDelta,
          impactArea: this.assumptionImpact,
        },
      ],
    });
    this.statusMessage.set(`Scenario "${name}" saved.`);
    this.resetDraft();
    this.loadScenarios();
  }

  requestDelete(scenarioId: string) {
    this.pendingDeleteId.set(scenarioId);
  }

  cancelDelete() {
    this.pendingDeleteId.set(null);
  }

  confirmDelete(scenarioId: string) {
    const removed = this.scenarios().find(
      (scenario) => scenario.id === scenarioId
    );
    this.store.deleteScenario(scenarioId);
    this.pendingDeleteId.set(null);
    this.statusMessage.set(
      removed ? `Removed scenario "${removed.name}".` : 'Scenario removed.'
    );
    this.loadScenarios();
  }

  onDraftChange() {
    this.bumpDraft();
  }

  private bumpDraft() {
    this.draftVersion.update((value) => value + 1);
  }

  /** @deprecated Kept for backwards compatibility; use {@link requestDelete} + {@link confirmDelete}. */
  deleteScenario(scenarioId: string) {
    this.confirmDelete(scenarioId);
  }

  private loadScenarios() {
    this.scenarios.set(
      this.planId ? this.store.listScenarios(this.planId) : []
    );
  }

  private resetDraft() {
    this.draft = {
      id: 'scenario-new',
      planId: this.planId,
      name: '',
      summary: '',
      assumptions: [],
    };
    this.assumptionLabel = '';
    this.assumptionDelta = '';
    this.assumptionImpact = 'spend';
    this.bumpDraft();
  }
}
