import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import {
  CommunityDto,
  CommunityMemberDto,
  CommunityMemberRole,
} from '@optimistic-tanuki/ui-models';
import {
  CommunityManagerRecord,
  CommunityService,
} from '../services/community.service';

type EntityTypeFilter = 'all' | 'community' | 'city' | 'member';
type EntityHealth = 'healthy' | 'attention';

interface SummaryMetric {
  label: string;
  value: string;
  detail: string;
}

interface CommunityOpsEntity {
  id: string;
  entityType: 'community' | 'city' | 'member';
  title: string;
  subtitle: string;
  detail: string;
  health: EntityHealth;
  timestamp: string | Date;
  route: string;
  communityId?: string;
  communityName?: string;
  memberRole?: CommunityMemberRole;
  managerProfileId?: string | null;
  memberCount?: number;
}

interface CommunityOpsNote {
  id: string;
  body: string;
  createdAt: string;
  author: string;
}

interface CommunityOpsEscalation {
  id: string;
  status: 'open' | 'resolved';
  summary: string;
  createdAt: string;
  actor: string;
}

interface CommunityOpsCase {
  id: string;
  title: string;
  summary: string;
  owner: string;
  status: 'open' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

interface CommunityOpsCaseDraft {
  title: string;
  summary: string;
  owner: string;
}

interface CommunitySnapshot {
  community: CommunityDto;
  members: CommunityMemberDto[];
  manager: CommunityManagerRecord | null;
}

interface CommunityOpsJournalEntry {
  notes: CommunityOpsNote[];
  escalations: CommunityOpsEscalation[];
  caseRecord: CommunityOpsCase | null;
}

interface ModerationHandoffContext {
  source: 'community-ops';
  entityType: 'community' | 'city' | 'member';
  entityId: string;
  communityId?: string;
  communityName?: string;
  entityTitle: string;
}

@Component({
  selector: 'app-community-ops-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <section class="community-ops-page">
      <header class="hero">
        <p class="hero-kicker">Community Ops</p>
        <h1>Locality and membership control plane</h1>
        <p>
          Unify city, community, and member governance in one workspace while
          preserving the existing edit and moderation tools behind it.
        </p>
      </header>

      <section class="metrics-grid" *ngIf="!loading; else loadingState">
        @for (metric of summaryMetrics; track metric.label) {
        <article class="metric-card">
          <span class="metric-value">{{ metric.value }}</span>
          <h2>{{ metric.label }}</h2>
          <p>{{ metric.detail }}</p>
        </article>
        }
      </section>

      <section class="workspace-shell" *ngIf="!loading">
        <aside class="entity-browser">
          <div class="panel-heading">
            <div>
              <h2>Entity browser</h2>
              <p>
                Pivot across locality records and member governance signals.
              </p>
            </div>
          </div>

          <div class="filters">
            <input
              type="search"
              class="search-input"
              placeholder="Search communities, cities, members"
              [(ngModel)]="searchQuery"
              (ngModelChange)="applyFilters()"
            />
            <select
              class="filter-select"
              [(ngModel)]="entityTypeFilter"
              (ngModelChange)="applyFilters()"
            >
              <option value="all">All entities</option>
              <option value="community">Communities</option>
              <option value="city">Cities</option>
              <option value="member">Members</option>
            </select>
          </div>

          <div class="entity-list">
            @for (entity of filteredEntities; track entity.id) {
            <button
              type="button"
              class="entity-card"
              [class.is-selected]="selectedEntity?.id === entity.id"
              (click)="selectEntity(entity)"
            >
              <div class="entity-card__header">
                <span class="entity-type">{{ entity.entityType }}</span>
                <span
                  class="entity-health"
                  [class.attention]="entity.health === 'attention'"
                >
                  {{
                    entity.health === 'attention'
                      ? 'Needs attention'
                      : 'Healthy'
                  }}
                </span>
              </div>
              <strong>{{ entity.title }}</strong>
              <p>{{ entity.subtitle }}</p>
              <small>{{ entity.detail }}</small>
              <small
                class="pressure-copy"
                *ngIf="entityPressureSummary(entity) as pressure"
              >
                {{ pressure }}
              </small>
            </button>
            } @empty {
            <div class="empty-state">
              <p>No community ops entities match the current filters.</p>
            </div>
            }
          </div>
        </aside>

        <section class="detail-panel" *ngIf="selectedEntity as entity">
          <div class="panel-heading">
            <div>
              <p class="detail-kicker">{{ entity.entityType }} workspace</p>
              <h2>{{ entity.title }}</h2>
              <p>{{ entity.subtitle }}</p>
            </div>
            <span
              class="detail-status"
              [class.attention]="entity.health === 'attention'"
            >
              {{ entity.health === 'attention' ? 'Attention' : 'Healthy' }}
            </span>
          </div>

          <div class="detail-grid">
            <article class="detail-card">
              <h3>Current state</h3>
              <p>{{ entity.detail }}</p>
            </article>
            <article class="detail-card">
              <h3>Linked governance route</h3>
              <p>{{ entity.route }}</p>
            </article>
          </div>

          <div class="action-group">
            <h3>Direct actions</h3>
            <div class="action-row">
              @for (action of buildActions(entity); track action.label) {
              <a class="action-link" [routerLink]="action.route">
                {{ action.label }}
              </a>
              }
            </div>
          </div>

          <div class="related-panel" *ngIf="relatedEntities.length">
            <h3>Related entities</h3>
            <p>
              Pivot directly into linked locality and membership records without
              leaving Community Ops.
            </p>
            <div class="related-entity-list">
              @for (related of relatedEntities; track related.id) {
              <button
                type="button"
                class="related-entity-card"
                (click)="selectEntity(related)"
              >
                <span class="entity-type">{{ related.entityType }}</span>
                <strong>{{ related.title }}</strong>
                <small>{{ related.subtitle }}</small>
              </button>
              }
            </div>
          </div>

          <div class="related-panel">
            <h3>Moderation Streams</h3>
            <p>
              Open the dedicated social and forum moderation tools when locality
              governance needs content-level intervention.
            </p>
            <div class="action-row">
              <a
                class="action-link secondary"
                routerLink="/dashboard/social-governance"
                [queryParams]="moderationContext()"
              >
                Social Governance
              </a>
              <a
                class="action-link secondary"
                routerLink="/dashboard/forum-governance"
                [queryParams]="moderationContext()"
              >
                Forum Governance
              </a>
            </div>
          </div>

          <div class="journal-grid">
            <section class="journal-panel">
              <div class="panel-heading journal-heading">
                <div>
                  <h3>Shared case</h3>
                  <p>
                    Assign ownership and resolution state for the current
                    entity.
                  </p>
                </div>
              </div>
              <div class="case-form" *ngIf="!activeCase; else existingCase">
                <input
                  class="journal-input"
                  type="text"
                  [(ngModel)]="caseDraft.title"
                  placeholder="Case title"
                />
                <textarea
                  class="journal-textarea"
                  rows="3"
                  [(ngModel)]="caseDraft.summary"
                  placeholder="Case summary"
                ></textarea>
                <input
                  class="journal-input"
                  type="text"
                  [(ngModel)]="caseDraft.owner"
                  placeholder="Case owner"
                />
                <div class="action-row">
                  <button
                    type="button"
                    class="action-link"
                    (click)="createCase()"
                  >
                    Create Case
                  </button>
                </div>
              </div>
              <ng-template #existingCase>
                <article class="journal-entry">
                  <div class="entity-card__header">
                    <strong>{{ activeCase?.title }}</strong>
                    <span
                      class="entity-health"
                      [class.attention]="activeCase?.status === 'open'"
                    >
                      {{ activeCase?.status }}
                    </span>
                  </div>
                  <span
                    >{{ activeCase?.owner }} ·
                    {{ activeCase?.updatedAt | date : 'medium' }}</span
                  >
                  <p>{{ activeCase?.summary }}</p>
                  <div class="action-row">
                    <button
                      type="button"
                      class="action-link secondary"
                      *ngIf="activeCase?.status === 'open'"
                      (click)="updateCaseStatus('resolved')"
                    >
                      Resolve Case
                    </button>
                    <button
                      type="button"
                      class="action-link"
                      *ngIf="activeCase?.status === 'resolved'"
                      (click)="updateCaseStatus('open')"
                    >
                      Reopen Case
                    </button>
                  </div>
                </article>
              </ng-template>
            </section>

            <section class="journal-panel">
              <div class="panel-heading journal-heading">
                <div>
                  <h3>Operator notes</h3>
                  <p>
                    Capture localized governance context without leaving the
                    workspace.
                  </p>
                </div>
              </div>
              <textarea
                class="journal-textarea"
                rows="4"
                [(ngModel)]="noteDraft"
                placeholder="Add operator context, follow-up guidance, or locality notes"
              ></textarea>
              <div class="action-row">
                <button type="button" class="action-link" (click)="saveNote()">
                  Save Note
                </button>
              </div>
              <div
                class="journal-list"
                *ngIf="activeNotes.length; else emptyNotes"
              >
                <article class="journal-entry" *ngFor="let note of activeNotes">
                  <strong>{{ note.author }}</strong>
                  <span>{{ note.createdAt | date : 'medium' }}</span>
                  <p>{{ note.body }}</p>
                </article>
              </div>
              <ng-template #emptyNotes>
                <p class="journal-empty">
                  No operator notes recorded for this entity yet.
                </p>
              </ng-template>
            </section>

            <section class="journal-panel">
              <div class="panel-heading journal-heading">
                <div>
                  <h3>Escalation history</h3>
                  <p>
                    Track when locality or membership issues were opened and
                    resolved.
                  </p>
                </div>
              </div>
              <textarea
                class="journal-textarea"
                rows="4"
                [(ngModel)]="escalationDraft"
                placeholder="Describe the escalation trigger or resolution"
              ></textarea>
              <div class="action-row">
                <button
                  type="button"
                  class="action-link"
                  (click)="addEscalation('open')"
                >
                  Log Open Escalation
                </button>
                <button
                  type="button"
                  class="action-link secondary"
                  (click)="addEscalation('resolved')"
                >
                  Log Resolution
                </button>
              </div>
              <div
                class="journal-list"
                *ngIf="activeEscalations.length; else emptyEscalations"
              >
                <article
                  class="journal-entry"
                  *ngFor="let entry of activeEscalations"
                >
                  <div class="entity-card__header">
                    <strong>{{ entry.summary }}</strong>
                    <span
                      class="entity-health"
                      [class.attention]="entry.status === 'open'"
                    >
                      {{ entry.status }}
                    </span>
                  </div>
                  <span
                    >{{ entry.actor }} ·
                    {{ entry.createdAt | date : 'medium' }}</span
                  >
                </article>
              </div>
              <ng-template #emptyEscalations>
                <p class="journal-empty">
                  No escalation history recorded for this entity yet.
                </p>
              </ng-template>
            </section>
          </div>
        </section>
      </section>

      <ng-template #loadingState>
        <section class="metrics-grid">
          @for (slot of [1, 2, 3, 4]; track slot) {
          <article class="metric-card skeleton">
            <span class="metric-value">…</span>
            <h2>Loading…</h2>
            <p>Aggregating community ops data.</p>
          </article>
          }
        </section>
      </ng-template>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .community-ops-page {
        display: grid;
        gap: 24px;
      }

      .hero,
      .entity-browser,
      .detail-panel {
        border-radius: 24px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: radial-gradient(
            circle at top right,
            color-mix(in srgb, var(--accent, #2563eb) 10%, transparent),
            transparent 32%
          ),
          linear-gradient(
            180deg,
            color-mix(
              in srgb,
              var(--surface, #ffffff) 96%,
              var(--background, #f3f4f6)
            ),
            color-mix(
              in srgb,
              var(--surface, #ffffff) 91%,
              var(--background, #f3f4f6)
            )
          );
        color: var(--foreground, #111827);
      }

      .hero,
      .entity-browser,
      .detail-panel {
        padding: 24px;
      }

      .hero-kicker,
      .detail-kicker,
      .entity-type {
        margin: 0 0 8px;
        color: color-mix(
          in srgb,
          var(--accent, #2563eb) 82%,
          var(--foreground, #111827)
        );
        font-size: 0.8rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1,
      h2,
      h3,
      p {
        margin: 0;
      }

      .hero p {
        margin-top: 12px;
        max-width: 72ch;
        line-height: 1.6;
      }

      .metrics-grid,
      .detail-grid {
        display: grid;
        gap: 16px;
      }

      .metrics-grid {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .metric-card,
      .detail-card,
      .related-panel,
      .entity-card {
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 94%,
          transparent
        );
      }

      .metric-card,
      .detail-card,
      .related-panel {
        padding: 18px;
        display: grid;
        gap: 10px;
      }

      .metric-value {
        font-size: 2rem;
        font-weight: 700;
        color: var(--accent, #2563eb);
      }

      .workspace-shell {
        display: grid;
        grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
        gap: 24px;
        align-items: start;
      }

      .panel-heading {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 16px;
        margin-bottom: 18px;
      }

      .panel-heading p {
        margin-top: 8px;
        line-height: 1.5;
      }

      .filters {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 180px;
        gap: 12px;
        margin-bottom: 18px;
      }

      .search-input,
      .filter-select {
        width: 100%;
        min-height: 44px;
        padding: 0 14px;
        border-radius: 12px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .search-input:focus,
      .filter-select:focus {
        outline: none;
        border-color: var(--accent, #2563eb);
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--accent, #2563eb) 18%, transparent);
      }

      .entity-list {
        display: grid;
        gap: 12px;
      }

      .entity-card {
        display: grid;
        gap: 8px;
        padding: 16px;
        text-align: left;
        cursor: pointer;
        color: inherit;
        transition: transform 160ms ease, border-color 160ms ease,
          box-shadow 160ms ease;
      }

      .entity-card:hover,
      .entity-card.is-selected {
        transform: translateY(-1px);
        border-color: color-mix(
          in srgb,
          var(--accent, #2563eb) 42%,
          transparent
        );
        box-shadow: 0 12px 24px
          color-mix(in srgb, var(--foreground, #111827) 10%, transparent);
      }

      .entity-card__header,
      .action-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        flex-wrap: wrap;
      }

      .entity-card p,
      .entity-card small,
      .detail-card p,
      .related-panel p {
        line-height: 1.5;
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
      }

      .pressure-copy {
        font-weight: 600;
        color: color-mix(
          in srgb,
          var(--warning, #b45309) 82%,
          var(--foreground, #111827)
        );
      }

      .entity-health,
      .detail-status {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 6px 10px;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--success, #15803d) 15%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--success, #15803d) 82%,
          var(--foreground, #111827)
        );
        font-size: 0.76rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .entity-health.attention,
      .detail-status.attention {
        background: color-mix(
          in srgb,
          var(--warning, #b45309) 16%,
          var(--surface, #ffffff)
        );
        color: color-mix(
          in srgb,
          var(--warning, #b45309) 82%,
          var(--foreground, #111827)
        );
      }

      .detail-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        margin: 18px 0;
      }

      .journal-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
        margin-top: 18px;
      }

      .related-entity-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 10px;
        margin-top: 12px;
      }

      .related-entity-card {
        display: grid;
        gap: 6px;
        padding: 14px;
        text-align: left;
        border-radius: 14px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 92%,
          var(--background, #f3f4f6)
        );
        color: inherit;
        cursor: pointer;
      }

      .related-entity-card small {
        color: color-mix(in srgb, var(--foreground, #111827) 70%, transparent);
      }

      .journal-panel {
        display: grid;
        gap: 12px;
        padding: 18px;
        border-radius: 18px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 94%,
          transparent
        );
      }

      .journal-heading {
        margin-bottom: 0;
      }

      .journal-textarea {
        width: 100%;
        padding: 12px 14px;
        border-radius: 14px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
        resize: vertical;
      }

      .journal-textarea:focus {
        outline: none;
        border-color: var(--accent, #2563eb);
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--accent, #2563eb) 18%, transparent);
      }

      .journal-input {
        width: 100%;
        min-height: 44px;
        padding: 0 14px;
        border-radius: 14px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
      }

      .journal-input:focus {
        outline: none;
        border-color: var(--accent, #2563eb);
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--accent, #2563eb) 18%, transparent);
      }

      .case-form {
        display: grid;
        gap: 12px;
      }

      .journal-list {
        display: grid;
        gap: 10px;
      }

      .journal-entry {
        display: grid;
        gap: 6px;
        padding: 14px;
        border-radius: 14px;
        border: 1px solid var(--border-color, #d6d6d6);
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 90%,
          var(--background, #f3f4f6)
        );
      }

      .journal-entry span,
      .journal-empty {
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
        line-height: 1.5;
      }

      .action-group,
      .related-panel {
        margin-top: 18px;
      }

      .action-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 16px;
        border-radius: 999px;
        text-decoration: none;
        font-weight: 700;
        border: 1px solid transparent;
        background: var(--accent, #2563eb);
        color: var(--on-primary, var(--primary-foreground, #ffffff));
      }

      .action-link.secondary {
        background: color-mix(
          in srgb,
          var(--surface, #ffffff) 88%,
          var(--background, #f3f4f6)
        );
        border-color: color-mix(
          in srgb,
          var(--accent, #2563eb) 22%,
          var(--border-color, #d6d6d6)
        );
        color: var(--foreground, #111827);
      }

      .empty-state {
        padding: 20px;
        border-radius: 18px;
        border: 1px dashed var(--border-color, #d6d6d6);
        color: color-mix(in srgb, var(--foreground, #111827) 72%, transparent);
      }

      .skeleton {
        opacity: 0.7;
      }

      @media (max-width: 1024px) {
        .workspace-shell {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 720px) {
        :host {
          padding: 16px;
        }

        .hero,
        .entity-browser,
        .detail-panel {
          padding: 18px;
          border-radius: 20px;
        }

        .filters {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CommunityOpsWorkspaceComponent implements OnInit {
  private static readonly STORAGE_KEY = 'owner-console.community-ops.journal';
  private readonly communityService = inject(CommunityService);

  loading = true;
  searchQuery = '';
  entityTypeFilter: EntityTypeFilter = 'all';
  entities: CommunityOpsEntity[] = [];
  filteredEntities: CommunityOpsEntity[] = [];
  selectedEntity: CommunityOpsEntity | null = null;
  summaryMetrics: SummaryMetric[] = [];
  noteDraft = '';
  escalationDraft = '';
  caseDraft: CommunityOpsCaseDraft = {
    title: '',
    summary: '',
    owner: '',
  };
  activeNotes: CommunityOpsNote[] = [];
  activeEscalations: CommunityOpsEscalation[] = [];
  activeCase: CommunityOpsCase | null = null;

  ngOnInit(): void {
    this.loadWorkspace();
  }

  loadWorkspace(): void {
    this.loading = true;

    forkJoin({
      communities: this.communityService
        .getCommunities()
        .pipe(catchError(() => of([] as CommunityDto[]))),
      cities: this.communityService
        .getCities()
        .pipe(catchError(() => of([] as CommunityDto[]))),
    })
      .pipe(
        switchMap(({ communities, cities }) => {
          if (communities.length === 0) {
            return of({
              communities,
              cities,
              snapshots: [] as CommunitySnapshot[],
            });
          }

          return forkJoin(
            communities.map((community) =>
              forkJoin({
                members: this.communityService
                  .getCommunityMembers(community.id)
                  .pipe(catchError(() => of([] as CommunityMemberDto[]))),
                manager: this.communityService
                  .getCommunityManager(community.id)
                  .pipe(catchError(() => of(null))),
              }).pipe(
                map(({ members, manager }) => ({
                  community,
                  members,
                  manager,
                }))
              )
            )
          ).pipe(map((snapshots) => ({ communities, cities, snapshots })));
        })
      )
      .subscribe(({ communities, cities, snapshots }) => {
        this.entities = this.buildEntities(communities, cities, snapshots);
        this.summaryMetrics = this.buildMetrics(communities, cities, snapshots);
        this.applyFilters();
        this.loading = false;
      });
  }

  applyFilters(): void {
    const query = this.searchQuery.trim().toLowerCase();
    this.filteredEntities = this.entities
      .filter((entity) => {
        if (
          this.entityTypeFilter !== 'all' &&
          entity.entityType !== this.entityTypeFilter
        ) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [entity.title, entity.subtitle, entity.detail]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(query));
      })
      .sort((left, right) => {
        const leftPressure = this.entityPressureScore(left);
        const rightPressure = this.entityPressureScore(right);
        if (leftPressure !== rightPressure) {
          return rightPressure - leftPressure;
        }

        if (left.health !== right.health) {
          return left.health === 'attention' ? -1 : 1;
        }

        const leftTime = new Date(left.timestamp).getTime();
        const rightTime = new Date(right.timestamp).getTime();
        if (leftTime !== rightTime) {
          return rightTime - leftTime;
        }

        return left.title.localeCompare(right.title);
      });

    if (
      !this.selectedEntity ||
      !this.filteredEntities.some(
        (entity) => entity.id === this.selectedEntity?.id
      )
    ) {
      this.selectedEntity =
        this.filteredEntities.find(
          (entity) => entity.entityType !== 'member'
        ) ??
        this.filteredEntities[0] ??
        null;
    }
  }

  selectEntity(entity: CommunityOpsEntity): void {
    this.selectedEntity = entity;
    this.loadJournalForSelectedEntity();
  }

  get relatedEntities(): CommunityOpsEntity[] {
    if (!this.selectedEntity) {
      return [];
    }

    if (this.selectedEntity.entityType === 'community') {
      return this.entities
        .filter(
          (entity) =>
            entity.entityType === 'member' &&
            entity.communityId === this.selectedEntity?.id
        )
        .sort(
          (left, right) =>
            new Date(right.timestamp).getTime() -
            new Date(left.timestamp).getTime()
        );
    }

    if (this.selectedEntity.entityType === 'member') {
      return this.entities.filter(
        (entity) =>
          entity.entityType === 'community' &&
          entity.id === this.selectedEntity?.communityId
      );
    }

    return [];
  }

  buildActions(
    entity: CommunityOpsEntity
  ): Array<{ label: string; route: string[] }> {
    if (entity.entityType === 'community') {
      return [
        {
          label: 'Edit Community',
          route: ['/dashboard/communities', entity.id],
        },
        {
          label: 'Manage Members',
          route: ['/dashboard/communities', entity.id, 'members'],
        },
      ];
    }

    if (entity.entityType === 'city') {
      return [
        { label: 'Edit City', route: ['/dashboard/cities', entity.id] },
        { label: 'Create Community', route: ['/dashboard/communities/new'] },
      ];
    }

    return [
      {
        label: 'Manage Community Members',
        route: ['/dashboard/communities', entity.communityId ?? '', 'members'],
      },
      {
        label: 'Open Community',
        route: ['/dashboard/communities', entity.communityId ?? ''],
      },
    ];
  }

  private buildEntities(
    communities: CommunityDto[],
    cities: CommunityDto[],
    snapshots: CommunitySnapshot[]
  ): CommunityOpsEntity[] {
    const communityEntities: CommunityOpsEntity[] = snapshots.map(
      ({ community, members, manager }) => ({
        id: community.id,
        entityType: 'community' as const,
        title: community.name,
        subtitle: community.description || 'No description provided.',
        detail: manager
          ? `${members.length} member records with ${manager.profileId} assigned as manager.`
          : `${members.length} member records and no assigned community manager.`,
        health: manager ? ('healthy' as const) : ('attention' as const),
        timestamp: community.createdAt,
        route: `/dashboard/communities/${community.id}`,
        memberCount: members.length,
        managerProfileId: manager?.profileId ?? null,
      })
    );

    const cityEntities: CommunityOpsEntity[] = cities.map((city) => ({
      id: city.id,
      entityType: 'city' as const,
      title: city.name,
      subtitle:
        [city.city, city.adminArea].filter(Boolean).join(', ') ||
        'Locality record',
      detail:
        city.population != null
          ? `Population ${city.population.toLocaleString()} with locality type ${
              city.localityType ?? 'city'
            }.`
          : `Locality type ${
              city.localityType ?? 'city'
            } with rollout metadata still forming.`,
      health: city.population ? ('healthy' as const) : ('attention' as const),
      timestamp: city.createdAt,
      route: `/dashboard/cities/${city.id}`,
    }));

    const memberEntities: CommunityOpsEntity[] = snapshots.flatMap(
      ({ community, members, manager }) =>
        members.map((member) => ({
          id: `${community.id}:${member.id}`,
          entityType: 'member' as const,
          title: member.profileId,
          subtitle: `${community.name} member`,
          detail: `${this.formatRole(member.role)} status ${member.status}${
            manager?.profileId === member.profileId
              ? ' and is the assigned manager'
              : ''
          }.`,
          health:
            member.status === 'approved'
              ? ('healthy' as const)
              : ('attention' as const),
          timestamp: member.joinedAt,
          route: `/dashboard/communities/${community.id}/members`,
          communityId: community.id,
          communityName: community.name,
          memberRole: member.role,
          managerProfileId: manager?.profileId ?? null,
        }))
    );

    return [...communityEntities, ...cityEntities, ...memberEntities];
  }

  private buildMetrics(
    communities: CommunityDto[],
    cities: CommunityDto[],
    snapshots: CommunitySnapshot[]
  ): SummaryMetric[] {
    const memberCount = snapshots.reduce(
      (sum, snapshot) => sum + snapshot.members.length,
      0
    );
    const communitiesWithoutManager = snapshots.filter(
      (snapshot) => !snapshot.manager
    ).length;
    const pendingMembers = snapshots.reduce(
      (sum, snapshot) =>
        sum +
        snapshot.members.filter((member) => member.status !== 'approved')
          .length,
      0
    );

    return [
      {
        label: 'Communities',
        value: String(communities.length),
        detail: `${communitiesWithoutManager} currently need manager coverage.`,
      },
      {
        label: 'Cities',
        value: String(cities.length),
        detail: 'Locality records currently surfaced through Community Ops.',
      },
      {
        label: 'Member records',
        value: String(memberCount),
        detail: `${pendingMembers} records still need membership intervention.`,
      },
      {
        label: 'Attention entities',
        value: String(
          this.buildEntities(communities, cities, snapshots).filter(
            (entity) => entity.health === 'attention'
          ).length
        ),
        detail: 'Communities, cities, or members that need operator review.',
      },
    ];
  }

  private formatRole(role: CommunityMemberRole): string {
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  }

  entityPressureSummary(entity: CommunityOpsEntity): string {
    const journal = this.readJournal()[entity.id];
    if (!journal) {
      return '';
    }

    const openEscalations = journal.escalations.filter(
      (entry) => entry.status === 'open'
    ).length;
    const notes = journal.notes.length;
    const parts: string[] = [];

    if (openEscalations > 0) {
      parts.push(
        `${openEscalations} open escalation${openEscalations === 1 ? '' : 's'}`
      );
    }

    if (notes > 0) {
      parts.push(`${notes} note${notes === 1 ? '' : 's'}`);
    }

    if (journal.caseRecord?.status === 'open') {
      parts.push('1 open case');
    }

    return parts.join(' · ');
  }

  moderationContext(): ModerationHandoffContext | null {
    if (!this.selectedEntity) {
      return null;
    }

    return {
      source: 'community-ops',
      entityType: this.selectedEntity.entityType,
      entityId: this.selectedEntity.id,
      communityId: this.selectedEntity.communityId ?? this.selectedEntity.id,
      communityName:
        this.selectedEntity.communityName ?? this.selectedEntity.title,
      entityTitle: this.selectedEntity.title,
    };
  }

  saveNote(): void {
    if (!this.selectedEntity || !this.noteDraft.trim()) {
      return;
    }

    const entry: CommunityOpsNote = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      body: this.noteDraft.trim(),
      createdAt: new Date().toISOString(),
      author: 'Operator',
    };

    const journal = this.readJournal();
    const entityJournal = journal[this.selectedEntity.id] ?? {
      notes: [],
      escalations: [],
    };
    entityJournal.notes = [entry, ...entityJournal.notes];
    journal[this.selectedEntity.id] = entityJournal;
    this.writeJournal(journal);
    this.noteDraft = '';
    this.loadJournalForSelectedEntity();
  }

  addEscalation(status: 'open' | 'resolved'): void {
    if (!this.selectedEntity || !this.escalationDraft.trim()) {
      return;
    }

    const entry: CommunityOpsEscalation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status,
      summary: this.escalationDraft.trim(),
      createdAt: new Date().toISOString(),
      actor: 'Operator',
    };

    const journal = this.readJournal();
    const entityJournal = journal[this.selectedEntity.id] ?? {
      notes: [],
      escalations: [],
    };
    entityJournal.escalations = [entry, ...entityJournal.escalations];
    journal[this.selectedEntity.id] = entityJournal;
    this.writeJournal(journal);
    this.escalationDraft = '';
    this.loadJournalForSelectedEntity();
  }

  createCase(): void {
    if (
      !this.selectedEntity ||
      !this.caseDraft.title.trim() ||
      !this.caseDraft.summary.trim() ||
      !this.caseDraft.owner.trim()
    ) {
      return;
    }

    const timestamp = new Date().toISOString();
    const nextCase: CommunityOpsCase = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: this.caseDraft.title.trim(),
      summary: this.caseDraft.summary.trim(),
      owner: this.caseDraft.owner.trim(),
      status: 'open',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const journal = this.readJournal();
    const entityJournal =
      journal[this.selectedEntity.id] ?? this.createEmptyJournal();
    entityJournal.caseRecord = nextCase;
    journal[this.selectedEntity.id] = entityJournal;
    this.writeJournal(journal);
    this.caseDraft = { title: '', summary: '', owner: '' };
    this.loadJournalForSelectedEntity();
  }

  updateCaseStatus(status: 'open' | 'resolved'): void {
    if (!this.selectedEntity || !this.activeCase) {
      return;
    }

    const journal = this.readJournal();
    const entityJournal =
      journal[this.selectedEntity.id] ?? this.createEmptyJournal();
    entityJournal.caseRecord = {
      ...this.activeCase,
      status,
      updatedAt: new Date().toISOString(),
    };
    journal[this.selectedEntity.id] = entityJournal;
    this.writeJournal(journal);
    this.loadJournalForSelectedEntity();
  }

  private loadJournalForSelectedEntity(): void {
    if (!this.selectedEntity) {
      this.activeNotes = [];
      this.activeEscalations = [];
      this.activeCase = null;
      return;
    }

    const entityJournal =
      this.readJournal()[this.selectedEntity.id] ?? this.createEmptyJournal();
    this.activeNotes = [...entityJournal.notes].sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
    this.activeEscalations = [...entityJournal.escalations].sort(
      (left, right) => right.createdAt.localeCompare(left.createdAt)
    );
    this.activeCase = entityJournal.caseRecord ?? null;
  }

  private readJournal(): Record<string, CommunityOpsJournalEntry> {
    if (typeof localStorage === 'undefined') {
      return {};
    }

    try {
      const raw = localStorage.getItem(
        CommunityOpsWorkspaceComponent.STORAGE_KEY
      );
      if (!raw) {
        return {};
      }
      return JSON.parse(raw) as Record<string, CommunityOpsJournalEntry>;
    } catch {
      return {};
    }
  }

  private writeJournal(
    journal: Record<string, CommunityOpsJournalEntry>
  ): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(
      CommunityOpsWorkspaceComponent.STORAGE_KEY,
      JSON.stringify(journal)
    );
  }

  private entityPressureScore(entity: CommunityOpsEntity): number {
    const journal = this.readJournal()[entity.id];
    if (!journal) {
      return 0;
    }

    const openEscalations = journal.escalations.filter(
      (entry) => entry.status === 'open'
    ).length;
    const casePressure = journal.caseRecord?.status === 'open' ? 20 : 0;
    return casePressure + openEscalations * 10 + journal.notes.length;
  }

  private createEmptyJournal(): CommunityOpsJournalEntry {
    return {
      notes: [],
      escalations: [],
      caseRecord: null,
    };
  }
}
