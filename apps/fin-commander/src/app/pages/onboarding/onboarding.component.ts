import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  FinanceAccountType,
  FinanceService,
  FinanceWorkspace,
} from '@optimistic-tanuki/finance-ui';
import { TenantContextService } from '../../tenant-context.service';

type OnboardingStep = 'account' | 'workspace' | 'finance-account';

@Component({
  selector: 'fc-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="onboarding-shell">
      <div class="progress-bar">
        <div class="progress-fill" [style.width.%]="progressPercent()"></div>
      </div>

      <div class="step-container">
        @switch (currentStep()) { @case ('account') {
        <section class="step-panel">
          <span class="eyebrow">Step 1 of 3</span>
          <h1>Create your account</h1>
          <p class="description">
            Start by naming the account you want to manage in Fin Commander.
          </p>

          <div class="form-group">
            <label for="account-name">Account name</label>
            <input
              id="account-name"
              type="text"
              [(ngModel)]="accountNameValue"
              placeholder="My household"
            />
          </div>

          <div class="form-group">
            <label>Account type</label>
            <div class="type-options">
              @for (type of accountTypes; track type.value) {
              <button
                type="button"
                class="type-option"
                [class.selected]="accountType() === type.value"
                (click)="accountType.set(type.value)"
              >
                <span class="type-icon">{{ type.icon }}</span>
                <span class="type-label">{{ type.label }}</span>
              </button>
              }
            </div>
          </div>

          @if (accountError()) {
          <p class="error-copy">{{ accountError() }}</p>
          }

          <button
            type="button"
            class="primary-btn"
            [disabled]="!accountNameValue.trim() || creating()"
            (click)="createAccount()"
          >
            {{ creating() ? 'Creating account...' : 'Continue' }}
          </button>
        </section>
        } @case ('workspace') {
        <section class="step-panel">
          <span class="eyebrow">Step 2 of 3</span>
          <h1>Choose your workspaces</h1>
          <p class="description">
            Pick the ledgers you want to set up for this account.
          </p>

          <div class="workspace-options">
            @for (ws of workspaceOptions; track ws.id) {
            <button
              type="button"
              class="workspace-option"
              [class.selected]="workspaces().includes(ws.id)"
              (click)="toggleWorkspace(ws.id)"
            >
              <span class="ws-icon">{{ ws.icon }}</span>
              <div class="ws-content">
                <strong>{{ ws.label }}</strong>
                <span>{{ ws.description }}</span>
              </div>
            </button>
            }
          </div>

          @if (workspaceError()) {
          <p class="error-copy">{{ workspaceError() }}</p>
          }

          <button
            type="button"
            class="primary-btn"
            [disabled]="workspaces().length === 0 || creating()"
            (click)="enableWorkspaces()"
          >
            {{ creating() ? 'Saving workspaces...' : 'Continue' }}
          </button>
        </section>
        } @case ('finance-account') {
        <section class="step-panel">
          <span class="eyebrow">Step 3 of 3</span>
          <h1>Add your first financial account</h1>
          <p class="description">
            Your account is ready. Finish the setup checklist to add your first
            financial account and continue into Commander.
          </p>

          <button
            type="button"
            class="primary-btn"
            (click)="finishFinanceAccountSetup()"
          >
            Open setup checklist
          </button>
        </section>
        } }
      </div>
    </div>
  `,
  styles: [
    `
      .onboarding-shell {
        min-height: 100vh;
        padding: 2rem;
        background: var(--background, #f8fafc);
        color: var(--foreground, #1f2937);
        font-family: var(
          --fc-font-body,
          var(--font-body, 'Manrope', sans-serif)
        );
      }

      .progress-bar {
        height: 4px;
        background: color-mix(in srgb, var(--border) 40%, transparent);
        border-radius: 2px;
        margin-bottom: 3rem;
        max-width: 400px;
        margin-left: auto;
        margin-right: auto;
      }

      .progress-fill {
        height: 100%;
        background: var(--primary, #2563eb);
        border-radius: 2px;
        transition: width 0.3s ease;
      }

      .step-container {
        max-width: 520px;
        margin: 0 auto;
      }

      .step-panel {
        background: color-mix(in srgb, var(--surface) 92%, transparent);
        backdrop-filter: blur(20px);
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 50%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        box-shadow: var(--fc-card-shadow, 0 20px 40px rgba(4, 16, 28, 0.24));
        padding: 2rem;
      }

      .eyebrow {
        display: inline-flex;
        align-items: center;
        padding: 0.25rem 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
        font-size: 0.66rem;
        font-weight: 700;
        color: var(--primary);
        background: color-mix(in srgb, var(--primary) 12%, transparent);
        border-radius: var(--fc-button-radius, 9999px);
        margin-bottom: 0.5rem;
      }

      h1 {
        margin: 0 0 0.5rem;
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 1.75rem;
        font-weight: 700;
        color: var(--foreground);
      }

      .description {
        color: var(--muted, #6b7280);
        margin-bottom: 1.5rem;
        line-height: 1.5;
      }

      .form-group {
        margin-bottom: 1.25rem;
      }

      .form-group label {
        display: block;
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--muted);
        margin-bottom: 0.5rem;
      }

      .form-group input {
        width: 100%;
        padding: 0.8rem 1rem;
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 55%, transparent);
        border-radius: var(--fc-input-radius, 14px);
        font-size: 0.95rem;
        background: color-mix(in srgb, var(--surface) 70%, transparent);
        color: var(--foreground);
        outline: none;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;

        &:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px
            color-mix(in srgb, var(--primary) 18%, transparent);
        }
      }

      .type-options {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 0.75rem;
      }

      .type-option,
      .workspace-option {
        border: var(--fc-border-width, 2px) solid
          color-mix(in srgb, var(--border) 45%, transparent);
        border-radius: var(--fc-card-radius, 18px);
        background: color-mix(in srgb, var(--surface) 85%, transparent);
        backdrop-filter: blur(8px);
        cursor: pointer;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover {
          border-color: color-mix(in srgb, var(--primary) 40%, transparent);
          transform: translateY(-2px);
        }
      }

      .type-option {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 1rem;
      }

      .workspace-options {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1.5rem;
      }

      .workspace-option {
        display: flex;
        align-items: flex-start;
        gap: 1rem;
        padding: 1rem;
        text-align: left;
      }

      .type-option.selected,
      .workspace-option.selected {
        border-color: var(--primary, #2563eb);
        background: color-mix(in srgb, var(--primary) 10%, var(--surface));
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--primary) 12%, transparent);
      }

      .type-icon,
      .ws-icon {
        font-size: 1.5rem;
      }

      .ws-content {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }

      .ws-content strong {
        color: var(--foreground);
      }

      .ws-content span,
      .type-label {
        font-size: 0.85rem;
        color: var(--muted, #6b7280);
      }

      .primary-btn {
        width: 100%;
        padding: 0.875rem 1.5rem;
        background: var(--primary, #2563eb);
        color: var(--background);
        border: none;
        border-radius: var(--fc-button-radius, 9999px);
        font-family: var(--fc-font-heading, 'Sora', sans-serif);
        font-size: 0.95rem;
        font-weight: 700;
        cursor: pointer;
        transition: var(
          --fc-transition,
          all 0.22s cubic-bezier(0.16, 1, 0.3, 1)
        );

        &:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px
            color-mix(in srgb, var(--primary) 40%, transparent);
        }
      }

      .primary-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }

      .error-copy {
        color: var(--danger, #b91c1c);
        margin: 0 0 1rem;
      }
    `,
  ],
})
export class OnboardingComponent {
  private readonly router = inject(Router);
  private readonly tenantContext = inject(TenantContextService);
  private readonly financeService = inject(FinanceService);

  readonly currentStep = signal<OnboardingStep>('account');
  readonly creating = signal(false);
  readonly accountName = signal('');
  readonly accountType = signal<FinanceAccountType>('individual');
  readonly workspaces = signal<FinanceWorkspace[]>(['personal']);
  readonly accountError = signal('');
  readonly workspaceError = signal('');
  readonly createdTenantId = signal<string | null>(null);
  readonly primaryWorkspace = computed<FinanceWorkspace>(
    () => this.workspaces()[0] ?? 'personal'
  );

  accountNameValue = '';

  readonly accountTypes: Array<{
    value: FinanceAccountType;
    label: string;
    icon: string;
  }> = [
    { value: 'individual', label: 'Individual', icon: '👤' },
    { value: 'business', label: 'Business', icon: '🏢' },
    { value: 'nonprofit', label: 'Non-profit', icon: '🤝' },
    { value: 'household', label: 'Household', icon: '🏠' },
  ];

  readonly workspaceOptions: Array<{
    id: FinanceWorkspace;
    label: string;
    description: string;
    icon: string;
  }> = [
    {
      id: 'personal',
      label: 'Personal',
      description: 'Income, bills, and everyday spending',
      icon: '💰',
    },
    {
      id: 'business',
      label: 'Business',
      description: 'Operating cash, expenses, and revenue',
      icon: '📊',
    },
  ];

  readonly progressPercent = computed(() => {
    const stepOrder: OnboardingStep[] = [
      'account',
      'workspace',
      'finance-account',
    ];
    return (
      ((stepOrder.indexOf(this.currentStep()) + 1) / stepOrder.length) * 100
    );
  });

  toggleWorkspace(workspace: FinanceWorkspace): void {
    const current = this.workspaces();
    if (current.includes(workspace)) {
      if (current.length > 1) {
        this.workspaces.set(current.filter((entry) => entry !== workspace));
      }
      return;
    }

    this.workspaces.set([...current, workspace]);
  }

  async createAccount(): Promise<void> {
    const name = (this.accountNameValue || this.accountName()).trim();
    this.accountName.set(name);
    this.accountNameValue = name;
    this.accountError.set('');

    if (!name) {
      this.accountError.set('Add an account name before continuing.');
      return;
    }

    this.creating.set(true);

    try {
      const tenant = await this.financeService.createTenant({
        name,
        type: this.accountType(),
      });
      this.createdTenantId.set(tenant.id);
      await this.tenantContext.loadTenantContext();
      this.currentStep.set('workspace');
    } catch {
      this.accountError.set(
        'We could not create your account. Please try again.'
      );
    } finally {
      this.creating.set(false);
    }
  }

  async enableWorkspaces(): Promise<void> {
    this.workspaceError.set('');

    if (this.workspaces().length === 0) {
      this.workspaceError.set('Choose at least one workspace to continue.');
      return;
    }

    this.creating.set(true);

    try {
      await this.financeService.bootstrapWorkspaces(
        this.workspaces().filter(
          (workspace): workspace is 'personal' | 'business' =>
            workspace === 'personal' || workspace === 'business'
        )
      );
      await this.tenantContext.loadTenantContext();
      const tenantId = this.createdTenantId();
      if (tenantId) {
        this.tenantContext.selectTenant(tenantId);
      }
      this.currentStep.set('finance-account');
    } catch {
      this.workspaceError.set(
        'We could not save your workspace choices. Please try again.'
      );
    } finally {
      this.creating.set(false);
    }
  }

  async finishFinanceAccountSetup(): Promise<void> {
    await this.router.navigate(['/finance', this.primaryWorkspace(), 'setup']);
  }
}
