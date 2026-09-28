import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { DrawingManifestEntryDto } from '@optimistic-tanuki/models';
import { ProjectNexusApiService } from '../../services/project-nexus-api.service';
import { NexusFieldSyncService } from '../../services/nexus-field-sync.service';

@Component({
  selector: 'nexus-drawings-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <p class="eyebrow">Blueprints and permits</p>
      <h1 class="page-title">Drawing sets</h1>

      <div *ngIf="loadError" class="error-banner" role="alert">
        {{ loadError }}
      </div>
      <p *ngIf="servedFromCache" class="cache-note" role="status">
        Showing the cached manifest from the jobsite locker.
      </p>

      <div *ngIf="drawings.length > 0" class="table-responsive">
        <table class="manifest-table">
          <caption class="sr-only">
            Drawing sets with versions and subcontractor insurance status
          </caption>
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Version</th>
              <th scope="col">SHA-256</th>
              <th scope="col">Insurance</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let drawing of drawings">
              <td class="cell-title">{{ drawing.title }}</td>
              <td>{{ drawing.version }}</td>
              <td class="cell-hash" [title]="drawing.sha256">
                {{ drawing.sha256.substring(0, 12) }}...
              </td>
              <td>
                <span
                  class="coi-pill"
                  [class.coi-valid]="drawing.coiStatus === 'valid'"
                  [class.coi-alert]="drawing.coiStatus !== 'valid'"
                >
                  {{ coiLabel(drawing) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p
        *ngIf="!loading && drawings.length === 0 && !loadError"
        class="empty-note"
      >
        No drawing sets are published for this project yet.
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
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .table-responsive {
        overflow-x: auto;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
      }
      .manifest-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.9rem;
      }
      .manifest-table th,
      .manifest-table td {
        text-align: left;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
      }
      .manifest-table th {
        color: var(--foreground-muted);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .cell-title {
        font-weight: 600;
        color: var(--foreground);
      }
      .cell-hash {
        font-family: monospace;
        color: var(--foreground-muted);
      }
      .coi-pill {
        padding: 2px 10px;
        border-radius: 4px;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }
      .coi-valid {
        background: color-mix(in srgb, var(--success) 18%, transparent);
        color: var(--success);
      }
      .coi-alert {
        background: color-mix(in srgb, var(--danger) 18%, transparent);
        color: var(--danger);
      }
      .empty-note {
        color: var(--foreground-muted);
      }
    `,
  ],
})
export class DrawingsPageComponent implements OnInit {
  projectId = '';
  drawings: DrawingManifestEntryDto[] = [];
  loading = true;
  loadError = '';
  servedFromCache = false;

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

  coiLabel(drawing: DrawingManifestEntryDto): string {
    if (drawing.coiStatus === 'valid') {
      return 'Insured';
    }
    if (drawing.coiStatus === 'expired') {
      return 'Insurance expired';
    }
    if (drawing.coiStatus === 'missing') {
      return 'No certificate';
    }
    return 'Unverified';
  }

  private async load(): Promise<void> {
    if (isPlatformBrowser(this.platformId)) {
      const cached = await this.sync.cachedDrawings(this.projectId);
      if (cached) {
        this.drawings = cached.drawings ?? [];
        this.servedFromCache = true;
      }
    }
    this.api.getDrawings(this.projectId).subscribe({
      next: (manifest) => {
        this.loading = false;
        this.loadError = '';
        this.servedFromCache = false;
        this.drawings = manifest.drawings ?? [];
        if (isPlatformBrowser(this.platformId)) {
          void this.sync.cacheSnapshot(this.projectId, 'drawings', manifest);
        }
      },
      error: () => {
        this.loading = false;
        if (this.drawings.length === 0) {
          this.loadError =
            'The drawing manifest is unavailable. Nothing is displayed.';
        } else {
          this.servedFromCache = true;
        }
      },
    });
  }
}
