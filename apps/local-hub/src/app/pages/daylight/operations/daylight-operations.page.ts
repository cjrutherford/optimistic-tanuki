import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DaylightOperationsComponent } from '@optimistic-tanuki/daylight-ops-ui';

/**
 * Daylight's operator tools. The panels live in `@optimistic-tanuki/daylight-ops-ui`,
 * shared with owner-console's Towns → Daylight page so the two cannot drift.
 */
@Component({
  selector: 'app-daylight-operations-page',
  imports: [DaylightOperationsComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ot-daylight-operations>
      <span daylightOpsDenied>
        This page is for Daylight operators.
        <a routerLink="/cities">Back to the towns</a>.
      </span>
    </ot-daylight-operations>
  `,
  styles: ':host { display: block; }',
})
export class DaylightOperationsPage {}
