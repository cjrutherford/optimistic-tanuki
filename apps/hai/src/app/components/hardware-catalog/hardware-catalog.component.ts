import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { BadgeComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import {
  HardwareCatalogService,
  HardwareTier,
} from '../../services/hardware-catalog.service';
import { Observable, map } from 'rxjs';
import { LABOR_RATE_LABEL, PRICING_ONE_LINE } from '../../content/pricing';

@Component({
  selector: 'hai-hardware-catalog',
  standalone: true,
  imports: [CommonModule, CardComponent, BadgeComponent],
  templateUrl: './hardware-catalog.component.html',
  styleUrl: './hardware-catalog.component.scss',
})
export class HardwareCatalogComponent implements OnInit {
  private readonly catalogService = inject(HardwareCatalogService);

  @Input() tiersOverride?: HardwareTier[];

  readonly pricingSummary = PRICING_ONE_LINE;
  readonly laborRate = LABOR_RATE_LABEL;

  tiers$!: Observable<HardwareTier[]>;

  ngOnInit(): void {
    const override = this.tiersOverride;
    if (override && override.length > 0) {
      this.tiers$ = new Observable((observer) => {
        observer.next(override);
        observer.complete();
      });
    } else {
      this.tiers$ = this.catalogService.getTiers();
    }
  }

  getPortalUrl(tier: HardwareTier): Observable<string> {
    return this.catalogService.getPortalUrl(tier.configuratorPreset);
  }
}
