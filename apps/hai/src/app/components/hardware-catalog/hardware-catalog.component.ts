import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { BadgeComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import {
  HardwareCatalogService,
  HardwareTier,
} from '../../services/hardware-catalog.service';
import { Observable, map } from 'rxjs';

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
