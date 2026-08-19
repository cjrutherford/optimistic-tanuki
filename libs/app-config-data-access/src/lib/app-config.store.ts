import { Injectable, signal } from '@angular/core';
import type {
  AppConfiguration,
  UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import { AppConfigApiService } from './app-config-data-access';

@Injectable({ providedIn: 'root' })
export class AppConfigStore {
  private readonly _selected = signal<AppConfiguration | null>(null);
  private readonly _draft = signal<UpdateAppConfigDto | null>(null);
  private readonly _loadError = signal<string | null>(null);
  private readonly _saveError = signal<string | null>(null);
  private readonly _saving = signal(false);
  private requestVersion = 0;

  readonly selected = this._selected.asReadonly();
  readonly draft = this._draft.asReadonly();
  readonly loadError = this._loadError.asReadonly();
  readonly saveError = this._saveError.asReadonly();
  readonly saving = this._saving.asReadonly();

  constructor(private readonly api: AppConfigApiService) {}

  loadByDomain(domain: string): void {
    const requestVersion = ++this.requestVersion;
    this._loadError.set(null);

    this.api.getByDomain(domain).subscribe({
      next: (configuration) => {
        if (requestVersion === this.requestVersion) {
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

  setDraft(patch: UpdateAppConfigDto): void {
    this._draft.update((draft) => ({ ...draft, ...patch }));
  }

  save(): void {
    const selected = this._selected();
    const draft = this._draft();

    if (!selected || !draft) {
      return;
    }

    this._saving.set(true);
    this._saveError.set(null);
    this.api.update(selected.id, draft).subscribe({
      next: (configuration) => {
        this._selected.set(configuration);
        this._draft.set(null);
        this._saving.set(false);
      },
      error: (error: unknown) => {
        this._saveError.set(
          error instanceof Error && error.message
            ? error.message
            : 'Failed to save configuration.'
        );
        this._saving.set(false);
      },
    });
  }
}
