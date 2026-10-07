import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  SITE_ANALYTICS_STORE,
  SiteAnalyticsStore,
} from './site-analytics.store';

/**
 * First-party, aggregate-only site analytics (HAI S014).
 *
 * Each accepted event increments one counter keyed by app, event, page path,
 * an optional short detail, and the UTM campaign fields. Nothing about the
 * visitor is stored: no IP address, user agent, identifier, or timestamp per
 * event. Counters live in the configured store (Redis in deployments, so they
 * survive gateway restarts) and are exposed to Prometheus as
 * `ot_site_events_total` on the performance exposition endpoint.
 */

export const SITE_ANALYTICS_EVENTS = [
  'page_view',
  'cta_click',
  'audience_interest',
  'assessment_start',
  'assessment_submit',
  'phone_click',
  'email_click',
] as const;

export type SiteAnalyticsEventName = (typeof SITE_ANALYTICS_EVENTS)[number];

export interface SiteAnalyticsEventInput {
  appId?: unknown;
  name?: unknown;
  path?: unknown;
  detail?: unknown;
  utmSource?: unknown;
  utmMedium?: unknown;
  utmCampaign?: unknown;
}

export interface SiteAnalyticsCount {
  appId: string;
  name: SiteAnalyticsEventName;
  path: string;
  detail: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  count: number;
}

const APP_ID = /^[a-z0-9-]{1,40}$/;
const PATH = /^\/[a-z0-9/-]{0,119}$/;
const DETAIL = /^[a-z0-9/_-]{1,80}$/;
const UTM = /^[a-z0-9_.-]{1,64}$/;
/** Upper bound on distinct counters, so junk input cannot grow memory. */
export const MAX_SITE_ANALYTICS_KEYS = 5000;

type SiteAnalyticsKey = Omit<SiteAnalyticsCount, 'count'>;

const FIELDS = [
  'appId',
  'name',
  'path',
  'detail',
  'utmSource',
  'utmMedium',
  'utmCampaign',
] as const;

const escapeLabel = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');

@Injectable()
export class SiteAnalyticsService {
  constructor(
    @Inject(SITE_ANALYTICS_STORE) private readonly store: SiteAnalyticsStore
  ) {}

  async record(input: SiteAnalyticsEventInput): Promise<void> {
    const event = this.normalize(input);
    const key = JSON.stringify(FIELDS.map((field) => event[field]));
    if (!(await this.store.increment(key, MAX_SITE_ANALYTICS_KEYS))) {
      throw new BadRequestException('Analytics capacity reached.');
    }
  }

  async summary(appId?: string): Promise<SiteAnalyticsCount[]> {
    const counts: SiteAnalyticsCount[] = [];
    for (const [key, count] of await this.store.entries()) {
      const entry = this.parse(key);
      if (entry && (!appId || entry.appId === appId)) {
        counts.push({ ...entry, count });
      }
    }
    return counts.sort((a, b) => b.count - a.count);
  }

  /** Prometheus exposition for the shared performance scrape endpoint. */
  async prometheus(): Promise<string> {
    const lines = [
      '# HELP ot_site_events_total Site analytics events by page and campaign.',
      '# TYPE ot_site_events_total counter',
    ];
    for (const entry of await this.summary()) {
      const labels = [
        ['app', entry.appId],
        ['event', entry.name],
        ['path', entry.path],
        ['detail', entry.detail ?? ''],
        ['utm_source', entry.utmSource ?? ''],
        ['utm_medium', entry.utmMedium ?? ''],
        ['utm_campaign', entry.utmCampaign ?? ''],
      ]
        .map(([name, value]) => `${name}="${escapeLabel(value)}"`)
        .join(',');
      lines.push(`ot_site_events_total{${labels}} ${entry.count}`);
    }
    return `${lines.join('\n')}\n`;
  }

  private parse(key: string): SiteAnalyticsKey | null {
    try {
      const values = JSON.parse(key) as Array<string | null>;
      if (!Array.isArray(values) || values.length !== FIELDS.length)
        return null;
      const entry = Object.fromEntries(
        FIELDS.map((field, index) => [field, values[index]])
      ) as unknown as SiteAnalyticsKey;
      return (SITE_ANALYTICS_EVENTS as readonly string[]).includes(entry.name)
        ? entry
        : null;
    } catch {
      return null;
    }
  }

  private normalize(
    input: SiteAnalyticsEventInput
  ): Omit<SiteAnalyticsCount, 'count'> {
    if (!input || typeof input !== 'object') {
      throw new BadRequestException('An analytics event is required.');
    }
    const appId = this.match(input.appId, APP_ID, 'appId');
    if (
      typeof input.name !== 'string' ||
      !(SITE_ANALYTICS_EVENTS as readonly string[]).includes(input.name)
    ) {
      throw new BadRequestException('Unknown analytics event.');
    }
    return {
      appId: appId as string,
      name: input.name as SiteAnalyticsEventName,
      path: this.match(input.path, PATH, 'path') as string,
      detail: this.optional(input.detail, DETAIL, 'detail'),
      utmSource: this.optional(input.utmSource, UTM, 'utmSource'),
      utmMedium: this.optional(input.utmMedium, UTM, 'utmMedium'),
      utmCampaign: this.optional(input.utmCampaign, UTM, 'utmCampaign'),
    };
  }

  private match(value: unknown, pattern: RegExp, name: string): string {
    if (typeof value !== 'string' || !pattern.test(value)) {
      throw new BadRequestException(`Invalid analytics ${name}.`);
    }
    return value;
  }

  private optional(
    value: unknown,
    pattern: RegExp,
    name: string
  ): string | null {
    if (value === undefined || value === null || value === '') return null;
    return this.match(value, pattern, name);
  }
}
