import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  BrandConfigService,
  DEMO_BRAND_PROFILES,
} from '@optimistic-tanuki/whitebox-brand-config';
import {
  CardComponent,
  ButtonComponent,
  BadgeComponent,
  ChipComponent,
  MetricTileComponent,
} from '@optimistic-tanuki/common-ui';
import { BrandProfile } from '../../models/field-flow.models';
import { FieldFlowSyncService } from '../../services/field-flow-sync.service';

@Component({
  selector: 'flow-demo',
  standalone: true,
  imports: [
    CommonModule,
    CardComponent,
    ButtonComponent,
    BadgeComponent,
    ChipComponent,
    MetricTileComponent,
  ],
  templateUrl: './demo.component.html',
  styleUrl: './demo.component.scss',
})
export class DemoComponent {
  private readonly router = inject(Router);
  readonly brandConfig = inject(BrandConfigService);
  readonly syncService = inject(FieldFlowSyncService);

  readonly profiles: BrandProfile[] = DEMO_BRAND_PROFILES;

  selectProfile(profileId: string): void {
    this.brandConfig.setBrandProfile(profileId);
  }

  enableStandalone(): void {
    this.brandConfig.enableStandaloneMode();
  }

  syncNow(): void {
    void this.syncService.syncPendingData();
  }

  startWorkflow(): void {
    void this.router.navigate(['/estimate']);
  }
}
