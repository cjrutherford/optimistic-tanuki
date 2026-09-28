import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CivicAgendaDto } from '@optimistic-tanuki/models';
import { CivicApiService } from '../../services/civic-api.service';

@Component({
  selector: 'civic-agendas-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page-container">
      <p class="eyebrow">Meeting records</p>
      <h1 class="page-title">Council and commission agendas</h1>
      <p class="page-lead">
        Searchable archive of city council and planning commission meetings.
        Summaries are extracted automatically from the published agenda text.
      </p>

      <form
        class="search-row"
        role="search"
        aria-label="Search meeting records"
        (submit)="search($event)"
      >
        <label class="search-field">
          <span class="input-label">Search agendas</span>
          <input
            type="search"
            class="search-input"
            [(ngModel)]="searchText"
            name="searchText"
            placeholder="Rezoning, variance, Bull Street..."
            autocomplete="off"
          />
        </label>
        <label class="search-field">
          <span class="input-label">Meeting body</span>
          <select
            class="search-input"
            [(ngModel)]="meetingBody"
            name="meetingBody"
          >
            <option value="">All bodies</option>
            <option value="city-council">City council</option>
            <option value="planning-commission">Planning commission</option>
          </select>
        </label>
        <button type="submit" class="btn-search" [disabled]="loading">
          Search
        </button>
      </form>

      <div *ngIf="loadError" class="error-banner" role="alert">
        {{ loadError }}
      </div>

      <div class="agenda-list" aria-live="polite" aria-busy="{{ loading }}">
        <article *ngFor="let agenda of agendas" class="agenda-card">
          <header class="agenda-header">
            <span class="body-pill">{{ bodyLabel(agenda) }}</span>
            <time class="meeting-date" [attr.datetime]="agenda.meetingDate">
              {{ agenda.meetingDate | date : 'mediumDate' }}
            </time>
          </header>
          <h2 class="agenda-title">{{ agenda.title }}</h2>
          <ol class="item-list">
            <li *ngFor="let item of agenda.items" class="agenda-item">
              <strong *ngIf="item.itemNumber" class="item-number">
                {{ item.itemNumber }}.
              </strong>
              <span class="item-title">{{ item.title }}</span>
              <p class="item-summary">{{ item.summary }}</p>
            </li>
          </ol>
        </article>
      </div>

      <p
        *ngIf="!loading && agendas.length === 0 && !loadError"
        class="empty-note"
      >
        No meeting records match this search.
      </p>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 900px;
        margin: 40px auto;
        padding: 0 24px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--accent);
        margin: 0 0 8px 0;
      }
      .page-title {
        font-size: 2.1rem;
        font-weight: 800;
        color: var(--foreground);
        margin: 0 0 10px 0;
      }
      .page-lead {
        color: var(--foreground-muted);
        line-height: 1.6;
        margin: 0 0 24px 0;
        max-width: 640px;
      }
      .search-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: flex-end;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 24px;
      }
      .search-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        flex: 1;
        min-width: 200px;
      }
      .input-label {
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--foreground-muted);
      }
      .search-input {
        background: var(--input-bg);
        border: 2px solid var(--border-color);
        border-radius: 6px;
        padding: 10px 14px;
        color: var(--foreground);
        font-size: 1rem;
      }
      .search-input:focus-visible,
      .btn-search:focus-visible {
        outline: 3px solid var(--primary);
        outline-offset: 3px;
      }
      .btn-search {
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
        border-radius: 6px;
        padding: 12px 22px;
        font-weight: 700;
        font-size: 1rem;
        cursor: pointer;
      }
      .btn-search:disabled {
        cursor: wait;
        opacity: 0.72;
      }
      .error-banner {
        background: var(--civic-danger-surface);
        border: 2px solid var(--danger);
        color: var(--danger);
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 16px;
        font-weight: 600;
      }
      .agenda-list {
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .agenda-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
      }
      .agenda-header {
        display: flex;
        gap: 10px;
        align-items: center;
        margin-bottom: 8px;
      }
      .body-pill {
        background: var(--primary);
        color: var(--primary-foreground);
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        border-radius: 4px;
        padding: 2px 10px;
      }
      .meeting-date {
        color: var(--foreground-muted);
        font-size: 0.9rem;
      }
      .agenda-title {
        margin: 0 0 12px 0;
        font-size: 1.25rem;
        color: var(--foreground);
      }
      .item-list {
        margin: 0;
        padding-left: 22px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .item-number {
        color: var(--accent);
      }
      .item-title {
        font-weight: 600;
        color: var(--foreground);
      }
      .item-summary {
        margin: 4px 0 0 0;
        color: var(--foreground-secondary);
        font-size: 0.92rem;
        line-height: 1.6;
      }
      .empty-note {
        color: var(--foreground-muted);
      }
      @media (max-width: 600px) {
        .page-container {
          margin: 24px auto;
          padding: 0 16px;
        }
        .search-row {
          align-items: stretch;
        }
        .search-field {
          min-width: 100%;
        }
        .btn-search {
          min-height: 48px;
        }
      }
    `,
  ],
})
export class AgendasPageComponent implements OnInit {
  agendas: CivicAgendaDto[] = [];
  loading = true;
  loadError = '';
  searchText = '';
  meetingBody = '';

  constructor(
    private readonly api: CivicApiService,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
    } else {
      this.loading = false;
    }
  }

  search(event: Event): void {
    event.preventDefault();
    this.load();
  }

  bodyLabel(agenda: CivicAgendaDto): string {
    return agenda.meetingBody === 'planning-commission'
      ? 'Planning commission'
      : 'City council';
  }

  private load(): void {
    this.loading = true;
    this.api
      .getAgendas({
        ...(this.meetingBody ? { meetingBody: this.meetingBody } : {}),
        ...(this.searchText.trim() ? { search: this.searchText.trim() } : {}),
      })
      .subscribe({
        next: (agendas) => {
          this.loading = false;
          this.loadError = '';
          this.agendas = agendas ?? [];
        },
        error: () => {
          this.loading = false;
          this.agendas = [];
          this.loadError =
            'Meeting records are unavailable. Nothing is displayed.';
        },
      });
  }
}
