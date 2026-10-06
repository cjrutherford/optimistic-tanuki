import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * What a Daylight contributor should know before they start: the terms a
 * contributor agrees to when signing up (D27), shown on the watcher page too.
 */
@Component({
  selector: 'app-daylight-contributor-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daylight-contributor-terms.component.html',
  styles: `
    :host { display: block; }
    ul { padding-left: 1.2rem; display: grid; gap: 0.5rem; margin: 0; }
    li { line-height: 1.65; }
  `,
})
export class DaylightContributorTermsComponent {}
