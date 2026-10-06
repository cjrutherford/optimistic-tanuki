import { CommonModule } from '@angular/common';
import { Component, PLATFORM_ID, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HaiAppDirectoryService } from '@optimistic-tanuki/hai-ui';
import { BadgeComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import {
  PulseRingsComponent,
  TopographicDriftComponent,
} from '@optimistic-tanuki/motion-ui';
import { EcosystemSectionComponent } from './ecosystem-section.component';
import { OfferingsSectionComponent } from './offerings-section.component';
import { PrivateCloudSectionComponent } from './private-cloud-section.component';
import {
  OFFERINGS,
  PRIVATE_CLOUD_CAPABILITIES,
  PRIVATE_CLOUD_INTRO,
  PRIVATE_CLOUD_PATHS,
} from '../../content/site-content';
import { prefersReducedMotion } from '../../services/reduced-motion';

@Component({
  selector: 'hai-landing',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    CardComponent,
    BadgeComponent,
    PulseRingsComponent,
    TopographicDriftComponent,
    OfferingsSectionComponent,
    PrivateCloudSectionComponent,
    EcosystemSectionComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly appDirectory = inject(HaiAppDirectoryService);

  readonly ecosystem$ = this.appDirectory.getResolvedApps('hai');
  readonly offerings = OFFERINGS;
  readonly privateCloudIntro = PRIVATE_CLOUD_INTRO;
  readonly privateCloudCapabilities = PRIVATE_CLOUD_CAPABILITIES;
  readonly privateCloudPaths = PRIVATE_CLOUD_PATHS;

  get reducedMotion(): boolean {
    return prefersReducedMotion(this.platformId);
  }
}
