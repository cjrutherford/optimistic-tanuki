import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, TemplateRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DirectoryBadgeComponent } from '../badge/directory-badge.component';
import { LocalDirectoryListing } from '../models';
import { humanizeCategory } from '../state';

/** One listing in a results list. Presentational: it links to the detail route, it never fetches. */
@Component({
  selector: 'otd-directory-card',
  standalone: true,
  imports: [NgTemplateOutlet, RouterLink, DirectoryBadgeComponent],
  template: `
    <article class="card" [attr.aria-labelledby]="headingId()">
      <div class="card__heading">
        <h3 class="card__name" [id]="headingId()">{{ listing().name }}</h3>
        <otd-directory-badge
          [kind]="businessPage() ? 'business-page' : 'directory-listing'"
        ></otd-directory-badge>
      </div>
      <p class="card__category">{{ category() }}</p>
      @if (listing().address || listing().phone) {
      <ul class="card__details">
        @if (listing().address) {
        <li>
          <address>{{ listing().address }}</address>
        </li>
        } @if (listing().phone) {
        <li>{{ listing().phone }}</li>
        }
      </ul>
      } @if (listing().website; as website) {
      <a
        class="card__link"
        [href]="website"
        target="_blank"
        rel="noopener noreferrer"
        [attr.aria-label]="'Visit website for ' + listing().name"
        >Visit website</a
      >
      } @if (detailLink(); as link) {
      <a
        class="card__link card__detail"
        data-testid="listing-detail-link"
        [routerLink]="$any(link)"
        [queryParams]="detailQueryParams()"
        [state]="detailState()"
        [attr.aria-label]="'View details for ' + listing().name"
        >View details</a
      >
      } @if (extras(); as template) {
      <div class="card__extras">
        <ng-container
          [ngTemplateOutlet]="template"
          [ngTemplateOutletContext]="{ $implicit: listing() }"
        ></ng-container>
      </div>
      }
    </article>
  `,
  styleUrls: ['./directory-card.component.scss'],
})
export class DirectoryCardComponent {
  private static nextId = 0;
  private readonly uid = DirectoryCardComponent.nextId++;

  readonly listing = input.required<LocalDirectoryListing>();
  /** Router commands for the detail view; null hides the link (for example when no reference was served). */
  readonly detailLink = input<readonly unknown[] | null>(null);
  readonly detailQueryParams = input<Record<string, string> | undefined>(
    undefined
  );
  readonly detailState = input<Record<string, unknown> | undefined>(undefined);
  /** True when the business has a page of its own in Town Square. */
  readonly businessPage = input(false);
  /** Optional per-listing extras (for example a claim control) rendered under the details. */
  readonly extras = input<TemplateRef<{
    $implicit: LocalDirectoryListing;
  }> | null>(null);

  readonly category = computed(() => humanizeCategory(this.listing().category));
  readonly headingId = computed(() => `otd-card-${this.uid}`);
}
