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

type SourceResult<T> = { ok: true; data: T } | { ok: false };

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

  /**
   * Every sub-fetch reports for itself. A source that fails is not an empty
   * source: it becomes an explicit "unavailable" item (kind
   * `source-unavailable`) so a consumer never reads a failure as zero.
   */
  getOperatorQueue(): Observable<OperatorQueueItem[]> {
    return forkJoin({
      appointments: this.settle(this.storeService.getAppointments()),
      orders: this.settle(this.storeService.getOrders()),
      leads: this.settle(this.leadsService.getLeads()),
      socialReports: this.settle(this.socialGovernanceService.getReports()),
      forumReports: this.settle(this.forumService.getReports()),
      configs: this.settle(this.appConfigService.getConfigurations()),
      siteConfig: this.settle(this.businessSiteAdminService.getSiteConfig()),
      products: this.settle(this.storeService.getProducts()),
    }).pipe(
      map((data) => {
        const items: Array<OperatorQueueItem | null> = [
          data.appointments.ok
            ? this.createAppointmentsItem(
                data.appointments.data as Array<{
                  status?: string;
                  startTime?: string | Date;
                }>
              )
            : this.unavailable(
                'commerce-appointments',
                'Commerce',
                'Appointments',
                '/dashboard/store/appointments'
              ),
          data.orders.ok
            ? this.createOrdersItem(data.orders.data as Order[])
            : this.unavailable(
                'commerce-orders',
                'Commerce',
                'Orders',
                '/dashboard/store/orders'
              ),
          data.leads.ok
            ? this.createNewLeadsItem(data.leads.data as Lead[])
            : this.unavailable(
                'crm-leads',
                'CRM',
                'Leads',
                '/dashboard/contacts'
              ),
        ];

        // Moderation is two sources; each reports for itself.
        const social = data.socialReports.ok
          ? (data.socialReports.data as ModerationReport[])
          : [];
        const forum = data.forumReports.ok
          ? (data.forumReports.data as ForumModerationReport[])
          : [];
        items.push(
          this.createModerationItem(
            social,
            forum,
            !data.socialReports.ok || !data.forumReports.ok
          )
        );
        if (!data.socialReports.ok) {
          items.push(
            this.unavailable(
              'community-social-reports',
              'Community Ops',
              'Social reports',
              '/dashboard/social-governance'
            )
          );
        }
        if (!data.forumReports.ok) {
          items.push(
            this.unavailable(
              'community-forum-reports',
              'Community Ops',
              'Forum reports',
              '/dashboard/forum-governance'
            )
          );
        }

        items.push(
          data.configs.ok
            ? this.createDraftConfigurationsItem(
                data.configs.data as AppConfiguration[]
              )
            : this.unavailable(
                'experience-configs',
                'Experience',
                'App configurations',
                '/dashboard/app-config'
              )
        );

        if (!data.siteConfig.ok) {
          items.push(
            this.unavailable(
              'experience-business-site',
              'Experience',
              'Business-site settings',
              '/dashboard/store/business-site'
            )
          );
        } else {
          const siteConfig = data.siteConfig.data as {
            config?: { serviceCatalog?: { source?: 'manual' | 'store' } };
          } | null;
          const storeMode =
            siteConfig?.config?.serviceCatalog?.source === 'store';
          if (storeMode && !data.products.ok) {
            items.push(
              this.unavailable(
                'experience-business-site-products',
                'Experience',
                'Store products',
                '/dashboard/store/business-site'
              )
            );
          } else {
            items.push(
              this.createBusinessSiteReadinessItem(
                siteConfig,
                data.products.ok ? (data.products.data as Product[]) : []
              )
            );
          }
        }

        return this.sortQueueItems(
          items.filter((item): item is OperatorQueueItem => item !== null)
        );
      })
    );
  }

  private settle<T>(source: Observable<T>): Observable<SourceResult<T>> {
    return source.pipe(
      map((data): SourceResult<T> => ({ ok: true, data })),
      catchError(() => of<SourceResult<T>>({ ok: false }))
    );
  }

  private unavailable(
    id: string,
    domain: OperatorQueueDomain,
    source: string,
    route: string
  ): OperatorQueueItem {
    return {
      id: `${id}-unavailable`,
      domain,
      kind: 'source-unavailable',
      severity: 'medium',
      title: `${source} unavailable`,
      detail: `${source} could not be loaded just now. This is not an empty queue; retry to check.`,
      route,
      status: 'unavailable',
      sourceTimestamp: null,
      tags: [domain.toLowerCase(), 'unavailable'],
    };
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
    forumReports: ForumModerationReport[],
    partial = false
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
      detail: `${total} moderation report${total === 1 ? '' : 's'} are ${
        partial ? 'known to be ' : ''
      }waiting across social and forum governance${
        partial ? '; another source could not be read' : ''
      }.`,
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
