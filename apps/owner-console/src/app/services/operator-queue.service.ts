import { Injectable } from '@angular/core';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { AppConfiguration } from '@optimistic-tanuki/app-config-models';
import { Lead, LeadStatus } from '@optimistic-tanuki/ui-models';
import { AppConfigService } from './app-config.service';
import { BusinessSiteAdminService } from './business-site-admin.service';
import { ContactLeadsService } from './contact-leads.service';
import { ForumModerationReport, ForumService } from './forum.service';
import {
  ModerationReport,
  SocialGovernanceService,
} from './social-governance.service';
import { Order, Product, StoreService } from './store.service';

export type OperatorQueueDomain =
  | 'Governance'
  | 'Experience'
  | 'Commerce'
  | 'CRM'
  | 'Community Ops';

export type OperatorQueueSeverity = 'high' | 'medium' | 'low';

export interface OperatorQueueItem {
  id: string;
  domain: OperatorQueueDomain;
  kind: string;
  severity: OperatorQueueSeverity;
  title: string;
  detail: string;
  route: string;
  status: string;
  sourceTimestamp: string | null;
  tags: string[];
}

@Injectable({
  providedIn: 'root',
})
export class OperatorQueueService {
  constructor(
    private readonly storeService: StoreService,
    private readonly leadsService: ContactLeadsService,
    private readonly socialGovernanceService: SocialGovernanceService,
    private readonly forumService: ForumService,
    private readonly appConfigService: AppConfigService,
    private readonly businessSiteAdminService: BusinessSiteAdminService
  ) {}

  getOverviewQueue(): Observable<OperatorQueueItem[]> {
    return this.getOperatorQueue();
  }

  getQueueByDomain(
    domain: OperatorQueueDomain
  ): Observable<OperatorQueueItem[]> {
    return this.getOperatorQueue().pipe(
      map((items) => items.filter((item) => item.domain === domain))
    );
  }

  getOperatorQueue(): Observable<OperatorQueueItem[]> {
    return forkJoin({
      appointments: this.storeService
        .getAppointments()
        .pipe(catchError(() => of([]))),
      orders: this.storeService.getOrders().pipe(catchError(() => of([]))),
      leads: this.leadsService.getLeads().pipe(catchError(() => of([]))),
      socialReports: this.socialGovernanceService
        .getReports()
        .pipe(catchError(() => of([]))),
      forumReports: this.forumService
        .getReports()
        .pipe(catchError(() => of([]))),
      configs: this.appConfigService
        .getConfigurations()
        .pipe(catchError(() => of([]))),
      siteConfig: this.businessSiteAdminService
        .getSiteConfig()
        .pipe(catchError(() => of(null))),
      products: this.storeService.getProducts().pipe(catchError(() => of([]))),
    }).pipe(
      map((data) =>
        this.sortQueueItems(
          [
            this.createAppointmentsItem(
              data.appointments as Array<{
                status?: string;
                startTime?: string | Date;
              }>
            ),
            this.createOrdersItem(data.orders as Order[]),
            this.createNewLeadsItem(data.leads as Lead[]),
            this.createModerationItem(
              data.socialReports as ModerationReport[],
              data.forumReports as ForumModerationReport[]
            ),
            this.createDraftConfigurationsItem(
              data.configs as AppConfiguration[]
            ),
            this.createBusinessSiteReadinessItem(
              data.siteConfig as {
                config?: {
                  serviceCatalog?: { source?: 'manual' | 'store' };
                };
              } | null,
              data.products as Product[]
            ),
          ].filter((item): item is OperatorQueueItem => item !== null)
        )
      )
    );
  }

  private createAppointmentsItem(
    appointments: Array<{ status?: string; startTime?: string | Date }>
  ): OperatorQueueItem | null {
    const pending = appointments.filter((appointment) =>
      ['pending', 'requested', 'awaiting_approval'].includes(
        appointment.status?.toLowerCase?.() ?? ''
      )
    );

    if (!pending.length) {
      return null;
    }

    return {
      id: 'commerce-appointments-pending',
      domain: 'Commerce',
      kind: 'appointment-approval',
      severity: 'high',
      title: 'Appointments awaiting approval',
      detail: `${pending.length} appointment${
        pending.length === 1 ? '' : 's'
      } still need approval or scheduling.`,
      route: '/dashboard/store/appointments',
      status: 'pending',
      sourceTimestamp: this.getEarliestTimestamp(
        pending.map((appointment) => appointment.startTime)
      ),
      tags: ['commerce', 'booking', 'approval'],
    };
  }

  private createOrdersItem(orders: Order[]): OperatorQueueItem | null {
    const actionable = orders.filter(
      (order) =>
        !['complete', 'completed', 'fulfilled', 'cancelled'].includes(
          order.status?.toLowerCase?.() ?? ''
        )
    );

    if (!actionable.length) {
      return null;
    }

    return {
      id: 'commerce-orders-actionable',
      domain: 'Commerce',
      kind: 'order-review',
      severity: 'medium',
      title: 'Orders need review',
      detail: `${actionable.length} order${
        actionable.length === 1 ? '' : 's'
      } still appear actionable from the current snapshot.`,
      route: '/dashboard/store/orders',
      status: 'attention',
      sourceTimestamp: this.getEarliestTimestamp(
        actionable.map((order) => order.createdAt)
      ),
      tags: ['commerce', 'orders', 'fulfillment'],
    };
  }

  private createNewLeadsItem(leads: Lead[]): OperatorQueueItem | null {
    const newLeads = leads.filter(
      (lead) => (lead.status?.toLowerCase?.() ?? '') === LeadStatus.NEW
    );

    if (!newLeads.length) {
      return null;
    }

    return {
      id: 'crm-leads-new',
      domain: 'CRM',
      kind: 'lead-first-response',
      severity: 'high',
      title: 'New leads need first response',
      detail: `${newLeads.length} lead${
        newLeads.length === 1 ? '' : 's'
      } are still marked new and should be triaged.`,
      route: '/dashboard/contacts',
      status: 'pending',
      sourceTimestamp: this.getEarliestTimestamp(
        newLeads.map((lead) => lead.createdAt)
      ),
      tags: ['crm', 'leads', 'inbox'],
    };
  }

  private createModerationItem(
    socialReports: ModerationReport[],
    forumReports: ForumModerationReport[]
  ): OperatorQueueItem | null {
    const pendingSocial = socialReports.filter(
      (report) => report.status === 'pending'
    );
    const pendingForum = forumReports.filter(
      (report) => report.status === 'pending'
    );
    const total = pendingSocial.length + pendingForum.length;

    if (!total) {
      return null;
    }

    return {
      id: 'community-moderation-pending',
      domain: 'Community Ops',
      kind: 'moderation-review',
      severity: 'high',
      title: 'Moderation reports pending review',
      detail: `${total} moderation report${
        total === 1 ? '' : 's'
      } are waiting across social and forum governance.`,
      route: '/dashboard/social-governance',
      status: 'pending',
      sourceTimestamp: this.getEarliestTimestamp([
        ...pendingSocial.map((report) => report.createdAt),
        ...pendingForum.map((report) => report.createdAt),
      ]),
      tags: ['community', 'moderation', 'safety'],
    };
  }

  private createDraftConfigurationsItem(
    configs: AppConfiguration[]
  ): OperatorQueueItem | null {
    const drafts = configs.filter((config) => !config.active);

    if (!drafts.length) {
      return null;
    }

    return {
      id: 'experience-configs-draft',
      domain: 'Experience',
      kind: 'publish-review',
      severity: 'medium',
      title: 'Experience publish review',
      detail: `${drafts.length} configuration${
        drafts.length === 1 ? '' : 's'
      } are inactive or draft and may need publish review.`,
      route: '/dashboard/app-config',
      status: 'attention',
      sourceTimestamp: null,
      tags: ['experience', 'config', 'publish'],
    };
  }

  private createBusinessSiteReadinessItem(
    siteConfigResponse: {
      config?: {
        serviceCatalog?: { source?: 'manual' | 'store' };
      };
    } | null,
    products: Product[]
  ): OperatorQueueItem | null {
    const source =
      siteConfigResponse?.config?.serviceCatalog?.source ?? 'manual';
    if (source !== 'store') {
      return null;
    }

    const serviceProducts = products.filter(
      (product) => product.type === 'service' && product.active
    );
    const issues = this.getBusinessSiteReadinessIssues(serviceProducts);

    if (!issues.length) {
      return null;
    }

    return {
      id: 'experience-business-site-readiness',
      domain: 'Experience',
      kind: 'catalog-readiness',
      severity: 'high',
      title: 'Business-site catalog readiness',
      detail: `${issues.length} readiness issue${
        issues.length === 1 ? '' : 's'
      } need attention before store mode is reliable.`,
      route: '/dashboard/store/business-site',
      status: 'attention',
      sourceTimestamp: null,
      tags: ['experience', 'readiness', 'catalog'],
    };
  }

  private getBusinessSiteReadinessIssues(products: Product[]): string[] {
    const issues: string[] = [];

    if (!products.length) {
      issues.push(
        'At least one active store service product is required for store mode.'
      );
    }

    if (products.some((product) => !product.description?.trim())) {
      issues.push(
        'Every store service product should have a public-facing description.'
      );
    }

    if (products.some((product) => Number(product.priceCents) <= 0)) {
      issues.push(
        'Every store service product should have a price greater than zero.'
      );
    }

    return issues;
  }

  private sortQueueItems(items: OperatorQueueItem[]): OperatorQueueItem[] {
    const severityRank: Record<OperatorQueueSeverity, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    return [...items].sort((left, right) => {
      const severityDiff =
        severityRank[left.severity] - severityRank[right.severity];
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const leftTime = this.toTimestamp(left.sourceTimestamp);
      const rightTime = this.toTimestamp(right.sourceTimestamp);
      return leftTime - rightTime;
    });
  }

  private getEarliestTimestamp(
    values: Array<string | Date | undefined | null>
  ): string | null {
    const valid = values
      .map((value) => this.toTimestamp(value))
      .filter((value) => Number.isFinite(value));

    if (!valid.length) {
      return null;
    }

    return new Date(Math.min(...valid)).toISOString();
  }

  private toTimestamp(value: string | Date | undefined | null): number {
    if (!value) {
      return Number.POSITIVE_INFINITY;
    }

    const date = value instanceof Date ? value : new Date(value);
    const timestamp = date.getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
  }
}
