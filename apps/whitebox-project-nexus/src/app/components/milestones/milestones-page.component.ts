import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ProjectMilestoneDto } from '@optimistic-tanuki/models';
import { ProjectNexusApiService } from '../../services/project-nexus-api.service';
import { NexusFieldSyncService } from '../../services/nexus-field-sync.service';

type GanttRow = {
  milestone: ProjectMilestoneDto;
  leftPercent: number;
  widthPercent: number;
};

@Component({
  selector: 'nexus-milestones-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <p class="eyebrow">Project schedule</p>
      <h1 class="page-title">Construction milestones</h1>

      <div *ngIf="loadError" class="error-banner" role="alert">
        {{ loadError }}
      </div>
      <p *ngIf="servedFromCache" class="cache-note" role="status">
        Showing the cached schedule from the jobsite locker. It refreshes when
        the trailer network is reachable.
      </p>

      <div *ngIf="rows.length > 0" class="gantt-card">
        <div
          *ngFor="let row of rows"
          class="gantt-row"
          [attr.data-delayed]="row.milestone.delayed"
        >
          <div class="gantt-label">
            <strong class="phase-name">{{ row.milestone.phase }}</strong>
            <span class="phase-meta">
              {{ row.milestone.status }} · {{ row.milestone.progressPercent }}%
            </span>
            <span
              *ngIf="row.milestone.delayed"
              class="delay-badge"
              role="alert"
            >
              Delayed {{ row.milestone.delayDays }}d
            </span>
            <span
              *ngIf="predecessorNames(row.milestone)"
              class="predecessor-note"
            >
              After: {{ predecessorNames(row.milestone) }}
            </span>
          </div>
          <div
            class="gantt-track"
            role="img"
            [attr.aria-label]="
              row.milestone.phase +
              ' from ' +
              row.milestone.plannedStart +
              ' to ' +
              row.milestone.plannedEnd
            "
          >
            <div
              class="gantt-bar"
              [class.delayed]="row.milestone.delayed"
              [class.completed]="row.milestone.status === 'completed'"
              [style.left.%]="row.leftPercent"
              [style.width.%]="row.widthPercent"
            >
              <div
                class="gantt-progress"
                [style.width.%]="row.milestone.progressPercent"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <p *ngIf="!loading && rows.length === 0 && !loadError" class="empty-note">
        No milestones are scheduled for this project yet.
      </p>
    </div>
  `,
  styles: [
    `
      .page-container {
        max-width: 1100px;
        margin: 40px auto;
        padding: 0 24px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.75rem;
        color: var(--accent);
        margin: 0 0 8px 0;
      }
      .page-title {
        font-size: 2rem;
        font-weight: 800;
        color: var(--foreground);
        margin: 0 0 24px 0;
      }
      .error-banner {
        background: color-mix(in srgb, var(--danger) 15%, transparent);
        border: 1px solid color-mix(in srgb, var(--danger) 35%, transparent);
        color: var(--danger);
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 16px;
      }
      .cache-note {
        background: color-mix(in srgb, var(--warning) 12%, transparent);
        border: 1px solid color-mix(in srgb, var(--warning) 35%, transparent);
        color: var(--warning);
        border-radius: 6px;
        padding: 10px 14px;
        font-size: 0.88rem;
        margin: 0 0 16px 0;
      }
      .gantt-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .gantt-row {
        display: grid;
        grid-template-columns: 260px 1fr;
        gap: 16px;
        align-items: center;
      }
      @media (max-width: 700px) {
        .gantt-row {
          grid-template-columns: 1fr;
        }
      }
      .phase-name {
        display: block;
        color: var(--foreground);
      }
      .phase-meta {
        display: block;
        font-size: 0.8rem;
        color: var(--foreground-muted);
        text-transform: capitalize;
      }
      .delay-badge {
        display: inline-block;
        margin-top: 4px;
        background: color-mix(in srgb, var(--danger) 18%, transparent);
        color: var(--danger);
        border-radius: 4px;
        padding: 2px 8px;
        font-size: 0.75rem;
        font-weight: 700;
      }
      .predecessor-note {
        display: block;
        font-size: 0.75rem;
        color: var(--foreground-muted);
      }
      .gantt-track {
        position: relative;
        height: 28px;
        background: var(--input-bg);
        border-radius: 6px;
      }
      .gantt-bar {
        position: absolute;
        top: 4px;
        bottom: 4px;
        background: var(--primary);
        border-radius: 4px;
        overflow: hidden;
        min-width: 8px;
      }
      .gantt-bar.delayed {
        background: var(--danger);
      }
      .gantt-bar.completed {
        background: var(--success);
      }
      .gantt-progress {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.35);
      }
      .empty-note {
        color: var(--foreground-muted);
      }
    `,
  ],
})
export class MilestonesPageComponent implements OnInit {
  projectId = '';
  rows: GanttRow[] = [];
  loading = true;
  loadError = '';
  servedFromCache = false;
  private byId = new Map<string, ProjectMilestoneDto>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: ProjectNexusApiService,
    private readonly sync: NexusFieldSyncService,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  ngOnInit(): void {
    this.projectId = this.route.snapshot.paramMap.get('id')?.trim() ?? '';
    if (!this.projectId) {
      this.loading = false;
      this.loadError = 'A project ID is required.';
      return;
    }
    void this.load();
  }

  predecessorNames(milestone: ProjectMilestoneDto): string {
    return (milestone.predecessorIds ?? [])
      .map((id) => this.byId.get(id)?.phase ?? 'Unknown phase')
      .join(', ');
  }

  private async load(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      const cached = await this.sync.cachedMilestones(this.projectId);
      if (cached) {
        this.applyMilestones(cached, true);
      }
    }
    this.api.getMilestones(this.projectId).subscribe({
      next: (milestones) => {
        this.loading = false;
        this.loadError = '';
        this.servedFromCache = false;
        this.applyMilestones(milestones, false);
        if (isPlatformBrowser(this.platformId)) {
          void this.sync.cacheSnapshot(
            this.projectId,
            'milestones',
            milestones
          );
        }
      },
      error: () => {
        this.loading = false;
        if (this.rows.length === 0) {
          this.loadError =
            'The schedule is unavailable. No milestone data is displayed.';
        } else {
          this.servedFromCache = true;
        }
      },
    });
  }

  private applyMilestones(
    milestones: ProjectMilestoneDto[],
    fromCache: boolean
  ): void {
    this.byId = new Map(milestones.map((item) => [item.id, item]));
    this.servedFromCache = fromCache;
    if (milestones.length === 0) {
      this.rows = [];
      return;
    }
    const starts = milestones.map((item) =>
      new Date(item.plannedStart).getTime()
    );
    const ends = milestones.map((item) => new Date(item.plannedEnd).getTime());
    const min = Math.min(...starts);
    const max = Math.max(...ends, min + 86400000);
    const span = max - min || 86400000;
    this.rows = milestones.map((milestone) => {
      const start = new Date(milestone.plannedStart).getTime();
      const end = Math.max(
        new Date(milestone.plannedEnd).getTime(),
        start + 3600000
      );
      return {
        milestone,
        leftPercent: Math.max(0, ((start - min) / span) * 100),
        widthPercent: Math.max(2, ((end - start) / span) * 100),
      };
    });
  }
}
