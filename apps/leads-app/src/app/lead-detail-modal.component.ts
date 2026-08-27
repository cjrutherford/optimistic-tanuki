import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import type { GeneratedApplication } from '@optimistic-tanuki/models';
import {
  getLeadSourceDescriptor,
  Lead,
  LeadContactPoint,
  LeadDiscoverySource,
} from './leads.types';

@Component({
  selector: 'app-lead-detail-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="modal-overlay"
      tabindex="0"
      role="button"
      (click)="onOverlayClick($event)"
      (keydown.enter)="closed.emit()"
      (keydown.space)="closed.emit()"
    >
      <div class="modal-content" tabindex="0">
        <div class="modal-header">
          <div>
            <p class="eyebrow">Lead details</p>
            <h2>{{ lead?.name || 'Lead details' }}</h2>
            <p class="lead-meta">
              <span *ngIf="lead?.company">{{ lead?.company }}</span>
              <span *ngIf="lead?.company && lead?.source">•</span>
              <span *ngIf="lead?.source">{{ sourceLabel }}</span>
            </p>
          </div>
          <button class="close-btn" type="button" (click)="closed.emit()">
            ×
          </button>
        </div>

        <div class="modal-body" *ngIf="lead">
          <section class="detail-section">
            <h3>Original posting</h3>
            <ng-container *ngIf="lead.originalPostingUrl; else noPosting">
              <a
                class="detail-link"
                [href]="lead.originalPostingUrl"
                target="_blank"
                rel="noreferrer"
              >
                {{ lead.originalPostingUrl }}
              </a>
            </ng-container>
            <ng-template #noPosting>
              <p class="empty-state">No original posting link is available.</p>
            </ng-template>
            <p class="source-attribution" *ngIf="attributionNote">
              {{ attributionNote }}
            </p>
          </section>

          <section class="detail-section application-section">
            <div class="application-head">
              <h3>Application documents</h3>
              <button
                type="button"
                class="generate-btn"
                (click)="onGenerateRequested()"
                [disabled]="applicationPending"
              >
                {{
                  applicationPending
                    ? 'Generating…'
                    : application
                    ? 'Regenerate'
                    : 'Generate'
                }}
              </button>
            </div>

            <p class="empty-state" *ngIf="applicationError">
              {{ applicationError }}
            </p>

            <ng-container *ngIf="application">
              <p class="application-meta">
                Version {{ application.version }} ·
                {{
                  application.modelGenerated
                    ? 'model generated'
                    : 'assembled from your resume'
                }}
              </p>

              <!-- What was removed matters as much as what was produced, so it
                   sits above the draft rather than hidden below it. -->
              <div
                class="evidence-warning"
                *ngIf="!application.evidence.clean"
                role="status"
              >
                <strong>
                  Unsupported claims were removed before you saw this.
                </strong>
                <p *ngFor="let claim of application.evidence.removedClaims">
                  {{ claim }}
                </p>
              </div>

              <div
                class="evidence-gaps"
                *ngIf="application.evidence.gaps.length"
              >
                <strong>Not evidenced in your resume</strong>
                <p *ngFor="let gap of application.evidence.gaps">{{ gap }}</p>
              </div>

              <h4>Resume</h4>
              <p class="doc-summary" *ngIf="application.resume.summary">
                {{ application.resume.summary }}
              </p>
              <p class="doc-skills" *ngIf="application.resume.skills.length">
                {{ application.resume.skills.join(' · ') }}
              </p>
              <div
                class="doc-role"
                *ngFor="let role of application.resume.roles"
              >
                <span class="doc-role-title">
                  {{ role.title
                  }}<span *ngIf="role.company"> — {{ role.company }}</span>
                </span>
                <ul>
                  <li *ngFor="let highlight of role.highlights">
                    {{ highlight }}
                  </li>
                </ul>
              </div>

              <h4>Cover letter</h4>
              <p>{{ application.coverLetter.greeting }}</p>
              <p *ngIf="application.coverLetter.opening">
                {{ application.coverLetter.opening }}
              </p>
              <p *ngFor="let paragraph of application.coverLetter.body">
                {{ paragraph }}
              </p>
              <p *ngIf="application.coverLetter.closing">
                {{ application.coverLetter.closing }}
              </p>

              <div class="export-row">
                <a
                  *ngFor="let target of exportTargets"
                  class="export-link"
                  [href]="exportUrl(target.kind, target.format)"
                  [download]="true"
                >
                  {{ target.label }}
                </a>
              </div>
            </ng-container>
          </section>

          <section class="detail-section">
            <h3>Contacts</h3>
            <div
              class="contact-list"
              *ngIf="displayContacts.length; else noContacts"
            >
              <a
                *ngFor="let contact of displayContacts"
                class="contact-chip"
                [href]="contact.href"
                [attr.target]="contact.kind === 'link' ? '_blank' : null"
                [attr.rel]="contact.kind === 'link' ? 'noreferrer' : null"
              >
                <span class="contact-kind">{{ contact.kind }}</span>
                <span class="contact-value">{{ contact.value }}</span>
              </a>
            </div>
            <ng-template #noContacts>
              <p class="empty-state">No contact details were extracted.</p>
            </ng-template>
          </section>

          <section class="detail-grid">
            <div class="detail-card">
              <h3>Status</h3>
              <p>{{ lead.status }}</p>
            </div>
            <div class="detail-card">
              <h3>Value</h3>
              <p>{{ '$' }}{{ lead.value | number }}</p>
            </div>
            <div class="detail-card">
              <h3>Follow-up</h3>
              <p>{{ lead.nextFollowUp || 'Not scheduled' }}</p>
            </div>
          </section>

          <section class="detail-section">
            <h3>Notes</h3>
            <p class="notes">{{ lead.notes || 'No notes yet.' }}</p>
          </section>

          <section class="detail-section" *ngIf="lead.searchKeywords?.length">
            <h3>Keywords</h3>
            <div class="keyword-list">
              <span
                *ngFor="let keyword of lead.searchKeywords"
                class="keyword-chip"
              >
                {{ keyword }}
              </span>
            </div>
          </section>
        </div>

        <div class="modal-footer">
          <button
            class="btn btn-secondary"
            type="button"
            (click)="closed.emit()"
          >
            Close
          </button>
          <button
            class="btn btn-primary"
            type="button"
            (click)="editRequested.emit()"
          >
            Edit lead
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .modal-overlay {
        position: fixed;
        inset: 0;
        background: var(--app-overlay);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
        z-index: 1000;
      }

      .modal-content {
        width: min(760px, 100%);
        max-height: 90vh;
        overflow: auto;
        border-radius: var(--radius-lg);
        background: var(--app-surface);
        border: 1px solid var(--app-border);
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.18);
      }

      .modal-header,
      .modal-footer {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid var(--app-border);
      }

      .modal-footer {
        border-bottom: none;
        border-top: 1px solid var(--app-border);
        justify-content: flex-end;
      }

      .modal-body {
        padding: 1.5rem;
        display: grid;
        gap: 1.25rem;
      }

      .eyebrow {
        margin: 0 0 0.35rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--app-foreground-muted);
      }

      h2,
      h3,
      p {
        margin: 0;
      }

      .lead-meta,
      .empty-state {
        color: var(--app-foreground-muted);
      }

      .source-attribution {
        margin: 0.6rem 0 0;
        font-size: 0.82rem;
        color: var(--app-foreground-secondary);
      }

      .detail-section,
      .detail-card {
        display: grid;
        gap: 0.5rem;
        padding: 1rem;
        border: 1px solid var(--app-border);
        border-radius: var(--radius-md);
        background: var(--app-background);
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
        gap: 1rem;
      }

      .detail-link {
        color: var(--app-primary);
        word-break: break-word;
      }

      .contact-list,
      .keyword-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .contact-chip,
      .keyword-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.625rem 0.875rem;
        border-radius: 999px;
        border: 1px solid var(--app-border);
        background: var(--app-surface);
        color: var(--app-foreground);
        text-decoration: none;
      }

      .contact-kind {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--app-foreground-muted);
      }

      .notes {
        white-space: pre-wrap;
        line-height: 1.5;
      }

      .close-btn,
      .btn {
        cursor: pointer;
      }

      .close-btn {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 999px;
        background: var(--app-surface-muted);
        color: var(--app-foreground);
        font-size: 1.5rem;
        line-height: 1;
      }

      .btn {
        border: 1px solid var(--app-border);
        border-radius: var(--radius-md);
        padding: 0.625rem 1rem;
        font-weight: 600;
      }

      .btn-primary {
        background: var(--app-primary);
        color: var(--app-primary-foreground);
        border-color: var(--app-primary);
      }

      .btn-secondary {
        background: var(--app-surface);
        color: var(--app-foreground);
      }
    `,
  ],
})
export class LeadDetailModalComponent {
  @Input() lead: Lead | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() editRequested = new EventEmitter<void>();

  get displayContacts(): LeadContactPoint[] {
    if (this.lead?.contacts?.length) {
      return this.lead.contacts;
    }

    const fallbackContacts: LeadContactPoint[] = [];
    if (this.lead?.email) {
      fallbackContacts.push({
        kind: 'email',
        value: this.lead.email,
        href: `mailto:${this.lead.email}`,
        label: this.lead.email,
        source: 'provider',
        isPrimary: true,
      });
    }
    if (this.lead?.phone) {
      fallbackContacts.push({
        kind: 'phone',
        value: this.lead.phone,
        href: `tel:${this.lead.phone}`,
        label: this.lead.phone,
        source: 'provider',
        isPrimary: fallbackContacts.length === 0,
      });
    }
    return fallbackContacts;
  }

  onOverlayClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  // Presentational only. The parent owns fetching and generation; this
  // component renders what it is given and reports intent.
  @Input() application: GeneratedApplication | null = null;
  @Input() applicationPending = false;
  @Input() applicationError = '';
  @Output() generateApplication = new EventEmitter<string>();

  readonly exportTargets = [
    {
      kind: 'resume' as const,
      format: 'docx' as const,
      label: 'Resume (.docx)',
    },
    { kind: 'resume' as const, format: 'odt' as const, label: 'Resume (.odt)' },
    {
      kind: 'cover-letter' as const,
      format: 'docx' as const,
      label: 'Cover letter (.docx)',
    },
    {
      kind: 'cover-letter' as const,
      format: 'odt' as const,
      label: 'Cover letter (.odt)',
    },
  ];

  onGenerateRequested(): void {
    if (this.lead?.id && !this.applicationPending) {
      this.generateApplication.emit(this.lead.id);
    }
  }

  /** A plain URL, so no service dependency is needed to build it. */
  exportUrl(kind: 'resume' | 'cover-letter', format: 'odt' | 'docx'): string {
    return this.lead?.id
      ? `/api/leads/${this.lead.id}/application/export?kind=${kind}&format=${format}`
      : '';
  }

  /** Registry label, so the UI never shows a raw enum value. */
  get sourceLabel(): string {
    if (!this.lead?.source) {
      return '';
    }
    const descriptor = getLeadSourceDescriptor(
      this.lead.source as unknown as LeadDiscoverySource
    );
    return descriptor?.label || this.lead.source;
  }

  /**
   * Some sources require visible credit wherever their results are displayed —
   * Remote OK and Jobicy both do. The registry is the single place that records
   * the obligation, so it cannot be met in one view and forgotten in another.
   */
  get attributionNote(): string | null {
    if (!this.lead?.source) {
      return null;
    }
    const descriptor = getLeadSourceDescriptor(
      this.lead.source as unknown as LeadDiscoverySource
    );
    return descriptor?.attributionRequired
      ? descriptor.attributionNote || `Sourced from ${descriptor.label}.`
      : null;
  }
}
