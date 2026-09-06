import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  GeneratedApplication,
  GeneratedOutreachDraft,
} from '@optimistic-tanuki/models';
import {
  getLeadSourceDescriptor,
  Lead,
  LeadContactPoint,
  LeadDiscoverySource,
  PresenceGap,
} from './leads.types';

@Component({
  selector: 'app-lead-detail-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

          <!-- Placed immediately above the composer: this is the thing worth
               opening the message with. -->
          <section class="detail-section" *ngIf="presenceGaps.length">
            <div class="gap-head">
              <h3>Why this is a lead</h3>
              <span class="gap-score" *ngIf="lead.presenceGapScore != null">
                {{ lead.presenceGapScore }}/100
              </span>
            </div>
            <div class="gap-list">
              <span class="gap-chip" *ngFor="let gap of presenceGaps">
                {{ gap.label }}
              </span>
            </div>
          </section>

          <section class="detail-section outreach-section">
            <div class="outreach-head">
              <h3>Write to this lead</h3>
              <span class="outreach-hint">
                You send it — the app only writes it down.
              </span>
            </div>

            <div class="draft-row">
              <button
                type="button"
                class="generate-btn"
                (click)="onDraftRequested()"
                [disabled]="draftPending"
              >
                {{
                  draftPending
                    ? 'Drafting…'
                    : outreachDraft
                    ? 'Redraft message'
                    : 'Draft message'
                }}
              </button>
              <span class="draft-meta" *ngIf="outreachDraft">
                Version {{ outreachDraft.version }} ·
                {{
                  outreachDraft.modelGenerated
                    ? 'model written'
                    : 'assembled from your profile'
                }}
              </span>
            </div>

            <p class="empty-state" *ngIf="draftError">{{ draftError }}</p>

            <!-- What the guard refused to say in the user's name matters more
                 than what it wrote, so it sits above the draft, not below. -->
            <div
              class="evidence-warning"
              *ngIf="outreachDraft && !outreachDraft.evidence.clean"
              role="status"
            >
              <strong
                >Unsupported claims were removed before you saw this.</strong
              >
              <p *ngFor="let claim of outreachDraft.evidence.removedClaims">
                {{ claim }}
              </p>
            </div>

            <div
              class="evidence-gaps"
              *ngIf="outreachDraft?.evidence?.observedSignals?.length"
            >
              <strong>What this draft is allowed to say about them</strong>
              <p
                *ngFor="let signal of outreachDraft?.evidence?.observedSignals"
              >
                {{ signal }}
              </p>
            </div>

            <label class="field">
              <span class="field-label">Subject</span>
              <input
                type="text"
                name="outreachSubject"
                maxlength="160"
                [(ngModel)]="outreachSubject"
                [disabled]="outreachPending"
              />
            </label>

            <label class="field">
              <span class="field-label">Message</span>
              <textarea
                rows="7"
                name="outreachMessage"
                maxlength="12000"
                placeholder="Write your first message. Keep it specific to what you saw in this posting."
                [(ngModel)]="outreachMessage"
                [disabled]="outreachPending"
              ></textarea>
            </label>

            <div class="outreach-actions">
              <button
                type="button"
                class="btn btn-primary"
                (click)="onCopyMessage()"
                [disabled]="!canSendOutreach || outreachPending"
              >
                {{ copyState === 'copied' ? 'Copied' : 'Copy message' }}
              </button>
              <a
                *ngIf="mailtoHref"
                class="btn btn-secondary"
                [href]="mailtoHref"
                target="_blank"
                rel="noreferrer"
              >
                Open in mail app
              </a>
              <button
                type="button"
                class="btn btn-secondary"
                (click)="onMarkAsSent()"
                [disabled]="!canSendOutreach || outreachPending"
              >
                {{ outreachPending ? 'Recording…' : 'Mark as sent' }}
              </button>
            </div>

            <!-- The mailto handoff is the convenient path, not the reliable
                 one: several mail clients silently truncate a long body, so
                 copy stays the primary action. -->
            <p class="outreach-note" *ngIf="mailtoHref && isLongMessage">
              This message is long enough that some mail apps will cut it short.
              Copy it instead and paste into a new email.
            </p>
            <p class="outreach-note" *ngIf="!lead.email">
              No email address was found for this lead, so there is nothing to
              hand your mail app. Copy the message and address it yourself.
            </p>
            <p class="outreach-recorded" *ngIf="outreachRecorded" role="status">
              Recorded. This lead is now marked Contacted, and the message is in
              its notes.
            </p>
            <p class="empty-state" *ngIf="outreachError">{{ outreachError }}</p>
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

      .outreach-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .outreach-hint {
        font-size: 0.8rem;
        color: var(--app-foreground-muted);
      }

      .outreach-section {
        display: grid;
        gap: 0.75rem;
      }

      .field {
        display: grid;
        gap: 0.35rem;
      }

      .field-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--app-foreground-muted);
      }

      .field input,
      .field textarea {
        width: 100%;
        padding: 0.6rem 0.75rem;
        border: 1px solid var(--app-border);
        border-radius: var(--radius-md);
        background: var(--app-surface);
        color: var(--app-foreground);
        font: inherit;
        resize: vertical;
      }

      .field input:disabled,
      .field textarea:disabled {
        opacity: 0.6;
      }

      .outreach-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .outreach-actions .btn {
        text-decoration: none;
        display: inline-flex;
        align-items: center;
      }

      .outreach-actions .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .outreach-note {
        font-size: 0.85rem;
        color: var(--app-foreground-muted);
      }

      .draft-row {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .draft-meta {
        font-size: 0.8rem;
        color: var(--app-foreground-muted);
      }

      .outreach-recorded {
        font-size: 0.85rem;
        font-weight: 600;
      }

      .gap-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 1rem;
      }

      .gap-score {
        font-family: var(--font-mono);
        font-size: 0.8rem;
        color: var(--app-foreground-muted);
      }

      .gap-list {
        display: flex;
        flex-wrap: wrap;
        gap: 0.35rem;
        margin-top: 0.5rem;
      }

      .gap-chip {
        padding: 0.2rem 0.6rem;
        font-size: 0.75rem;
        font-weight: 600;
        border: 1px solid var(--app-border);
        border-radius: var(--radius-sm);
        background: var(--app-surface-muted);
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

  // ---- Outreach ------------------------------------------------------------
  //
  // The app deliberately does not send cold mail. It composes, hands the text
  // over, and records that the user sent it. That last part is not a nicety:
  // nothing else moves a lead to Contacted, so an unrecorded send leaves the
  // pipeline claiming this lead was never approached.

  @Input() outreachPending = false;
  @Input() outreachError = '';
  @Input() outreachRecorded = false;
  @Input() draftPending = false;
  @Input() draftError = '';
  @Output() draftRequested = new EventEmitter<string>();

  private draftValue: GeneratedOutreachDraft | null = null;

  /**
   * A drafted message fills the composer, but never overwrites work in
   * progress: the user asked for a draft, not for their own words to be
   * discarded, and a redraft after edits would otherwise silently lose them.
   */
  @Input() set outreachDraft(value: GeneratedOutreachDraft | null) {
    this.draftValue = value;
    if (!value) {
      return;
    }
    this.outreachSubject = value.draft.subject || this.outreachSubject;
    this.outreachMessage = this.composeMessage(value);
    this.copyState = 'idle';
  }

  get outreachDraft(): GeneratedOutreachDraft | null {
    return this.draftValue;
  }

  onDraftRequested(): void {
    if (this.leadValue?.id && !this.draftPending) {
      this.draftRequested.emit(this.leadValue.id);
    }
  }

  /** The stored draft as the plain text the user will actually send. */
  private composeMessage(generated: GeneratedOutreachDraft): string {
    const { greeting, opening, body, closing, signOff } = generated.draft;
    return [greeting, opening, ...(body || []), closing, signOff]
      .map((part) => (part || '').trim())
      .filter(Boolean)
      .join('\n\n');
  }
  @Output() outreachSent = new EventEmitter<{
    leadId: string;
    subject: string;
    message: string;
  }>();

  outreachSubject = '';
  outreachMessage = '';
  copyState: 'idle' | 'copied' | 'failed' = 'idle';

  /** Past this, mail clients start truncating a `mailto:` body. */
  private static readonly MAILTO_SAFE_LENGTH = 1500;

  @Input() set lead(value: Lead | null) {
    const changedLead = value?.id !== this.leadValue?.id;
    this.leadValue = value;
    if (changedLead) {
      // A draft belongs to the lead it was written for. Carrying it across
      // would risk sending one company's message to another.
      this.outreachSubject = value ? this.defaultSubject(value) : '';
      this.outreachMessage = '';
      this.copyState = 'idle';
      this.draftValue = null;
    }
  }

  get lead(): Lead | null {
    return this.leadValue;
  }

  private leadValue: Lead | null = null;

  /** What the local-business sources found missing. Empty for every other source. */
  get presenceGaps(): PresenceGap[] {
    return this.leadValue?.presenceGaps || [];
  }

  get canSendOutreach(): boolean {
    return Boolean(
      this.leadValue?.id &&
        this.outreachSubject.trim().length >= 2 &&
        this.outreachMessage.trim().length >= 2
    );
  }

  get isLongMessage(): boolean {
    return (
      this.outreachMessage.length > LeadDetailModalComponent.MAILTO_SAFE_LENGTH
    );
  }

  get mailtoHref(): string | null {
    const email = this.leadValue?.email?.trim();
    if (!email || !this.canSendOutreach) {
      return null;
    }
    return (
      `mailto:${encodeURIComponent(email)}` +
      `?subject=${encodeURIComponent(this.outreachSubject)}` +
      `&body=${encodeURIComponent(this.outreachMessage)}`
    );
  }

  async onCopyMessage(): Promise<void> {
    if (!this.canSendOutreach) {
      return;
    }
    const text = `${this.outreachSubject}\n\n${this.outreachMessage}`;
    try {
      await navigator.clipboard.writeText(text);
      this.copyState = 'copied';
    } catch {
      // Clipboard access is refused outside a secure context, and there is no
      // silent fallback worth trusting — say so rather than appear to succeed.
      this.copyState = 'failed';
      this.outreachError =
        'Your browser would not let the page copy. Select the message and copy it yourself.';
    }
  }

  onMarkAsSent(): void {
    if (!this.leadValue?.id || !this.canSendOutreach || this.outreachPending) {
      return;
    }
    this.outreachSent.emit({
      leadId: this.leadValue.id,
      subject: this.outreachSubject.trim(),
      message: this.outreachMessage.trim(),
    });
  }

  /**
   * A neutral opener the user is expected to rewrite. Nothing here claims
   * anything on their behalf — generating the actual message is a later slice,
   * and guessing at it now would put words in their mouth.
   */
  private defaultSubject(lead: Lead): string {
    return lead.company ? `Question about ${lead.company}` : '';
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
