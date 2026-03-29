import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { LeadsService } from './leads.service';
import { Lead, LeadStats, LeadStatus, LeadSource, LeadFlagReason } from './leads.types';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { FlagLeadModalComponent } from './flag-lead-modal.component';

@Component({
  selector: 'app-leads',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, FlagLeadModalComponent],
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
  newLead: Partial<Lead> = {
    name: '',
    source: LeadSource.OTHER,
    status: LeadStatus.NEW,
    value: 0,
  };

  // Flagging
  selectedLeadForFlag: Lead | null = null;

  sources = Object.values(LeadSource);
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
    const query = this.searchQuery.toLowerCase();
    this.filteredLeads = this.leads.filter(
      (lead) =>
        lead.name.toLowerCase().includes(query) ||
        lead.company?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query)
    );
  }

  getLeadsByStatus(status: string): Lead[] {
    return this.filteredLeads.filter((lead) => lead.status === status);
  }

  isLeadFlagged(lead: Lead): boolean {
    return lead.isFlagged || this.leadsService.isLeadFlagged(lead.id);
  }

  openFlagModal(lead: Lead) {
    this.selectedLeadForFlag = lead;
  }

  onLeadFlagged(event: { reasons: LeadFlagReason[]; notes?: string }) {
    if (!this.selectedLeadForFlag) return;
    this.leadsService.flagLead(
      this.selectedLeadForFlag.id,
      event.reasons,
      event.notes
    );
    this.selectedLeadForFlag = null;
  }

  viewLead(lead: Lead) {
    console.log('View lead:', lead);
  }

  editLead(lead: Lead) {
    console.log('Edit lead:', lead);
  }

  deleteLead(lead: Lead) {
    if (confirm(`Delete lead "${lead.name}"?`)) {
      this.leadsService.deleteLead(lead.id).subscribe({
        next: () => this.loadLeads(),
      });
    }
  }

  createLead() {
    this.leadsService.createLead(this.newLead as any).subscribe({
      next: () => {
        this.showQuickAdd = false;
        this.showMoreDetails = false;
        this.newLead = {
          name: '',
          source: LeadSource.OTHER,
          status: LeadStatus.NEW,
          value: 0,
        };
        this.loadLeads();
        this.loadStats();
      },
    });
  }

  closeQuickAdd() {
    this.showQuickAdd = false;
    this.showMoreDetails = false;
    this.newLead = {
      name: '',
      source: LeadSource.OTHER,
      status: LeadStatus.NEW,
      value: 0,
    };
  }
}
