import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AppRegistration,
  AppRegistry,
  AppType,
  AppVisibility,
  NavigationLink,
  NavigationLinkType,
  NavigationPosition,
  PublishRegistryDto,
  RegistryReleaseRevision,
  RegistryReleaseState,
} from '@optimistic-tanuki/app-registry-backend';
import type { ColDef } from '@optimistic-tanuki/ag-grid-ui';
import {
  OwnerConfirmService,
  OwnerDataTableComponent,
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import { forkJoin } from 'rxjs';
import {
  RegistryAuditEntry,
  RegistryManagementService,
} from '../services/registry-management.service';

@Component({
  selector: 'app-registry-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OwnerDataTableComponent,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './registry-management.component.html',
  styleUrl: './registry-management.component.scss',
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

  readonly auditColumns: ColDef[] = [
    { field: 'occurredAt', headerName: 'When', flex: 2 },
    { field: 'action', headerName: 'Action', flex: 1 },
    { field: 'summary', headerName: 'What changed', flex: 3 },
  ];

  private readonly confirmService = inject(OwnerConfirmService);

  auditLog: RegistryAuditEntry[] = [];
  auditError: string | null = null;
  /** The registry itself could not be loaded; the editor is not shown. */
  loadFailed = false;
  error = '';
  links: NavigationLink[] = [];
  loading = false;
  message = '';
  release: RegistryReleaseState | null = null;
  releaseNotes = '';
  changeSummary = '';
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
    this.loadFailed = false;
    this.message = '';
    this.error = '';

    forkJoin({
      registry: this.registryService.getRegistry(),
      links: this.registryService.getLinks(),
      audit: this.registryService.getAuditLog(),
    }).subscribe({
      next: ({ registry, links, audit }) => {
        this.registry = this.clone(registry.data);
        this.release = registry.release ?? null;
        this.links = this.clone(links.data);
        this.auditLog = audit.data;
        this.loading = false;
        this.releaseNotes = this.release?.releaseNotes ?? '';
        this.changeSummary = this.release?.changeSummary ?? '';
        this.validate();
      },
      error: (error) => {
        this.error = `Failed to load registry: ${
          error.message || error.statusText || 'Unknown error'
        }`;
        this.loadFailed = true;
        this.loading = false;
      },
    });
  }

  loadAuditLog(): void {
    this.auditError = null;
    this.registryService.getAuditLog().subscribe({
      next: (response) => {
        this.auditLog = response.data;
      },
      error: (error) => {
        this.auditError = `Failed to load the change history: ${
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
        iconUrl: 'https://new-app.example.com/favicon.ico',
        appType: 'client',
        visibility: 'internal',
        sortOrder: nextIndex,
      },
    ];
    this.validate();
  }

  async removeApp(index: number): Promise<void> {
    const target = this.registry.apps[index];
    if (!target) return;
    const { confirmed } = await this.confirmService.confirm({
      level: 'typed',
      title: `Remove ${target.name || target.appId}`,
      body: 'The app and every navigation link that points to or from it are removed from the draft. Type the app ID to continue.',
      confirmLabel: 'Remove app',
      typedPhrase: target.appId || target.name,
      destructive: true,
    });
    if (!confirmed) return;
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

  async removeLink(index: number): Promise<void> {
    const link = this.links[index];
    if (!link) return;
    const { confirmed } = await this.confirmService.confirm({
      level: 'plain',
      title: `Remove link ${link.label}`,
      body: 'The link is removed from the draft. Refresh to bring it back before you save.',
      confirmLabel: 'Remove link',
      destructive: true,
    });
    if (!confirmed) return;
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

  async saveRegistry(): Promise<void> {
    this.validate();
    if (this.validationErrors.length > 0) {
      return;
    }
    const { confirmed } = await this.confirmService.confirm({
      level: 'plain',
      title: 'Save apps draft',
      body: 'Saves the apps as a draft. Nothing is public until you publish.',
      confirmLabel: 'Save draft',
    });
    if (!confirmed) return;

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
        this.release = response.release ?? this.release;
        this.loading = false;
        this.message = 'Application registry saved.';
        this.error = '';
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

  async saveLinks(): Promise<void> {
    const { confirmed } = await this.confirmService.confirm({
      level: 'plain',
      title: 'Save links draft',
      body: 'Saves the navigation links as a draft. Nothing is public until you publish.',
      confirmLabel: 'Save draft',
    });
    if (!confirmed) return;
    this.loading = true;
    this.message = '';
    this.error = '';
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

  async publishRegistry(): Promise<void> {
    this.validate();
    if (this.validationErrors.length > 0) {
      return;
    }

    if (!this.releaseNotes.trim()) {
      this.error = 'Release notes are required before publishing the registry.';
      return;
    }

    // The publish API takes release notes (already required above) but no
    // separate reason, so this reason is collected for the owner only.
    const { confirmed } = await this.confirmService.confirm({
      level: 'reason',
      title: 'Publish registry',
      body: 'Every app and the navigation that points to it update for all users.',
      confirmLabel: 'Publish',
    });
    if (!confirmed) return;

    this.loading = true;
    this.message = '';
    this.error = '';

    const payload: PublishRegistryDto = {
      releaseNotes: this.releaseNotes.trim(),
      changeSummary: this.changeSummary.trim() || undefined,
    };

    this.registryService.publishRegistry(payload).subscribe({
      next: (response) => {
        this.applyReleaseBundle(response.data);
        this.loading = false;
        this.message = 'Application registry published.';
        this.loadAuditLog();
      },
      error: (error) => {
        this.error = `Failed to publish registry: ${
          error.error?.message || error.message || 'Unknown error'
        }`;
        this.loading = false;
      },
    });
  }

  async rollbackRegistry(version: number): Promise<void> {
    const { confirmed, reason } = await this.confirmService.confirm({
      level: 'reason',
      title: `Roll back to version ${version}`,
      body: 'The published registry returns to this version for all users.',
      confirmLabel: 'Roll back',
      destructive: true,
    });
    if (!confirmed) return;
    this.loading = true;
    this.message = '';
    this.error = '';

    this.registryService
      .rollbackRegistry({
        version,
        // The rollback API accepts release notes, so the reason is sent there.
        releaseNotes: reason?.trim() || 'Rollback from registry management',
      })
      .subscribe({
        next: (response) => {
          this.applyReleaseBundle(response.data);
          this.loading = false;
          this.message = 'Application registry rolled back.';
          this.loadAuditLog();
        },
        error: (error) => {
          this.error = `Failed to rollback registry: ${
            error.error?.message || error.message || 'Unknown error'
          }`;
          this.loading = false;
        },
      });
  }

  releaseStatusLabel(): string {
    const status = this.release?.status;
    if (status === 'published') {
      return 'Published';
    }
    if (status === 'changes-pending') {
      return 'Changes Pending';
    }
    return 'Draft';
  }

  releaseHistory(): RegistryReleaseRevision[] {
    return [...(this.release?.history ?? [])].sort(
      (left, right) => right.version - left.version
    );
  }

  publicAppCount(): number {
    return this.registry.apps.filter((app) => app.visibility === 'public')
      .length;
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

    if (app.iconUrl) {
      try {
        const iconUrl = new URL(app.iconUrl);
        if (!['http:', 'https:'].includes(iconUrl.protocol)) {
          return `${app.appId} icon URL must use http or https.`;
        }
      } catch {
        return `${app.appId} icon URL must be absolute.`;
      }
    }

    return '';
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private applyReleaseBundle(data: {
    registry: AppRegistry;
    links: NavigationLink[];
    release: RegistryReleaseState;
  }): void {
    this.registry = this.clone(data.registry);
    this.links = this.clone(data.links);
    this.release = this.clone(data.release);
    this.releaseNotes = this.release.releaseNotes ?? '';
    this.changeSummary = this.release.changeSummary ?? '';
    this.validate();
  }
}
