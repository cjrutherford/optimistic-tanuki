import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DocumentDropZoneComponent } from '@optimistic-tanuki/common-ui';
import { PracticeVaultApiService } from '../../services/practice-vault-api.service';
import { DocumentAuditResponseDto } from '@optimistic-tanuki/models';

@Component({
  selector: 'vault-drop-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, DocumentDropZoneComponent],
  template: `
    <div class="drop-page-container">
      <div class="page-header">
        <h1 class="page-title">Client document drop</h1>
        <p class="page-lead">
          Encrypted portal for tax, payroll, and civil litigation documents.
          Files stream directly to the on-premises ClamAV daemon and are sealed
          into the immutable WISP compliance ledger.
        </p>
        <div class="statutory-callout">
          <span class="shield-badge">FTC 16 CFR Part 314</span>
          <span class="shield-badge">IRS Pub 4557</span>
          <span class="shield-badge">Zero cloud leakage</span>
        </div>
      </div>

      <div class="drop-card">
        <div class="drop-meta-row">
          <div>
            <span class="meta-label">Secure session token</span>
            <span class="meta-value">{{ token }}</span>
          </div>
          <div>
            <span class="meta-label">Retention protocol</span>
            <span class="meta-value">7-year statutory retention</span>
          </div>
        </div>

        <otui-document-drop-zone
          [token]="token"
          label="Drop confidential client document"
          [scanning]="isScanning"
          [scanStatus]="scanStatus"
          [chainedHash]="auditResult?.chainedHash"
          [disabled]="!token || isScanning"
          (fileSelected)="onFileSelected($event)"
        ></otui-document-drop-zone>

        <div *ngIf="uploadError" class="error-banner" role="alert">
          {{ uploadError }}
        </div>

        <div *ngIf="auditResult" class="audit-receipt-card">
          <div class="receipt-header">
            <div class="receipt-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <div>
              <h3 class="receipt-title">Document sealed and audited</h3>
              <p class="receipt-subtitle">
                Cryptographic chain integrity verified
              </p>
            </div>
          </div>

          <div class="receipt-grid">
            <div class="receipt-item">
              <span class="item-label">File name</span>
              <span class="item-value">{{ auditResult.fileName }}</span>
            </div>
            <div class="receipt-item">
              <span class="item-label">Antivirus scan</span>
              <span class="item-value status-clean">
                {{ auditResult.antivirusStatus.toUpperCase() }} (ClamAV
                verified)
              </span>
            </div>
            <div class="receipt-item">
              <span class="item-label">Document SHA-256</span>
              <span class="item-value hash-code">{{
                auditResult.documentHash
              }}</span>
            </div>
            <div class="receipt-item">
              <span class="item-label">Chained SHA-256 hash</span>
              <span class="item-value hash-code">{{
                auditResult.chainedHash
              }}</span>
            </div>
            <div class="receipt-item">
              <span class="item-label">Statutory mandate</span>
              <span class="item-value">{{
                auditResult.complianceStandard
              }}</span>
            </div>
            <div class="receipt-item">
              <span class="item-label">Timestamp</span>
              <span class="item-value">{{
                auditResult.timestamp | date : 'medium'
              }}</span>
            </div>
          </div>

          <div class="receipt-actions">
            <a routerLink="/admin/compliance" class="btn-view-ledger">
              View WISP compliance ledger
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .drop-page-container {
        max-width: 900px;
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
      .drop-card {
        background: var(--vault-background-deep);
        border: 1px solid rgba(56, 189, 248, 0.25);
        border-radius: 12px;
        padding: 32px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.6);
      }
      .drop-meta-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .meta-label {
        display: block;
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--vault-text-subtle);
        letter-spacing: 0.05em;
        margin-bottom: 4px;
      }
      .meta-value {
        font-size: 0.95rem;
        color: var(--vault-border-light);
        font-weight: 600;
      }
      .error-banner {
        margin-top: 20px;
        background: rgba(239, 68, 68, 0.15);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: var(--vault-danger-soft);
        border-radius: 6px;
        padding: 12px 16px;
        font-size: 0.9rem;
      }
      .audit-receipt-card {
        margin-top: 32px;
        background: rgba(15, 23, 42, 0.9);
        border: 1px solid rgba(34, 197, 94, 0.4);
        border-radius: 10px;
        padding: 24px;
      }
      .receipt-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }
      .receipt-icon {
        background: rgba(34, 197, 94, 0.15);
        padding: 8px;
        border-radius: 8px;
        display: flex;
      }
      .receipt-title {
        margin: 0;
        font-size: 1.15rem;
        font-weight: 700;
        color: var(--foreground);
      }
      .receipt-subtitle {
        margin: 2px 0 0 0;
        font-size: 0.8rem;
        color: var(--trust-badge-color);
      }
      .receipt-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin-bottom: 20px;
      }
      @media (max-width: 650px) {
        .receipt-grid {
          grid-template-columns: 1fr;
        }
      }
      .receipt-item {
        background: rgba(30, 41, 59, 0.5);
        padding: 12px;
        border-radius: 6px;
        border: 1px solid rgba(255, 255, 255, 0.05);
      }
      .item-label {
        display: block;
        font-size: 0.75rem;
        color: var(--foreground-muted);
        margin-bottom: 4px;
      }
      .item-value {
        font-size: 0.9rem;
        color: var(--background-secondary);
        font-weight: 500;
        word-break: break-all;
      }
      .status-clean {
        color: var(--vault-success-bright);
        font-weight: 700;
      }
      .hash-code {
        font-family: monospace;
        font-size: 0.8rem;
        color: var(--accent);
      }
      .receipt-actions {
        display: flex;
        justify-content: flex-end;
      }
      .btn-view-ledger {
        background: var(--vault-action-blue);
        color: var(--primary-foreground);
        text-decoration: none;
        padding: 8px 18px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 0.875rem;
        transition: background 0.15s ease;
      }
      .btn-view-ledger:hover {
        background: var(--vault-action-blue-hover);
      }
    `,
  ],
})
export class DropPageComponent implements OnInit {
  token = '';
  isScanning = false;
  scanStatus = '';
  uploadError = '';
  auditResult: DocumentAuditResponseDto | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: PracticeVaultApiService
  ) {}

  ngOnInit(): void {
    const routeToken = this.route.snapshot.paramMap.get('token')?.trim();
    if (routeToken) {
      this.token = routeToken;
      return;
    }
    this.uploadError = 'Secure document-drop token is required.';
  }

  onFileSelected(file: File): void {
    if (!this.token) {
      this.uploadError = 'Secure document-drop token is required.';
      return;
    }

    this.uploadError = '';
    this.auditResult = null;
    this.isScanning = true;
    this.scanStatus = 'Reading document for secure upload...';

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        this.isScanning = false;
        this.scanStatus = '';
        this.uploadError = 'Failed to read document payload.';
        return;
      }

      const base64Data = reader.result.split(',')[1];
      if (!base64Data) {
        this.isScanning = false;
        this.scanStatus = '';
        this.uploadError = 'Failed to read document payload.';
        return;
      }

      this.scanStatus =
        'Uploading document for antivirus scanning and immutable audit...';
      this.api
        .uploadDocument(this.token, {
          token: this.token,
          fileName: file.name,
          fileSizeBytes: file.size,
          mimeType: file.type || 'application/octet-stream',
          fileBase64: base64Data,
        })
        .subscribe({
          next: (result) => {
            this.isScanning = false;
            this.scanStatus = '';
            this.auditResult = result;
          },
          error: (err) => {
            this.isScanning = false;
            this.scanStatus = '';
            this.uploadError =
              err?.error?.message ||
              'File upload rejected by security interceptor.';
          },
        });
    };

    reader.onerror = () => {
      this.isScanning = false;
      this.scanStatus = '';
      this.uploadError = 'Failed to read document payload.';
    };

    reader.readAsDataURL(file);
  }
}
