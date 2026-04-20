import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FinanceOnboardingState, FinanceWorkspace } from '../models';
import { FinanceService } from '../services/finance.service';

@Component({
  selector: 'ot-finance-setup-checklist',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="setup-checklist">
      <header>
        <p class="eyebrow">Guided Setup</p>
        <h1>{{ workspaceLabel() }} setup checklist</h1>
        <p>Finish these tasks to unlock more accurate planning and coaching.</p>
      </header>

      @if (state(); as setupState) {
      <div class="grid">
        @for (item of checklistItems(setupState); track item.id) {
        <article class="task" [class.complete]="item.complete">
          <strong>{{ item.label }}</strong>
          <span>{{ item.complete ? 'Done' : 'Needs attention' }}</span>
          <a [routerLink]="item.route">{{ item.action }}</a>
        </article>
        }
      </div>
      }
    </section>
  `,
  styles: [
    `
      .setup-checklist {
        display: grid;
        gap: 16px;
        color: var(--foreground, #1f2937);
        font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif);
      }
      .eyebrow {
        margin: 0 0 8px;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-size: 12px;
        color: var(--muted, #6b7280);
      }
      h1 {
        margin: 0 0 8px;
        font-size: clamp(28px, 4vw, 40px);
        font-family: var(--font-heading, 'Helvetica Neue', Arial, sans-serif);
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }
      .task {
        padding: 18px;
        border-radius: var(--border-radius-lg, 18px);
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, rgba(148, 163, 184, 0.2));
        display: grid;
        gap: 8px;
      }
      .task.complete {
        border-color: var(--success, #16a34a);
      }
      .task a {
        color: var(--primary, #2563eb);
        font-weight: 700;
        text-decoration: none;
      }
    `,
  ],
})
export class SetupChecklistComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<FinanceOnboardingState | null>(null);
  readonly workspace = signal<FinanceWorkspace>('personal');

  async ngOnInit() {
    this.workspace.set(
      (this.route.snapshot.paramMap.get('workspace') ??
        'personal') as FinanceWorkspace
    );
    this.state.set(await this.financeService.getOnboardingState());
  }

  workspaceLabel(): string {
    if (this.workspace() === 'business') {
      return 'Business';
    }

    if (this.workspace() === 'net-worth') {
      return 'Net worth';
    }

    return 'Personal';
  }

  checklistItems(state: FinanceOnboardingState) {
    const workspace = this.workspace();
    const items = [
      {
        id: 'accounts',
        label: 'Create or review workspace accounts',
        complete: state.availableWorkspaces.includes(workspace),
        action: 'Open accounts',
        route: `/finance/${workspace}/accounts`,
      },
      {
        id: 'transactions',
        label: 'Categorize early transactions',
        complete: false,
        action: 'Review transactions',
        route: `/finance/${workspace}/transactions`,
      },
      {
        id: 'budget',
        label: 'Create at least one active budget',
        complete:
          state.checklist.find((item) => item.id === 'create-budget')
            ?.complete ?? false,
        action: 'Open budgets',
        route: `/finance/${workspace}/budgets`,
      },
    ];

    if (workspace === 'net-worth') {
      return items.filter((item) => item.id !== 'budget');
    }

    return items;
  }
}
