import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Lead,
  LeadStatus,
  SendLeadResponseDto,
  UpdateLeadDto,
} from '@optimistic-tanuki/ui-models';
import { ContactLeadsService } from '../services/contact-leads.service';
import { OperatorQueuePanelComponent } from './operator-queue-panel.component';
import {
  OperatorQueueItem,
  OperatorQueueService,
} from '../services/operator-queue.service';

type QueueFilter = 'all' | 'unassigned' | 'assigned' | 'overdue';
type CrmViewPreset = 'all' | 'assigned' | 'stale' | 'qualified';
type ResponseTemplateKey =
  | 'first-touch'
  | 'pricing-follow-up'
  | 'qualified-next-step';

interface SourceAnalyticsRow {
  label: string;
  leadCount: number;
  openCount: number;
}

interface AssignmentQueueRow {
  key: QueueFilter;
  label: string;
  count: number;
  helper: string;
}

interface InteractionTimelineItem {
  kind: 'created' | 'updated' | 'responded' | 'follow-up' | 'notes';
  label: string;
  timestamp: string;
}

const CRM_VIEW_STORAGE_KEY = 'owner-console.crm-workspace.view';

@Component({
  selector: 'app-contact-leads-management',
  standalone: true,
  imports: [CommonModule, FormsModule, OperatorQueuePanelComponent],
  template: `
    <section class="page">
      <header class="hero">
        <p class="hero-kicker">CRM Workspace</p>
        <h1>Contact leads</h1>
        <p>
          Expand the inbox into an operator workflow with SLA visibility,
          assignment queues, source analytics, response templates, and a lead
          timeline.
        </p>
      </header>

      <section class="stats-grid">
        <article class="stat-card">
          <span class="label">Open leads</span>
          <strong>{{ openLeads().length }}</strong>
          <p>{{ leads.length }} total records in the workspace.</p>
        </article>
        <article class="stat-card">
          <span class="label">Overdue follow-up</span>
          <strong>{{ overdueLeads().length }}</strong>
          <p>
            {{ staleNewLeads().length }} new leads are beyond first-response
            SLA.
          </p>
        </article>
        <article class="stat-card">
          <span class="label">Assigned queue</span>
          <strong>{{ assignedLeads().length }}</strong>
          <p>{{ unassignedLeads().length }} leads still need an owner.</p>
        </article>
        <article class="stat-card">
          <span class="label">Qualified pipeline</span>
          <strong>{{ qualifiedPipelineCount() }}</strong>
          <p>Qualified, proposal, and negotiation opportunities.</p>
        </article>
      </section>

      <section class="filters">
        <label>
          <span>App</span>
          <select [(ngModel)]="filters.appScope" (ngModelChange)="loadLeads()">
            <option value="">All apps</option>
            <option *ngFor="let appScope of appScopes" [value]="appScope">
              {{ appScope }}
            </option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select [(ngModel)]="filters.status" (ngModelChange)="loadLeads()">
            <option value="">All statuses</option>
            <option *ngFor="let status of statuses" [value]="status">
              {{ status }}
            </option>
          </select>
        </label>
        <label>
          <span>Queue</span>
          <select [(ngModel)]="queueFilter">
            <option value="all">All leads</option>
            <option value="unassigned">Unassigned</option>
            <option value="assigned">Assigned</option>
            <option value="overdue">Overdue</option>
          </select>
        </label>
        <button class="btn btn-secondary" type="button" (click)="loadLeads()">
          Refresh
        </button>
      </section>

      <section class="view-presets">
        <button
          type="button"
          class="view-btn"
          [class.active]="activeViewPreset === 'all'"
          (click)="applyViewPreset('all')"
        >
          All work
        </button>
        <button
          type="button"
          class="view-btn"
          [class.active]="activeViewPreset === 'assigned'"
          (click)="applyViewPreset('assigned')"
        >
          Assigned queue
        </button>
        <button
          type="button"
          class="view-btn"
          [class.active]="activeViewPreset === 'stale'"
          (click)="applyViewPreset('stale')"
        >
          Stale follow-up
        </button>
        <button
          type="button"
          class="view-btn"
          [class.active]="activeViewPreset === 'qualified'"
          (click)="applyViewPreset('qualified')"
        >
          Qualified pipeline
        </button>
      </section>

      <app-operator-queue-panel
        [items]="queueItems"
        heading="CRM Queue"
        description="Lead response and follow-up work prioritized from the shared operator queue."
        emptyStateCopy="No CRM queue items are currently prioritized."
      ></app-operator-queue-panel>

      <section class="analytics-grid">
        <article class="panel">
          <div class="panel-head">
            <h2>Assignment queues</h2>
          </div>
          <div class="queue-cards">
            <button
              *ngFor="let queue of assignmentQueues()"
              type="button"
              class="queue-card"
              [class.active]="queueFilter === queue.key"
              (click)="queueFilter = queue.key"
            >
              <strong>{{ queue.label }}</strong>
              <span>{{ queue.count }}</span>
              <small>{{ queue.helper }}</small>
            </button>
          </div>
        </article>

        <article class="panel">
          <div class="panel-head">
            <h2>Source analytics</h2>
          </div>
          <div class="analytics-list">
            <article
              class="analytics-row"
              *ngFor="let row of sourceAnalytics()"
            >
              <strong>{{ row.label }}</strong>
              <span>{{ row.leadCount }} leads</span>
              <small>{{ row.openCount }} still open</small>
            </article>
          </div>
        </article>
      </section>

      <section class="workspace">
        <div class="lead-list panel">
          <div class="panel-head">
            <h2>Inbox</h2>
            <span>{{ filteredLeads().length }} leads</span>
          </div>

          <div *ngIf="loading" class="empty">Loading leads…</div>
          <div *ngIf="!loading && !filteredLeads().length" class="empty">
            No contact leads matched the current filters.
          </div>

          <button
            *ngFor="let lead of filteredLeads()"
            class="lead-card"
            type="button"
            [class.is-active]="lead.id === selectedLead?.id"
            (click)="selectLead(lead)"
          >
            <div class="lead-card-top">
              <strong>{{ lead.name }}</strong>
              <span class="badge">{{ lead.appScope }}</span>
            </div>
            <div class="lead-card-meta">
              <span>{{ lead.email || 'No email' }}</span>
              <span>{{ lead.status }}</span>
            </div>
            <div class="lead-card-meta">
              <span>{{ lead.assignedTo || 'Unassigned' }}</span>
              <span>{{ slaLabel(lead) }}</span>
            </div>
            <p class="lead-card-message">
              {{ lead.contactSubject || lead.contactMessage || lead.notes }}
            </p>
          </button>
        </div>

        <div class="lead-detail panel" *ngIf="selectedLead; else emptyDetail">
          <div class="panel-head">
            <div>
              <h2>{{ selectedLead.name }}</h2>
              <p>
                {{ selectedLead.contactSourceLabel || selectedLead.appScope }}
              </p>
            </div>
            <span class="badge">{{ selectedLead.status }}</span>
          </div>

          <div class="detail-grid">
            <div class="detail-block">
              <span class="label">Email</span>
              <strong>{{ selectedLead.email || 'Not provided' }}</strong>
            </div>
            <div class="detail-block">
              <span class="label">Phone</span>
              <strong>{{ selectedLead.phone || 'Not provided' }}</strong>
            </div>
            <div class="detail-block">
              <span class="label">Company</span>
              <strong>{{ selectedLead.company || 'Not provided' }}</strong>
            </div>
            <div class="detail-block">
              <span class="label">Follow up</span>
              <strong>{{
                selectedLead.nextFollowUp || 'Not scheduled'
              }}</strong>
            </div>
          </div>

          <div class="detail-grid">
            <div class="detail-block">
              <span class="label">Assigned to</span>
              <strong>{{ selectedLead.assignedTo || 'Unassigned' }}</strong>
            </div>
            <div class="detail-block">
              <span class="label">Last responded</span>
              <strong>{{
                selectedLead.lastRespondedAt || 'No reply yet'
              }}</strong>
            </div>
            <div class="detail-block">
              <span class="label">SLA</span>
              <strong>{{ slaLabel(selectedLead) }}</strong>
            </div>
            <div class="detail-block">
              <span class="label">Source</span>
              <strong>{{ selectedLead.source }}</strong>
            </div>
          </div>

          <div class="detail-block">
            <span class="label">Subject</span>
            <strong>{{
              selectedLead.contactSubject || 'General inquiry'
            }}</strong>
          </div>

          <div class="detail-block">
            <span class="label">Message</span>
            <p class="message">
              {{ selectedLead.contactMessage || 'No message' }}
            </p>
          </div>

          <div class="editor">
            <h3>Lead management</h3>
            <label>
              <span>Status</span>
              <select [(ngModel)]="editModel.status">
                <option *ngFor="let status of statuses" [value]="status">
                  {{ status }}
                </option>
              </select>
            </label>
            <label>
              <span>Assigned to</span>
              <input type="text" [(ngModel)]="editModel.assignedTo" />
            </label>
            <label>
              <span>Next follow up</span>
              <input type="date" [(ngModel)]="editModel.nextFollowUp" />
            </label>
            <label>
              <span>Operator notes</span>
              <textarea rows="6" [(ngModel)]="editModel.notes"></textarea>
            </label>
            <div class="actions">
              <button
                class="btn btn-primary"
                type="button"
                (click)="saveLead()"
              >
                Save Lead
              </button>
            </div>
          </div>

          <div class="editor">
            <div class="panel-head">
              <h3>Respond</h3>
              <span>{{ responseTemplates.length }} templates</span>
            </div>
            <div class="template-row">
              <button
                *ngFor="let template of responseTemplates"
                type="button"
                class="template-btn"
                (click)="applyResponseTemplate(template.key)"
              >
                {{ template.label }}
              </button>
            </div>
            <label>
              <span>Email subject</span>
              <input type="text" [(ngModel)]="responseModel.subject" />
            </label>
            <label>
              <span>Message</span>
              <textarea rows="8" [(ngModel)]="responseModel.message"></textarea>
            </label>
            <label>
              <span>Post-send status</span>
              <select [(ngModel)]="responseModel.status">
                <option [ngValue]="undefined">Contacted</option>
                <option
                  *ngFor="let status of postSendStatuses"
                  [value]="status"
                >
                  {{ status }}
                </option>
              </select>
            </label>
            <div class="actions">
              <button
                class="btn btn-primary"
                type="button"
                (click)="respondToLead()"
              >
                Send Response
              </button>
            </div>
            <p *ngIf="responseStatus" class="response-status">
              {{ responseStatus }}
            </p>
          </div>

          <div class="editor">
            <h3>Interaction timeline</h3>
            <div class="timeline">
              <article
                class="timeline-item"
                *ngFor="let item of interactionTimeline()"
              >
                <strong>{{ item.label }}</strong>
                <span>{{ item.timestamp }}</span>
              </article>
            </div>
          </div>
        </div>

        <ng-template #emptyDetail>
          <div class="panel empty">
            Select a lead to review submission details, apply templates, and
            manage follow-up.
          </div>
        </ng-template>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .page,
      .workspace,
      .filters,
      .editor,
      .stats-grid,
      .analytics-grid,
      .view-presets,
      .queue-cards,
      .analytics-list,
      .timeline {
        display: grid;
        gap: 16px;
      }

      .hero,
      .panel,
      .filters {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--accent, var(--primary)) 10%, transparent),
            transparent 28%
          ),
          color-mix(in srgb, var(--surface, #ffffff) 96%, transparent);
        padding: 24px;
        color: var(--foreground, #111827);
      }

      .hero-kicker,
      .label {
        margin: 0 0 8px;
        color: var(--accent, var(--primary));
        font-size: 0.82rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .hero h1,
      .panel-head h2,
      .editor h3 {
        margin: 0;
      }

      .hero p,
      .panel-head p,
      .lead-card-message,
      .message,
      .empty {
        margin: 0;
        line-height: 1.5;
      }

      .stats-grid {
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }

      .analytics-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .stat-card,
      .queue-card,
      .analytics-row,
      .timeline-item {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 18px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 88%,
          var(--background, #f8fafc)
        );
        padding: 16px;
      }

      .stat-card strong {
        display: block;
        font-size: 1.8rem;
      }

      .filters {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        align-items: end;
      }

      .filters label,
      .editor label {
        display: grid;
        gap: 8px;
      }

      .view-presets {
        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      }

      .view-btn,
      .template-btn,
      .queue-card {
        border-radius: 999px;
        cursor: pointer;
      }

      .view-btn.active,
      .queue-card.active {
        background: var(--accent, var(--primary));
        color: var(--on-primary, var(--primary-foreground));
        border-color: var(--accent, var(--primary));
      }

      .workspace {
        grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.1fr);
        align-items: start;
      }

      .lead-list {
        max-height: 78vh;
        overflow: auto;
      }

      .panel-head {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        align-items: start;
        margin-bottom: 16px;
      }

      .lead-card {
        display: grid;
        gap: 10px;
        width: 100%;
        text-align: left;
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 18px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 88%,
          var(--background, #f8fafc)
        );
        padding: 16px;
        margin-bottom: 12px;
        cursor: pointer;
      }

      .lead-card.is-active {
        border-color: var(--accent, var(--primary));
        box-shadow: 0 0 0 1px
          color-mix(in srgb, var(--accent, var(--primary)) 22%, transparent);
      }

      .lead-card-top,
      .lead-card-meta,
      .detail-grid,
      .template-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .lead-card-message {
        color: var(--foreground-secondary, #52606d);
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .detail-block {
        display: grid;
        gap: 8px;
        padding: 14px 16px;
        border-radius: 18px;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 88%,
          var(--background, #f8fafc)
        );
        border: 1px solid var(--border-color, #d6d6d6);
      }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.3rem 0.65rem;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--accent, var(--primary)) 12%,
          transparent
        );
        color: var(--accent, var(--primary));
        font-size: 0.78rem;
        font-weight: 700;
      }

      input,
      select,
      textarea,
      .btn,
      .view-btn,
      .template-btn,
      .queue-card {
        border-radius: 12px;
        border: 1px solid var(--border-color, #d6d6d6);
        padding: 10px 12px;
        font: inherit;
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 94%,
          var(--background, #f8fafc)
        );
      }

      textarea {
        resize: vertical;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
      }

      .btn {
        cursor: pointer;
      }

      .btn-primary {
        background: var(--accent, var(--primary));
        border-color: var(--accent, var(--primary));
        color: var(--on-primary, var(--primary-foreground));
      }

      .btn-secondary {
        background: transparent;
      }

      .response-status {
        margin: 0;
        color: var(--accent, var(--primary));
      }

      @media (max-width: 1100px) {
        .workspace,
        .analytics-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ContactLeadsManagementComponent implements OnInit {
  private readonly leadsService = inject(ContactLeadsService);
  private readonly operatorQueueService = inject(OperatorQueueService);

  leads: Lead[] = [];
  queueItems: OperatorQueueItem[] = [];
  appScopes: string[] = [];
  selectedLead: Lead | null = null;
  loading = false;
  responseStatus: string | null = null;
  queueFilter: QueueFilter = 'all';
  activeViewPreset: CrmViewPreset = 'all';
  filters = {
    appScope: '',
    status: '',
  };

  editModel: UpdateLeadDto = {};
  responseModel: SendLeadResponseDto = {
    subject: '',
    message: '',
  };

  readonly statuses = Object.values(LeadStatus);
  readonly postSendStatuses = this.statuses.filter(
    (status) => status !== LeadStatus.CONTACTED
  );
  readonly responseTemplates: Array<{
    key: ResponseTemplateKey;
    label: string;
  }> = [
    { key: 'first-touch', label: 'First touch' },
    { key: 'pricing-follow-up', label: 'Pricing follow-up' },
    { key: 'qualified-next-step', label: 'Qualified next step' },
  ];

  ngOnInit(): void {
    this.restoreViewPreset();
    this.loadLeads();
    this.loadQueue();
  }

  loadQueue(): void {
    this.operatorQueueService.getQueueByDomain('CRM').subscribe({
      next: (items) => {
        this.queueItems = items;
      },
      error: () => {
        this.queueItems = [];
      },
    });
  }

  loadLeads(): void {
    this.loading = true;
    this.leadsService
      .getLeads({
        appScope: this.filters.appScope || undefined,
        status: this.filters.status || undefined,
      })
      .subscribe({
        next: (leads) => {
          this.leads = leads;
          this.appScopes = Array.from(
            new Set(
              leads
                .map((lead) => lead.appScope)
                .filter((appScope): appScope is string => Boolean(appScope))
            )
          ).sort();
          this.loading = false;
          if (this.selectedLead) {
            const refreshed = leads.find(
              (lead) => lead.id === this.selectedLead?.id
            );
            if (refreshed) {
              this.selectLead(refreshed);
            } else {
              this.selectedLead = null;
            }
          }
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  filteredLeads(): Lead[] {
    return this.leads.filter((lead) => {
      if (this.queueFilter === 'unassigned' && lead.assignedTo) {
        return false;
      }
      if (this.queueFilter === 'assigned' && !lead.assignedTo) {
        return false;
      }
      if (this.queueFilter === 'overdue' && !this.isOverdue(lead)) {
        return false;
      }
      return true;
    });
  }

  openLeads(): Lead[] {
    return this.leads.filter(
      (lead) =>
        lead.status !== LeadStatus.WON && lead.status !== LeadStatus.LOST
    );
  }

  overdueLeads(): Lead[] {
    return this.openLeads().filter((lead) => this.isOverdue(lead));
  }

  staleNewLeads(): Lead[] {
    return this.leads.filter((lead) => {
      if (lead.status !== LeadStatus.NEW) {
        return false;
      }
      const createdAt = this.asDate(lead.createdAt);
      if (!createdAt) {
        return false;
      }
      return this.daysSince(createdAt) >= 2;
    });
  }

  assignedLeads(): Lead[] {
    return this.leads.filter((lead) => !!lead.assignedTo);
  }

  unassignedLeads(): Lead[] {
    return this.leads.filter((lead) => !lead.assignedTo);
  }

  qualifiedPipelineCount(): number {
    return this.leads.filter((lead) =>
      [
        LeadStatus.QUALIFIED,
        LeadStatus.PROPOSAL,
        LeadStatus.NEGOTIATION,
      ].includes(lead.status as LeadStatus)
    ).length;
  }

  assignmentQueues(): AssignmentQueueRow[] {
    return [
      {
        key: 'all',
        label: 'All leads',
        count: this.leads.length,
        helper: 'Everything currently in the CRM workspace.',
      },
      {
        key: 'unassigned',
        label: 'Unassigned',
        count: this.unassignedLeads().length,
        helper: 'Needs routing to an operator.',
      },
      {
        key: 'assigned',
        label: 'Assigned',
        count: this.assignedLeads().length,
        helper: 'Actively owned follow-up work.',
      },
      {
        key: 'overdue',
        label: 'Overdue',
        count: this.overdueLeads().length,
        helper: 'Missed follow-up or first-response SLA.',
      },
    ];
  }

  sourceAnalytics(): SourceAnalyticsRow[] {
    const grouped = new Map<string, Lead[]>();
    for (const lead of this.leads) {
      const label =
        lead.contactSourceLabel || lead.appScope || String(lead.source);
      const bucket = grouped.get(label) ?? [];
      bucket.push(lead);
      grouped.set(label, bucket);
    }

    return Array.from(grouped.entries())
      .map(([label, rows]) => ({
        label,
        leadCount: rows.length,
        openCount: rows.filter(
          (lead) =>
            lead.status !== LeadStatus.WON && lead.status !== LeadStatus.LOST
        ).length,
      }))
      .sort((left, right) => right.leadCount - left.leadCount);
  }

  selectLead(lead: Lead): void {
    this.selectedLead = lead;
    this.editModel = {
      status: lead.status,
      assignedTo: lead.assignedTo,
      nextFollowUp: this.toDateInputValue(lead.nextFollowUp),
      notes: lead.notes,
    };
    this.responseModel = {
      subject:
        lead.contactSubject ||
        `Re: ${lead.contactSourceLabel || lead.appScope} inquiry`,
      message: '',
      nextFollowUp: this.toDateInputValue(lead.nextFollowUp),
    };
    this.responseStatus = null;
  }

  saveLead(): void {
    if (!this.selectedLead) {
      return;
    }
    this.leadsService
      .updateLead(this.selectedLead.id, this.editModel)
      .subscribe({
        next: (lead) => {
          this.selectedLead = lead;
          this.selectLead(lead);
          this.loadLeads();
        },
      });
  }

  respondToLead(): void {
    if (!this.selectedLead) {
      return;
    }
    this.leadsService
      .respondToLead(this.selectedLead.id, this.responseModel)
      .subscribe({
        next: (result) => {
          this.selectedLead = result.lead;
          this.responseStatus = 'Response sent successfully.';
          this.selectLead(result.lead);
          this.loadLeads();
        },
        error: (error) => {
          this.responseStatus =
            error?.error?.message || 'Failed to send the response.';
        },
      });
  }

  applyViewPreset(preset: CrmViewPreset): void {
    this.activeViewPreset = preset;
    switch (preset) {
      case 'assigned':
        this.queueFilter = 'assigned';
        this.filters.status = '';
        break;
      case 'stale':
        this.queueFilter = 'overdue';
        this.filters.status = LeadStatus.NEW;
        break;
      case 'qualified':
        this.queueFilter = 'all';
        this.filters.status = LeadStatus.QUALIFIED;
        break;
      default:
        this.queueFilter = 'all';
        this.filters.status = '';
        break;
    }
    localStorage.setItem(CRM_VIEW_STORAGE_KEY, preset);
  }

  applyResponseTemplate(template: ResponseTemplateKey): void {
    if (!this.selectedLead) {
      return;
    }

    const displayName = this.selectedLead.name;
    const companyName = this.selectedLead.company || this.selectedLead.name;
    switch (template) {
      case 'pricing-follow-up':
        this.responseModel.subject = `Pricing options for ${companyName}`;
        this.responseModel.message =
          `Thanks for reaching out about pricing for ${companyName}. ` +
          `I can outline the available options and recommend the right next step.`;
        break;
      case 'qualified-next-step':
        this.responseModel.subject = `Next steps for ${companyName}`;
        this.responseModel.message =
          `Thanks for the additional context. ${companyName} looks like a strong fit, ` +
          `and I’d like to move this into the next planning step.`;
        this.responseModel.status = LeadStatus.QUALIFIED;
        break;
      default:
        this.responseModel.subject = `Thanks for reaching out, ${displayName}`;
        this.responseModel.message =
          `Thanks for reaching out about ${companyName}. ` +
          `I’ve reviewed your note and will follow up with the right next step shortly.`;
        break;
    }
  }

  interactionTimeline(): InteractionTimelineItem[] {
    if (!this.selectedLead) {
      return [];
    }

    const items: InteractionTimelineItem[] = [];
    const createdAt = this.formatTimelineDate(this.selectedLead.createdAt);
    if (createdAt) {
      items.push({
        kind: 'created',
        label: 'Lead created',
        timestamp: createdAt,
      });
    }

    const updatedAt = this.formatTimelineDate(this.selectedLead.updatedAt);
    if (updatedAt && updatedAt !== createdAt) {
      items.push({
        kind: 'updated',
        label: 'Lead updated',
        timestamp: updatedAt,
      });
    }

    const lastRespondedAt = this.formatTimelineDate(
      this.selectedLead.lastRespondedAt
    );
    if (lastRespondedAt) {
      items.push({
        kind: 'responded',
        label: 'Last response sent',
        timestamp: lastRespondedAt,
      });
    }

    const nextFollowUp = this.formatTimelineDate(
      this.selectedLead.nextFollowUp
    );
    if (nextFollowUp) {
      items.push({
        kind: 'follow-up',
        label: 'Next follow-up scheduled',
        timestamp: nextFollowUp,
      });
    }

    return items;
  }

  slaLabel(lead: Lead): string {
    if (this.isOverdue(lead)) {
      return 'Overdue';
    }
    if (lead.status === LeadStatus.NEW) {
      return 'New';
    }
    return 'On track';
  }

  private restoreViewPreset(): void {
    const preset = localStorage.getItem(CRM_VIEW_STORAGE_KEY);
    if (
      preset === 'all' ||
      preset === 'assigned' ||
      preset === 'stale' ||
      preset === 'qualified'
    ) {
      this.applyViewPreset(preset);
    }
  }

  private isOverdue(lead: Lead): boolean {
    const followUp = this.asDate(lead.nextFollowUp);
    if (followUp) {
      return followUp.getTime() < this.startOfToday().getTime();
    }

    if (lead.status === LeadStatus.NEW) {
      const createdAt = this.asDate(lead.createdAt);
      return createdAt ? this.daysSince(createdAt) >= 2 : false;
    }

    return false;
  }

  private startOfToday(): Date {
    const now = new Date('2026-07-04T12:00:00.000Z');
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
  }

  private daysSince(value: Date): number {
    const diff = this.startOfToday().getTime() - value.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  private asDate(value: string | Date | null | undefined): Date | null {
    if (!value) {
      return null;
    }

    const dateValue = value instanceof Date ? value : new Date(value);
    return Number.isNaN(dateValue.getTime()) ? null : dateValue;
  }

  private formatTimelineDate(value: string | Date | null | undefined): string {
    const dateValue = this.asDate(value);
    return dateValue ? dateValue.toISOString().slice(0, 10) : '';
  }

  private toDateInputValue(
    value: string | Date | null | undefined
  ): string | undefined {
    if (!value) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value.slice(0, 10);
    }

    return value.toISOString().slice(0, 10);
  }
}
