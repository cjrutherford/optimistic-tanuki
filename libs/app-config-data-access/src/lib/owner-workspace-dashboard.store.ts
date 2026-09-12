import { Injectable, signal } from '@angular/core';
import type {
  PublishAppConfigDto,
  RollbackAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import {
  defer,
  finalize,
  map,
  Subscription,
  tap,
  throwError,
  type Observable,
} from 'rxjs';
import { AppConfigApiService } from './app-config-data-access';
import {
  canEditWorkspace,
  canPublishWorkspace,
  dashboardReleaseStatus,
  type OwnerWorkspaceDashboard,
  type OwnerWorkspaceDashboardState,
} from './owner-workspace-dashboard.model';
import { WorkspaceDiscoveryApiService } from './workspace-discovery-api.service';

@Injectable({ providedIn: 'root' })
export class OwnerWorkspaceDashboardStore {
  private readonly _dashboard = signal<OwnerWorkspaceDashboard | null>(null);
  private readonly _state = signal<OwnerWorkspaceDashboardState>('empty');
  private readonly _error = signal<string | null>(null);
  private readonly _publishError = signal<string | null>(null);
  private readonly _publishing = signal(false);
  private readonly _rollbackError = signal<string | null>(null);
  private readonly _rollingBack = signal(false);
  private selectedSlug: string | null = null;
  private requestGeneration = 0;
  private loadSubscription?: Subscription;

  readonly dashboard = this._dashboard.asReadonly();
  readonly state = this._state.asReadonly();
  readonly error = this._error.asReadonly();
  readonly publishError = this._publishError.asReadonly();
  readonly publishing = this._publishing.asReadonly();
  readonly rollbackError = this._rollbackError.asReadonly();
  readonly rollingBack = this._rollingBack.asReadonly();

  constructor(
    private readonly discovery: WorkspaceDiscoveryApiService,
    private readonly configurations: AppConfigApiService
  ) {}

  load(workspaceSlug: string): void {
    const generation = ++this.requestGeneration;
    this.loadSubscription?.unsubscribe();
    this.selectedSlug = workspaceSlug;
    this._state.set('loading');
    this._error.set(null);
    this._publishError.set(null);
    this._dashboard.set(null);
    if (!this.nonempty(workspaceSlug)) {
      this.unavailable('A workspace slug is required.');
      return;
    }
    const loadSubscription = new Subscription();
    this.loadSubscription = loadSubscription;
    loadSubscription.add(
      this.discovery.list().subscribe({
        next: (workspaces) => {
          if (generation !== this.requestGeneration) return;
          const workspace = workspaces.find(
            (candidate) => candidate.slug === workspaceSlug
          );
          if (!workspace)
            return this.unavailable(
              'That workspace is not available to your account.'
            );
          if (
            workspace.status !== 'active' ||
            workspace.membershipStatus !== 'active'
          )
            return this.unavailable(
              'That workspace is not currently available.'
            );
          if (
            !this.nonempty(workspace.workspaceId) ||
            !this.nonempty(workspace.appInstanceId) ||
            !this.nonempty(workspace.appScope)
          )
            return this.unavailable(
              'The selected workspace has incomplete app identity.'
            );
          const role = workspace.membershipRole;
          if (!role)
            return this.unavailable(
              'The selected workspace has incomplete membership context.'
            );
          if (role !== 'owner')
            return this.unavailable(
              'Only the workspace owner can access this dashboard.'
            );
          if (!workspace.configurationId) {
            this._state.set('empty');
            return;
          }
          loadSubscription.add(
            this.configurations
              .get(workspace.configurationId, workspace.slug)
              .subscribe({
                next: (configuration) => {
                  if (generation !== this.requestGeneration) return;
                  if (
                    configuration.id !== workspace.configurationId ||
                    configuration.workspaceId !== workspace.workspaceId ||
                    configuration.appInstanceId !== workspace.appInstanceId ||
                    configuration.appScope !== workspace.appScope ||
                    !configuration.active
                  )
                    return this.unavailable(
                      'The selected app context could not be verified.'
                    );
                  this._dashboard.set({
                    workspace: {
                      id: workspace.workspaceId,
                      slug: workspace.slug,
                      name: workspace.displayName,
                      status: workspace.status,
                    },
                    app: {
                      id: workspace.appInstanceId,
                      name: configuration.name,
                      scope: workspace.appScope,
                    },
                    membership: {
                      role,
                      status: workspace.membershipStatus ?? 'active',
                      canEdit: canEditWorkspace(role),
                      canPublish: canPublishWorkspace(role),
                    },
                    configuration: {
                      id: configuration.id,
                      revision: configuration.revision,
                      active: configuration.active,
                      releaseStatus: dashboardReleaseStatus(configuration),
                      publishedVersion:
                        configuration.release?.publishedVersion ?? null,
                      releaseHistory: (
                        configuration.release?.history ?? []
                      ).map(
                        ({
                          version,
                          action,
                          releaseNotes,
                          changeSummary,
                          releasedAt,
                        }) => ({
                          version,
                          action,
                          releaseNotes,
                          changeSummary,
                          releasedAt,
                        })
                      ),
                      updatedAt: configuration.updatedAt,
                    },
                    links: {
                      preview: `/app/${encodeURIComponent(
                        configuration.name
                      )}?workspaceSlug=${encodeURIComponent(workspace.slug)}`,
                      edit: `/owner/workspace/${encodeURIComponent(
                        workspace.slug
                      )}/config/${encodeURIComponent(configuration.id)}`,
                    },
                  });
                  this._state.set('ready');
                },
                error: (error: unknown) => {
                  if (generation === this.requestGeneration) this.fail(error);
                },
              })
          );
        },
        error: (error: unknown) => {
          if (generation === this.requestGeneration) this.fail(error);
        },
      })
    );
  }

  refresh(): void {
    if (this.selectedSlug) this.load(this.selectedSlug);
  }
  retry(): void {
    this.refresh();
  }

  publish(
    releaseNotes: string,
    changeSummary?: string
  ): Observable<OwnerWorkspaceDashboard> {
    const dashboard = this._dashboard();
    if (!dashboard)
      return throwError(() => new Error('No workspace dashboard is loaded.'));
    if (!dashboard.membership.canPublish)
      return throwError(
        () => new Error('You do not have permission to publish this workspace.')
      );
    if (this._publishing())
      return throwError(
        () => new Error('A publish request is already in progress.')
      );
    const generation = this.requestGeneration;
    const payload: PublishAppConfigDto = {
      expectedRevision: dashboard.configuration.revision,
      releaseNotes,
      ...(changeSummary ? { changeSummary } : {}),
    };
    return defer(() => {
      this._publishing.set(true);
      this._publishError.set(null);
      return this.configurations.publish(
        dashboard.configuration.id,
        payload,
        dashboard.workspace.slug
      );
    }).pipe(
      map((configuration) => {
        if (
          generation !== this.requestGeneration ||
          configuration.id !== dashboard.configuration.id ||
          configuration.workspaceId !== dashboard.workspace.id ||
          configuration.appInstanceId !== dashboard.app.id ||
          configuration.appScope !== dashboard.app.scope ||
          typeof configuration.revision !== 'number'
        ) {
          throw new Error('The server returned an unexpected app context.');
        }
        return configuration;
      }),
      tap((configuration) => {
        this._dashboard.update(
          (current) =>
            current && {
              ...current,
              configuration: {
                ...current.configuration,
                revision: configuration.revision,
                releaseStatus: dashboardReleaseStatus(configuration),
                publishedVersion:
                  configuration.release?.publishedVersion ?? null,
                releaseHistory: (configuration.release?.history ?? []).map(
                  ({
                    version,
                    action,
                    releaseNotes,
                    changeSummary,
                    releasedAt,
                  }) => ({
                    version,
                    action,
                    releaseNotes,
                    changeSummary,
                    releasedAt,
                  })
                ),
                updatedAt: configuration.updatedAt,
              },
            }
        );
      }),
      map(() => {
        const current = this._dashboard();
        if (!current)
          throw new Error('The workspace dashboard is no longer available.');
        return current;
      }),
      tap({
        error: (error: unknown) => {
          this._publishError.set(
            error instanceof Error && error.message
              ? error.message
              : 'Unable to publish this configuration.'
          );
        },
      }),
      finalize(() => this._publishing.set(false))
    );
  }

  rollback(
    version: number,
    releaseNotes = 'Rollback release'
  ): Observable<OwnerWorkspaceDashboard> {
    const dashboard = this._dashboard();
    if (!dashboard)
      return throwError(() => new Error('No workspace dashboard is loaded.'));
    if (!dashboard.membership.canPublish)
      return throwError(
        () =>
          new Error('You do not have permission to rollback this workspace.')
      );
    if (this._rollingBack() || this._publishing())
      return throwError(
        () => new Error('A release request is already in progress.')
      );
    const generation = this.requestGeneration;
    const payload: RollbackAppConfigDto = {
      expectedRevision: dashboard.configuration.revision,
      version,
      releaseNotes,
    };
    return defer(() => {
      this._rollingBack.set(true);
      this._rollbackError.set(null);
      return this.configurations.rollback(
        dashboard.configuration.id,
        payload,
        dashboard.workspace.slug
      );
    }).pipe(
      map((configuration) => {
        if (
          generation !== this.requestGeneration ||
          configuration.id !== dashboard.configuration.id ||
          configuration.workspaceId !== dashboard.workspace.id ||
          configuration.appInstanceId !== dashboard.app.id ||
          configuration.appScope !== dashboard.app.scope ||
          typeof configuration.revision !== 'number'
        ) {
          throw new Error('The server returned an unexpected app context.');
        }
        return configuration;
      }),
      tap((configuration) => {
        this._dashboard.update(
          (current) =>
            current && {
              ...current,
              configuration: {
                ...current.configuration,
                revision: configuration.revision,
                releaseStatus: dashboardReleaseStatus(configuration),
                publishedVersion:
                  configuration.release?.publishedVersion ?? null,
                releaseHistory: (configuration.release?.history ?? []).map(
                  ({
                    version: releaseVersion,
                    action,
                    releaseNotes: notes,
                    changeSummary,
                    releasedAt,
                  }) => ({
                    version: releaseVersion,
                    action,
                    releaseNotes: notes,
                    changeSummary,
                    releasedAt,
                  })
                ),
                updatedAt: configuration.updatedAt,
              },
            }
        );
      }),
      map(() => {
        const current = this._dashboard();
        if (!current)
          throw new Error('The workspace dashboard is no longer available.');
        return current;
      }),
      tap({
        error: (error: unknown) => {
          this._rollbackError.set(
            error instanceof Error && error.message
              ? error.message
              : 'Unable to rollback this configuration.'
          );
        },
      }),
      finalize(() => this._rollingBack.set(false))
    );
  }

  private unavailable(message: string): void {
    this._state.set('unavailable');
    this._error.set(message);
  }
  private fail(error: unknown): void {
    this._state.set('error');
    this._error.set(
      error instanceof Error && error.message
        ? error.message
        : 'Unable to load this workspace.'
    );
  }
  private nonempty(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }
}
