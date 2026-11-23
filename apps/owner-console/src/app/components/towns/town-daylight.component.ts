import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  DAYLIGHT_OPERATOR_PERMISSIONS,
  DAYLIGHT_OPS_ACCESS,
  DaylightOperationsComponent,
  type DaylightOpsAccess,
  type DaylightTownFilter,
} from '@optimistic-tanuki/daylight-ops-ui';
import { OwnerPageHeaderComponent } from '@optimistic-tanuki/owner-page-ui';
import { map } from 'rxjs';
import { OwnerAccessService } from '../../services/owner-access.service';
import { TownContextService } from '../../services/town-context.service';

/**
 * Daylight's operator tools: pipeline health, officials named in agendas,
 * contributor density, copyright notices, callbacks and upkeep. The panels are
 * the same component local-hub renders, over the same operator routes, so the
 * two cannot drift. Under `/dashboard/towns/:townId/daylight` the town panels
 * narrow to the selected town; `/dashboard/daylight` shows every town, which
 * is where copyright notices (not tied to a town) are reached from.
 */
@Component({
  selector: 'app-town-daylight',
  standalone: true,
  imports: [OwnerPageHeaderComponent, DaylightOperationsComponent],
  providers: [
    {
      // The owner holds owner-console roles, not local-hub's, so ask the
      // owner-console access service instead of local-hub's /me route.
      provide: DAYLIGHT_OPS_ACCESS,
      useFactory: (): DaylightOpsAccess => {
        const access = inject(OwnerAccessService);
        return () =>
          access
            .load()
            .pipe(
              map((loaded) =>
                DAYLIGHT_OPERATOR_PERMISSIONS.filter(
                  (permission) =>
                    loaded.all || loaded.permissions.has(permission)
                )
              )
            );
      },
    },
  ],
  template: `
    <section class="daylight-ops" aria-label="Daylight">
      <ot-owner-page-header
        [title]="title()"
        description="Pipeline health, officials named in agendas, contributor density and copyright notices for the Daylight feed. The same tools Towne Square operators use."
      ></ot-owner-page-header>
      <ot-daylight-operations [town]="filter()" [showHeading]="false" />
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class TownDaylightComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly context = inject(TownContextService);

  private readonly hasTown = this.route.snapshot.paramMap.has('townId');

  /** The selected town on a town URL; null (every town) on `/dashboard/daylight`. */
  protected readonly filter = computed((): DaylightTownFilter | null => {
    if (!this.hasTown) return null;
    const town = this.context.selected();
    return town ? { name: town.name } : null;
  });

  protected readonly title = computed(() =>
    this.filter()?.name ? `Daylight: ${this.filter()?.name}` : 'Daylight'
  );
}
