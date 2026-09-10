import { Injectable, signal } from '@angular/core';
import type {
  AppConfiguration,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { AppConfigApiService } from './app-config-data-access';
import type { ScopedAppConfiguration } from './scoped-app-configuration.contract';
import type { Subscription } from 'rxjs';

type AppConfigDraft = Partial<Omit<UpdateAppConfigDto, 'expectedRevision'>>;
type AppConfigWithScope = AppConfiguration &
  Partial<Pick<ScopedAppConfiguration, 'workspaceId' | 'appInstanceId'>>;
type AppConfigScope = {
  configurationId: string;
  workspaceSlug: string;
  workspaceId?: string;
  appInstanceId?: string;
  appScope?: string;
};

@Injectable({ providedIn: 'root' })
export class AppConfigStore {
  private readonly _selected = signal<AppConfiguration | null>(null);
  private readonly _draft = signal<AppConfigDraft | null>(null);
  private readonly _latest = signal<ScopedAppConfiguration | null>(null);
  private readonly _latestLoading = signal(false);
  private readonly _latestError = signal<string | null>(null);
  private readonly _loadError = signal<string | null>(null);
  private readonly _saveError = signal<string | null>(null);
  private readonly _saveConflict = signal(false);
  private readonly _saving = signal(false);
  private readonly _workspaceSlug = signal<string | null>(null);
  private activeScope: AppConfigScope | null = null;
  private loadedScope: AppConfigScope | null = null;
  private draftVersion = 0;
  private requestVersion = 0;
  private latestRequestVersion = 0;
  private saveSubscription?: Subscription;

  readonly selected = this._selected.asReadonly();
  readonly draft = this._draft.asReadonly();
  readonly latest = this._latest.asReadonly();
  readonly latestSnapshot = this._latest.asReadonly();
  readonly latestLoading = this._latestLoading.asReadonly();
  readonly latestError = this._latestError.asReadonly();
  readonly loadError = this._loadError.asReadonly();
  readonly saveError = this._saveError.asReadonly();
  readonly saveConflict = this._saveConflict.asReadonly();
  readonly saving = this._saving.asReadonly();
  readonly workspaceSlug = this._workspaceSlug.asReadonly();

  constructor(private readonly api: AppConfigApiService) {}

  load(configurationId: string, workspaceSlug: string): void {
    const validScope =
      this.nonempty(configurationId) && this.nonempty(workspaceSlug);
    const sameScope =
      validScope &&
      this.activeScope?.configurationId === configurationId &&
      this.activeScope?.workspaceSlug === workspaceSlug;
    const requestVersion = ++this.requestVersion;
    ++this.latestRequestVersion;
    this._latest.set(null);
    this._latestLoading.set(false);
    this._latestError.set(null);
    if (!sameScope) this._draft.set(null);
    if (!sameScope) this._selected.set(null);
    if (!sameScope) this.loadedScope = null;
    this.activeScope = validScope ? { configurationId, workspaceSlug } : null;
    this._loadError.set(null);
    this._saveError.set(null);
    this._saveConflict.set(false);
    this._workspaceSlug.set(null);
    if (!this.nonempty(configurationId)) {
      this._loadError.set('A configuration ID is required.');
      return;
    }
    if (!this.nonempty(workspaceSlug)) {
      this._loadError.set('A workspace slug is required.');
      return;
    }
    this._workspaceSlug.set(workspaceSlug);

    this.api.get(configurationId, workspaceSlug).subscribe({
      next: (configuration) => {
        if (requestVersion === this.requestVersion) {
          if (configuration.id !== configurationId) {
            this._loadError.set(
              'The selected configuration does not match the requested owner context.'
            );
            return;
          }
          const selected = this._selected();
          if (
            selected &&
            this.isValidRevision(selected.revision) &&
            this.isValidRevision(configuration.revision) &&
            selected.revision > configuration.revision
          )
            return;
          this.loadedScope = this.configurationScope(
            configuration,
            configurationId,
            workspaceSlug
          );
          this._selected.set(configuration);
        }
      },
      error: (error: unknown) => {
        if (requestVersion === this.requestVersion) {
          this._loadError.set(
            error instanceof Error && error.message
              ? error.message
              : 'Failed to load configuration.'
          );
        }
      },
    });
  }

  setDraft(patch: Partial<UpdateAppConfigDto>): void {
    const { expectedRevision: _ignoredExpectedRevision, ...draftPatch } = patch;
    this.draftVersion += 1;
    this._draft.update((draft) => ({ ...draft, ...draftPatch }));
  }

  refreshLatest(): void {
    const latestRequestVersion = ++this.latestRequestVersion;
    const requestVersion = this.requestVersion;
    const scope = this.activeScope;
    const workspaceSlug = this._workspaceSlug();
    const expectedScope =
      scope && workspaceSlug
        ? this.latestScope(scope.configurationId, workspaceSlug)
        : null;

    if (!scope || !workspaceSlug || !expectedScope) {
      this._latestLoading.set(false);
      this._latestError.set(
        'A fully scoped configuration is required to refresh the latest revision.'
      );
      return;
    }

    this._latestLoading.set(true);
    this._latestError.set(null);
    this.api.get(scope.configurationId, workspaceSlug).subscribe({
      next: (configuration) => {
        if (
          !this.isCurrentLatestRequest(
            latestRequestVersion,
            requestVersion,
            scope
          )
        )
          return;
        if (!this.matchesLatestScope(configuration, expectedScope)) {
          this._latestLoading.set(false);
          this._latestError.set(
            'The latest configuration does not match the loaded owner context.'
          );
          return;
        }
        if (!this.isStrictlyNewerLatestRevision(configuration)) {
          this._latestLoading.set(false);
          return;
        }
        this._latest.set(configuration);
        this._latestLoading.set(false);
        this._latestError.set(null);
      },
      error: (error: unknown) => {
        if (
          !this.isCurrentLatestRequest(
            latestRequestVersion,
            requestVersion,
            scope
          )
        )
          return;
        this._latestLoading.set(false);
        this._latestError.set(
          this.errorMessage(
            error,
            'Failed to refresh the latest configuration.'
          )
        );
      },
    });
  }

  acceptLatest(options: { preserveDraft: boolean }): void {
    const latest = this._latest();
    const scope = this.activeScope;
    const workspaceSlug = this._workspaceSlug();
    const expectedScope =
      scope && workspaceSlug
        ? this.latestScope(scope.configurationId, workspaceSlug)
        : null;

    if (!latest || !scope || !workspaceSlug || !expectedScope) return;
    if (!this.matchesLatestScope(latest, expectedScope)) {
      this._latestError.set(
        'The latest configuration does not match the loaded owner context.'
      );
      return;
    }
    if (!this.isAcceptableLatestRevision(latest)) return;

    this._selected.set(latest);
    this.loadedScope = this.configurationScope(
      latest,
      scope.configurationId,
      workspaceSlug
    );
    this._latest.set(null);
    this._latestLoading.set(false);
    this._latestError.set(null);
    this._saveError.set(null);
    this._saveConflict.set(false);
    if (!options.preserveDraft) this.clearDraft();
  }

  clearDraft(): void {
    this.draftVersion += 1;
    this._draft.set(null);
  }

  clearSaveRecovery(): void {
    ++this.latestRequestVersion;
    this._latest.set(null);
    this._latestLoading.set(false);
    this._latestError.set(null);
    this._saveError.set(null);
    this._saveConflict.set(false);
  }

  cancelPendingSave(): void {
    ++this.requestVersion;
    this.saveSubscription?.unsubscribe();
    this.saveSubscription = undefined;
    this._saving.set(false);
  }

  save(): void {
    if (this._saving()) return;

    const selected = this._selected();
    const draft = this._draft();

    const workspaceSlug = this._workspaceSlug();
    if (!selected || !draft || !workspaceSlug) {
      if (selected && draft && !workspaceSlug) {
        this._saveError.set(
          'A workspace slug is required to save configuration.'
        );
      }
      return;
    }
    if (!this.isValidRevision(selected.revision)) {
      this._saveError.set(
        'A valid configuration revision is required to save configuration.'
      );
      this._saveConflict.set(false);
      return;
    }

    const saveVersion = this.requestVersion;
    const saveDraftVersion = this.draftVersion;
    const saveScope: AppConfigScope = this.loadedScope ?? {
      configurationId: selected.id,
      workspaceSlug,
    };
    this._saving.set(true);
    this._saveError.set(null);
    this._saveConflict.set(false);
    const update: UpdateAppConfigDto = {
      ...draft,
      expectedRevision: selected.revision,
    };
    const saveSubscription = this.api
      .update(selected.id, update, workspaceSlug)
      .subscribe({
        next: (configuration) => {
          this.saveSubscription = undefined;
          const sameScope =
            this.activeScope?.configurationId === saveScope.configurationId &&
            this.activeScope?.workspaceSlug === saveScope.workspaceSlug;
          if (saveVersion !== this.requestVersion && !sameScope) {
            this._saving.set(false);
            return;
          }
          if (!this.matchesScope(configuration, saveScope)) {
            this._saveError.set(
              'The saved configuration does not match the loaded owner context.'
            );
            this._saveConflict.set(false);
            this._saving.set(false);
            return;
          }
          const selected = this._selected();
          if (
            !selected ||
            !this.isValidRevision(selected.revision) ||
            !this.isValidRevision(configuration.revision) ||
            selected.revision <= configuration.revision
          )
            this._selected.set(configuration);
          if (saveDraftVersion === this.draftVersion) this._draft.set(null);
          this._saving.set(false);
        },
        error: (error: unknown) => {
          this.saveSubscription = undefined;
          if (saveVersion !== this.requestVersion) {
            this._saving.set(false);
            return;
          }
          const conflict = this.isConflict(error);
          this._saveConflict.set(conflict);
          this._saveError.set(
            conflict
              ? 'Configuration changed elsewhere. Reload the latest revision before retrying.'
              : this.errorMessage(error, 'Failed to save configuration.')
          );
          this._saving.set(false);
        },
      });
    this.saveSubscription = saveSubscription;
    if (saveSubscription.closed) this.saveSubscription = undefined;
  }

  private isConflict(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const candidate = error as { status?: unknown; statusCode?: unknown };
    return candidate.status === 409 || candidate.statusCode === 409;
  }

  private isValidRevision(revision: unknown): revision is number {
    return (
      typeof revision === 'number' && Number.isInteger(revision) && revision > 0
    );
  }

  private isStrictlyNewerLatestRevision(
    configuration: AppConfiguration
  ): boolean {
    if (!this.isValidRevision(configuration.revision)) return false;
    const selectedRevision = this._selected()?.revision;
    const latestRevision = this._latest()?.revision;
    const authoritativeRevision = Math.max(
      this.isValidRevision(selectedRevision) ? selectedRevision : 0,
      this.isValidRevision(latestRevision) ? latestRevision : 0
    );
    return configuration.revision > authoritativeRevision;
  }

  private isAcceptableLatestRevision(configuration: AppConfiguration): boolean {
    if (!this.isValidRevision(configuration.revision)) return false;
    const selectedRevision = this._selected()?.revision;
    return (
      !this.isValidRevision(selectedRevision) ||
      configuration.revision > selectedRevision
    );
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    if (
      error &&
      typeof error === 'object' &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message: string }).message;
    }
    return fallback;
  }

  private nonempty(value: string): boolean {
    return value.trim().length > 0;
  }

  private configurationScope(
    configuration: AppConfigWithScope,
    configurationId: string,
    workspaceSlug: string
  ): AppConfigScope {
    return {
      configurationId,
      workspaceSlug,
      workspaceId: configuration.workspaceId,
      appInstanceId: configuration.appInstanceId,
      appScope: configuration.appScope,
    };
  }

  private latestScope(
    configurationId: string,
    workspaceSlug: string
  ): AppConfigScope | null {
    const selected = this._selected();
    const scope =
      this.loadedScope ??
      (selected
        ? this.configurationScope(selected, configurationId, workspaceSlug)
        : null);
    return scope && this.isFullyScoped(scope) ? scope : null;
  }

  private isFullyScoped(scope: AppConfigScope): boolean {
    return (
      this.nonempty(scope.configurationId) &&
      this.nonempty(scope.workspaceSlug) &&
      this.nonempty(scope.workspaceId ?? '') &&
      this.nonempty(scope.appInstanceId ?? '') &&
      this.nonempty(scope.appScope ?? '')
    );
  }

  private isCurrentLatestRequest(
    latestRequestVersion: number,
    requestVersion: number,
    scope: AppConfigScope
  ): boolean {
    return (
      latestRequestVersion === this.latestRequestVersion &&
      requestVersion === this.requestVersion &&
      this.activeScope?.configurationId === scope.configurationId &&
      this.activeScope?.workspaceSlug === scope.workspaceSlug
    );
  }

  private matchesLatestScope(
    configuration: AppConfigWithScope,
    scope: AppConfigScope
  ): configuration is ScopedAppConfiguration {
    return (
      this.isFullyScoped({
        configurationId: configuration.id,
        workspaceSlug: scope.workspaceSlug,
        workspaceId: configuration.workspaceId,
        appInstanceId: configuration.appInstanceId,
        appScope: configuration.appScope,
      }) &&
      configuration.id === scope.configurationId &&
      configuration.workspaceId === scope.workspaceId &&
      configuration.appInstanceId === scope.appInstanceId &&
      configuration.appScope === scope.appScope
    );
  }

  private matchesScope(
    configuration: AppConfigWithScope,
    scope: AppConfigScope
  ): boolean {
    return (
      configuration.id === scope.configurationId &&
      configuration.workspaceId === scope.workspaceId &&
      configuration.appInstanceId === scope.appInstanceId &&
      configuration.appScope === scope.appScope
    );
  }
}
