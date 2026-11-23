import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  Lead,
  LeadStatus,
  SendLeadResponseDto,
  UpdateLeadDto,
} from '@optimistic-tanuki/ui-models';
import type { ColDef } from '@optimistic-tanuki/ag-grid-ui';
import {
  OwnerConfirmService,
  OwnerDataTableComponent,
  OwnerFilterBarComponent,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
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
  imports: [
    CommonModule,
    FormsModule,
    OperatorQueuePanelComponent,
    OwnerDataTableComponent,
    OwnerFilterBarComponent,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './contact-leads-management.component.html',
  styleUrl: './contact-leads-management.component.scss',
})
export class ContactLeadsManagementComponent implements OnInit {
  private readonly leadsService = inject(ContactLeadsService);
  private readonly operatorQueueService = inject(OperatorQueueService);
  private readonly confirmService = inject(OwnerConfirmService);

  leads: Lead[] = [];
  queueItems: OperatorQueueItem[] = [];
  appScopes: string[] = [];
  selectedLead: Lead | null = null;
  loading = false;
  /** True once a load has succeeded; stats show a dash until then. */
  loaded = false;
  queueError: string | null = null;
  saveStatus: string | null = null;
  searchText = '';
  loadError: string | null = null;
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

  readonly columns: ColDef[] = [
    { field: 'name', headerName: 'Name', flex: 2 },
    { field: 'appScope', headerName: 'App', flex: 1 },
    { field: 'status', headerName: 'Status', flex: 1 },
    {
      headerName: 'Assigned to',
      flex: 1,
      valueGetter: (p) => p.data?.assignedTo || 'Unassigned',
    },
    {
      headerName: 'Follow-up',
      flex: 1,
      valueGetter: (p) => (p.data ? this.slaLabel(p.data) : ''),
    },
    {
      headerName: 'Subject',
      flex: 3,
      valueGetter: (p) =>
        p.data?.contactSubject || p.data?.contactMessage || p.data?.notes || '',
    },
  ];

  private tableCache: { key: string; leads: Lead[]; rows: Lead[] } | null =
    null;

  /** Stable between change detections so the grid is not reset every cycle. */
  get tableLeads(): Lead[] {
    const key = `${this.queueFilter}|${this.searchText}`;
    if (
      !this.tableCache ||
      this.tableCache.key !== key ||
      this.tableCache.leads !== this.leads
    ) {
      this.tableCache = {
        key,
        leads: this.leads,
        rows: this.searchedLeads(),
      };
    }
    return this.tableCache.rows;
  }

  onSearch(text: string): void {
    this.searchText = text.trim().toLowerCase();
  }

  private searchedLeads(): Lead[] {
    const q = this.searchText;
    return this.filteredLeads().filter(
      (lead) =>
        !q ||
        [lead.name, lead.email, lead.contactSubject].some((v) =>
          (v ?? '').toLowerCase().includes(q)
        )
    );
  }

  ngOnInit(): void {
    this.restoreViewPreset();
    this.loadLeads();
    this.loadQueue();
  }

  loadQueue(): void {
    this.queueError = null;
    this.operatorQueueService.getQueueByDomain('CRM').subscribe({
      next: (items) => {
        this.queueItems = items;
      },
      error: () => {
        this.queueError = 'The CRM queue could not be loaded.';
      },
    });
  }

  loadLeads(): void {
    this.loading = true;
    this.loadError = null;
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
          this.loaded = true;
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
          this.loadError = 'Contact leads could not be loaded.';
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
    return this.leads.filter(
      (lead) =>
        lead.appScope === 'hai' &&
        !lead.firstPersonalResponseAt &&
        this.isOverdue(lead)
    );
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

  async saveLead(): Promise<void> {
    if (!this.selectedLead) {
      return;
    }
    const { confirmed } = await this.confirmService.confirm({
      level: 'plain',
      title: 'Save lead changes',
      body: `Update ${this.selectedLead.name}. You can edit it again later.`,
      confirmLabel: 'Save changes',
    });
    if (!confirmed || !this.selectedLead) return;
    this.saveStatus = null;
    this.leadsService
      .updateLead(
        this.selectedLead.id,
        this.editModel,
        this.selectedLead.appScope
      )
      .subscribe({
        next: (lead) => {
          this.selectedLead = lead;
          this.selectLead(lead);
          this.loadLeads();
        },
        error: (error) => {
          this.saveStatus = error?.error?.message || 'Failed to save the lead.';
        },
      });
  }

  async respondToLead(): Promise<void> {
    if (!this.selectedLead) {
      return;
    }
    // An email cannot be recalled, but sending replies is routine work, so
    // this is a plain confirmation rather than a typed one.
    const { confirmed } = await this.confirmService.confirm({
      level: 'plain',
      title: 'Send reply',
      body: `Email ${
        this.selectedLead.email || this.selectedLead.name
      } now. A sent email cannot be recalled.`,
      confirmLabel: 'Send reply',
    });
    if (!confirmed || !this.selectedLead) return;
    this.leadsService
      .respondToLead(
        this.selectedLead.id,
        this.responseModel,
        this.selectedLead.appScope
      )
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
    if (lead.appScope === 'hai') {
      const dueAt = this.asDate(lead.dueAt);
      const firstResponse = this.asDate(lead.firstPersonalResponseAt);
      if (!dueAt) return 'Deadline unavailable';
      if (firstResponse) {
        return firstResponse.getTime() <= dueAt.getTime() ? 'Met' : 'Missed';
      }
      return Date.now() > dueAt.getTime()
        ? 'Overdue'
        : 'Awaiting acknowledgment';
    }
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
    if (lead.appScope === 'hai') {
      const dueAt = this.asDate(lead.dueAt);
      const firstResponse = this.asDate(lead.firstPersonalResponseAt);
      return Boolean(
        dueAt && (firstResponse || new Date()).getTime() > dueAt.getTime()
      );
    }
    const followUp = this.asDate(lead.nextFollowUp);
    if (followUp) {
      return followUp.getTime() < this.startOfToday().getTime();
    }

    return false;
  }

  private startOfToday(): Date {
    const now = new Date();
    return new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );
  }

  formatEastern(value: string | Date | null | undefined): string {
    const date = this.asDate(value);
    if (!date) return 'Not recorded';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/New_York',
      timeZoneName: 'short',
    }).format(date);
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
