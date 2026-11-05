import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStateService } from '../../services/auth-state.service';
import {
  SOURCE_REQUEST_NOTE_MAX,
  TownSourcesService,
} from '../../services/town-sources.service';

/**
 * Shown in place of an empty feed when Daylight has no sources for a town
 * (D32): a plain note and three ways to help.
 */
@Component({
  selector: 'app-town-sources-note',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './town-sources-note.component.html',
  styleUrl: './town-sources-note.component.scss',
})
export class TownSourcesNoteComponent {
  private readonly sources = inject(TownSourcesService);
  private readonly auth = inject(AuthStateService);
  private readonly router = inject(Router);

  /** The town page's slug, for the return URL. */
  readonly citySlug = input.required<string>();
  /** The civic-briefing locality the request is recorded against. */
  readonly localitySlug = input.required<string>();
  readonly name = input.required<string>();
  readonly status = input.required<'no-sources' | 'not-sourced-yet'>();

  protected readonly noteMax = SOURCE_REQUEST_NOTE_MAX;
  protected readonly formOpen = signal(false);
  protected readonly note = signal('');
  protected readonly pending = signal(false);
  protected readonly error = signal('');
  protected readonly requestCount = signal<number | null>(null);

  protected readonly headline = computed(() =>
    this.status() === 'no-sources'
      ? `No sources yet for ${this.name()}`
      : `Daylight is still looking for sources for ${this.name()}`
  );
  protected readonly returnUrl = computed(
    () => `/city/${this.citySlug()}/briefing`
  );
  protected readonly confirmation = computed(() => {
    const count = this.requestCount();
    if (count === null) return '';
    const readers = count === 1 ? '1 reader has' : `${count} readers have`;
    return `Thanks — ${readers} asked for ${this.name()}`;
  });

  protected async openRequest(): Promise<void> {
    if (!(await this.signedIn())) {
      await this.toLogin();
      return;
    }
    this.formOpen.set(true);
  }

  protected setNote(event: Event): void {
    this.note.set((event.target as HTMLTextAreaElement).value);
  }

  protected async submit(): Promise<void> {
    if (this.pending()) return;
    this.pending.set(true);
    this.error.set('');
    try {
      const result = await this.sources.request(
        this.localitySlug(),
        this.note().trim() || undefined
      );
      this.requestCount.set(result.requestCount);
      this.formOpen.set(false);
    } catch (error: unknown) {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        await this.toLogin();
      } else {
        this.error.set("We couldn't send your request. Please try again.");
      }
    } finally {
      this.pending.set(false);
    }
  }

  private async signedIn(): Promise<boolean> {
    try {
      await this.auth.waitForSessionRestore();
    } catch {
      // Treat a failed session check as signed out.
    }
    return firstValueFrom(this.auth.isAuthenticated$);
  }

  private toLogin(): Promise<boolean> {
    return this.router.navigate(['/login'], {
      queryParams: { returnUrl: this.returnUrl() },
    });
  }
}
