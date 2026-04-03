import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { LeadsService } from './leads.service';
import {
  Lead,
  LeadStats,
  LeadStatus,
  LeadSource,
  LeadFlagReason,
} from './leads.types';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { FlagLeadModalComponent } from './flag-lead-modal.component';
import { LeadDetailModalComponent } from './lead-detail-modal.component';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    FlagLeadModalComponent,
    LeadDetailModalComponent,
  ],
  templateUrl: './leads.component.html',
  styleUrl: './leads.component.scss',
})
export class LeadsComponent implements OnInit {
  private readonly leadsService = inject(LeadsService);
  private readonly themeService = inject(ThemeService);
  private readonly route = inject(ActivatedRoute);

  leads: Lead[] = [];
  filteredLeads: Lead[] = [];
  stats: LeadStats | null = null;
  loading = true;
  searchQuery = '';
  viewMode: 'list' | 'kanban' = 'list';

  // Quick-add panel
  showQuickAdd = false;
  showMoreDetails = false;
  searchKeywordsInput = '';
  newLead: Partial<Lead> = {
    name: '',
    source: LeadSource.OTHER,
    status: LeadStatus.NEW,
    value: 0,
  };

  // Edit mode
  isEditingLead = false;
  editingLeadId: string | null = null;

  // Flagging
  selectedLeadForFlag: Lead | null = null;
  selectedLeadForView: Lead | null = null;

  sources = [LeadSource.REFERRAL, LeadSource.COLD, LeadSource.OTHER];
  statuses = Object.values(LeadStatus);

  kanbanColumns = [
    { key: 'new', label: 'New' },
    { key: 'contacted', label: 'Contacted' },
    { key: 'qualified', label: 'Qualified' },
    { key: 'proposal', label: 'Proposal' },
    { key: 'negotiation', label: 'Negotiation' },
    { key: 'won', label: 'Won' },
    { key: 'lost', label: 'Lost' },
  ];

  ngOnInit() {
    this.loadLeads();
    this.loadStats();
    this.themeService.setPersonality('control-center');

    this.route.queryParams.subscribe((params) => {
      if (params['quickAdd'] === 'true') {
        this.showQuickAdd = true;
      }
    });
  }

  loadLeads() {
    this.leadsService.getLeads().subscribe({
      next: (leads) => {
        this.leads = leads;
        this.filterLeads();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  loadStats() {
    this.leadsService.getStats().subscribe({
      next: (stats) => (this.stats = stats),
    });
  }

  filterLeads() {
    if (!this.searchQuery.trim()) {
      this.filteredLeads = this.leads;
      return;
    }
    const normalizedQuery = this.normalizeSearchToken(this.searchQuery);
    const tokens = normalizedQuery.split(' ').filter(Boolean);

    this.filteredLeads = this.leads
      .map((lead) => ({
        lead,
        score: this.getLeadSearchScore(lead, normalizedQuery, tokens),
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.lead);
  }

  getLeadsByStatus(status: string): Lead[] {
    return this.filteredLeads.filter((lead) => lead.status === status);
  }

  isLeadFlagged(lead: Lead): boolean {
    return !!lead.isFlagged || (lead.flags?.length || 0) > 0;
  }

  openFlagModal(lead: Lead) {
    this.selectedLeadForFlag = lead;
  }

  onLeadFlagged(event: { reasons: LeadFlagReason[]; notes?: string }) {
    if (!this.selectedLeadForFlag) return;
    this.leadsService
      .flagLead(this.selectedLeadForFlag.id, {
        reasons: event.reasons,
        notes: event.notes,
      })
      .subscribe({
        next: () => {
          this.selectedLeadForFlag = null;
          this.loadLeads();
          this.loadStats();
        },
      });
  }

  viewLead(lead: Lead) {
    this.selectedLeadForView = lead;
  }

  editLead(lead: Lead) {
    this.selectedLeadForView = null;
    this.isEditingLead = true;
    this.editingLeadId = lead.id;
    this.showQuickAdd = true;
    this.newLead = {
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      source: lead.source,
      status: lead.status,
      value: lead.value,
      notes: lead.notes,
      nextFollowUp: lead.nextFollowUp,
      assignedTo: lead.assignedTo,
      searchKeywords: lead.searchKeywords,
    };
    this.searchKeywordsInput = (lead.searchKeywords || []).join(', ');
    this.showMoreDetails = true;
  }

  deleteLead(lead: Lead) {
    if (confirm(`Delete lead "${lead.name}"?`)) {
      this.leadsService.deleteLead(lead.id).subscribe({
        next: () => this.loadLeads(),
      });
    }
  }

  createLead() {
    this.leadsService.createLead(this.buildLeadPayload() as any).subscribe({
      next: () => {
        this.resetForm();
        this.loadLeads();
        this.loadStats();
      },
    });
  }

  saveLead() {
    if (this.isEditingLead && this.editingLeadId) {
      this.updateLead();
    } else {
      this.createLead();
    }
  }

  private updateLead() {
    this.leadsService
      .updateLead(this.editingLeadId!, this.buildLeadPayload() as any)
      .subscribe({
        next: () => {
          this.resetForm();
          this.loadLeads();
          this.loadStats();
        },
      });
  }

  private resetForm() {
    this.showQuickAdd = false;
    this.showMoreDetails = false;
    this.isEditingLead = false;
    this.editingLeadId = null;
    this.searchKeywordsInput = '';
    this.newLead = {
      name: '',
      source: LeadSource.OTHER,
      status: LeadStatus.NEW,
      value: 0,
    };
  }

  private buildLeadPayload() {
    const searchKeywords =
      this.parseSearchKeywords(this.searchKeywordsInput) ||
      this.normalizeKeywordList(this.newLead.searchKeywords);

    return {
      name: this.newLead.name?.trim() || '',
      company: this.normalizeOptionalString(this.newLead.company),
      email: this.normalizeOptionalString(this.newLead.email),
      phone: this.normalizeOptionalString(this.newLead.phone),
      source: this.newLead.source,
      status: this.newLead.status,
      value: this.newLead.value ?? 0,
      notes: this.normalizeOptionalString(this.newLead.notes),
      nextFollowUp: this.normalizeOptionalString(this.newLead.nextFollowUp),
      assignedTo: this.normalizeOptionalString(this.newLead.assignedTo),
      searchKeywords,
    };
  }

  private normalizeOptionalString(value: string | undefined) {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private parseSearchKeywords(value: string): string[] | undefined {
    const keywords = value
      .split(',')
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    return keywords.length ? keywords : undefined;
  }

  private normalizeKeywordList(values: string[] | undefined): string[] | undefined {
    const keywords = (values || [])
      .map((keyword) => keyword.trim())
      .filter((keyword) => keyword.length > 0);

    return keywords.length ? keywords : undefined;
  }

  closeQuickAdd() {
    this.resetForm();
  }

  openEditFromView(lead: Lead) {
    this.selectedLeadForView = null;
    this.editLead(lead);
  }

  private getLeadSearchScore(
    lead: Lead,
    normalizedQuery: string,
    tokens: string[]
  ): number {
    const haystacks = {
      name: this.normalizeSearchToken(lead.name),
      company: this.normalizeSearchToken(lead.company),
      email: this.normalizeSearchToken(lead.email),
      phone: this.normalizeSearchToken(lead.phone),
      notes: this.normalizeSearchToken(lead.notes),
      source: this.normalizeSearchToken(lead.source),
      status: this.normalizeSearchToken(lead.status),
      assignedTo: this.normalizeSearchToken(lead.assignedTo),
      keywords: this.normalizeSearchToken((lead.searchKeywords || []).join(' ')),
      contacts: this.normalizeSearchToken(
        (lead.contacts || [])
          .map((contact) => `${contact.label} ${contact.value} ${contact.href}`)
          .join(' ')
      ),
      posting: this.normalizeSearchToken(lead.originalPostingUrl),
    };

    let score = 0;

    for (const token of tokens) {
      if (!token) {
        continue;
      }

      let tokenMatched = false;
      const weightedFields: Array<[string, number]> = [
        [haystacks.name, 10],
        [haystacks.company, 8],
        [haystacks.email, 7],
        [haystacks.phone, 7],
        [haystacks.keywords, 6],
        [haystacks.contacts, 6],
        [haystacks.notes, 4],
        [haystacks.assignedTo, 4],
        [haystacks.source, 3],
        [haystacks.status, 3],
        [haystacks.posting, 2],
      ];

      for (const [fieldValue, weight] of weightedFields) {
        if (!fieldValue) {
          continue;
        }
        if (fieldValue === token) {
          score += weight + 3;
          tokenMatched = true;
          continue;
        }
        if (fieldValue.startsWith(token)) {
          score += weight + 2;
          tokenMatched = true;
          continue;
        }
        if (fieldValue.includes(token)) {
          score += weight;
          tokenMatched = true;
        }
      }

      if (!tokenMatched) {
        return 0;
      }
    }

    const fullHaystack = Object.values(haystacks).join(' ');
    if (normalizedQuery && fullHaystack.includes(normalizedQuery)) {
      score += 5;
    }

    return score;
  }

  private normalizeSearchToken(value: string | undefined): string {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
