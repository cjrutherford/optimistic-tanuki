import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { CreateRecurringItem, FinanceWorkspace, RecurringItem } from '../models';
import { FinanceService } from '../services/finance.service';
import { isAbortLikeHttpError } from '../services/http-error.utils';

@Component({
  selector: 'ot-recurring-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="recurring">
      <header>
        <p class="eyebrow">Plan</p>
        <h1>Recurring Items</h1>
      </header>

      <form class="editor" (ngSubmit)="saveItem()">
        <input [(ngModel)]="draft.name" name="name" placeholder="Name" required />
        <input [(ngModel)]="draft.amount" name="amount" type="number" placeholder="Amount" required />
        <select [(ngModel)]="draft.type" name="type">
          <option value="debit">Debit</option>
          <option value="credit">Credit</option>
        </select>
        <input [(ngModel)]="draft.category" name="category" placeholder="Category" />
        <select [(ngModel)]="draft.cadence" name="cadence">
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="yearly">Yearly</option>
        </select>
        <input [(ngModel)]="draft.nextDueDate" name="nextDueDate" type="date" required />
        <button type="submit">{{ editingId() ? 'Update item' : 'Create item' }}</button>
      </form>

      <div class="list">
        @for (item of items(); track item.id) {
          <article class="row">
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ item.cadence }} · {{ item.nextDueDate | date:'mediumDate' }}</span>
            </div>
            <p>\${{ item.amount }}</p>
            <div class="actions">
              <button type="button" (click)="editItem(item)">Edit</button>
              <button type="button" (click)="deleteItem(item.id)">Delete</button>
            </div>
          </article>
        }
      </div>
    </section>
  `,
  styles: [`
    .recurring { display:grid; gap:18px; color: var(--foreground, #1f2937); font-family: var(--font-body, 'Helvetica Neue', Arial, sans-serif); }
    .eyebrow { margin:0 0 8px; text-transform:uppercase; letter-spacing:.12em; font-size:12px; color: var(--muted, #6b7280); }
    h1 { margin:0; font-size:32px; font-family: var(--font-heading, 'Helvetica Neue', Arial, sans-serif); }
    .editor { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; padding:18px; border-radius: var(--border-radius-lg, 18px); background: var(--surface, #ffffff); border: 1px solid var(--border, rgba(148, 163, 184, 0.2)); }
    .editor input,.editor select,.editor button { padding:10px 12px; border-radius: var(--border-radius-md, 12px); border:1px solid var(--border, rgba(148, 163, 184, 0.2)); }
    .editor button { background: var(--primary, #2563eb); color: var(--background, #ffffff); font-weight:700; }
    .list { display:grid; gap:12px; }
    .row { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:12px; align-items:center; padding:16px; border-radius: var(--border-radius-lg, 18px); background: var(--surface, #ffffff); border: 1px solid var(--border, rgba(148, 163, 184, 0.2)); }
    .row span { display:block; color: var(--muted, #6b7280); }
    .actions { display:flex; gap:8px; }
  `],
})
export class RecurringListComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  readonly items = signal<RecurringItem[]>([]);
  readonly workspace = signal<FinanceWorkspace>('personal');
  readonly editingId = signal<string | null>(null);
  draft: any = this.emptyDraft();

  async ngOnInit() {
    this.workspace.set((this.route.snapshot.paramMap.get('workspace') ?? 'personal') as FinanceWorkspace);
    this.draft = this.emptyDraft();
    await this.loadItems();
  }

  emptyDraft() {
    return {
      name: '',
      amount: 0,
      type: 'debit',
      category: '',
      cadence: 'monthly',
      nextDueDate: new Date().toISOString().slice(0, 10),
      workspace: this.workspace(),
    };
  }

  async loadItems() {
    try {
      this.items.set(await this.financeService.getRecurringItems(this.workspace()));
    } catch (error) {
      if (isAbortLikeHttpError(error)) {
        return;
      }

      throw error;
    }
  }

  editItem(item: RecurringItem) {
    this.editingId.set(item.id);
    this.draft = {
      ...item,
      nextDueDate: new Date(item.nextDueDate).toISOString().slice(0, 10),
    };
  }

  async saveItem() {
    const payload: CreateRecurringItem = {
      ...this.draft,
      nextDueDate: new Date(this.draft.nextDueDate),
      workspace: this.workspace(),
    };
    if (this.editingId()) {
      await this.financeService.updateRecurringItem(this.editingId()!, payload);
    } else {
      await this.financeService.createRecurringItem(payload);
    }
    this.editingId.set(null);
    this.draft = this.emptyDraft();
    await this.loadItems();
  }

  async deleteItem(id: string) {
    await this.financeService.deleteRecurringItem(id);
    await this.loadItems();
  }
}
