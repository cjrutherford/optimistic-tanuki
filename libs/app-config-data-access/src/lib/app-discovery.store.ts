import { Injectable, signal } from '@angular/core';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import {
  AppDiscoveryApiService,
  type DiscoveredApp,
} from './app-discovery-api.service';

@Injectable({ providedIn: 'root' })
export class AppDiscoveryStore {
  private readonly _apps = signal<DiscoveredApp[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly _actionErrors = signal<Record<string, string>>({});
  private readonly _actionsInFlight = signal<Set<string>>(new Set());
  private readonly loadRequests = new Subject<{
    search?: string;
    accessPolicy?: DiscoveredApp['accessPolicy'];
  }>();

  readonly apps = this._apps.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly actionErrors = this._actionErrors.asReadonly();

  constructor(private readonly api: AppDiscoveryApiService) {
    this.loadRequests
      .pipe(
        switchMap(({ search, accessPolicy }) =>
          this.api.list(search, accessPolicy).pipe(
            tap((apps) => {
              this._apps.set(apps);
              this._loading.set(false);
            }),
            catchError((error: unknown) => {
              this._error.set(
                errorMessage(error, 'Unable to load published apps')
              );
              this._loading.set(false);
              return EMPTY;
            })
          )
        )
      )
      .subscribe();
  }

  load(search?: string, accessPolicy?: DiscoveredApp['accessPolicy']): void {
    this._loading.set(true);
    this._error.set(null);
    this._actionErrors.set({});
    this._actionsInFlight.set(new Set());
    this.loadRequests.next({ search, accessPolicy });
  }

  join(appId: string): void {
    this.runMembershipAction(
      appId,
      () => this.api.join(appId),
      'Unable to join this app'
    );
  }

  request(appId: string): void {
    this.runMembershipAction(
      appId,
      () => this.api.request(appId),
      'Unable to request app access'
    );
  }

  actionError(appId: string): string | null {
    return this._actionErrors()[appId] ?? null;
  }

  actionInFlight(appId: string): boolean {
    return this._actionsInFlight().has(appId);
  }

  private runMembershipAction(
    appId: string,
    action: () => ReturnType<AppDiscoveryApiService['join']>,
    fallback: string
  ): void {
    if (this.actionInFlight(appId)) return;
    this._actionErrors.update((errors) => {
      const next = { ...errors };
      delete next[appId];
      return next;
    });
    this._actionsInFlight.update((ids) => new Set(ids).add(appId));
    action().subscribe({
      next: (membership) => {
        this.reflectMembership(membership);
        this.finishMembershipAction(appId);
      },
      error: (error: unknown) => {
        this._actionErrors.update((errors) => ({
          ...errors,
          [appId]: errorMessage(error, fallback),
        }));
        this.finishMembershipAction(appId);
      },
    });
  }

  private finishMembershipAction(appId: string): void {
    this._actionsInFlight.update((ids) => {
      const next = new Set(ids);
      next.delete(appId);
      return next;
    });
  }

  private reflectMembership(membership: {
    appId: string;
    role: string;
    status: string;
  }): void {
    this._actionErrors.update((errors) => {
      const next = { ...errors };
      delete next[membership.appId];
      return next;
    });
    this._apps.update((apps) =>
      apps.map((app) =>
        app.appId !== membership.appId
          ? app
          : {
              ...app,
              membershipRole: membership.role,
              membershipStatus: membership.status,
              canOpen: membership.status === 'active',
              canJoin: false,
              canRequest: false,
            }
      )
    );
  }
}

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const response = error as {
      message?: unknown;
      error?: { message?: unknown };
    };
    const message = response.error?.message ?? response.message;
    if (typeof message === 'string' && message) return message;
    if (
      Array.isArray(message) &&
      message.every((item) => typeof item === 'string')
    ) {
      return message.join(', ');
    }
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
