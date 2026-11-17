import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  DirectoryNearbyTown,
  nearestTowns,
  PlacedTown,
} from '@optimistic-tanuki/directory-ui';

type Phase = 'idle' | 'locating' | 'found' | 'denied' | 'unavailable';

/**
 * Finds a town to browse. The browser's location is requested only when the visitor presses the button, is
 * used once to rank towns, and is never stored. If it is refused or unavailable, a manual town selector is the
 * way forward (it is always on the page anyway).
 */
@Component({
  selector: 'app-town-locator',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="locator" aria-labelledby="town-locator-title">
      <h2 id="town-locator-title" class="locator__title">Find another town</h2>
      <div class="locator__row">
        <button
          type="button"
          class="locator__button"
          data-testid="use-my-location"
          [disabled]="phase() === 'locating'"
          (click)="useMyLocation()"
        >
          Use my location
        </button>
        <div class="locator__manual">
          <label for="town-locator-select">Choose a town</label>
          <select
            id="town-locator-select"
            data-testid="town-select"
            (change)="choose($any($event.target).value)"
          >
            <option value="">Select a town…</option>
            @for (town of towns(); track town.slug) {
            <option
              [value]="town.slug"
              [selected]="town.slug === currentSlug()"
            >
              {{ town.name }}{{ town.adminArea ? ', ' + town.adminArea : '' }}
            </option>
            }
          </select>
        </div>
      </div>
      <p
        class="locator__status"
        role="status"
        aria-live="polite"
        data-testid="locator-status"
      >
        @switch (phase()) { @case ('locating') { Finding your location… } @case
        ('denied') { We couldn't use your location. Choose a town from the list
        instead. } @case ('unavailable') { Location isn't available here. Choose
        a town from the list instead. } @case ('found') { @if (found().length
        === 0) { No towns with a known location were found. } @else { Closest
        towns to you: } } }
      </p>
      @if (phase() === 'found' && found().length) {
      <ul class="locator__found" data-testid="locator-found">
        @for (town of found(); track town.slug) {
        <li>
          <a [routerLink]="['/city', town.slug, 'businesses']">{{
            town.name
          }}</a>
        </li>
        }
      </ul>
      }
    </section>
  `,
  styleUrls: ['./town-locator.component.scss'],
})
export class TownLocatorComponent {
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);

  readonly towns = input<readonly (PlacedTown & { adminArea?: string })[]>([]);
  readonly currentSlug = input('');

  readonly phase = signal<Phase>('idle');
  private readonly origin = signal<{ lat: number; lng: number } | null>(null);
  readonly found = computed<DirectoryNearbyTown[]>(() =>
    nearestTowns(this.origin(), this.towns(), { limit: 3 })
  );

  useMyLocation(): void {
    if (
      !isPlatformBrowser(this.platformId) ||
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      this.phase.set('unavailable');
      return;
    }
    this.phase.set('locating');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.origin.set({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        this.phase.set('found');
      },
      (error) => {
        this.origin.set(null);
        this.phase.set(error.code === 1 ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
    );
  }

  choose(slug: string): void {
    if (slug) void this.router.navigate(['/city', slug, 'businesses']);
  }
}
