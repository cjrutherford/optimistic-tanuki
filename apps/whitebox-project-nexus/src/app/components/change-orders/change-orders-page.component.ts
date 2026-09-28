import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ChangeOrderResponseDto } from '@optimistic-tanuki/models';
import { SignatureCanvasComponent } from '@optimistic-tanuki/canvas-ui';
import { ProjectNexusApiService } from '../../services/project-nexus-api.service';
import { NexusFieldSyncService } from '../../services/nexus-field-sync.service';

@Component({
  selector: 'nexus-change-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SignatureCanvasComponent],
  template: `
    <div class="page-container">
      <p class="eyebrow">Digital approvals</p>
      <h1 class="page-title">Change orders</h1>

      <div *ngIf="loadError" class="error-banner" role="alert">
        {{ loadError }}
      </div>
      <p *ngIf="servedFromCache" class="cache-note" role="status">
        Showing cached change orders from the jobsite locker.
      </p>

      <div class="orders-list">
        <div *ngFor="let order of changeOrders" class="order-card">
          <div class="order-header">
            <strong class="order-title">{{ order.title }}</strong>
            <span class="status-pill" [class]="'status-' + order.status">
              {{ order.status }}
            </span>
          </div>
          <p class="order-desc">{{ order.description }}</p>
          <p class="order-amount">{{ formatAmount(order.amountCents) }}</p>
          <ul class="signature-list">
            <li *ngFor="let signature of order.signatures">
              {{ signature.role }}: {{ signature.name }}
            </li>
          </ul>
          <div class="order-actions">
            <button
              *ngIf="order.status === 'submitted'"
              type="button"
              class="btn-approve"
              (click)="transition(order, 'approved')"
            >
              Approve
            </button>
            <button
              *ngIf="order.status === 'submitted'"
              type="button"
              class="btn-reject"
              (click)="transition(order, 'rejected')"
            >
              Reject
            </button>
            <button
              *ngIf="order.status === 'approved'"
              type="button"
              class="btn-approve"
              (click)="transition(order, 'applied')"
            >
              Mark applied
            </button>
            <button
              *ngIf="order.documentKey"
              type="button"
              class="btn-download"
              (click)="downloadDocument(order)"
            >
              Signed PDF
            </button>
          </div>
        </div>
      </div>

      <p
        *ngIf="!loading && changeOrders.length === 0 && !loadError"
        class="empty-note"
      >
        No change orders are filed for this project yet.
      </p>

      <div class="submit-card">
        <h2 class="card-title">Submit a change order</h2>
        <label class="input-label" for="coTitle">Title</label>
        <input
          id="coTitle"
          type="text"
          class="text-input"
          [(ngModel)]="form.title"
        />
        <label class="input-label" for="coDescription">Description</label>
        <textarea
          id="coDescription"
          class="text-input"
          rows="3"
          [(ngModel)]="form.description"
        ></textarea>
        <label class="input-label" for="coAmount">Amount (USD)</label>
        <input
          id="coAmount"
          type="number"
          step="0.01"
          class="text-input"
          [(ngModel)]="form.amount"
        />
        <label class="input-label" for="ownerName">Owner name</label>
        <input
          id="ownerName"
          type="text"
          class="text-input"
          [(ngModel)]="form.ownerName"
        />
        <label class="input-label" for="ownerSignature">
          Owner signature
        </label>
        <nxui-signature-canvas
          ariaLabel="Owner signature pad"
          (signedChange)="ownerSignature = $event"
        ></nxui-signature-canvas>
        <label class="input-label" for="contractorName">Contractor name</label>
        <input
          id="contractorName"
          type="text"
          class="text-input"
          [(ngModel)]="form.contractorName"
        />
        <label class="input-label" for="contractorSignature">
          Contractor signature
        </label>
        <nxui-signature-canvas
          ariaLabel="Contractor signature pad"
          (signedChange)="contractorSignature = $event"
        ></nxui-signature-canvas>
        <div *ngIf="submitError" class="error-banner" role="alert">
          {{ submitError }}
        </div>
        <button
          type="button"
          class="btn-submit"
          [disabled]="!canSubmit() || isSubmitting"
          (click)="submit()"
        >
          <span *ngIf="!isSubmitting">Submit for approval</span>
          <span *ngIf="isSubmitting">Submitting...</span>
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 900px;
        margin: 40px auto;
        padding: 0 24px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.75rem;
        color: var(--accent);
        margin: 0 0 8px 0;
      }
      .page-title {
        font-size: 2rem;
        font-weight: 800;
        color: var(--foreground);
        margin: 0 0 24px 0;
      }
      .error-banner {
        background: color-mix(in srgb, var(--danger) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
        color: var(--danger);
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .cache-note {
        background: color-mix(in srgb, var(--warning) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
        color: var(--warning);
        border-radius: 6px;
        padding: 10px 14px;
        font-size: 0.88rem;
        margin: 0 0 16px 0;
      }
      .orders-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
        margin-bottom: 32px;
      }
      .order-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 18px;
      }
      .order-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
      }
      .order-title {
        color: var(--foreground);
        font-size: 1.05rem;
      }
      .status-pill {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 10px;
        border-radius: 4px;
        background: color-mix(
          in srgb,
          var(--foreground-muted) 20%,
          transparent
        );
        color: var(--foreground-secondary);
      }
      .status-submitted {
        background: color-mix(in srgb, var(--warning) 20%, transparent);
        color: var(--warning);
      }
      .status-approved,
      .status-applied {
        background: color-mix(in srgb, var(--success) 18%, transparent);
        color: var(--success);
      }
      .status-rejected {
        background: color-mix(in srgb, var(--danger) 18%, transparent);
        color: var(--danger);
      }
      .order-desc {
        color: var(--foreground-muted);
        font-size: 0.9rem;
        margin: 0 0 6px 0;
      }
      .order-amount {
        color: var(--accent);
        font-weight: 700;
        margin: 0 0 8px 0;
      }
      .signature-list {
        margin: 0 0 12px 0;
        padding-left: 18px;
        font-size: 0.85rem;
        color: var(--foreground-secondary);
      }
      .order-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .btn-approve {
        background: var(--success);
        color: var(--success-foreground);
        border: none;
        border-radius: 6px;
        padding: 8px 16px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-reject {
        background: transparent;
        border: 1px solid var(--danger);
        color: var(--danger);
        border-radius: 6px;
        padding: 8px 16px;
        font-weight: 600;
        cursor: pointer;
      }
      .btn-download {
        background: transparent;
        border: 1px solid var(--accent);
        color: var(--accent);
        border-radius: 6px;
        padding: 8px 16px;
        font-weight: 600;
        cursor: pointer;
      }
      .empty-note {
        color: var(--foreground-muted);
      }
      .submit-card {
        background: var(--surface);
        border: 1px solid var(--primary);
        border-radius: 12px;
        padding: 22px;
      }
      .card-title {
        margin: 0 0 16px 0;
        color: var(--foreground);
      }
      .input-label {
        display: block;
        font-size: 0.8rem;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--foreground-muted);
        margin: 14px 0 6px 0;
      }
      .text-input {
        width: 100%;
        box-sizing: border-box;
        background: var(--input-bg);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        padding: 10px 14px;
        color: var(--foreground);
        font-size: 0.95rem;
      }
      nxui-signature-canvas {
        display: block;
        margin-bottom: 6px;
      }
      .btn-submit {
        margin-top: 18px;
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        border-radius: 6px;
        padding: 12px 22px;
        font-weight: 700;
        cursor: pointer;
      }
      .btn-submit:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    `,
  ],
})
export class ChangeOrdersPageComponent implements OnInit {
  projectId = '';
  changeOrders: ChangeOrderResponseDto[] = [];
  loading = true;
  loadError = '';
  servedFromCache = false;
  isSubmitting = false;
  submitError = '';
  ownerSignature: string | null = null;
  contractorSignature: string | null = null;
  form = {
    title: '',
    description: '',
    amount: 0,
    ownerName: '',
    contractorName: '',
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: ProjectNexusApiService,
    private readonly sync: NexusFieldSyncService,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!this.projectId) {
      this.loading = false;
      this.loadError = 'A project ID is required.';
      return;
    }
    void this.load();
  }

  formatAmount(amountCents: number): string {
    const sign = amountCents < 0 ? '-' : '';
    return `${sign}$${(Math.abs(amountCents) / 100).toFixed(2)}`;
  }

  canSubmit(): boolean {
    return (
      this.form.title.trim().length >= 3 &&
      this.form.description.trim().length >= 10 &&
      Number.isFinite(this.form.amount) &&
      this.form.ownerName.trim().length > 0 &&
      this.form.contractorName.trim().length > 0 &&
      !!this.ownerSignature &&
      !!this.contractorSignature
    );
  }

  submit(): void {
    if (!this.canSubmit() || this.isSubmitting) {
      return;
    }
    this.submitError = '';
    this.isSubmitting = true;
    const now = new Date().toISOString();
    this.api
      .submitChangeOrder(this.projectId, {
        projectId: this.projectId,
        title: this.form.title.trim(),
        description: this.form.description.trim(),
        amountCents: Math.round(this.form.amount * 100),
        signatures: [
          {
            name: this.form.ownerName.trim(),
            role: 'owner',
            signaturePng: this.ownerSignature as string,
            signedAt: now,
          },
          {
            name: this.form.contractorName.trim(),
            role: 'contractor',
            signaturePng: this.contractorSignature as string,
            signedAt: now,
          },
        ],
      })
      .subscribe({
        next: () => {
          this.isSubmitting = false;
          this.form = {
            title: '',
            description: '',
            amount: 0,
            ownerName: '',
            contractorName: '',
          };
          this.ownerSignature = null;
          this.contractorSignature = null;
          void this.load();
        },
        error: (error: unknown) => {
          this.isSubmitting = false;
          this.submitError =
            error instanceof Error && error.message
              ? `Submission failed: ${error.message}`
              : 'Submission failed. Nothing was filed.';
        },
      });
  }

  transition(order: ChangeOrderResponseDto, transition: string): void {
    this.api
      .transitionChangeOrder(this.projectId, order.id, transition)
      .subscribe({
        next: () => void this.load(),
        error: () => {
          this.loadError = `Could not move the order to ${transition}.`;
        },
      });
  }

  downloadDocument(order: ChangeOrderResponseDto): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.api.downloadChangeOrderDocument(this.projectId, order.id).subscribe({
      next: (blob) => {
        if (!blob || blob.size === 0) {
          this.loadError = 'The signed document is unavailable.';
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `change-order-${order.id}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.loadError = 'The signed document is unavailable.';
      },
    });
  }

  private async load(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      const cached = await this.sync.cachedChangeOrders(this.projectId);
      if (cached) {
        this.changeOrders = cached;
        this.servedFromCache = true;
      }
    }
    this.api.getChangeOrders(this.projectId).subscribe({
      next: (orders) => {
        this.loading = false;
        this.loadError = '';
        this.servedFromCache = false;
        this.changeOrders = orders;
        if (isPlatformBrowser(this.platformId)) {
          void this.sync.cacheSnapshot(this.projectId, 'change-orders', orders);
        }
      },
      error: () => {
        this.loading = false;
        if (this.changeOrders.length === 0) {
          this.loadError =
            'Change orders are unavailable. Nothing is displayed.';
        } else {
          this.servedFromCache = true;
        }
      },
    });
  }
}
