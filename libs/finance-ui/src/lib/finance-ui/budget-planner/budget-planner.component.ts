import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Budget, CreateBudget, FinanceWorkspace } from '../models';
import { FinanceService } from '../services/finance.service';
import { isAbortLikeHttpError } from '../services/http-error.utils';

@Component({
  selector: 'ot-budget-planner',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="planner">
      <header>
        <p class="eyebrow">Plan</p>
        <h1>Budgets</h1>
      </header>

      <form class="editor" (ngSubmit)="saveBudget()">
        <input [(ngModel)]="draft.name" name="name" placeholder="Budget name" required />
        <input [(ngModel)]="draft.category" name="category" placeholder="Category" required />
        <input [(ngModel)]="draft.limit" name="limit" type="number" placeholder="Limit" required />
        <select [(ngModel)]="draft.period" name="period">
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </select>
        <button type="submit">{{ editingId() ? 'Update budget' : 'Create budget' }}</button>
      </form>

      <div class="grid">
        @for (budget of budgets(); track budget.id) {
          <article class="budget-card">
            <div>
              <strong>{{ budget.name }}</strong>
              <span>{{ budget.category }}</span>
            </div>
            <p>\${{ budget.spent }} / \${{ budget.limit }}</p>
            <div class="actions">
              <button type="button" (click)="editBudget(budget)">Edit</button>
              <button type="button" (click)="deleteBudget(budget.id)">Delete</button>
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: [`
    .planner { display:grid; gap:18px; color: var(--foreground, #1f2937); font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif); }
    .eyebrow { margin:0 0 8px; text-transform:uppercase; letter-spacing:.12em; font-size:12px; color: var(--muted, #6b7280); }
    h1 { margin:0; font-size:32px; font-family: var(--font-heading, 'Helvetica Neue', Arial, sans-serif); }
    .editor { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; padding:18px; border-radius: var(--border-radius-lg, 18px); background: var(--surface, #ffffff); border: 1px solid var(--border, rgba(148, 163, 184, 0.2)); }
    .editor input,.editor select,.editor button { padding:10px 12px; border-radius: var(--border-radius-md, 12px); border:1px solid var(--border, rgba(148, 163, 184, 0.2)); }
    .editor button { background: var(--primary, #2563eb); color: var(--background, #ffffff); font-weight:700; }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; }
    .budget-card { padding:18px; border-radius: var(--border-radius-lg, 18px); background: var(--surface, #ffffff); border: 1px solid var(--border, rgba(148, 163, 184, 0.2)); display:grid; gap:10px; }
    .budget-card span { display:block; color: var(--muted, #6b7280); }
    .actions { display:flex; gap:8px; }
  `],
})
export class BudgetPlannerComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  readonly budgets = signal<Budget[]>([]);
  readonly workspace = signal<FinanceWorkspace>('personal');
  readonly editingId = signal<string | null>(null);
  draft: Partial<CreateBudget> = this.emptyDraft();

  async ngOnInit() {
    this.workspace.set((this.route.snapshot.paramMap.get('workspace') ?? 'personal') as FinanceWorkspace);
    this.draft = this.emptyDraft();
    await this.loadBudgets();
  }

  emptyDraft(): Partial<CreateBudget> {
    return {
      name: '',
      category: '',
      limit: 0,
      period: 'monthly',
      startDate: new Date(),
      endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      alertOnExceed: true,
      workspace: this.workspace(),
    };
  }

  async loadBudgets() {
    try {
      this.budgets.set(await this.financeService.getBudgets(this.workspace()));
    } catch (error) {
      if (isAbortLikeHttpError(error)) {
        return;
      }

      throw error;
    }
  }

  editBudget(budget: Budget) {
    this.editingId.set(budget.id);
    this.draft = { ...budget };
  }

  async saveBudget() {
    const payload = {
      ...this.draft,
      workspace: this.workspace(),
      startDate: this.draft.startDate ?? new Date(),
      endDate: this.draft.endDate ?? new Date(new Date().setMonth(new Date().getMonth() + 1)),
    } as CreateBudget;

    if (this.editingId()) {
      await this.financeService.updateBudget(this.editingId()!, payload);
    } else {
      await this.financeService.createBudget(payload);
    }

    this.editingId.set(null);
    this.draft = this.emptyDraft();
    await this.loadBudgets();
  }

  async deleteBudget(id: string) {
    await this.financeService.deleteBudget(id);
    await this.loadBudgets();
  }
}
