import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import {
  OwnerPageHeaderComponent,
  OwnerStateComponent,
} from '@optimistic-tanuki/owner-page-ui';
import { AppConfigService } from '../services/app-config.service';
import { AppScopesService } from '../services/app-scopes.service';
import { BusinessSiteAdminService } from '../services/business-site-admin.service';
import { CommunityService } from '../services/community.service';
import {
  ControlCenterService,
  DeploymentHealth,
  ImageInfo,
  OAuthProviderDetail,
} from '../services/control-center.service';
import {
  OperatorQueueDomain,
  OperatorQueueItem,
  OperatorQueueService,
} from '../services/operator-queue.service';
import { ContactLeadsService } from '../services/contact-leads.service';
import { StoreService } from '../services/store.service';
import { UsersService } from '../services/users.service';

interface DomainStatusCard {
  title: string;
  status: 'Healthy' | 'Attention';
  detail: string;
  route: string;
}

interface ControlPlaneAction {
  title: string;
  description: string;
  route: string;
}

interface BusinessSiteCatalogStatus {
  status: 'Healthy' | 'Attention';
  mode: 'manual' | 'store' | 'unknown';
  detail: string;
  route: string;
}

@Component({
  selector: 'app-operations-workspace',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    OwnerPageHeaderComponent,
    OwnerStateComponent,
  ],
  templateUrl: './operations-workspace.component.html',
  styleUrl: './operations-workspace.component.scss',
})
export class OperationsWorkspaceComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  private readonly appScopesService = inject(AppScopesService);
  private readonly appConfigService = inject(AppConfigService);
  private readonly businessSiteAdminService = inject(BusinessSiteAdminService);
  private readonly communityService = inject(CommunityService);
  private readonly storeService = inject(StoreService);
  private readonly controlCenter = inject(ControlCenterService);
  private readonly operatorQueueService = inject(OperatorQueueService);
  private readonly contactLeadsService = inject(ContactLeadsService);

  statusCards: DomainStatusCard[] = [];
  queueItems: OperatorQueueItem[] | null = null;
  readonly queueDomains: OperatorQueueDomain[] = [
    'Governance',
    'Experience',
    'Commerce',
    'CRM',
    'Community Ops',
  ];
  selectedQueueDomain: OperatorQueueDomain | 'all' = 'all';
  selectedQueueSeverity: OperatorQueueItem['severity'] | 'all' = 'all';
  businessSiteCatalogStatus: BusinessSiteCatalogStatus = {
    status: 'Attention',
    mode: 'unknown',
    detail: 'Business-site catalog configuration has not been loaded yet.',
    route: '/dashboard/store/business-site',
  };
  controlPlaneActions: ControlPlaneAction[] = [
    {
      title: 'Review role assignments',
      description:
        'Jump into governance workflows when platform-wide access or operator authority must change.',
      route: '/dashboard/roles',
    },
    {
      title: 'Publish or revise app configuration',
      description:
        'Move from monitoring into experience intervention when a user-facing surface needs correction.',
      route: '/dashboard/app-config',
    },
    {
      title: 'Resolve order or booking exceptions',
      description:
        'Handle outstanding commerce issues from one entry point into orders, appointments, and availability.',
      route: '/dashboard/store/orders',
    },
    {
      title: 'Govern business-site catalog source',
      description:
        'Verify store service-product readiness before switching the public business site to store-backed offers.',
      route: '/dashboard/store/business-site',
    },
    {
      title: 'Stabilize community rollout',
      description:
        'Inspect city and community records whenever localized network coverage needs operator action.',
      route: '/dashboard/communities',
    },
    {
      title: 'Monitor video processing',
      description:
        'Watch transcoding queue health, inspect failures, and safely retry failed video jobs.',
      route: '/dashboard/video-processing',
    },
  ];

  // Null until loaded, so a pending or failed load never shows invented values.
  deploymentHealth: DeploymentHealth | null = null;
  healthError: string | null = null;
  images: ImageInfo[] | null = null;
  imagesError: string | null = null;
  oauthProviders: OAuthProviderDetail[] | null = null;
  oauthError: string | null = null;
  queueError: string | null = null;
  updatesAvailable = 0;

  get filteredQueueItems(): OperatorQueueItem[] {
    return (this.queueItems ?? []).filter((item) => {
      const domainMatch =
        this.selectedQueueDomain === 'all' ||
        item.domain === this.selectedQueueDomain;
      const severityMatch =
        this.selectedQueueSeverity === 'all' ||
        item.severity === this.selectedQueueSeverity;
      return domainMatch && severityMatch;
    });
  }

  ngOnInit(): void {
    this.loadHealth();
    this.loadImages();
    this.loadOauth();
    this.loadQueue();

    forkJoin({
      governance: forkJoin({
        users: this.usersService.getProfiles().pipe(catchError(() => of(null))),
        appScopes: this.appScopesService
          .getAppScopes()
          .pipe(catchError(() => of(null))),
      }),
      experience: this.appConfigService
        .getConfigurations()
        .pipe(catchError(() => of(null))),
      commerce: forkJoin({
        products: this.storeService
          .getProducts()
          .pipe(catchError(() => of(null))),
        orders: this.storeService.getOrders().pipe(catchError(() => of(null))),
        appointments: this.storeService
          .getAppointments()
          .pipe(catchError(() => of(null))),
        businessSiteConfig: this.businessSiteAdminService
          .getSiteConfig()
          .pipe(catchError(() => of(null))),
      }),
      crm: this.contactLeadsService.getLeads().pipe(catchError(() => of(null))),
      communities: forkJoin({
        communities: this.communityService
          .getCommunities()
          .pipe(catchError(() => of(null))),
        cities: this.communityService
          .getCities()
          .pipe(catchError(() => of(null))),
      }),
    }).subscribe((result) => {
      this.statusCards = [
        {
          title: 'Identity and governance',
          status:
            result.governance.users && result.governance.appScopes
              ? 'Healthy'
              : 'Attention',
          detail:
            result.governance.users && result.governance.appScopes
              ? 'Profiles and app-scope metadata are currently reachable.'
              : 'One or more governance sources did not respond cleanly.',
          route: '/dashboard/users',
        },
        {
          title: 'Experience delivery',
          status: result.experience ? 'Healthy' : 'Attention',
          detail: result.experience
            ? 'App configuration data is available for publish review.'
            : 'Experience configuration data needs operator investigation.',
          route: '/dashboard/app-config',
        },
        {
          title: 'Commerce operations',
          status:
            result.commerce.products &&
            result.commerce.orders &&
            result.commerce.appointments
              ? 'Healthy'
              : 'Attention',
          detail:
            result.commerce.products &&
            result.commerce.orders &&
            result.commerce.appointments
              ? 'Catalog, orders, and booking data are available for intervention.'
              : 'Commerce data is partially unavailable and should be checked.',
          route: '/dashboard/store/overview',
        },
        {
          title: 'CRM pipeline',
          status: result.crm ? 'Healthy' : 'Attention',
          detail: result.crm
            ? 'Lead intake data is available for assignment, follow-up, and response work.'
            : 'Lead intake data is unavailable and CRM interventions need investigation.',
          route: '/dashboard/contacts',
        },
        {
          title: 'Community network',
          status:
            result.communities.communities && result.communities.cities
              ? 'Healthy'
              : 'Attention',
          detail:
            result.communities.communities && result.communities.cities
              ? 'Community and city records are reachable for operator workflows.'
              : 'Community topology data needs follow-up from operators.',
          route: '/dashboard/towns',
        },
      ];

      const catalogSource =
        result.commerce.businessSiteConfig?.config?.serviceCatalog?.source ??
        'manual';
      const serviceProducts =
        result.commerce.products?.filter(
          (product) => product.type === 'service'
        ) ?? [];
      this.businessSiteCatalogStatus = {
        status:
          result.commerce.businessSiteConfig && result.commerce.products
            ? 'Healthy'
            : 'Attention',
        mode:
          catalogSource === 'store' || catalogSource === 'manual'
            ? catalogSource
            : 'unknown',
        detail:
          result.commerce.businessSiteConfig && result.commerce.products
            ? catalogSource === 'store'
              ? `Store-backed business offers are enabled. ${serviceProducts.length} service product(s) are available in the current catalog.`
              : 'Manual business-site offers are active. Store service products are available, but not currently selected as the public source.'
            : 'Business-site or store catalog data is unavailable and should be investigated.',
        route: '/dashboard/store/business-site',
      };
    });
  }

  loadHealth(): void {
    this.healthError = null;
    this.controlCenter.getDeploymentHealth().subscribe({
      next: (health) => (this.deploymentHealth = health),
      error: () =>
        (this.healthError = 'Deployment health could not be loaded.'),
    });
  }

  loadImages(): void {
    this.imagesError = null;
    this.controlCenter.getImages().subscribe({
      next: (imgs) => {
        this.images = imgs;
        this.updatesAvailable = imgs.filter((i) => i.updateAvailable).length;
      },
      error: () => (this.imagesError = 'Image status could not be loaded.'),
    });
  }

  loadOauth(): void {
    this.oauthError = null;
    this.controlCenter.getOAuthProviders().subscribe({
      next: (data) => (this.oauthProviders = data.providers),
      error: () =>
        (this.oauthError = 'Sign-in provider status could not be loaded.'),
    });
  }

  loadQueue(): void {
    this.queueError = null;
    this.operatorQueueService.getOverviewQueue().subscribe({
      next: (items) => (this.queueItems = items),
      error: () =>
        (this.queueError = 'The operator queue could not be loaded.'),
    });
  }

  countQueueItemsByDomain(domain: OperatorQueueDomain): number {
    return this.filteredQueueItems.filter((item) => item.domain === domain)
      .length;
  }
}
