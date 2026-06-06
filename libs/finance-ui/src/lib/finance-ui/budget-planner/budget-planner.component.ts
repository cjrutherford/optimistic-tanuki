import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AgGridUiComponent,
  ColDef,
  GridOptions,
} from '@optimistic-tanuki/ag-grid-ui';
import { Budget, CreateBudget, FinanceWorkspace } from '../models';
import { FinanceService } from '../services/finance.service';
import { isAbortLikeHttpError } from '../services/http-error.utils';
import { FinanceWorkspaceScreenComponent } from '../finance-workspace-screen/finance-workspace-screen.component';

@Component({
  selector: 'ot-budget-planner',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AgGridUiComponent,
    FinanceWorkspaceScreenComponent,
  ],
  template: `
    <ot-finance-workspace-screen
      eyebrow="Plan"
      title="Budgets"
      lede="Track targets and spend in one operating view. Create or refine categories above, then scan the full budget posture in the shared grid layout."
    >
      <section class="workspace-panel" screen-toolbar>
        <h3 class="workspace-panel-title">Budget quick create</h3>
        <p class="workspace-panel-copy">
          Seed a new envelope or adjust the one currently being edited.
        </p>

        <form class="workspace-form" (ngSubmit)="saveBudget()">
          <input
            [(ngModel)]="draft.name"
            name="name"
            placeholder="Budget name"
            required
          />
          <div>
            <input
              [(ngModel)]="draft.category"
              name="category"
              placeholder="Category"
              list="budget-category-options"
              required
            />
            <datalist id="budget-category-options">
              @for (category of categoryOptions(); track category) {
              <option [value]="category"></option>
              }
            </datalist>
          </div>
          <input
            [(ngModel)]="draft.limit"
            name="limit"
            type="number"
            placeholder="Limit"
            required
          />
          <select [(ngModel)]="draft.period" name="period">
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <button type="submit" class="workspace-button-primary">
            {{ editingId() ? 'Update budget' : 'Create budget' }}
          </button>
        </form>
      </section>

      <section class="workspace-grid-panel">
        <otui-ag-grid
          [rowData]="budgets()"
          [columnDefs]="columnDefs"
          [gridOptions]="gridOptions"
          [loading]="loading()"
          height="440px"
        ></otui-ag-grid>
      </section>
    </ot-finance-workspace-screen>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      :host ::ng-deep .grid-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class BudgetPlannerComponent implements OnInit {
  private readonly financeService = inject(FinanceService);
  private readonly route = inject(ActivatedRoute);

  readonly budgets = signal<Budget[]>([]);
  readonly categoryOptions = signal<string[]>([]);
  readonly workspace = signal<FinanceWorkspace>('personal');
  readonly editingId = signal<string | null>(null);
  readonly loading = signal(false);
  draft: Partial<CreateBudget> = this.emptyDraft();

  readonly columnDefs: ColDef<Budget>[] = [
    {
      field: 'name',
      headerName: 'Budget',
    },
    {
      field: 'category',
      headerName: 'Category',
    },
    {
      field: 'period',
      headerName: 'Period',
      maxWidth: 140,
    },
    {
      field: 'spent',
      headerName: 'Spent',
      valueFormatter: (params) => this.formatCurrency(params.value),
    },
    {
      field: 'limit',
      headerName: 'Limit',
      valueFormatter: (params) => this.formatCurrency(params.value),
    },
    {
      headerName: 'Remaining',
      valueGetter: (params) =>
        Number(params.data?.limit ?? 0) - Number(params.data?.spent ?? 0),
      valueFormatter: (params) => this.formatCurrency(params.value),
    },
    {
      headerName: 'Actions',
      sortable: false,
      filter: false,
      editable: false,
      maxWidth: 220,
      cellRenderer: (params: { data?: Budget }) => {
        const data = params.data;
        if (!data) {
          return '';
        }

        const wrapper = document.createElement('div');
        wrapper.className = 'grid-actions';
        wrapper.append(
          this.buildActionButton('Edit', () => this.editBudget(data)),
          this.buildActionButton(
            'Delete',
            () => void this.deleteBudget(data.id),
            'workspace-button-danger'
          )
        );

        return wrapper;
      },
    },
  ];

  readonly gridOptions: GridOptions<Budget> = {
    domLayout: 'normal',
    pagination: true,
    defaultColDef: {
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
      minWidth: 130,
    },
  };

  async ngOnInit() {
    this.workspace.set(
      (this.route.snapshot.paramMap.get('workspace') ??
        'personal') as FinanceWorkspace
    );
    this.draft = this.emptyDraft();
    await Promise.all([this.loadBudgets(), this.loadCategoryOptions()]);
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
    this.loading.set(true);
    try {
      this.budgets.set(await this.financeService.getBudgets(this.workspace()));
    } catch (error) {
      if (isAbortLikeHttpError(error)) {
        return;
      }

      throw error;
    } finally {
      this.loading.set(false);
    }
  }

  async loadCategoryOptions() {
    try {
      this.categoryOptions.set(
        await this.financeService.getCategorySuggestions(this.workspace())
      );
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
      category: this.draft.category?.trim(),
      workspace: this.workspace(),
      startDate: this.draft.startDate ?? new Date(),
      endDate:
        this.draft.endDate ??
        new Date(new Date().setMonth(new Date().getMonth() + 1)),
    } as CreateBudget;

    if (this.editingId()) {
      await this.financeService.updateBudget(this.editingId()!, payload);
    } else {
      await this.financeService.createBudget(payload);
    }

    this.editingId.set(null);
    this.draft = this.emptyDraft();
    await Promise.all([this.loadBudgets(), this.loadCategoryOptions()]);
  }

  async deleteBudget(id: string) {
    await this.financeService.deleteBudget(id);
    await Promise.all([this.loadBudgets(), this.loadCategoryOptions()]);
  }

  private formatCurrency(value: unknown): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(value ?? 0));
  }

  private buildActionButton(
    label: string,
    onClick: () => void,
    className = ''
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.className = className;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });

    return button;
  }
}
