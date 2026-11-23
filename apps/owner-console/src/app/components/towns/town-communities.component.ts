import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TownContextService } from '../../services/town-context.service';
import {
  CommunityOpsEntity,
  EntityTypeFilter,
  SummaryMetric,
} from './community-ops.model';
import { CommunityOpsDataService } from './community-ops-data.service';
import { CommunityOpsJournalService } from './community-ops-journal.service';
import { OpsEntityDetailComponent } from './ops-entity-detail.component';
import { TOWN_OPS_STYLES } from './community-ops.styles';

/** Communities and their members: browse, pivot, and keep a journal. */
@Component({
  selector: 'app-town-communities',
  standalone: true,
  imports: [CommonModule, FormsModule, OpsEntityDetailComponent],
  template: `
    <section class="ops-page">
      <header class="hero">
        <p class="hero-kicker">{{ context.selected()?.name ?? 'Town' }}</p>
        <h1>Communities and members</h1>
        <p>
          Community governance and member records, with the edit and moderation
          tools behind them.
        </p>
      </header>

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
                <p>Pivot across communities and member governance signals.</p>
              </div>
            </div>

            <div class="filters">
              <input
                type="search"
                class="search-input"
                placeholder="Search communities and members"
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
                  *ngIf="pressureSummary(entity) as pressure"
                >
                  {{ pressure }}
                </small>
              </button>
              } @empty {
              <div class="empty-state">
                <p>No communities or members match the current filters.</p>
              </div>
              }
            </div>
          </aside>

          <app-ops-entity-detail
            *ngIf="selectedEntity"
            [entity]="selectedEntity"
            [related]="relatedEntities"
            (relatedSelected)="selectEntity($event)"
            (journalChanged)="applyFilters()"
          ></app-ops-entity-detail>
        </section>

        <ng-template #loadingState>
          <section class="metrics-grid">
            @for (slot of [1, 2, 3, 4]; track slot) {
            <article class="metric-card skeleton">
              <span class="metric-value">…</span>
              <h2>Loading…</h2>
              <p>Aggregating community data.</p>
            </article>
            }
          </section>
        </ng-template>
      </section>
    </section>
  `,
  styles: [TOWN_OPS_STYLES],
})
export class TownCommunitiesComponent implements OnInit {
  readonly context = inject(TownContextService);
  private readonly data = inject(CommunityOpsDataService);
  private readonly journal = inject(CommunityOpsJournalService);

  loading = true;
  searchQuery = '';
  entityTypeFilter: EntityTypeFilter = 'all';
  entities: CommunityOpsEntity[] = [];
  filteredEntities: CommunityOpsEntity[] = [];
  selectedEntity: CommunityOpsEntity | null = null;
  summaryMetrics: SummaryMetric[] = [];

  ngOnInit(): void {
    this.context.load();
    this.data.load().subscribe(({ entities, metrics }) => {
      this.entities = entities.filter((entity) => entity.entityType !== 'city');
      this.summaryMetrics = metrics;
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
        const leftPressure = this.journal.entityPressureScore(left);
        const rightPressure = this.journal.entityPressureScore(right);
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
  }

  pressureSummary(entity: CommunityOpsEntity): string {
    return this.journal.entityPressureSummary(entity);
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
}
