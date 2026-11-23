import { DirectoryAdminService } from '../services/directory-admin.service';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import {
  TAXONOMY_APPLY_CONFIRMATION,
  type TaxonomyMappingList,
  type TaxonomyRunRecord,
  type TaxonomyRunScope,
} from '@optimistic-tanuki/social-contracts/directory';
import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  EmptyStateComponent,
  IconComponent,
  LoadingStateComponent,
} from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

export const TAXONOMY_POLL_MS = 3000;
export const TAXONOMY_ROLLBACK_CONFIRMATION = 'ROLLBACK';
const ACTIVE = ['pending', 'running', 'rolling_back'];

/**
 * Reclassification runs. A dry run plans the change and writes nothing; an apply names the plan hash of a
 * completed dry run and needs a typed confirmation; a completed apply can be rolled back. Runs are processed by a
 * background worker, so the list refreshes itself while any run is in flight.
 */
@Component({
  selector: 'app-directory-taxonomy-runs-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    IconComponent,
    LoadingStateComponent,
    TextInputComponent,
  ],
  templateUrl: './directory-taxonomy-runs-page.component.html',
  styleUrls: ['./directory-taxonomy-runs-page.component.scss'],
})
export class DirectoryTaxonomyRunsPageComponent implements OnInit, OnDestroy {
  private readonly admin = inject(DirectoryAdminService);

  readonly applyWord = TAXONOMY_APPLY_CONFIRMATION;
  readonly rollbackWord = TAXONOMY_ROLLBACK_CONFIRMATION;
  mappings: TaxonomyMappingList = { versions: [], available: [] };
  runs: TaxonomyRunRecord[] = [];
  loading = false;
  busy = false;
  message = '';
  scope: TaxonomyRunScope = 'town';
  version = '';
  townInput = '';
  typed: Record<string, string> = {};
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  // One id per attempt: a retry after a network error replays instead of duplicating.
  private readonly ids = new Map<string, string>();

  ngOnInit(): void {
    this.loadMappings();
    this.load(true);
  }

  ngOnDestroy(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  inFlight(): boolean {
    return this.runs.some((r) => ACTIVE.includes(r.status));
  }

  private loadMappings(): void {
    this.admin.listTaxonomyMappings<TaxonomyMappingList>().subscribe({
      next: (result) => {
        this.mappings = result;
        if (!this.version)
          this.version =
            result.versions.find((v) => v.active)?.id ??
            result.available[0]?.id ??
            '';
      },
      error: () => {
        this.message = 'Mapping versions are unavailable.';
      },
    });
  }

  private load(initial = false): void {
    if (initial) this.loading = true;
    this.admin.listTaxonomyRuns<{ runs: TaxonomyRunRecord[] }>(25).subscribe({
      next: (result) => {
        this.loading = false;
        this.runs = result.runs ?? [];
        this.schedule();
      },
      error: () => {
        this.loading = false;
        this.message = 'Runs are unavailable. Retrying.';
        this.schedule();
      },
    });
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    if (this.stopped || !this.inFlight()) return;
    this.timer = setTimeout(() => this.load(), TAXONOMY_POLL_MS);
  }

  private idFor(key: string): string {
    const id = this.ids.get(key) ?? crypto.randomUUID();
    this.ids.set(key, id);
    return id;
  }

  private failed(key: string, error: HttpErrorResponse, what: string): void {
    this.busy = false;
    if (error?.status === 409 || error?.status === 400) this.ids.delete(key);
    this.message =
      error?.status === 409
        ? `${what} was refused: it conflicts with the current state (another run may be active, or the plan has moved).`
        : error?.status === 400
        ? `${what} was refused. Check the inputs and the typed confirmation.`
        : `${what} could not be recorded. Try again.`;
  }

  setVersion(event: Event): void {
    this.version = (event.target as HTMLSelectElement).value;
  }

  setScope(scope: TaxonomyRunScope): void {
    this.scope = scope;
    this.ids.clear();
  }

  setTyped(id: string, value: string): void {
    this.typed = { ...this.typed, [id]: value };
  }

  install(activate: boolean): void {
    if (this.busy || !this.version) return;
    this.busy = true;
    this.message = '';
    this.admin
      .installTaxonomyMappings<{ replayed: boolean }>({
        version: this.version,
        activate,
      })
      .subscribe({
        next: (result) => {
          this.busy = false;
          this.message = result.replayed
            ? 'That mapping version is already installed.'
            : 'Mapping version installed.';
          this.loadMappings();
        },
        error: (error: HttpErrorResponse) =>
          this.failed('install', error, 'The install'),
      });
  }

  dryRun(townId: string, reason: string): void {
    if (this.busy) return;
    if (
      !this.version ||
      !reason.trim() ||
      (this.scope === 'town' && !townId.trim())
    ) {
      this.message =
        'A mapping version, a reason, and a town id (for a town run) are required.';
      return;
    }
    const key = `dry:${this.version}:${
      this.scope
    }:${townId.trim()}:${reason.trim()}`;
    this.busy = true;
    this.message = '';
    this.admin
      .startTaxonomyRun<{ replayed: boolean; run: TaxonomyRunRecord }>({
        id: this.idFor(key),
        mappingVersion: this.version,
        scope: this.scope,
        ...(this.scope === 'town' ? { townId: townId.trim() } : {}),
        mode: 'dry_run',
        reason: reason.trim(),
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.ids.delete(key);
          this.message = 'Dry run queued. Nothing is changed by a dry run.';
          this.load();
        },
        error: (error: HttpErrorResponse) =>
          this.failed(key, error, 'The dry run'),
      });
  }

  canApply(r: TaxonomyRunRecord): boolean {
    return r.mode === 'dry_run' && r.status === 'complete' && !!r.planHash;
  }

  canCancel(r: TaxonomyRunRecord): boolean {
    return r.status === 'pending' || r.status === 'running';
  }

  canRollback(r: TaxonomyRunRecord): boolean {
    return r.mode === 'apply' && r.status === 'complete';
  }

  confirmed(r: TaxonomyRunRecord, word: string): boolean {
    return this.typed[r.id] === word;
  }

  apply(r: TaxonomyRunRecord, reason: string): void {
    if (this.busy || !this.canApply(r)) return;
    if (!this.confirmed(r, this.applyWord)) {
      this.message = `Type ${this.applyWord} to confirm.`;
      return;
    }
    if (!reason.trim()) {
      this.message = 'A reason is required to apply a plan.';
      return;
    }
    const key = `apply:${r.id}`;
    this.busy = true;
    this.message = '';
    this.admin
      .startTaxonomyRun<{ replayed: boolean; run: TaxonomyRunRecord }>({
        id: this.idFor(key),
        mappingVersion: r.mappingVersion,
        scope: r.scope,
        ...(r.townId ? { townId: r.townId } : {}),
        mode: 'apply',
        reason: reason.trim(),
        expectedPlanHash: r.planHash,
        confirm: this.applyWord,
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.ids.delete(key);
          this.setTyped(r.id, '');
          this.message =
            'Apply queued. It runs in the background and can be cancelled or rolled back.';
          this.load();
        },
        error: (error: HttpErrorResponse) =>
          this.failed(key, error, 'The apply'),
      });
  }

  cancel(r: TaxonomyRunRecord, reason: string): void {
    if (this.busy || !this.canCancel(r)) return;
    if (!reason.trim()) {
      this.message = 'A reason is required to cancel.';
      return;
    }
    const key = `cancel:${r.id}`;
    this.busy = true;
    this.admin
      .cancelTaxonomyRun(r.id, {
        reason: reason.trim(),
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.message =
            'Cancel requested. The run stops after its current batch.';
          this.load();
        },
        error: (error: HttpErrorResponse) =>
          this.failed(key, error, 'The cancel'),
      });
  }

  rollback(r: TaxonomyRunRecord, reason: string): void {
    if (this.busy || !this.canRollback(r)) return;
    if (!this.confirmed(r, this.rollbackWord)) {
      this.message = `Type ${this.rollbackWord} to confirm.`;
      return;
    }
    if (!reason.trim()) {
      this.message = 'A reason is required to roll back.';
      return;
    }
    const key = `rollback:${r.id}`;
    this.busy = true;
    this.admin
      .rollbackTaxonomyRun(r.id, {
        reason: reason.trim(),
        confirm: this.rollbackWord,
      })
      .subscribe({
        next: () => {
          this.busy = false;
          this.setTyped(r.id, '');
          this.message =
            'Rollback started. Rows changed by this run are being restored.';
          this.load();
        },
        error: (error: HttpErrorResponse) =>
          this.failed(key, error, 'The rollback'),
      });
  }

  progressText(r: TaxonomyRunRecord): string {
    if (r.phase === 'rollback')
      return `${r.restoredRows} of ${r.appliedRows} rows restored`;
    if (r.mode === 'apply')
      return `${r.appliedRows} of ${r.changedRows} rows applied`;
    return `${r.scannedRows} rows scanned, ${r.changedRows} would change`;
  }

  badgeTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
    if (status === 'complete') return 'success';
    if (status === 'failed') return 'danger';
    if (ACTIVE.includes(status)) return 'warning';
    return 'neutral';
  }
}
