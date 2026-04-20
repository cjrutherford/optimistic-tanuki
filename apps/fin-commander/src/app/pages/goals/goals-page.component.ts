import { CommonModule } from '@angular/common';
import {
  Component,
  effect,
  inject,
  signal,
  ChangeDetectionStrategy,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import {
  FinCommanderGoal,
  FinCommanderPlanStore,
} from '@optimistic-tanuki/fin-commander-data-access';

function createGoalId(): string {
  return `goal-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

@Component({
  selector: 'fc-goals-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.Default,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="page-header">
        <span class="eyebrow">Goals</span>
        <h2>Plan targets with visible progress</h2>
      </header>

      <!-- ── GOAL EDITOR ──────────────────────────────────────── -->
      <form class="editor-card" (ngSubmit)="saveGoal()" novalidate>
        <div class="editor-header">
          <span class="editor-eyebrow">New Goal</span>
          <h3 class="editor-title">Create a target</h3>
        </div>

        <div class="editor-grid">
          <div class="field field-wide">
            <label class="field-label" for="name">Goal name</label>
            <input
              id="name"
              class="field-input"
              [(ngModel)]="draft.name"
              name="name"
              placeholder="e.g., Emergency Fund"
              required
            />
          </div>
          <div class="field">
            <label class="field-label" for="targetAmount">Target amount</label>
            <div class="input-prefix-wrap">
              <span class="input-prefix">$</span>
              <input
                id="targetAmount"
                class="field-input has-prefix"
                [(ngModel)]="draft.targetAmount"
                name="targetAmount"
                type="number"
                placeholder="10,000"
                required
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="currentAmount"
              >Current amount</label
            >
            <div class="input-prefix-wrap">
              <span class="input-prefix">$</span>
              <input
                id="currentAmount"
                class="field-input has-prefix"
                [(ngModel)]="draft.currentAmount"
                name="currentAmount"
                type="number"
                placeholder="0"
                required
              />
            </div>
          </div>
          <div class="field">
            <label class="field-label" for="dueDate">Due date</label>
            <input
              id="dueDate"
              class="field-input"
              [(ngModel)]="draft.dueDate"
              name="dueDate"
              type="date"
              required
            />
          </div>
          <div class="field field-wide">
            <label class="field-label" for="strategy">Strategy</label>
            <input
              id="strategy"
              class="field-input"
              [(ngModel)]="draft.strategy"
              name="strategy"
              placeholder="Auto-transfer $500/month from checking"
              required
            />
          </div>
        </div>

        <div class="editor-footer">
          <div class="editor-footer-hint">
            @if (draft.targetAmount > 0 && draft.currentAmount >= 0) {
            <span class="hint-text">
              Starting at {{ getPreviewPercent() }}% of your target
            </span>
            }
          </div>
          <button
            type="submit"
            class="btn-primary"
            [disabled]="!draft.name.trim()"
          >
            Save Goal
            <span class="btn-arrow">→</span>
          </button>
        </div>
      </form>

      <!-- ── GOALS GRID ────────────────────────────────────────── -->
      @if (goals().length > 0) {
      <div class="goals-grid">
        @for (goal of goals(); track goal.id; let i = $index) {
        <article class="goal-card" [style.animation-delay]="i * 0.07 + 's'">
          <div class="goal-header">
            <strong class="goal-name">{{ goal.name }}</strong>
            <span
              class="goal-progress-badge"
              [class.complete]="getProgressPercent(goal) >= 100"
            >
              {{ getProgressPercent(goal) }}%
            </span>
          </div>

          <!-- Progress bar -->
          <div class="progress-track">
            <div
              class="progress-fill"
              [style.width.%]="getProgressPercent(goal)"
              [class.complete]="getProgressPercent(goal) >= 100"
            ></div>
          </div>

          <div class="goal-body">
            <div class="goal-amounts">
              <div class="amount-current">
                <span class="amount-label">Current</span>
                <span class="amount-value current">{{
                  formatCurrency(goal.currentAmount)
                }}</span>
              </div>
              <div class="amount-sep">of</div>
              <div class="amount-target">
                <span class="amount-label">Target</span>
                <span class="amount-value">{{
                  formatCurrency(goal.targetAmount)
                }}</span>
              </div>
            </div>

            @if (goal.strategy) {
            <p class="goal-strategy">{{ goal.strategy }}</p>
            }
            <span class="goal-due">
              <span class="due-icon">◷</span>
              Due {{ formatDate(goal.dueDate) }}
            </span>
          </div>

          <div class="goal-footer">
            <button
              type="button"
              class="btn-danger"
              (click)="deleteGoal(goal.id)"
            >
              Remove
            </button>
          </div>
        </article>
        }
      </div>
      } @else {
      <div class="goals-empty">
        <span class="empty-glyph">◎</span>
        <p>No goals yet. Create your first target above.</p>
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
        color: var(--primary);
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        border-radius: var(--fc-button-radius, 9999px);
      }

      h2 {
        margin: 0;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: clamp(1.2rem, 2.5vw, 1.5rem);
        font-weight: 700;
        color: var(--foreground);
      }

      /* ─── EDITOR CARD ──────────────────────────────────────── */
      .editor-card {
        background: color-mix(in srgb, var(--surface) 90%, transparent);
        backdrop-filter: blur(14px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 50%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        overflow: hidden;
        box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
      }

      .editor-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid
          color-mix(in srgb, var(--border) 35%, transparent);
        background: color-mix(in srgb, var(--primary) 4%, transparent);
        display: grid;
        gap: 0.2rem;
      }

      .editor-eyebrow {
        font-size: 0.62rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-weight: 700;
        color: var(--primary);
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
          border-color: var(--primary);
          box-shadow: 0 0 0 3px
            color-mix(in srgb, var(--primary) 18%, transparent);
        }

        &::placeholder {
          color: color-mix(in srgb, var(--muted) 55%, transparent);
        }

        &.has-prefix {
          padding-left: 2rem;
        }
      }

      .input-prefix-wrap {
        position: relative;
      }

      .input-prefix {
        position: absolute;
        left: 0.9rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--muted);
        pointer-events: none;
        z-index: 1;
      }

      .editor-footer {
        padding: 1rem 1.5rem;
        border-top: 1px solid color-mix(in srgb, var(--border) 35%, transparent);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .editor-footer-hint {
        flex: 1;
      }

      .hint-text {
        font-size: 0.78rem;
        color: var(--muted);
        font-style: italic;
      }

      .btn-primary {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.8rem 1.75rem;
        background: var(--primary);
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
            color-mix(in srgb, var(--primary) 38%, transparent);
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }

      .btn-arrow {
        font-size: 1rem;
      }

      /* ─── GOALS GRID ───────────────────────────────────────── */
      .goals-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      }

      .goal-card {
        display: grid;
        gap: 0.85rem;
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
          border-color: color-mix(in srgb, var(--primary) 35%, transparent);
        }
      }

      .goal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 0.75rem;
      }

      .goal-name {
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground);
        line-height: 1.3;
      }

      .goal-progress-badge {
        flex-shrink: 0;
        padding: 0.28rem 0.7rem;
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        color: var(--primary);
        font-size: 0.72rem;
        font-weight: 700;
        border-radius: var(--fc-button-radius, 9999px);

        &.complete {
          background: color-mix(
            in srgb,
            var(--success, #22c55e) 15%,
            transparent
          );
          color: var(--success, #22c55e);
        }
      }

      /* ─── PROGRESS BAR ─────────────────────────────────────── */
      .progress-track {
        height: 6px;
        background: color-mix(in srgb, var(--border) 40%, transparent);
        border-radius: 999px;
        overflow: hidden;
      }

      .progress-fill {
        height: 100%;
        background: linear-gradient(
          90deg,
          var(--primary),
          color-mix(in srgb, var(--primary) 75%, var(--success, #22c55e))
        );
        border-radius: 999px;
        transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);

        &.complete {
          background: linear-gradient(
            90deg,
            var(--primary),
            var(--success, #22c55e)
          );
        }
      }

      /* ─── GOAL BODY ────────────────────────────────────────── */
      .goal-body {
        display: grid;
        gap: 0.6rem;
      }

      .goal-amounts {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .amount-current,
      .amount-target {
        display: grid;
        gap: 0.1rem;
      }

      .amount-label {
        font-size: 0.6rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 600;
        color: var(--muted);
      }

      .amount-value {
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--foreground);
        font-variant-numeric: tabular-nums;

        &.current {
          color: var(--primary);
        }
      }

      .amount-sep {
        font-size: 0.75rem;
        color: var(--muted);
        padding-top: 1rem;
      }

      .goal-strategy {
        margin: 0;
        font-size: 0.82rem;
        color: var(--muted);
        line-height: 1.5;
      }

      .goal-due {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.72rem;
        color: var(--muted);
        font-weight: 500;
      }

      .due-icon {
        opacity: 0.7;
        font-size: 0.85rem;
      }

      .goal-footer {
        padding-top: 0.5rem;
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
      .goals-empty {
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
        color: var(--primary);
        opacity: 0.4;
      }

      /* ─── RESPONSIVE ───────────────────────────────────────── */
      @media (max-width: 640px) {
        .editor-grid {
          grid-template-columns: 1fr;
        }

        .field-wide {
          grid-column: span 1;
        }

        .goals-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class GoalsPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(FinCommanderPlanStore);
  private readonly routePlanId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('planId'))),
    { initialValue: this.route.snapshot.paramMap.get('planId') }
  );

  readonly goals = signal<FinCommanderGoal[]>([]);
  private planId = '';

  draft: FinCommanderGoal = {
    id: 'goal-new',
    planId: this.planId,
    name: '',
    targetAmount: 0,
    currentAmount: 0,
    dueDate: new Date().toISOString().slice(0, 10),
    strategy: '',
  };

  constructor() {
    effect(() => {
      this.store.getScope();
      this.planId = this.routePlanId() ?? this.store.listPlans()[0]?.id ?? '';
      this.resetDraft();
      this.loadGoals();
    });
  }

  getProgressPercent(goal: FinCommanderGoal): number {
    if (!goal.targetAmount) return 0;
    return Math.min(
      100,
      Math.round((goal.currentAmount / goal.targetAmount) * 100)
    );
  }

  getPreviewPercent(): number {
    if (!this.draft.targetAmount) return 0;
    return Math.min(
      100,
      Math.round((this.draft.currentAmount / this.draft.targetAmount) * 100)
    );
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  saveGoal() {
    this.store.saveGoal({ ...this.draft, id: createGoalId() });
    this.resetDraft();
    this.loadGoals();
  }

  deleteGoal(goalId: string) {
    this.store.deleteGoal(goalId);
    this.loadGoals();
  }

  private loadGoals() {
    this.goals.set(this.planId ? this.store.listGoals(this.planId) : []);
  }

  private resetDraft() {
    this.draft = {
      id: 'goal-new',
      planId: this.planId,
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      dueDate: new Date().toISOString().slice(0, 10),
      strategy: '',
    };
  }
}
