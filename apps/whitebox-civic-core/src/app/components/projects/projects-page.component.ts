import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TipProjectSpatialDto } from '@optimistic-tanuki/models';
import { CivicApiService } from '../../services/civic-api.service';

export function createProjectsFeatureCollection(
  projects: TipProjectSpatialDto[]
): {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    id: string;
    properties: { id: string; name: string };
    geometry: Record<string, unknown>;
  }>;
} {
  return {
    type: 'FeatureCollection',
    features: projects.flatMap((project) =>
      getRenderableGeometries(project.geometry).map((geometry, index) => ({
        type: 'Feature' as const,
        id: index === 0 ? project.id : `${project.id}:${index + 1}`,
        properties: { id: project.id, name: project.name },
        geometry,
      }))
    ),
  };
}

function getRenderableGeometries(
  value: unknown
): Array<Record<string, unknown>> {
  if (value === null || typeof value !== 'object') {
    return [];
  }

  const geometry = value as {
    type?: unknown;
    coordinates?: unknown;
    geometries?: unknown;
  };
  if (geometry.type === 'GeometryCollection') {
    return Array.isArray(geometry.geometries)
      ? geometry.geometries.flatMap(getRenderableGeometries)
      : [];
  }

  return typeof geometry.type === 'string' && 'coordinates' in geometry
    ? [value as Record<string, unknown>]
    : [];
}

@Component({
  selector: 'civic-projects-page',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-container">
      <p class="eyebrow">Infrastructure program</p>
      <h1 class="page-title">Transportation projects</h1>
      <p class="page-lead">
        Regional infrastructure projects with locations, funding allocations,
        and milestone status.
      </p>

      <div *ngIf="loadError" class="error-banner" role="alert">
        {{ loadError }}
      </div>

      <div
        #mapContainer
        class="map-container"
        role="region"
        aria-label="Map of transportation projects"
        aria-describedby="map-help"
        [hidden]="!mapReady"
      ></div>
      <p id="map-help" class="map-notice" role="status" aria-live="polite">
        {{
          mapNotice ||
            'Map data uses project GeoJSON. Use the project list below to select a location and view its details.'
        }}
      </p>
      <p
        class="selection-announcement"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {{ selectionAnnouncement }}
      </p>

      <div class="project-list">
        <article
          *ngFor="let project of projects"
          class="project-card"
          [attr.data-selected]="selectedId === project.id"
        >
          <button
            type="button"
            class="project-select"
            (click)="selectProject(project, $event.currentTarget)"
            aria-haspopup="dialog"
          >
            <strong class="project-name">{{ project.name }}</strong>
            <span class="project-status">{{ project.status }}</span>
          </button>
          <p class="project-desc">{{ project.description }}</p>
        </article>
      </div>

      <dialog
        #projectDialog
        class="project-dialog"
        aria-modal="true"
        aria-labelledby="project-dialog-title"
        (cancel)="cancelProjectDialog($event)"
        (close)="restoreProjectFocus()"
      >
        <div class="dialog-heading-row">
          <h2 id="project-dialog-title" class="detail-title">
            {{ selectedProject?.name }} details
          </h2>
          <button
            #dialogClose
            type="button"
            class="dialog-close"
            aria-label="Close project details"
            (click)="closeProjectDialog()"
          >
            Close
          </button>
        </div>
        <ng-container *ngIf="selectedProject as project">
          <p class="detail-description">{{ project.description }}</p>
          <dl class="funding-grid">
            <div>
              <dt>Allocated</dt>
              <dd>{{ formatCents(project.fundingAllocatedCents) }}</dd>
            </div>
            <div>
              <dt>Spent</dt>
              <dd>{{ formatCents(project.fundingSpentCents) }}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{{ project.status }}</dd>
            </div>
          </dl>
          <p *ngIf="project.milestone" class="detail-line">
            Current milestone: {{ project.milestone }}
          </p>
          <p class="detail-line">
            {{ formatCents(project.fundingSpentCents) }} spent of
            {{ formatCents(project.fundingAllocatedCents) }} allocated ({{
              spentPercent(project)
            }}%).
          </p>
        </ng-container>
      </dialog>

      <p
        *ngIf="!loading && projects.length === 0 && !loadError"
        class="empty-note"
      >
        No transportation projects are published yet.
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
        font-size: 0.78rem;
        font-weight: 700;
        color: var(--accent);
        margin: 0 0 8px 0;
      }
      .page-title {
        font-size: 2rem;
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
      .error-banner {
        background: #fef2f2;
        border: 2px solid var(--danger);
        color: var(--danger);
        border-radius: 6px;
        padding: 12px 16px;
        margin-bottom: 16px;
        font-weight: 600;
      }
      .map-container {
        height: 380px;
        min-height: 260px;
        border: 2px solid var(--border-strong);
        border-radius: 12px;
        margin-bottom: 8px;
        background: var(--background-secondary);
      }
      .map-notice {
        font-size: 0.85rem;
        color: var(--foreground-muted);
        margin: 0 0 20px 0;
      }
      .project-list {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .project-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 18px;
      }
      .project-select {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        width: 100%;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        text-align: left;
      }
      .project-select:focus-visible {
        outline: 3px solid var(--focus-ring-color, var(--primary));
        outline-offset: 4px;
      }
      .project-name {
        color: var(--foreground);
        font-size: 1.05rem;
      }
      .project-status {
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        color: var(--primary);
        white-space: nowrap;
      }
      .project-desc {
        color: var(--foreground-secondary);
        font-size: 0.92rem;
        margin: 8px 0;
      }
      .project-dialog {
        width: min(620px, calc(100vw - 32px));
        max-height: min(80dvh, 720px);
        overflow: auto;
        border: 1px solid var(--border-strong);
        border-radius: 14px;
        padding: 24px;
        color: var(--foreground);
        background: var(--surface);
        box-shadow: 0 18px 60px rgb(12 35 32 / 30%);
      }
      .project-dialog::backdrop {
        background: rgb(14 33 31 / 58%);
      }
      .dialog-heading-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
      }
      .dialog-close {
        min-width: 44px;
        min-height: 44px;
        border: 1px solid var(--border-strong);
        border-radius: 6px;
        background: var(--surface);
        color: var(--foreground);
        cursor: pointer;
      }
      .dialog-close:focus-visible {
        outline: 3px solid var(--primary);
      }
      .detail-description {
        color: var(--foreground-secondary);
        line-height: 1.6;
      }
      .funding-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 16px 28px;
        margin: 20px 0;
      }
      .funding-grid dt {
        font-size: 0.72rem;
        text-transform: uppercase;
        color: var(--foreground-muted);
      }
      .funding-grid dd {
        margin: 2px 0 0 0;
        font-weight: 700;
        color: var(--foreground);
      }
      .detail-title {
        font-size: 1.2rem;
        margin: 0;
        color: var(--foreground);
      }
      .detail-line {
        margin: 4px 0;
        font-size: 0.9rem;
        color: var(--foreground-secondary);
      }
      .empty-note {
        color: var(--foreground-muted);
      }
      @media (max-width: 600px) {
        .page-container {
          margin: 24px auto;
          padding: 0 16px;
        }
        .map-container {
          height: 280px;
        }
        .project-select {
          align-items: flex-start;
          flex-direction: column;
        }
        .project-dialog {
          padding: 18px;
        }
      }
    `,
  ],
})
export class ProjectsPageComponent implements OnInit, OnDestroy {
  projects: TipProjectSpatialDto[] = [];
  loading = true;
  loadError = '';
  selectedId: string | null = null;
  mapReady = false;
  mapNotice = '';
  selectionAnnouncement = '';
  private map: { remove: () => void } | null = null;
  private focusReturnTarget: HTMLElement | null = null;

  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLElement>;
  @ViewChild('projectDialog') projectDialog?: ElementRef<HTMLDialogElement>;
  @ViewChild('dialogClose') dialogClose?: ElementRef<HTMLButtonElement>;

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

  ngOnDestroy(): void {
    try {
      this.map?.remove();
    } catch {
      /* map teardown is best effort */
    }
    this.map = null;
  }

  formatCents(cents: number): string {
    return `$${(Number(cents) / 100).toLocaleString('en-US', {
      maximumFractionDigits: 0,
    })}`;
  }

  spentPercent(project: TipProjectSpatialDto): number {
    if (!project.fundingAllocatedCents) {
      return 0;
    }
    return Math.round(
      (project.fundingSpentCents / project.fundingAllocatedCents) * 100
    );
  }

  get selectedProject(): TipProjectSpatialDto | undefined {
    return this.projects.find((project) => project.id === this.selectedId);
  }

  selectProject(
    project: TipProjectSpatialDto,
    trigger?: EventTarget | null
  ): void {
    this.selectedId = project.id;
    this.selectionAnnouncement = `${project.name} details opened.`;
    const dialog = this.projectDialog?.nativeElement;
    if (dialog && !dialog.open) {
      this.focusReturnTarget =
        trigger instanceof HTMLElement
          ? trigger
          : (dialog.ownerDocument.activeElement as HTMLElement | null);
      dialog.showModal();
      this.dialogClose?.nativeElement.focus();
    }
  }

  closeProjectDialog(): void {
    const dialog = this.projectDialog?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }
  }

  cancelProjectDialog(event: Event): void {
    event.preventDefault();
    this.closeProjectDialog();
  }

  restoreProjectFocus(): void {
    this.focusReturnTarget?.focus({ preventScroll: true });
    this.focusReturnTarget = null;
  }

  private load(): void {
    this.api.getTipProjects().subscribe({
      next: (projects) => {
        this.loading = false;
        this.loadError = '';
        this.projects = projects ?? [];
        void this.initializeMap();
      },
      error: () => {
        this.loading = false;
        this.projects = [];
        this.loadError =
          'Transportation projects are unavailable. Nothing is displayed.';
      },
    });
  }

  private async initializeMap(): Promise<void> {
    if (
      !isPlatformBrowser(this.platformId) ||
      this.projects.length === 0 ||
      !this.mapContainer
    ) {
      return;
    }
    let maplibre: typeof import('maplibre-gl');
    try {
      maplibre = await import('maplibre-gl');
    } catch {
      this.mapNotice =
        'The interactive map could not load. Project details below remain available.';
      return;
    }
    try {
      const document = this.mapContainer.nativeElement.ownerDocument;
      const tileUrl =
        document.querySelector<HTMLMetaElement>(
          'meta[name="civic-basemap-tiles"]'
        )?.content || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
      const tileAttribution =
        document.querySelector<HTMLMetaElement>(
          'meta[name="civic-basemap-attribution"]'
        )?.content ||
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
      const points = this.projects.flatMap((project) =>
        this.extractPoints(project.geometry)
      );
      if (points.length === 0) {
        this.mapNotice =
          'No project locations are on file, so the map stays hidden.';
        return;
      }
      const map = new maplibre.Map({
        container: this.mapContainer.nativeElement,
        style: {
          version: 8,
          sources: {
            'openstreetmap-raster': {
              type: 'raster',
              tiles: [tileUrl],
              tileSize: 256,
              attribution: tileAttribution,
            },
          },
          layers: [
            {
              id: 'openstreetmap-raster',
              type: 'raster',
              source: 'openstreetmap-raster',
            },
          ],
        },
        center: [points[0][0], points[0][1]],
        zoom: 10,
        maxZoom: 18,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      map.on('load', () => {
        map.addSource('tip-projects', {
          type: 'geojson',
          data: createProjectsFeatureCollection(this.projects) as never,
        });
        map.addLayer({
          id: 'tip-area-fill',
          type: 'fill',
          source: 'tip-projects',
          filter: [
            'in',
            ['geometry-type'],
            ['literal', ['Polygon', 'MultiPolygon']],
          ],
          paint: { 'fill-color': '#147d72', 'fill-opacity': 0.24 },
        });
        map.addLayer({
          id: 'tip-linework',
          type: 'line',
          source: 'tip-projects',
          filter: [
            'in',
            ['geometry-type'],
            [
              'literal',
              ['LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'],
            ],
          ],
          paint: { 'line-color': '#075e58', 'line-width': 4 },
        });
        map.addLayer({
          id: 'tip-locations',
          type: 'circle',
          source: 'tip-projects',
          filter: [
            'in',
            ['geometry-type'],
            ['literal', ['Point', 'MultiPoint']],
          ],
          paint: {
            'circle-radius': 8,
            'circle-color': '#1d4ed8',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });
        const selectFeature = (event: {
          features?: Array<{ properties?: Record<string, unknown> }>;
        }) => {
          const id = event.features?.[0]?.properties?.['id'];
          if (typeof id === 'string') {
            const project = this.projects.find(
              (candidate) => candidate.id === id
            );
            if (project) {
              this.selectProject(project);
            }
          }
        };
        map.on('click', 'tip-locations', selectFeature);
        map.on('click', 'tip-linework', selectFeature);
        map.on('click', 'tip-area-fill', selectFeature);
        map.fitBounds(
          [
            [
              Math.min(...points.map((point) => point[0])),
              Math.min(...points.map((point) => point[1])),
            ],
            [
              Math.max(...points.map((point) => point[0])),
              Math.max(...points.map((point) => point[1])),
            ],
          ],
          { padding: 48, maxZoom: 13, duration: 0 }
        );
      });
      map.on('error', () => {
        this.mapNotice =
          'Some map resources are unavailable. Project details below remain available.';
      });
      this.map = map;
      this.mapReady = true;
    } catch {
      this.mapNotice =
        'The interactive map could not start. Project details below remain available.';
    }
  }

  private extractPoints(geometry: unknown): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    const visit = (node: unknown): void => {
      if (
        Array.isArray(node) &&
        node.length >= 2 &&
        typeof node[0] === 'number' &&
        typeof node[1] === 'number' &&
        Number.isFinite(node[0]) &&
        Number.isFinite(node[1])
      ) {
        points.push([node[0], node[1]]);
        return;
      }
      if (Array.isArray(node)) {
        for (const entry of node) {
          visit(entry);
        }
        return;
      }
      if (node !== null && typeof node === 'object') {
        for (const entry of Object.values(node)) {
          visit(entry);
        }
      }
    };
    visit(geometry);
    return points;
  }
}
