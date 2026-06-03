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

@Component({
  selector: 'app-contact-leads-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="page">
      <header class="hero">
        <p class="hero-kicker">CRM Workspace</p>
        <h1>Contact leads</h1>
        <p>
          Review inbound contact requests across client-facing apps, update lead
          state, and respond from the operator console.
        </p>
      </header>

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
        <button class="btn btn-secondary" type="button" (click)="loadLeads()">
          Refresh
        </button>
      </section>

      <section class="workspace">
        <div class="lead-list panel">
          <div class="panel-head">
            <h2>Inbox</h2>
            <span>{{ leads.length }} leads</span>
          </div>

          <div *ngIf="loading" class="empty">Loading leads…</div>
          <div *ngIf="!loading && !leads.length" class="empty">
            No contact leads matched the current filters.
          </div>

          <button
            *ngFor="let lead of leads"
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
              <textarea rows="8" [(ngModel)]="editModel.notes"></textarea>
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
            <h3>Respond</h3>
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
                <option *ngFor="let status of statuses" [value]="status">
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
        </div>

        <ng-template #emptyDetail>
          <div class="panel empty">
            Select a lead to review submission details and respond.
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
      .editor {
        display: grid;
        gap: 16px;
      }

      .hero,
      .panel,
      .filters {
        border: 1px solid var(--border-color, #d6d6d6);
        border-radius: 24px;
        background: rgba(255, 255, 255, 0.96);
        padding: 24px;
      }

      .hero-kicker,
      .label {
        margin: 0 0 8px;
        color: #0f766e;
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

      .filters {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        align-items: end;
      }

      .filters label,
      .editor label {
        display: grid;
        gap: 8px;
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
        background: rgba(248, 250, 250, 0.95);
        padding: 16px;
        margin-bottom: 12px;
        cursor: pointer;
      }

      .lead-card.is-active {
        border-color: #0f766e;
        box-shadow: 0 0 0 1px rgba(15, 118, 110, 0.18);
      }

      .lead-card-top,
      .lead-card-meta,
      .detail-grid {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
      }

      .lead-card-message {
        color: #52606d;
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
        background: rgba(248, 250, 250, 0.95);
        border: 1px solid var(--border-color, #d6d6d6);
      }

      .badge {
        display: inline-flex;
        align-items: center;
        padding: 0.3rem 0.65rem;
        border-radius: 999px;
        background: rgba(15, 118, 110, 0.12);
        color: #0f766e;
        font-size: 0.78rem;
        font-weight: 700;
      }

      input,
      select,
      textarea,
      .btn {
        border-radius: 12px;
        border: 1px solid var(--border-color, #d6d6d6);
        padding: 10px 12px;
        font: inherit;
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
        background: #0f766e;
        border-color: #0f766e;
        color: white;
      }

      .btn-secondary {
        background: transparent;
      }

      .response-status {
        margin: 0;
        color: #0f766e;
      }

      @media (max-width: 1100px) {
        .workspace {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ContactLeadsManagementComponent implements OnInit {
  private readonly leadsService = inject(ContactLeadsService);

  leads: Lead[] = [];
  appScopes: string[] = [];
  selectedLead: Lead | null = null;
  loading = false;
  responseStatus: string | null = null;
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

  ngOnInit(): void {
    this.loadLeads();
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
      status: LeadStatus.CONTACTED,
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
