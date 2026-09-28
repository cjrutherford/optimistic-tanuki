import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PracticeVaultApiService } from '../../services/practice-vault-api.service';
import {
  WispAuditLogDto,
  DocumentAuditResponseDto,
  CopilotResponseDto,
} from '@optimistic-tanuki/models';

@Component({
  selector: 'vault-compliance-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="compliance-page-container">
      <div class="page-header">
        <h1 class="page-title">WISP compliance ledger</h1>
        <p class="page-lead">
          Immutable written information security plan (WISP) audit log. Every
          client document upload and escrow wire revelation is permanently
          sealed into an immutable chained SHA-256 hash ledger satisfying FTC
          Safeguards Rule 16 CFR Part 314, IRS Pub 4557, and ALTA Pillar 3.
        </p>
        <div class="statutory-callout">
          <span class="shield-badge">FTC 16 CFR Part 314</span>
          <span class="shield-badge">IRS Pub 4557 Section 3</span>
          <span class="shield-badge">ALTA Pillar 3</span>
          <span class="shield-badge">ABA Formal Opinion 477R</span>
        </div>
      </div>

      <!-- Ledger Summary Stats -->
      <div class="stats-row">
        <div class="stat-card">
          <span class="stat-label">Chain cryptographic status</span>
          <div class="stat-value" [class.valid-chain]="wispAudit?.chainValid">
            <span class="indicator-dot"></span>
            {{
              wispAudit === null
                ? auditError
                  ? 'UNAVAILABLE'
                  : 'NOT LOADED'
                : wispAudit.chainValid
                ? 'VERIFIED INTACT'
                : 'INTEGRITY FAILED'
            }}
          </div>
          <span class="stat-meta">
            {{
              wispAudit?.chainValid
                ? 'Zero hash collisions detected'
                : 'Integrity not verified'
            }}
          </span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Total sealed records</span>
          <div class="stat-value">
            {{
              wispAudit === null
                ? auditError
                  ? 'Unavailable'
                  : 'Not loaded'
                : wispAudit.records.length
            }}
          </div>
          <span class="stat-meta">Immutable ledger entries</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Antivirus scanner engine</span>
          <div class="stat-value highlight-cyan">
            Not reported by ledger API
          </div>
          <span class="stat-meta">Upload receipts report scan status</span>
        </div>

        <div class="stat-card">
          <span class="stat-label">Storage immutability</span>
          <div class="stat-value highlight-green">
            Not reported by ledger API
          </div>
          <span class="stat-meta"
            >Storage controls require deployment verification</span
          >
        </div>
      </div>

      <!-- Air-gapped AI assistant query section -->
      <div class="copilot-section">
        <div class="copilot-header">
          <div class="copilot-icon">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#38bdf8"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <h2 class="copilot-title">Air-gapped compliance assistant</h2>
            <p class="copilot-subtitle">
              Queries are sent only to the configured local Ollama service.
            </p>
          </div>
        </div>

        <div class="copilot-input-row">
          <label class="sr-only" for="copilot-query"
            >Ask the on-premises compliance assistant</label
          >
          <input
            id="copilot-query"
            type="text"
            class="copilot-query-input"
            placeholder="Ask about tax schedules, wire protocols, or deposition transcripts..."
            [(ngModel)]="copilotQuery"
            (keydown.enter)="runCopilotQuery()"
            [disabled]="isQuerying"
          />
          <button
            type="button"
            class="btn-query-copilot"
            (click)="runCopilotQuery()"
            [disabled]="!copilotQuery.trim() || isQuerying"
          >
            <span *ngIf="!isQuerying">Query air-gapped index</span>
            <span *ngIf="isQuerying">Analyzing...</span>
          </button>
        </div>

        <div *ngIf="copilotError" class="error-banner" role="alert">
          {{ copilotError }}
        </div>

        <div *ngIf="copilotResult" class="copilot-result-box">
          <div class="result-badge-row">
            <span class="model-badge">{{ copilotResult.model }}</span>
            <span
              class="airgap-badge"
              [class.airgap-unavailable]="!copilotResult.airGapped"
            >
              {{
                copilotResult.airGapped ? 'Local model response' : 'Unavailable'
              }}
            </span>
          </div>
          <p class="result-answer">{{ copilotResult.answer }}</p>

          <div *ngIf="copilotResult.sources?.length" class="result-citations">
            <span class="citations-title">Verified on-premises sources:</span>
            <ul>
              <li *ngFor="let src of copilotResult.sources">
                <strong>{{ src.documentId }}:</strong> {{ src.excerpt }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Audit Ledger Table -->
      <div class="ledger-card">
        <div class="ledger-card-header">
          <h2 class="card-title">Chained SHA-256 audit entries</h2>
          <div class="ledger-actions">
            <button
              type="button"
              class="btn-export"
              (click)="exportAudit('csv')"
              [disabled]="wispAudit === null || isExporting"
            >
              <span *ngIf="!isExporting">Export CSV</span>
              <span *ngIf="isExporting">Exporting...</span>
            </button>
            <button
              type="button"
              class="btn-export"
              (click)="exportAudit('json')"
              [disabled]="wispAudit === null || isExporting"
            >
              <span *ngIf="!isExporting">Export JSON</span>
              <span *ngIf="isExporting">Exporting...</span>
            </button>
            <button type="button" class="btn-refresh" (click)="loadAuditLogs()">
              Refresh ledger
            </button>
          </div>
        </div>

        <div *ngIf="exportError" class="error-banner" role="alert">
          {{ exportError }}
        </div>

        <div
          *ngIf="auditAuthDenied"
          class="error-banner"
          data-testid="staff-auth-error"
          role="alert"
        >
          {{ auditError }}
        </div>

        <div
          *ngIf="auditError && !auditAuthDenied"
          class="error-banner"
          role="alert"
        >
          {{ auditError }}
        </div>

        <div class="table-responsive">
          <table class="audit-table">
            <caption class="sr-only">
              Immutable WISP audit ledger entries with chained SHA-256 integrity
              hashes
            </caption>
            <thead>
              <tr>
                <th scope="col">Timestamp</th>
                <th scope="col">Action</th>
                <th scope="col">File name</th>
                <th scope="col">Document hash</th>
                <th scope="col">Chained SHA-256 hash</th>
                <th scope="col">Scan status</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let record of records">
                <td class="cell-time">
                  {{ record.timestamp | date : 'short' }}
                </td>
                <td class="cell-action">
                  <span class="action-pill">{{
                    record.action || 'UPLOAD'
                  }}</span>
                </td>
                <td class="cell-file">{{ record.fileName }}</td>
                <td class="cell-hash" title="{{ record.documentHash }}">
                  {{ record.documentHash.substring(0, 10) }}...
                </td>
                <td class="cell-chained" title="{{ record.chainedHash }}">
                  {{ record.chainedHash.substring(0, 14) }}...
                </td>
                <td class="cell-status">
                  <span
                    class="status-pill"
                    [class.status-clean]="record.antivirusStatus === 'clean'"
                    [class.status-alert]="record.antivirusStatus !== 'clean'"
                  >
                    {{ record.antivirusStatus.toUpperCase() }}
                  </span>
                </td>
              </tr>
              <tr *ngIf="records.length === 0">
                <td colspan="6" class="cell-empty">
                  <ng-container *ngIf="auditError; else emptyLedger">
                    Ledger unavailable; record count is unknown.
                  </ng-container>
                  <ng-template #emptyLedger>
                    No records logged yet. Use the secure document-drop link
                    provided for this session to generate an immutable entry.
                  </ng-template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .compliance-page-container {
        max-width: 1200px;
        margin: 40px auto;
        padding: 0 24px;
      }
      .page-header {
        margin-bottom: 32px;
      }
      .page-title {
        font-size: 2rem;
        font-weight: 800;
        color: var(--foreground);
        margin: 0 0 10px 0;
        letter-spacing: -0.02em;
      }
      .page-lead {
        font-size: 1rem;
        line-height: 1.6;
        color: var(--foreground-muted);
        margin: 0 0 16px 0;
      }
      .statutory-callout {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .shield-badge {
        background: rgba(56, 189, 248, 0.12);
        border: 1px solid rgba(56, 189, 248, 0.35);
        color: var(--vault-accent-soft);
        font-size: 0.75rem;
        font-weight: 600;
        padding: 3px 10px;
        border-radius: 4px;
      }
      .stats-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        margin-bottom: 32px;
      }
      @media (max-width: 900px) {
        .stats-row {
          grid-template-columns: 1fr 1fr;
        }
      }
      @media (max-width: 500px) {
        .stats-row {
          grid-template-columns: 1fr;
        }
      }
      .stat-card {
        background: var(--vault-background-deep);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 10px;
        padding: 20px;
      }
      .stat-label {
        display: block;
        font-size: 0.75rem;
        color: var(--foreground-muted);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin-bottom: 8px;
      }
      .stat-value {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--foreground);
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 4px;
      }
      .stat-meta {
        font-size: 0.75rem;
        color: var(--vault-text-subtle);
      }
      .indicator-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--success);
        display: inline-block;
      }
      .valid-chain {
        color: var(--vault-success-bright);
      }
      .highlight-cyan {
        color: var(--accent);
      }
      .highlight-green {
        color: var(--trust-badge-color);
      }
      .copilot-section {
        background: var(--vault-background-deep);
        border: 1px solid rgba(56, 189, 248, 0.25);
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 32px;
      }
      .copilot-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 18px;
      }
      .copilot-icon {
        background: rgba(56, 189, 248, 0.12);
        padding: 8px;
        border-radius: 8px;
        display: flex;
      }
      .copilot-title {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--foreground);
      }
      .copilot-subtitle {
        margin: 2px 0 0 0;
        font-size: 0.8rem;
        color: var(--foreground-muted);
      }
      .copilot-input-row {
        display: flex;
        gap: 10px;
      }
      .copilot-query-input {
        flex: 1;
        background: var(--vault-background-deepest);
        border: 1px solid rgba(56, 189, 248, 0.3);
        border-radius: 6px;
        padding: 10px 16px;
        color: var(--foreground);
        font-size: 0.95rem;
        outline: none;
      }
      .copilot-query-input:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.25);
      }
      .btn-query-copilot {
        background: var(--vault-action-blue);
        color: var(--primary-foreground);
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .btn-query-copilot:hover:not(:disabled) {
        background: var(--vault-action-blue-hover);
      }
      .btn-query-copilot:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .error-banner {
        margin-top: 16px;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: var(--vault-danger-soft);
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 0.9rem;
      }
      .copilot-result-box {
        margin-top: 20px;
        background: rgba(15, 23, 42, 0.9);
        border-left: 3px solid var(--accent);
        border-radius: 4px;
        padding: 16px;
      }
      .result-badge-row {
        display: flex;
        gap: 8px;
        margin-bottom: 10px;
      }
      .model-badge {
        background: rgba(56, 189, 248, 0.15);
        color: var(--accent);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-family: monospace;
      }
      .airgap-badge {
        background: rgba(34, 197, 94, 0.15);
        color: var(--trust-badge-color);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
      }
      .airgap-unavailable {
        background: rgba(239, 68, 68, 0.15);
        color: var(--vault-danger-soft);
      }
      .result-answer {
        margin: 0 0 12px 0;
        color: var(--vault-border-light);
        font-size: 0.95rem;
        line-height: 1.6;
      }
      .result-citations {
        font-size: 0.8rem;
        color: var(--foreground-muted);
      }
      .citations-title {
        display: block;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .result-citations ul {
        margin: 0;
        padding-left: 18px;
      }
      .ledger-card {
        background: var(--vault-background-deep);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 24px;
      }
      .ledger-card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 12px;
      }
      .ledger-actions {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }
      .sr-only {
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
      .btn-export {
        background: rgba(56, 189, 248, 0.12);
        border: 1px solid rgba(56, 189, 248, 0.35);
        color: var(--vault-accent-soft);
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
        font-weight: 600;
      }
      .btn-export:hover:not(:disabled) {
        background: rgba(56, 189, 248, 0.2);
      }
      .btn-export:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      .card-title {
        margin: 0;
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--foreground);
      }
      .btn-refresh {
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: var(--foreground-secondary);
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.85rem;
      }
      .btn-refresh:hover {
        background: rgba(255, 255, 255, 0.06);
      }
      .table-responsive {
        overflow-x: auto;
      }
      .audit-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.875rem;
      }
      .audit-table th {
        background: rgba(15, 23, 42, 0.8);
        color: var(--foreground-muted);
        padding: 12px 14px;
        font-weight: 600;
        text-transform: uppercase;
        font-size: 0.75rem;
        letter-spacing: 0.04em;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .audit-table td {
        padding: 14px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        color: var(--foreground-secondary);
      }
      .cell-time {
        color: var(--foreground-muted);
        white-space: nowrap;
      }
      .action-pill {
        background: rgba(56, 189, 248, 0.12);
        color: var(--accent);
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .cell-file {
        font-weight: 500;
        color: var(--background-secondary);
      }
      .cell-hash {
        font-family: monospace;
        color: var(--foreground-muted);
      }
      .cell-chained {
        font-family: monospace;
        color: var(--accent);
        font-weight: 600;
      }
      .status-pill {
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 600;
      }
      .status-clean {
        background: rgba(34, 197, 94, 0.15);
        color: var(--trust-badge-color);
      }
      .status-alert {
        background: rgba(239, 68, 68, 0.15);
        color: var(--vault-danger-soft);
      }
      .cell-empty {
        text-align: center;
        padding: 32px 16px;
        color: var(--vault-text-subtle);
      }
    `,
  ],
})
export class CompliancePageComponent implements OnInit {
  wispAudit: WispAuditLogDto | null = null;
  records: any[] = [];
  auditError = '';
  auditAuthDenied = false;
  isExporting = false;
  exportError = '';
  copilotQuery = '';
  isQuerying = false;
  copilotError = '';
  copilotResult: CopilotResponseDto | null = null;

  constructor(
    private readonly api: PracticeVaultApiService,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadAuditLogs();
    }
  }

  loadAuditLogs(): void {
    this.auditError = '';
    this.auditAuthDenied = false;
    this.api.getWispComplianceAudit().subscribe({
      next: (data) => {
        this.wispAudit = data;
        this.records = data.records || [];
      },
      error: (error: unknown) => {
        this.wispAudit = null;
        this.records = [];
        this.auditAuthDenied = this.isAuthDenied(error);
        this.auditError = this.auditAuthDenied
          ? 'Staff authentication is required. Sign in with an authorized staff account to view this ledger.'
          : 'Ledger unavailable. No audit records are displayed.';
      },
    });
  }

  exportAudit(format: 'csv' | 'json'): void {
    if (this.wispAudit === null || this.isExporting) {
      return;
    }
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.exportError = '';
    this.isExporting = true;
    this.api.exportWispAudit(format).subscribe({
      next: (blob) => {
        this.isExporting = false;
        if (!blob || blob.size === 0) {
          this.exportError =
            'The compliance export returned no data. Nothing was downloaded.';
          return;
        }
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `wisp-compliance-audit-export.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      },
      error: (error: unknown) => {
        this.isExporting = false;
        this.exportError = this.isAuthDenied(error)
          ? 'Staff authentication is required. Sign in with an authorized staff account to export this ledger.'
          : 'The compliance export failed. Nothing was downloaded.';
      },
    });
  }

  runCopilotQuery(): void {
    if (!this.copilotQuery.trim() || this.isQuerying) return;
    this.copilotError = '';
    this.copilotResult = null;
    this.isQuerying = true;
    this.api
      .queryCopilot({
        query: this.copilotQuery.trim(),
      })
      .subscribe({
        next: (res) => {
          this.isQuerying = false;
          this.copilotResult = res;
        },
        error: (error: unknown) => {
          this.isQuerying = false;
          this.copilotResult = null;
          this.copilotError = this.isAuthDenied(error)
            ? 'Staff authentication is required. Sign in with an authorized staff account to query the copilot.'
            : 'Copilot unavailable. No analysis was performed.';
        },
      });
  }

  private isAuthDenied(error: unknown): boolean {
    const status = (error as { status?: number } | null)?.status;
    return status === 401 || status === 403;
  }
}
