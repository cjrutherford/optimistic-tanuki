import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  DestroyRef,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  inject,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/**
 * Privacy-conscious analytics for the HAI site (S014).
 *
 * Sends aggregate-friendly events to the first-party gateway endpoint
 * `/api/analytics/events`. No cookies, identifiers, free text, or personal
 * data: an event is a name, the page path, an optional fixed detail, and the
 * visitor's campaign (UTM) values. Visitors with Global Privacy Control or Do
 * Not Track enabled send nothing.
 */

export type AnalyticsEventName =
  | 'page_view'
  | 'cta_click'
  | 'audience_interest'
  | 'assessment_start'
  | 'assessment_submit'
  | 'phone_click'
  | 'email_click';

export interface Campaign {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}

export interface AnalyticsEvent extends Campaign {
  appId: 'hai';
  name: AnalyticsEventName;
  path: string;
  detail?: string;
}

export type AnalyticsTransport = (event: AnalyticsEvent) => void;

export const ANALYTICS_ENDPOINT = '/api/analytics/events';
const CAMPAIGN_KEY = 'hai.campaign';
const UTM_VALUE = /^[a-z0-9_.-]{1,64}$/;

/** Sends one event without delaying navigation. */
export const ANALYTICS_TRANSPORT = new InjectionToken<AnalyticsTransport>(
  'ANALYTICS_TRANSPORT',
  {
    providedIn: 'root',
    factory: () => (event: AnalyticsEvent) => {
      const body = JSON.stringify(event);
      if (typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon(
          ANALYTICS_ENDPOINT,
          new Blob([body], { type: 'application/json' })
        );
        return;
      }
      if (typeof fetch !== 'function') return;
      void fetch(ANALYTICS_ENDPOINT, {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'content-type': 'application/json' },
      }).catch(() => undefined);
    },
  }
);

/** Links whose clicks count as calls to action, keyed by route. */
const CTA_ROUTES: Record<string, string> = {
  '/contact': 'contact',
  '/private-cloud/assessment': 'assessment',
};

const AUDIENCE_ROUTES: Record<string, string> = {
  '/private-cloud/home': 'home',
  '/private-cloud/organizations': 'organization',
};

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private readonly router = inject(Router);
  private readonly transport = inject(ANALYTICS_TRANSPORT);
  private readonly destroyRef = inject(DestroyRef);

  private started = false;
  private readonly once = new Set<string>();

  /** Begins tracking page views and link clicks. Browser only; idempotent. */
  start(): void {
    if (this.started || !isPlatformBrowser(this.platformId)) return;
    this.started = true;
    this.captureCampaign(this.document.defaultView?.location.search ?? '');

    // Every navigation, including the first, ends with NavigationEnd; tracking
    // here too would count the pre-navigation URL ("/") as a visit.
    const subscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.once.delete('assessment_start');
        this.track('page_view');
      });
    const onClick = (event: MouseEvent) => this.onClick(event);
    this.document.addEventListener('click', onClick, true);
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      this.document.removeEventListener('click', onClick, true);
    });
  }

  /** Records an event at most once until the next navigation. */
  trackOnce(name: AnalyticsEventName, detail?: string): void {
    if (this.once.has(name)) return;
    this.once.add(name);
    this.track(name, detail);
  }

  track(name: AnalyticsEventName, detail?: string): void {
    if (!isPlatformBrowser(this.platformId) || this.optedOut()) return;
    this.transport({
      appId: 'hai',
      name,
      path: this.currentPath(),
      ...(detail ? { detail } : {}),
      ...this.campaign(),
    });
  }

  /** The visitor's campaign for this session, if they arrived from one. */
  campaign(): Campaign {
    if (!isPlatformBrowser(this.platformId)) return {};
    try {
      const stored =
        this.document.defaultView?.sessionStorage.getItem(CAMPAIGN_KEY);
      return stored ? (JSON.parse(stored) as Campaign) : {};
    } catch {
      return {};
    }
  }

  /** `?utm_source=…` for lead attribution, or an empty string. */
  campaignQuery(): string {
    const campaign = this.campaign();
    const params = new URLSearchParams();
    if (campaign.utmSource) params.set('utm_source', campaign.utmSource);
    if (campaign.utmMedium) params.set('utm_medium', campaign.utmMedium);
    if (campaign.utmCampaign) params.set('utm_campaign', campaign.utmCampaign);
    const query = params.toString();
    return query ? `?${query}` : '';
  }

  /** Stores UTM values from a landing URL for the rest of the session. */
  captureCampaign(search: string): void {
    const params = new URLSearchParams(search);
    const clean = (key: string) => {
      const value = (params.get(key) ?? '').trim().toLowerCase();
      return UTM_VALUE.test(value) ? value : undefined;
    };
    const campaign: Campaign = {
      utmSource: clean('utm_source'),
      utmMedium: clean('utm_medium'),
      utmCampaign: clean('utm_campaign'),
    };
    if (!campaign.utmSource && !campaign.utmMedium && !campaign.utmCampaign) {
      return;
    }
    try {
      this.document.defaultView?.sessionStorage.setItem(
        CAMPAIGN_KEY,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(campaign).filter(([, value]) => value)
          )
        )
      );
    } catch {
      // Storage can be unavailable (private modes); campaigns are optional.
    }
  }

  private onClick(event: MouseEvent): void {
    const link = (event.target as Element | null)?.closest?.('a');
    const href = link?.getAttribute('href');
    if (!href) return;
    if (href.startsWith('tel:')) return this.track('phone_click');
    if (href.startsWith('mailto:')) return this.track('email_click');
    const path = href.split(/[?#]/)[0];
    if (CTA_ROUTES[path]) return this.track('cta_click', CTA_ROUTES[path]);
    if (AUDIENCE_ROUTES[path]) {
      return this.track('audience_interest', AUDIENCE_ROUTES[path]);
    }
  }

  private currentPath(): string {
    const path = (this.router.url || '/').split(/[?#]/)[0].toLowerCase();
    return /^\/[a-z0-9/-]{0,119}$/.test(path) ? path : '/';
  }

  private optedOut(): boolean {
    const nav = this.document.defaultView?.navigator as
      | (Navigator & { globalPrivacyControl?: boolean })
      | undefined;
    return nav?.globalPrivacyControl === true || nav?.doNotTrack === '1';
  }
}
