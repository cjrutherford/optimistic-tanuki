import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppRegistration,
  AppRegistry,
  AppType,
  AppVisibility,
  NavigationLink,
  NavigationLinkType,
  NavigationPosition,
} from '@optimistic-tanuki/app-registry';
import { forkJoin } from 'rxjs';
import {
  RegistryAuditEntry,
  RegistryManagementService,
} from '../services/registry-management.service';

@Component({
  selector: 'app-registry-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="registry-page">
      <header class="registry-hero">
        <div>
          <p class="eyebrow">Experience Control</p>
          <h1>Application Registry</h1>
        </div>
        <div class="hero-actions">
          <button type="button" class="secondary" (click)="load()">
            Refresh
          </button>
          <button
            type="button"
            class="primary"
            (click)="saveRegistry()"
            [disabled]="loading || validationErrors.length > 0"
          >
            Save Apps
          </button>
          <button
            type="button"
            class="primary"
            (click)="saveLinks()"
            [disabled]="loading"
          >
            Save Links
          </button>
        </div>
      </header>

      @if (loading) {
      <div class="status">Loading registry...</div>
      } @if (message) {
      <div class="status success">{{ message }}</div>
      } @if (error) {
      <div class="status error">{{ error }}</div>
      } @if (validationErrors.length > 0) {
      <div class="status error">
        @for (validationError of validationErrors; track validationError) {
        <p>{{ validationError }}</p>
        }
      </div>
      }

      <section class="registry-band">
        <div class="section-heading">
          <h2>Registered Applications</h2>
          <button type="button" class="secondary" (click)="addApp()">
            Add App
          </button>
        </div>

        <div class="app-grid">
          @for (app of registry.apps; track app.appId; let i = $index) {
          <article class="app-editor">
            <div class="editor-topline">
              <strong>{{ app.name || app.appId || 'New application' }}</strong>
              <button type="button" class="ghost-danger" (click)="removeApp(i)">
                Remove
              </button>
            </div>

            <label>
              App ID
              <input [(ngModel)]="app.appId" (ngModelChange)="validate()" />
            </label>
            <label>
              Name
              <input [(ngModel)]="app.name" (ngModelChange)="validate()" />
            </label>
            <label>
              Domain
              <input
                [(ngModel)]="app.domain"
                (ngModelChange)="syncUiHost(app)"
              />
            </label>
            <label>
              Subdomain
              <input
                [(ngModel)]="app.subdomain"
                (ngModelChange)="syncUiHost(app)"
              />
            </label>
            <label class="wide">
              UI Base URL
              <input [(ngModel)]="app.uiBaseUrl" (ngModelChange)="validate()" />
            </label>
            <label class="wide">
              API Base URL
              <input
                [(ngModel)]="app.apiBaseUrl"
                (ngModelChange)="validate()"
              />
            </label>
            <label>
              Type
              <select [(ngModel)]="app.appType">
                @for (type of appTypes; track type) {
                <option [ngValue]="type">{{ type }}</option>
                }
              </select>
            </label>
            <label>
              Visibility
              <select [(ngModel)]="app.visibility">
                @for (visibility of visibilityTypes; track visibility) {
                <option [ngValue]="visibility">{{ visibility }}</option>
                }
              </select>
            </label>
            <label>
              Sort Order
              <input type="number" [(ngModel)]="app.sortOrder" />
            </label>
            <label class="wide">
              Description
              <textarea [(ngModel)]="app.description"></textarea>
            </label>
          </article>
          }
        </div>
      </section>

      <section class="registry-band">
        <div class="section-heading">
          <h2>Navigation Links</h2>
          <button type="button" class="secondary" (click)="addLink()">
            Add Link
          </button>
        </div>

        <div class="link-table">
          <div class="link-row link-head">
            <span>Label</span>
            <span>Source</span>
            <span>Target</span>
            <span>Type</span>
            <span>Path</span>
            <span></span>
          </div>
          @for (link of links; track link.linkId; let i = $index) {
          <div class="link-row">
            <input [(ngModel)]="link.label" />
            <select [(ngModel)]="link.sourceAppId">
              @for (app of registry.apps; track app.appId) {
              <option [ngValue]="app.appId">{{ app.appId }}</option>
              }
            </select>
            <select [(ngModel)]="link.targetAppId">
              @for (app of registry.apps; track app.appId) {
              <option [ngValue]="app.appId">{{ app.appId }}</option>
              }
            </select>
            <select [(ngModel)]="link.type">
              @for (type of linkTypes; track type) {
              <option [ngValue]="type">{{ type }}</option>
              }
            </select>
            <input [(ngModel)]="link.path" />
            <button type="button" class="ghost-danger" (click)="removeLink(i)">
              Remove
            </button>
          </div>
          }
        </div>
      </section>

      <section class="registry-band audit-band">
        <div class="section-heading">
          <h2>Audit Log</h2>
          <button type="button" class="secondary" (click)="loadAuditLog()">
            Reload
          </button>
        </div>
        @if (auditLog.length === 0) {
        <p class="quiet">
          No registry changes recorded in this gateway process.
        </p>
        } @else {
        <ol class="audit-list">
          @for (entry of auditLog; track entry.id) {
          <li>
            <time>{{ entry.occurredAt }}</time>
            <strong>{{ entry.action }}</strong>
            <span>{{ entry.summary }}</span>
          </li>
          }
        </ol>
        }
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        padding: 24px;
      }

      .registry-page {
        display: grid;
        gap: 20px;
        color: var(--foreground-color, #172026);
      }

      .registry-hero,
      .registry-band {
        border: 1px solid var(--border-color, #d7dde2);
        border-radius: 8px;
        background: var(--surface-color, #fff);
      }

      .registry-hero {
        display: flex;
        justify-content: space-between;
        gap: 20px;
        align-items: center;
        padding: 24px;
      }

      .eyebrow {
        margin: 0 0 6px;
        color: var(--accent, #0f766e);
        font-size: 0.78rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1,
      h2 {
        margin: 0;
      }

      .hero-actions,
      .section-heading {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      .section-heading {
        justify-content: space-between;
        padding: 18px 20px;
        border-bottom: 1px solid var(--border-color, #d7dde2);
      }

      button {
        min-height: 38px;
        border: 1px solid transparent;
        border-radius: 6px;
        padding: 0 14px;
        font-weight: 700;
        cursor: pointer;
      }

      button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .primary {
        background: #0f766e;
        color: white;
      }

      .secondary {
        border-color: #8fb8b2;
        background: #f3fbf9;
        color: #0f4f49;
      }

      .ghost-danger {
        border-color: #f2b7b7;
        background: #fff7f7;
        color: #a51919;
      }

      .status {
        border-radius: 8px;
        padding: 12px 14px;
        background: #eef6ff;
      }

      .status p {
        margin: 0;
      }

      .status p + p {
        margin-top: 6px;
      }

      .success {
        background: #edfdf6;
        color: #075e43;
      }

      .error {
        background: #fff1f1;
        color: #9b1c1c;
      }

      .app-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 16px;
        padding: 20px;
      }

      .app-editor {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
        border: 1px solid var(--border-color, #d7dde2);
        border-radius: 8px;
        padding: 16px;
        background: #fbfcfc;
      }

      .editor-topline,
      .wide {
        grid-column: 1 / -1;
      }

      .editor-topline {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
      }

      label {
        display: grid;
        gap: 5px;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      input,
      select,
      textarea {
        width: 100%;
        border: 1px solid #cbd5dc;
        border-radius: 6px;
        background: white;
        color: inherit;
        font: inherit;
        padding: 9px 10px;
        box-sizing: border-box;
      }

      textarea {
        min-height: 78px;
        resize: vertical;
        text-transform: none;
      }

      .link-table {
        display: grid;
        gap: 8px;
        padding: 20px;
        overflow-x: auto;
      }

      .link-row {
        display: grid;
        grid-template-columns:
          minmax(160px, 1.2fr) minmax(140px, 1fr) minmax(140px, 1fr)
          minmax(110px, 0.7fr) minmax(140px, 1fr) auto;
        gap: 10px;
        min-width: 860px;
        align-items: center;
      }

      .link-head {
        color: #56616a;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
      }

      .audit-band {
        margin-bottom: 24px;
      }

      .quiet {
        margin: 0;
        padding: 20px;
        color: #64727d;
      }

      .audit-list {
        display: grid;
        gap: 10px;
        margin: 0;
        padding: 20px 20px 20px 42px;
      }

      .audit-list li {
        display: grid;
        grid-template-columns: minmax(190px, 0.4fr) minmax(130px, 0.3fr) 1fr;
        gap: 12px;
      }

      time {
        color: #64727d;
      }

      @media (max-width: 760px) {
        .registry-hero,
        .app-editor,
        .audit-list li {
          grid-template-columns: 1fr;
        }

        .registry-hero {
          align-items: stretch;
        }
      }
    `,
  ],
})
export class RegistryManagementComponent implements OnInit {
  readonly appTypes: AppType[] = ['client', 'admin', 'user'];
  readonly linkTypes: NavigationLinkType[] = [
    'nav',
    'action',
    'footer',
    'context',
  ];
  readonly positions: NavigationPosition[] = ['primary', 'secondary', 'footer'];
  readonly visibilityTypes: AppVisibility[] = ['public', 'internal'];

  auditLog: RegistryAuditEntry[] = [];
  error = '';
  links: NavigationLink[] = [];
  loading = false;
  message = '';
  registry: AppRegistry = {
    version: '1.0.0',
    generatedAt: new Date(0).toISOString(),
    apps: [],
  };
  validationErrors: string[] = [];

  constructor(private readonly registryService: RegistryManagementService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.message = '';
    this.error = '';

    forkJoin({
      registry: this.registryService.getRegistry(),
      links: this.registryService.getLinks(),
      audit: this.registryService.getAuditLog(),
    }).subscribe({
      next: ({ registry, links, audit }) => {
        this.registry = this.clone(registry.data);
        this.links = this.clone(links.data);
        this.auditLog = audit.data;
        this.loading = false;
        this.validate();
      },
      error: (error) => {
        this.error = `Failed to load registry: ${
          error.message || error.statusText || 'Unknown error'
        }`;
        this.loading = false;
      },
    });
  }

  loadAuditLog(): void {
    this.registryService.getAuditLog().subscribe({
      next: (response) => {
        this.auditLog = response.data;
      },
      error: (error) => {
        this.error = `Failed to load audit log: ${
          error.message || error.statusText || 'Unknown error'
        }`;
      },
    });
  }

  addApp(): void {
    const nextIndex = this.registry.apps.length + 1;
    this.registry.apps = [
      ...this.registry.apps,
      {
        appId: `new-app-${nextIndex}`,
        name: `New App ${nextIndex}`,
        domain: 'haidev.com',
        uiBaseUrl: `https://new-app-${nextIndex}.haidev.com`,
        apiBaseUrl: 'https://api.haidev.com',
        appType: 'client',
        visibility: 'internal',
        sortOrder: nextIndex,
      },
    ];
    this.validate();
  }

  removeApp(index: number): void {
    const appId = this.registry.apps[index]?.appId;
    this.registry.apps = this.registry.apps.filter(
      (_, current) => current !== index
    );
    this.links = this.links.filter(
      (link) => link.sourceAppId !== appId && link.targetAppId !== appId
    );
    this.validate();
  }

  addLink(): void {
    const sourceAppId = this.registry.apps[0]?.appId ?? '';
    const targetAppId = this.registry.apps[1]?.appId ?? sourceAppId;
    const nextIndex = this.links.length + 1;
    this.links = [
      ...this.links,
      {
        linkId: `registry-link-${nextIndex}`,
        sourceAppId,
        targetAppId,
        type: 'nav',
        label: `Link ${nextIndex}`,
        path: '/',
        position: 'primary',
      },
    ];
  }

  removeLink(index: number): void {
    this.links = this.links.filter((_, current) => current !== index);
  }

  syncUiHost(app: AppRegistration): void {
    const domain = app.domain?.trim();
    if (domain) {
      const host = app.subdomain?.trim()
        ? `${app.subdomain.trim()}.${domain}`
        : domain;
      app.uiBaseUrl = `https://${host}`;
    }
    this.validate();
  }

  saveRegistry(): void {
    this.validate();
    if (this.validationErrors.length > 0) {
      return;
    }

    this.loading = true;
    this.message = '';
    this.registry = {
      ...this.registry,
      generatedAt: new Date().toISOString(),
      apps: this.registry.apps.map((app) => ({
        ...app,
        updatedAt: new Date().toISOString(),
      })),
    };

    this.registryService.updateRegistry(this.registry).subscribe({
      next: (response) => {
        this.registry = this.clone(response.data);
        this.loading = false;
        this.message = 'Application registry saved.';
        this.loadAuditLog();
      },
      error: (error) => {
        this.error = `Failed to save registry: ${
          error.error?.message || error.message || 'Unknown error'
        }`;
        this.loading = false;
      },
    });
  }

  saveLinks(): void {
    this.loading = true;
    this.message = '';
    this.registryService.updateLinks(this.links).subscribe({
      next: (response) => {
        this.links = this.clone(response.data);
        this.loading = false;
        this.message = 'Navigation links saved.';
        this.loadAuditLog();
      },
      error: (error) => {
        this.error = `Failed to save links: ${
          error.error?.message || error.message || 'Unknown error'
        }`;
        this.loading = false;
      },
    });
  }

  validate(): void {
    const appIds = new Set<string>();
    const errors: string[] = [];

    for (const app of this.registry.apps) {
      if (
        !app.appId ||
        !app.name ||
        !app.domain ||
        !app.uiBaseUrl ||
        !app.apiBaseUrl
      ) {
        errors.push(`${app.appId || 'New app'} is missing required fields.`);
      }

      if (appIds.has(app.appId)) {
        errors.push(`Duplicate app id ${app.appId}.`);
      }
      appIds.add(app.appId);

      const domainError = this.getDomainError(app);
      if (domainError) {
        errors.push(domainError);
      }
    }

    this.validationErrors = errors;
  }

  private getDomainError(app: AppRegistration): string {
    const domainPattern =
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
    if (app.domain !== 'localhost' && !domainPattern.test(app.domain || '')) {
      return `${app.appId} has an invalid domain.`;
    }

    try {
      const uiUrl = new URL(app.uiBaseUrl);
      const expectedHost = app.subdomain
        ? `${app.subdomain}.${app.domain}`
        : app.domain;
      if (uiUrl.hostname !== expectedHost) {
        return `${app.appId} UI host must match ${expectedHost}.`;
      }
    } catch {
      return `${app.appId} UI base URL must be absolute.`;
    }

    try {
      new URL(app.apiBaseUrl);
    } catch {
      return `${app.appId} API base URL must be absolute.`;
    }

    return '';
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }
}
