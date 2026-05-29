import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AcceptedBusinessClient,
  BusinessApiService,
  BusinessSiteConfigStore,
  RoutineAssignment,
} from '@optimistic-tanuki/business-data-access';
import { Appointment } from '@optimistic-tanuki/ui-models';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'business-owner-clients-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, CardComponent],
  template: `
    <section class="client-studio">
      <otui-card class="headline-card">
        <div class="headline-copy">
          <p class="eyebrow">Client Studio</p>
          <h1>Manage active relationships</h1>
          <p class="headline-body">
            Stay in the flow of who is approved, who is booked, and what each
            client needs next.
          </p>
        </div>
        <div class="headline-band">
          <div class="metric-tile accent">
            <span>Accepted</span>
            <strong>{{ acceptedClients().length }}</strong>
            <small>Cleared to book against availability.</small>
          </div>
          <button
            type="button"
            class="metric-tile metric-button"
            (click)="scrollToSection('owner-client-bookings')"
          >
            <span>Bookings</span>
            <strong>{{ bookings().length }}</strong>
            <small>Upcoming and in-flight sessions.</small>
          </button>
          <button
            type="button"
            class="metric-tile metric-button"
            (click)="scrollToSection('owner-client-routines')"
          >
            <span>Routines</span>
            <strong>{{ routines().length }}</strong>
            <small>Assigned plans in motion.</small>
          </button>
        </div>
      </otui-card>

      <div class="workspace-grid">
        <otui-card class="roster-card">
          <div class="section-head section-head-spread">
            <div>
              <p class="eyebrow">Roster</p>
              <h2>Approved clients</h2>
            </div>
            <span class="section-count">{{ acceptedClients().length }}</span>
          </div>

          <div class="roster-list">
            @for (client of acceptedClients(); track client.userId) {
            <button
              type="button"
              class="roster-item"
              [class.selected]="client.userId === clientId()"
              (click)="selectClient(client.userId)"
            >
              <div class="roster-topline">
                <span class="avatar-seal">{{
                  client.name?.slice(0, 1) || 'C'
                }}</span>
                <div class="roster-identity">
                  <strong>{{ client.name }}</strong>
                  <span>{{ client.email || client.userId }}</span>
                </div>
              </div>
              <div class="roster-meta">
                <small
                  >{{
                    selectedClientBookingsCount(client.userId)
                  }}
                  bookings</small
                >
                <small
                  >{{
                    selectedClientRoutinesCount(client.userId)
                  }}
                  routines</small
                >
              </div>
            </button>
            } @empty {
            <p class="empty">
              Accepted clients will appear here once the owner approves them.
            </p>
            }
          </div>
        </otui-card>

        <otui-card class="workspace-card">
          @if (selectedClient(); as client) {
          <div class="workspace-header">
            <div class="workspace-title">
              <p class="eyebrow">Selected Client</p>
              <h2>{{ client.name }}</h2>
              <p class="detail-copy">
                {{ client.email || 'No email' }} ·
                {{ client.phone || 'No phone' }}
              </p>
            </div>
            <div class="status-pill">
              <span>{{ client.leadStatus }}</span>
            </div>
          </div>

          <div class="insight-ribbon">
            <div class="insight-chip">
              <span>Booking status</span>
              <strong>{{
                selectedClientBookings().length
                  ? 'Active'
                  : 'Awaiting first session'
              }}</strong>
            </div>
            <div class="insight-chip">
              <span>Availability fit</span>
              <strong>Owner calendar enforced</strong>
            </div>
            <div class="insight-chip">
              <span>Next step</span>
              <strong>{{
                selectedClientRoutines().length
                  ? 'Routine assigned'
                  : 'Routine pending'
              }}</strong>
            </div>
          </div>

          <div class="workspace-layout">
            <aside class="overview-rail">
              <div class="overview-card">
                <p class="rail-label">Relationship overview</p>
                <div class="overview-list">
                  <div class="overview-row">
                    <span>Name</span>
                    <strong>{{ client.name }}</strong>
                  </div>
                  <div class="overview-row">
                    <span>Email</span>
                    <strong>{{ client.email || 'Not provided' }}</strong>
                  </div>
                  <div class="overview-row">
                    <span>Phone</span>
                    <strong>{{ client.phone || 'Not provided' }}</strong>
                  </div>
                  <div class="overview-row">
                    <span>Lead state</span>
                    <strong>{{ client.leadStatus }}</strong>
                  </div>
                </div>
              </div>
              <div class="overview-card muted">
                <p class="rail-label">Workspace notes</p>
                <p class="rail-copy">
                  This client can only book inside the owner’s published
                  availability. Use this workspace to keep the relationship
                  moving.
                </p>
              </div>
            </aside>

            <div class="activity-stage">
              <div class="activity-grid">
                <div class="activity-card" id="owner-client-bookings">
                  <div class="activity-head">
                    <h3>Bookings</h3>
                    <span>{{ selectedClientBookings().length }}</span>
                  </div>
                  <div class="timeline">
                    @for (booking of selectedClientBookings(); track booking.id)
                    {
                    <div class="timeline-item booking">
                      <div class="timeline-marker"></div>
                      <div class="timeline-content">
                        <div class="item-topline">
                          <strong>{{ booking.title }}</strong>
                          <span class="status-tag">{{ booking.status }}</span>
                        </div>
                        <p>
                          {{ booking.startTime | date : 'medium' }} -
                          {{ booking.endTime | date : 'shortTime' }}
                        </p>
                      </div>
                    </div>
                    } @empty {
                    <p class="empty">No bookings yet for this client.</p>
                    }
                  </div>
                </div>

                @if (siteConfig.site().features.clientTasks.enabled) {
                <div class="activity-card" id="owner-client-routines">
                  <div class="activity-head">
                    <h3>Current routines</h3>
                    <span>{{ selectedClientRoutines().length }}</span>
                  </div>
                  <div class="timeline">
                    @for (routine of selectedClientRoutines(); track routine.id)
                    {
                    <div class="timeline-item">
                      <div class="timeline-marker"></div>
                      <div class="timeline-content">
                        <div class="item-topline">
                          <strong>{{ routine.title }}</strong>
                          <span>{{ routine.clientName }}</span>
                        </div>
                        <p>{{ routine.summary }}</p>
                      </div>
                    </div>
                    } @empty {
                    <p class="empty">No routines assigned yet.</p>
                    }
                  </div>
                </div>
                }
              </div>

              @if (siteConfig.site().features.clientTasks.enabled) {
              <form class="assignment-card" (ngSubmit)="assignRoutine()">
                <div class="section-head compact section-head-spread">
                  <div>
                    <p class="eyebrow">Next Action</p>
                    <h3>Assign a routine</h3>
                  </div>
                  <span class="section-count">Live</span>
                </div>
                <div class="assignment-grid">
                  <label>
                    Title
                    <input [(ngModel)]="title" name="title" />
                  </label>
                  <label class="full">
                    Summary
                    <textarea [(ngModel)]="summary" name="summary"></textarea>
                  </label>
                </div>
                <otui-button type="submit" variant="primary"
                  >Assign routine</otui-button
                >
              </form>
              }
            </div>
          </div>
          } @else {
          <div class="empty-state">
            <p class="eyebrow">Client Detail</p>
            <h2>
              Select a client to manage bookings, routines, and contact context.
            </h2>
            <p class="empty">
              The owner view is centered on approved clients and what they
              currently have in flight.
            </p>
          </div>
          }
        </otui-card>
      </div>

      @if (siteConfig.site().features.clientTasks.enabled) {
      <otui-card class="all-routines-card">
        <div class="section-head section-head-spread">
          <div>
            <p class="eyebrow">Shared Work</p>
            <h2>Current routines across clients</h2>
          </div>
          <span class="section-count">{{ routines().length }}</span>
        </div>
        <div class="routine-board">
          @for (routine of routines(); track routine.id) {
          <div class="routine-board-card">
            <small>{{ routine.clientName }}</small>
            <strong>{{ routine.title }}</strong>
            <p>{{ routine.summary }}</p>
          </div>
          } @empty {
          <p class="empty">No client routines assigned yet.</p>
          }
        </div>
      </otui-card>
      }
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        color: var(--foreground, #0f172a);
      }
      .client-studio {
        display: grid;
        gap: 1.25rem;
        --studio-base: var(--background, #ffffff);
        --studio-elevated: var(
          --background-elevated,
          var(--surface, var(--background, #ffffff))
        );
        --studio-surface: color-mix(
          in srgb,
          var(--studio-elevated) 86%,
          var(--studio-base)
        );
        --studio-surface-strong: color-mix(
          in srgb,
          var(--studio-elevated) 94%,
          var(--studio-base)
        );
        --studio-surface-soft: color-mix(
          in srgb,
          var(--studio-base) 76%,
          var(--studio-elevated)
        );
        --studio-accent-surface: color-mix(
          in srgb,
          var(--primary, #1f7a63) 12%,
          var(--studio-elevated)
        );
        --studio-border: color-mix(
          in srgb,
          var(--border, #d0d7de) 78%,
          var(--primary, #1f7a63) 22%
        );
        --studio-border-soft: color-mix(
          in srgb,
          var(--border, #d0d7de) 88%,
          transparent
        );
        --studio-shadow: 0 16px 36px
          color-mix(in srgb, var(--foreground, #0f172a) 10%, transparent);
        --studio-shadow-soft: 0 10px 24px
          color-mix(in srgb, var(--foreground, #0f172a) 8%, transparent);
      }
      .headline-card ::ng-deep .card,
      .roster-card ::ng-deep .card,
      .workspace-card ::ng-deep .card,
      .all-routines-card ::ng-deep .card {
        border-color: var(--studio-border);
        background: var(--studio-surface-strong);
        box-shadow: var(--studio-shadow);
      }
      .headline-card ::ng-deep .card-body,
      .roster-card ::ng-deep .card-body,
      .workspace-card ::ng-deep .card-body,
      .all-routines-card ::ng-deep .card-body {
        background: transparent;
      }
      .headline-band,
      .workspace-grid,
      .workspace-layout,
      .activity-grid,
      .assignment-grid,
      .routine-board,
      .roster-list,
      .overview-list,
      .timeline {
        display: grid;
        gap: 1rem;
      }
      .headline-card {
        display: grid;
        gap: 1.1rem;
        padding: 1.4rem;
        border-radius: 1.6rem;
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--primary, #1f7a63) 14%, transparent),
            transparent 38%
          ),
          linear-gradient(
            135deg,
            var(--studio-accent-surface),
            var(--studio-surface-strong)
          );
        overflow: hidden;
      }
      .headline-copy {
        display: grid;
        gap: 0.55rem;
      }
      .headline-copy h1,
      .section-head h2,
      .workspace-title h2 {
        margin: 0;
        font-family: var(
          --font-heading,
          'Baskervville',
          'Times New Roman',
          serif
        );
        font-weight: 700;
        line-height: 0.98;
      }
      .headline-copy h1 {
        font-size: clamp(2rem, 3vw, 3rem);
      }
      .headline-body {
        margin: 0;
        max-width: 54ch;
        color: color-mix(in srgb, var(--foreground, #0f172a) 72%, transparent);
      }
      .headline-band {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }
      .metric-tile {
        display: grid;
        gap: 0.3rem;
        padding: 1rem 1.05rem;
        border-radius: 1.2rem;
        border: 1px solid var(--studio-border-soft);
        background: var(--studio-surface);
        box-shadow: var(--studio-shadow-soft);
      }
      .metric-button {
        text-align: left;
        color: inherit;
        cursor: pointer;
        transition: transform 0.2s ease, border-color 0.2s ease,
          box-shadow 0.2s ease;
      }
      .metric-button:hover {
        transform: translateY(-2px);
        border-color: var(--studio-border);
      }
      .metric-tile.accent {
        background: linear-gradient(
          135deg,
          var(--studio-accent-surface),
          var(--studio-surface)
        );
        border-color: var(--studio-border);
      }
      .metric-tile span,
      .insight-chip span,
      .rail-label,
      .section-count {
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .metric-tile strong {
        font-size: clamp(1.6rem, 2vw, 2.2rem);
        font-family: var(
          --font-heading,
          'Baskervville',
          'Times New Roman',
          serif
        );
        line-height: 1;
      }
      .metric-tile small,
      .detail-copy,
      .headline-copy .eyebrow,
      .insight-chip,
      .roster-identity span,
      .roster-meta small,
      .overview-row span,
      .rail-copy,
      .timeline-content p,
      .routine-board-card p,
      .empty {
        color: var(--muted);
      }
      .workspace-grid {
        grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
        align-items: start;
      }
      .roster-card,
      .workspace-card,
      .all-routines-card {
        padding: 1.2rem;
        border-radius: 1.5rem;
        background: var(--studio-surface-strong);
      }
      .section-head,
      .workspace-header,
      .workspace-title,
      .overview-card,
      .activity-card,
      .assignment-card,
      .empty-state {
        display: grid;
        gap: 0.8rem;
      }
      .section-head-spread,
      .activity-head,
      .item-topline,
      .overview-row,
      .workspace-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }
      .section-count,
      .status-pill,
      .status-tag {
        padding: 0.45rem 0.7rem;
        border-radius: 999px;
        border: 1px solid var(--studio-border);
        background: color-mix(
          in srgb,
          var(--primary, #1f7a63) 12%,
          var(--studio-elevated)
        );
        color: var(--primary, #1f7a63);
      }
      .status-pill,
      .status-tag {
        font-size: 0.76rem;
        font-weight: 700;
        text-transform: capitalize;
      }
      .roster-item {
        width: 100%;
        display: grid;
        gap: 0.75rem;
        padding: 1rem 1.05rem;
        border-radius: 1.2rem;
        border: 1px solid var(--studio-border-soft);
        background: var(--studio-surface);
        text-align: left;
        color: inherit;
        transition: transform 0.2s ease, border-color 0.2s ease,
          box-shadow 0.2s ease, background 0.2s ease;
      }
      .roster-item:hover {
        transform: translateY(-2px);
        border-color: var(--studio-border);
        box-shadow: var(--studio-shadow-soft);
      }
      .roster-item.selected {
        background: linear-gradient(
          135deg,
          var(--studio-accent-surface),
          var(--studio-surface-strong)
        );
        border-color: var(--studio-border);
      }
      .roster-topline {
        display: flex;
        gap: 0.85rem;
        align-items: center;
      }
      .avatar-seal {
        display: grid;
        place-items: center;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 0.9rem;
        border: 1px solid
          color-mix(
            in srgb,
            var(--primary, #1f7a63) 28%,
            var(--border, #d0d7de)
          );
        background: linear-gradient(
          135deg,
          color-mix(
            in srgb,
            var(--primary, #1f7a63) 22%,
            var(--studio-elevated)
          ),
          color-mix(in srgb, var(--primary, #1f7a63) 10%, var(--studio-base))
        );
        color: var(--primary, #1f7a63);
        font-weight: 800;
      }
      .roster-identity {
        display: grid;
        gap: 0.15rem;
      }
      .roster-meta {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .roster-meta small {
        padding: 0.3rem 0.55rem;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--foreground, #0f172a) 6%,
          var(--studio-elevated)
        );
      }
      .insight-ribbon {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
      }
      .insight-chip {
        display: grid;
        gap: 0.3rem;
        padding: 0.9rem 1rem;
        border-radius: 1.05rem;
        border: 1px solid var(--studio-border-soft);
        background: linear-gradient(
          180deg,
          var(--studio-surface),
          var(--studio-surface-soft)
        );
      }
      .insight-chip strong {
        color: var(--foreground, #0f172a);
      }
      .workspace-layout {
        grid-template-columns: minmax(250px, 300px) minmax(0, 1fr);
        align-items: start;
      }
      .overview-rail,
      .activity-stage {
        display: grid;
        gap: 1rem;
      }
      .overview-card,
      .activity-card,
      .assignment-card,
      .empty-state {
        padding: 1rem;
        border-radius: 1.15rem;
        border: 1px solid var(--studio-border-soft);
        background: var(--studio-surface);
      }
      .overview-card.muted {
        background: linear-gradient(
          180deg,
          var(--studio-surface-soft),
          var(--studio-surface)
        );
      }
      .overview-rail {
        position: sticky;
        top: 1rem;
      }
      .overview-list {
        gap: 0.65rem;
      }
      .overview-row {
        align-items: baseline;
        padding-bottom: 0.65rem;
        border-bottom: 1px solid
          color-mix(in srgb, var(--border, #d0d7de) 78%, transparent);
      }
      .overview-row:last-child {
        padding-bottom: 0;
        border-bottom: 0;
      }
      .eyebrow {
        margin: 0;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        color: var(--primary, #1f7a63);
      }
      .activity-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .activity-head h3,
      .section-head.compact h3 {
        margin: 0;
      }
      .activity-head span {
        font-size: 0.82rem;
        font-weight: 700;
        color: var(--muted);
      }
      .timeline {
        gap: 0.85rem;
      }
      .timeline-item {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        gap: 0.75rem;
        align-items: start;
      }
      .timeline-marker {
        width: 0.85rem;
        height: 0.85rem;
        margin-top: 0.35rem;
        border-radius: 999px;
        background: var(--primary, #1f7a63);
        box-shadow: 0 0 0 6px
          color-mix(in srgb, var(--primary, #1f7a63) 10%, transparent);
      }
      .timeline-content {
        display: grid;
        gap: 0.3rem;
      }
      .item-topline {
        align-items: baseline;
      }
      .timeline-content p,
      .routine-board-card p {
        margin: 0;
      }
      .assignment-card {
        gap: 1rem;
      }
      .assignment-grid {
        grid-template-columns: 1fr;
      }
      label {
        display: grid;
        gap: 0.4rem;
        font-weight: 700;
      }
      label.full {
        grid-column: 1 / -1;
      }
      input,
      textarea,
      select {
        font: inherit;
        padding: 0.85rem 0.95rem;
        border-radius: 0.95rem;
        border: 1px solid var(--studio-border);
        background: color-mix(
          in srgb,
          var(--studio-elevated) 92%,
          var(--studio-base)
        );
        color: inherit;
      }
      textarea {
        min-height: 110px;
      }
      .routine-board {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
      .routine-board-card {
        display: grid;
        gap: 0.4rem;
        padding: 1rem;
        border-radius: 1rem;
        border: 1px solid var(--studio-border-soft);
        background: linear-gradient(
          180deg,
          var(--studio-surface),
          var(--studio-surface-soft)
        );
      }
      .routine-board-card small {
        color: var(--primary, #1f7a63);
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      @media (max-width: 1100px) {
        .headline-band,
        .workspace-grid,
        .workspace-layout,
        .activity-grid,
        .insight-ribbon {
          grid-template-columns: 1fr;
        }
        .overview-rail {
          position: static;
        }
      }
    `,
  ],
})
export class BusinessOwnerClientsPageComponent {
  private readonly api = inject(BusinessApiService);
  protected readonly siteConfig = inject(BusinessSiteConfigStore);
  readonly routines = signal<RoutineAssignment[]>([]);
  readonly acceptedClients = signal<AcceptedBusinessClient[]>([]);
  readonly bookings = signal<Appointment[]>([]);
  readonly activeClients = computed(() =>
    this.acceptedClients().map((client) => ({
      id: client.userId,
      label: client.name || client.email || client.userId,
    }))
  );
  readonly selectedClient = computed(
    () =>
      this.acceptedClients().find(
        (client) => client.userId === this.clientId()
      ) ?? null
  );
  readonly selectedClientBookings = computed(() =>
    this.bookings().filter((booking) => booking.userId === this.clientId())
  );
  readonly selectedClientRoutines = computed(() =>
    this.routines().filter((routine) => routine.clientId === this.clientId())
  );
  readonly clientId = signal('');
  title = 'Four-week strength reset';
  summary = '3 lifting sessions, mobility finishers, and recovery check-ins.';

  constructor() {
    this.api
      .getAllRoutines()
      .subscribe((routines) => this.routines.set(routines));
    this.api
      .getOwnerBookings()
      .subscribe((bookings) => this.bookings.set(bookings));
    this.api.getAcceptedClients().subscribe((clients) => {
      this.acceptedClients.set(clients);
      this.clientId.set(
        clients.some((client) => client.userId === this.clientId())
          ? this.clientId()
          : this.activeClients()[0]?.id ?? ''
      );
    });
  }

  assignRoutine(): void {
    if (!this.clientId()) {
      return;
    }

    this.api
      .assignRoutine({
        clientId: this.clientId(),
        clientName: this.selectedClientLabel(),
        title: this.title,
        summary: this.summary,
        focusAreas: ['Strength', 'Mobility'],
      })
      .subscribe((routine) => {
        this.routines.update((routines) => [...routines, routine]);
      });
  }

  selectClient(clientId: string): void {
    this.clientId.set(clientId);
  }

  selectedClientLabel(): string {
    return (
      this.activeClients().find((client) => client.id === this.clientId())
        ?.label ?? this.clientId()
    );
  }

  scrollToSection(id: string): void {
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  selectedClientBookingsCount(clientId: string): number {
    return this.bookings().filter((booking) => booking.userId === clientId)
      .length;
  }

  selectedClientRoutinesCount(clientId: string): number {
    return this.routines().filter((routine) => routine.clientId === clientId)
      .length;
  }
}
