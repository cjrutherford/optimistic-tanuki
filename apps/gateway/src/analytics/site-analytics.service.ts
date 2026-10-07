import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * First-party, aggregate-only site analytics (HAI S014).
 *
 * Each accepted event increments one counter keyed by app, event, page path,
 * an optional short detail, and the UTM campaign fields. Nothing about the
 * visitor is stored: no IP address, user agent, identifier, or timestamp per
 * event. Counts live in memory and reset when the gateway restarts.
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

@Injectable()
export class SiteAnalyticsService {
  private readonly counts = new Map<string, SiteAnalyticsCount>();

  record(input: SiteAnalyticsEventInput): SiteAnalyticsCount {
    const event = this.normalize(input);
    const key = JSON.stringify([
      event.appId,
      event.name,
      event.path,
      event.detail,
      event.utmSource,
      event.utmMedium,
      event.utmCampaign,
    ]);
    const existing = this.counts.get(key);
    if (existing) {
      existing.count += 1;
      return existing;
    }
    if (this.counts.size >= MAX_SITE_ANALYTICS_KEYS) {
      throw new BadRequestException('Analytics capacity reached.');
    }
    const created = { ...event, count: 1 };
    this.counts.set(key, created);
    return created;
  }

  summary(appId?: string): SiteAnalyticsCount[] {
    return [...this.counts.values()]
      .filter((entry) => !appId || entry.appId === appId)
      .map((entry) => ({ ...entry }))
      .sort((a, b) => b.count - a.count);
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
