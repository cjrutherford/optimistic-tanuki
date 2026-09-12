import { Component, Input, OnInit } from '@angular/core';
import type { AppAccessPolicy } from '@optimistic-tanuki/app-config-models';
import {
  AppDiscoveryStore,
  type DiscoveredApp,
} from '@optimistic-tanuki/app-config-data-access';
import {
  DiscoveryCardComponent,
  DiscoveryRegionComponent,
  LandingHeaderComponent,
  LandingHeroComponent,
  LandingStatusComponent,
  type DiscoveryAction,
  type DiscoveryCard,
  type DiscoveryNavItem,
} from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'app-configurable-client-public-landing',
  standalone: true,
  imports: [
    DiscoveryCardComponent,
    DiscoveryRegionComponent,
    LandingHeaderComponent,
    LandingHeroComponent,
    LandingStatusComponent,
  ],
  template: `
    <div class="public-discovery-shell">
      <otui-public-landing-header
        brandLabel="Configurable Client"
        brandHref="/"
        [navItems]="navItems"
      >
        <a slot="actions" class="header-action" [href]="ownerAction.href">{{
          ownerAction.label
        }}</a>
      </otui-public-landing-header>

      <div
        class="value-proposition"
        aria-label="Who Configurable Client is for"
      >
        <span>Owners publish.</span>
        <span>Clients arrive.</span>
      </div>

      <otui-public-landing-hero
        eyebrow="A front door for every configured experience"
        heading="Build a client experience people can find."
        description="Owners publish a distinct client doorway. Clients open a shared link and get straight to the experience."
        [primaryAction]="primaryAction"
        [secondaryAction]="secondaryAction"
      >
        <div slot="visual" class="hero-visual" aria-hidden="true">
          <div class="hero-visual__topline">
            <span class="hero-visual__dot"></span>
            <span class="hero-visual__dot"></span>
            <span class="hero-visual__dot"></span>
            <span class="hero-visual__label">published / ready</span>
          </div>
          <div class="hero-visual__canvas">
            <span class="hero-visual__mark">CC</span>
            <span class="hero-visual__line hero-visual__line--long"></span>
            <span class="hero-visual__line hero-visual__line--short"></span>
            <span class="hero-visual__tile"></span>
            <span class="hero-visual__tile hero-visual__tile--accent"></span>
          </div>
          <p>One thoughtful shell. Many distinct experiences.</p>
        </div>
        <a slot="actions" class="hero-action" href="#how-it-works"
          >See how it works</a
        >
      </otui-public-landing-hero>

      <otui-public-discovery-region
        id="discoveries"
        eyebrow="Choose your doorway"
        heading="Start where you are."
        description="Owners sign in to shape and publish. Clients use a shared link—no account required to arrive."
      >
        <div class="path-grid">
          <div id="owners" class="path-card-anchor">
            <otui-public-discovery-card [item]="ownerCard" />
          </div>
          <div id="clients" class="path-card-anchor">
            <otui-public-discovery-card [item]="clientCard" />
          </div>
          <div class="path-card-anchor">
            <otui-public-discovery-card [item]="publishCard" />
          </div>
        </div>
      </otui-public-discovery-region>

      <otui-public-discovery-region
        id="published-apps"
        eyebrow="For clients"
        heading="Published experiences"
        description="Published links are for clients. This directory stays intentionally quiet until an experience is ready to invite people in."
      >
        <form class="published-app-search" (submit)="load($event)">
          <label for="published-app-search">
            Search published apps
            <input
              id="published-app-search"
              type="search"
              [value]="searchQuery"
              (input)="searchQuery = $any($event.target).value"
              placeholder="Search by name or description"
            />
          </label>
          <label for="published-app-policy">
            Access
            <select
              id="published-app-policy"
              [value]="selectedAccessPolicy"
              (change)="selectedAccessPolicy = $any($event.target).value"
            >
              <option value="">Any access</option>
              <option value="public">Public</option>
              <option value="joinable">Joinable</option>
              <option value="request-only">Request-only</option>
            </select>
          </label>
          <button class="published-app-search__submit" type="submit">
            Search
          </button>
        </form>

        @if (directoryState === 'loading') {
        <otui-landing-status
          class="published-app-status"
          [attr.aria-busy]="true"
          state="loading"
          headline="Loading published apps"
          body="Looking for experiences that are ready to share."
        />
        } @else if (directoryState === 'error') {
        <otui-landing-status
          class="published-app-status"
          state="error"
          headline="Published apps are unavailable"
          [body]="discovery.error() || 'Try again in a moment.'"
        >
          <button slot="actions" type="button" (click)="load()">
            Try again
          </button>
        </otui-landing-status>
        } @else if (!discovery.apps().length) {
        <otui-landing-status
          class="published-app-status"
          state="empty"
          headline="No published apps yet"
          body="Have a public app link? Open it directly. If you own an experience, sign in to publish and share its doorway."
        />
        } @else {
        <ul class="published-app-list" aria-label="Published experiences">
          @for (app of discovery.apps(); track app.appId) {
          <li>
            <otui-public-discovery-card [item]="discoveryCard(app)">
              <span slot="meta">{{ membershipMessage(app) }}</span>
              <ng-container slot="actions">
                @if (app.canOpen) {
                <a [href]="appHref(app)">Open app</a>
                } @else if (app.canJoin) { @if (signedIn) {
                <button
                  type="button"
                  [disabled]="discovery.actionInFlight(app.appId)"
                  (click)="join(app.appId)"
                >
                  {{
                    discovery.actionInFlight(app.appId) ? 'Joining…' : 'Join'
                  }}
                </button>
                } @else {
                <a href="/login?returnTo=%2F%23published-apps"
                  >Sign in to join</a
                >
                } } @else if (app.canRequest) { @if (signedIn) {
                <button
                  type="button"
                  [disabled]="discovery.actionInFlight(app.appId)"
                  (click)="request(app.appId)"
                >
                  {{
                    discovery.actionInFlight(app.appId)
                      ? 'Requesting…'
                      : 'Request access'
                  }}
                </button>
                } @else {
                <a href="/login?returnTo=%2F%23published-apps"
                  >Sign in to request access</a
                >
                } } @if (discovery.actionError(app.appId); as actionError) {
                <span class="published-app-action-error" role="alert">{{
                  actionError
                }}</span>
                }
              </ng-container>
            </otui-public-discovery-card>
          </li>
          }
        </ul>
        }
        <div class="region-action">
          <a href="#how-it-works">Learn how client discovery works</a>
          @if (demoAppHref) {
          <a [href]="demoAppHref">{{ demoAppLabel }}</a>
          } @else {
          <span class="demo-app-unavailable"
            >Preview unavailable until a workspace is selected</span
          >
          }
        </div>
      </otui-public-discovery-region>

      <section
        id="how-it-works"
        class="how-it-works"
        aria-labelledby="how-it-works-heading"
      >
        <div class="how-it-works__inner">
          <p class="section-eyebrow">A simple handoff</p>
          <h2 id="how-it-works-heading">From a workspace to a welcome.</h2>
          <div class="steps">
            <div class="step">
              <span class="step__number">01</span>
              <h3>Owners shape the surface</h3>
              <p>
                Configure the message, tone, and sections your clients should
                see first.
              </p>
            </div>
            <div class="step">
              <span class="step__number">02</span>
              <h3>Publishing creates the doorway</h3>
              <p>
                A published app has a stable public route that can be shared
                with the right people.
              </p>
            </div>
            <div class="step">
              <span class="step__number">03</span>
              <h3>Clients arrive with context</h3>
              <p>
                Clients land in the experience itself, without needing to
                understand the configuration behind it.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
  styleUrls: ['./configurable-client-public-landing.component.scss'],
})
export class ConfigurableClientPublicLandingComponent implements OnInit {
  @Input() signedIn = false;
  @Input() workspaceSlug: string | null = null;
  searchQuery = '';
  selectedAccessPolicy: AppAccessPolicy | '' = '';

  constructor(readonly discovery: AppDiscoveryStore) {}

  ngOnInit(): void {
    this.load();
  }

  get directoryState(): 'ready' | 'loading' | 'error' {
    if (this.discovery.loading()) return 'loading';
    return this.discovery.error() ? 'error' : 'ready';
  }

  load(event?: Event): void {
    event?.preventDefault();
    this.discovery.load(
      this.searchQuery.trim() || undefined,
      this.selectedAccessPolicy || undefined
    );
  }

  join(appId: string): void {
    this.discovery.join(appId);
  }

  request(appId: string): void {
    this.discovery.request(appId);
  }

  appHref(app: DiscoveredApp): string {
    return `/config/${encodeURIComponent(app.appId)}`;
  }

  discoveryCard(app: DiscoveredApp): DiscoveryCard {
    return {
      id: app.appId,
      eyebrow: this.accessPolicyLabel(app.accessPolicy),
      title: app.name,
      description: app.description,
      href: app.canOpen ? this.appHref(app) : undefined,
      meta: app.domain ? `Published at ${app.domain}` : undefined,
    };
  }

  membershipMessage(app: DiscoveredApp): string {
    if (app.membershipStatus === 'active') return 'Access granted';
    if (app.membershipStatus === 'pending') return 'Access request pending';
    if (app.membershipStatus === 'denied') return 'Access request denied';
    if (app.membershipStatus === 'suspended') return 'Access suspended';
    if (app.membershipStatus === 'revoked') return 'Access revoked';
    if (!app.canOpen && !app.canJoin && !app.canRequest) {
      return app.accessPolicy === 'private'
        ? 'Private · membership required'
        : 'Unavailable';
    }
    return this.accessPolicyLabel(app.accessPolicy);
  }

  private accessPolicyLabel(policy: AppAccessPolicy): string {
    return policy === 'request-only'
      ? 'Request-only'
      : `${policy.slice(0, 1).toUpperCase()}${policy.slice(1)}`;
  }

  get demoAppHref(): string | null {
    const slug = this.workspaceSlug?.trim();
    return slug
      ? `/app/demo-app?workspaceSlug=${encodeURIComponent(slug)}`
      : null;
  }

  readonly navItems: DiscoveryNavItem[] = [
    { label: 'Discover', href: '#discoveries', current: true },
    { label: 'For owners', href: '#owners' },
    { label: 'For clients', href: '#clients' },
  ];

  get ownerAction(): DiscoveryAction {
    return this.signedIn
      ? { label: 'Open owner workspace', href: '/owner' }
      : { label: 'Owner sign in', href: '/login?returnTo=%2Fowner' };
  }

  get primaryAction(): DiscoveryAction {
    return this.ownerAction;
  }

  get secondaryAction(): DiscoveryAction {
    return this.signedIn
      ? {
          label: 'Preview a client app',
          href: this.demoAppHref ?? '#published-apps',
        }
      : { label: 'Find a published app', href: '#discoveries' };
  }

  get demoAppLabel(): string {
    return this.signedIn ? 'Preview the demo' : 'Preview the demo (sign in)';
  }

  get ownerCard(): DiscoveryCard {
    return {
      id: 'owner-workspace',
      eyebrow: 'For owners',
      title: 'Shape your workspace experience',
      description:
        'Bring your message, visual personality, and client journey into one configurable public surface.',
      meta: 'Owner account required to publish',
      href: this.ownerAction.href,
      actionLabel: this.signedIn
        ? 'Open the owner workspace'
        : 'Sign in as an owner',
      featured: true,
    };
  }

  get clientCard(): DiscoveryCard {
    return {
      id: 'client-doorway',
      eyebrow: 'For clients',
      title: this.signedIn
        ? 'Preview a client doorway'
        : 'Open a shared client doorway',
      description:
        'Use the public link from an owner to arrive at the experience built for you—no configuration knowledge required.',
      meta: 'Shared link · no account required',
      href: '#published-apps',
      actionLabel: 'Use a shared link',
    };
  }

  readonly publishCard: DiscoveryCard = {
    id: 'published-surface',
    eyebrow: 'The handoff',
    title: 'Make the first impression yours',
    description:
      'A deliberate landing page gives every configured app a recognizable, accessible starting point.',
    meta: 'A published link is the handoff',
    href: '#how-it-works',
    actionLabel: 'See the three-step handoff',
  };
}
