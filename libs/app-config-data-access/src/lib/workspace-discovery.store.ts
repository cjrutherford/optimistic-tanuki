import { Injectable, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Subject, catchError, switchMap, tap } from 'rxjs';
import {
  WorkspaceDiscoveryApiService,
  type DiscoveredWorkspace,
} from './workspace-discovery-api.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceDiscoveryStore {
  private readonly _workspaces = signal<DiscoveredWorkspace[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private readonly loadRequests = new Subject<void>();

  readonly workspaces = this._workspaces.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();

  constructor(
    private readonly api: WorkspaceDiscoveryApiService,
    private readonly destroyRef: DestroyRef
  ) {
    this.loadRequests
      .pipe(
        switchMap(() =>
          this.api.list().pipe(
            tap((workspaces) => {
              this._workspaces.set(workspaces);
              this._loading.set(false);
            }),
            catchError((error: unknown) => {
              this._error.set(
                error instanceof Error && error.message
                  ? error.message
                  : 'Unable to load your workspaces.'
              );
              this._loading.set(false);
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  load(): void {
    this._loading.set(true);
    this._error.set(null);
    this.loadRequests.next();
  }

  provisionBusinessSite(): void {
    this._loading.set(true);
    this._error.set(null);
    this.api
      .provisionBusinessSite()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: (error: unknown) => {
          this._error.set(
            error instanceof Error && error.message
              ? error.message
              : 'Unable to create your Business Site workspace.'
          );
          this._loading.set(false);
        },
      });
  }
}
