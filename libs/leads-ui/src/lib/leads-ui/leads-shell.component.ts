import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LeadsService } from './leads.service';
import { Lead, LeadSource, LeadStats, LeadStatus } from './leads.types';

@Component({
  selector: 'lib-leads-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="leads-container">
      <div class="leads-header">
        <h1>Lead Tracker</h1>
        <button class="btn-primary" (click)="showCreateForm = true">
          Add Lead
        </button>
      </div>

      @if (stats) {
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-value">{{ stats.total }}</span>
          <span class="stat-label">Total Leads</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.autoDiscovered }}</span>
          <span class="stat-label">Auto-Discovered</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.manual }}</span>
          <span class="stat-label">Manual</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">\${{ stats.totalValue | number }}</span>
          <span class="stat-label">Total Value</span>
        </div>
        <div class="stat-card">
          <span class="stat-value">{{ stats.followUpsDue }}</span>
          <span class="stat-label">Follow Ups Due</span>
        </div>
      </div>
      } @if (loading) {
      <div class="loading">Loading leads...</div>
      } @else {
      <div class="leads-list">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Company</th>
              <th>Email</th>
              <th>Source</th>
              <th>Status</th>
              <th>Value</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (lead of leads; track lead.id) {
            <tr>
              <td>{{ lead.name }}</td>
              <td>{{ lead.company || '-' }}</td>
              <td>{{ lead.email || '-' }}</td>
              <td>{{ lead.source }}</td>
              <td>
                <span class="status-badge" [attr.data-status]="lead.status">
                  {{ lead.status }}
                </span>
              </td>
              <td>\${{ lead.value | number }}</td>
              <td>
                <button class="btn-icon" (click)="viewLead(lead)">View</button>
                <button class="btn-icon" (click)="editLead(lead)">Edit</button>
                <button class="btn-icon btn-danger" (click)="deleteLead(lead)">
                  Delete
                </button>
              </td>
            </tr>
            }
          </tbody>
        </table>
      </div>
      } @if (showCreateForm) {
      <div class="modal-overlay" (click)="showCreateForm = false">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h2>Create New Lead</h2>
          <form (ngSubmit)="createLead()">
            <div class="form-group">
              <label>Name *</label>
              <input
                type="text"
                [(ngModel)]="newLead.name"
                name="name"
                required
              />
            </div>
            <div class="form-group">
              <label>Company</label>
              <input type="text" [(ngModel)]="newLead.company" name="company" />
            </div>
            <div class="form-group">
              <label>Email</label>
              <input type="email" [(ngModel)]="newLead.email" name="email" />
            </div>
            <div class="form-group">
              <label>Phone</label>
              <input type="tel" [(ngModel)]="newLead.phone" name="phone" />
            </div>
            <div class="form-group">
              <label>Source</label>
              <select [(ngModel)]="newLead.source" name="source" required>
                @for (source of sources; track source) {
                <option [value]="source">{{ source }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label>Value</label>
              <input
                type="number"
                [(ngModel)]="newLead.value"
                name="value"
                min="0"
              />
            </div>
            <div class="form-group">
              <label>Notes</label>
              <textarea [(ngModel)]="newLead.notes" name="notes"></textarea>
            </div>
            <div class="form-actions">
              <button type="button" (click)="showCreateForm = false">
                Cancel
              </button>
              <button type="submit" class="btn-primary">Create</button>
            </div>
          </form>
        </div>
      </div>
      }
    </div>
  `,
  styles: [
    `
      .leads-container {
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .leads-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
      }
      .leads-header h1 {
        margin: 0;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-bottom: 30px;
      }
      .stat-card {
        background: var(--card-bg, #f5f5f5);
        padding: 15px;
        border-radius: 8px;
        text-align: center;
      }
      .stat-value {
        display: block;
        font-size: 24px;
        font-weight: bold;
      }
      .stat-label {
        display: block;
        font-size: 12px;
        color: #666;
        margin-top: 5px;
      }
      .leads-list table {
        width: 100%;
        border-collapse: collapse;
      }
      .leads-list th,
      .leads-list td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #eee;
      }
      .status-badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        text-transform: uppercase;
      }
      .status-badge[data-status='NEW'] {
        background: #e3f2fd;
        color: #1565c0;
      }
      .status-badge[data-status='CONTACTED'] {
        background: #fff3e0;
        color: #e65100;
      }
      .status-badge[data-status='QUALIFIED'] {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .status-badge[data-status='PROPOSAL'] {
        background: #f3e5f5;
        color: #7b1fa2;
      }
      .status-badge[data-status='NEGOTIATION'] {
        background: #fce4ec;
        color: #c2185b;
      }
      .status-badge[data-status='WON'] {
        background: #c8e6c9;
        color: #1b5e20;
      }
      .status-badge[data-status='LOST'] {
        background: #ffcdd2;
        color: #b71c1c;
      }
      .btn-primary {
        background: #1976d2;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 4px;
        cursor: pointer;
      }
      .btn-icon {
        background: transparent;
        border: 1px solid #ccc;
        padding: 4px 8px;
        margin-right: 4px;
        border-radius: 4px;
        cursor: pointer;
      }
      .btn-danger {
        color: #d32f2f;
        border-color: #d32f2f;
      }
      .loading {
        text-align: center;
        padding: 40px;
        color: #666;
      }
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .modal-content {
        background: white;
        padding: 30px;
        border-radius: 8px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }
      .form-group {
        margin-bottom: 15px;
      }
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-weight: 500;
      }
      .form-group input,
      .form-group select,
      .form-group textarea {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }
      .form-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 20px;
      }
    `,
  ],
})
export class LeadsShellComponent implements OnInit {
  private readonly leadsService = inject(LeadsService);

  leads: Lead[] = [];
  stats: LeadStats | null = null;
  loading = true;
  showCreateForm = false;

  newLead: Partial<Lead> = {
    name: '',
    source: LeadSource.OTHER,
    status: LeadStatus.NEW,
    value: 0,
  };

  sources = Object.values(LeadSource);
  statuses = Object.values(LeadStatus);

  ngOnInit() {
    this.loadLeads();
    this.loadStats();
  }

  loadLeads() {
    this.loading = true;
    this.leadsService.getLeads().subscribe({
      next: (leads) => {
        this.leads = leads;
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
        this.showCreateForm = false;
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
}
