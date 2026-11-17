import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

/**
 * Placeholder for the "Report or correct this listing" form.
 * TODO(S6 report form): replace with the real form once the listing-report contract lands in
 * libs/social/contracts. The detail page already links here, so only this component changes.
 */
@Component({
  selector: 'app-business-report',
  standalone: true,
  imports: [RouterLink],
  template: `
    <main class="report-page" aria-labelledby="report-title">
      <h1 id="report-title">Report or correct this listing</h1>
      <p>This form is not available yet.</p>
      <a [routerLink]="['/city', slug, 'businesses', reference]"
        >Back to the listing</a
      >
    </main>
  `,
  styles: [
    `
      .report-page {
        max-width: 48rem;
        margin: 0 auto;
        padding: 2rem 1.5rem 5rem;
        color: var(--foreground);
      }
      a {
        color: var(--primary-text, var(--primary));
      }
    `,
  ],
})
export class BusinessReportComponent {
  private route = inject(ActivatedRoute);
  slug = this.route.snapshot.paramMap.get('slug') ?? '';
  reference = this.route.snapshot.paramMap.get('reference') ?? '';
}
