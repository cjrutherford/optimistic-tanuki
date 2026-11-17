import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DirectoryNearbyTown } from '../models';

/** The closest towns in the system, each linking to its own directory. Never a hard-coded region. */
@Component({
  selector: 'otd-directory-nearby-towns',
  standalone: true,
  imports: [RouterLink],
  template: `
    <nav class="nearby" aria-labelledby="otd-nearby-title">
      <h2 id="otd-nearby-title" class="nearby__title">Nearby towns</h2>
      @if (towns().length === 0) {
      <p class="nearby__empty" data-testid="nearby-empty">
        No other towns are available yet.
      </p>
      } @else {
      <ul class="nearby__list">
        @for (town of towns(); track town.slug) {
        <li>
          <a [routerLink]="linkFor()(town)">{{ town.name }}</a>
          @if (town.adminArea) {<span class="nearby__meta"
            >, {{ town.adminArea }}</span
          >} @if (town.distanceMiles !== undefined) {
          <span class="nearby__meta">
            ({{ roundedMiles(town.distanceMiles) }} mi)</span
          >
          }
        </li>
        }
      </ul>
      }
    </nav>
  `,
  styleUrls: ['./directory-nearby-towns.component.scss'],
})
export class DirectoryNearbyTownsComponent {
  readonly towns = input<readonly DirectoryNearbyTown[]>([]);
  readonly linkFor = input<(town: DirectoryNearbyTown) => readonly unknown[]>(
    (town) => ['/city', town.slug, 'businesses']
  );

  roundedMiles(miles: number): number {
    return Math.max(1, Math.round(miles));
  }
}
