import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Chassis,
  HardwareService,
  HardwareTier,
} from '../../services/hardware.service';
import { ConfiguratorStateService } from '../../state/configurator-state.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="landing-shell">
      <header class="hero">
        <div class="hero-copy">
          <p class="eyebrow">HAI Computer</p>
          <h1>
            Purpose-built systems for teams that need calm, durable compute.
          </h1>
          <p class="lede">
            Hovering Alien Invaders Computers designs integration-ready
            workstations, storage nodes, and deployment platforms with a tighter
            handoff from planning to purchase.
          </p>

          <div class="hero-actions">
            <button
              type="button"
              class="primary-action"
              (click)="jumpToSystems()"
            >
              Start a configuration
            </button>
            <div class="trust-strip">
              <span>Thermal-vetted chassis</span>
              <span>Field deployment guidance</span>
              <span>Assisted payment fulfillment</span>
            </div>
          </div>
        </div>

        <div class="hero-panel">
          <div class="hero-stack">
            <article>
              <span>Signal</span>
              <strong>HAI Build Queue</strong>
              <small>{{ chassisList().length }} active chassis families</small>
            </article>
            <article>
              <span>Orientation</span>
              <strong>Industrial teal identity</strong>
              <small>Fixed HAI personality with guided procurement flow</small>
            </article>
            <article>
              <span>Checkout model</span>
              <strong>Public configure, authenticated purchase</strong>
              <small>Inline profile gate before payment confirmation</small>
            </article>
          </div>
        </div>
      </header>

      <section class="commercial-section" aria-labelledby="tier-heading">
        <div class="section-header">
          <div>
            <p class="eyebrow">HAI system tiers</p>
            <h2 id="tier-heading">Start with a proven build</h2>
          </div>
          <p class="section-copy">
            Explore a tier, then configure the build around your workload. A HAI
            owner checks verified distributor offers and confirms pricing in a
            written quote valid for 30 days.
          </p>
        </div>

        <div class="empty-state" *ngIf="tiersLoading()" role="status">
          Loading HAI system tiers...
        </div>
        <div class="empty-state" *ngIf="tiersError()" role="alert">
          {{ tiersError() }}
        </div>
        <div
          class="empty-state"
          *ngIf="!tiersLoading() && !tiersError() && tiers().length === 0"
        >
          No HAI system tiers are available right now.
        </div>

        <div class="tier-grid" *ngIf="!tiersLoading() && tiers().length > 0">
          <article
            class="tier-card"
            *ngFor="let tier of tiers()"
            [attr.data-tier]="tier.id"
          >
            <div class="tier-heading">
              <span class="type-badge"
                >Tier {{ tier.tierNumber }} · {{ tier.formFactor }}</span
              >
              <h3>{{ tier.name }}</h3>
              <p>{{ tier.targetUsers }}</p>
            </div>
            <dl class="tier-specs">
              <div>
                <dt>Hardware</dt>
                <dd>{{ tier.hardware }}</dd>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>{{ tier.ram }}</dd>
              </div>
              <div>
                <dt>Storage</dt>
                <dd>{{ tier.storage }}</dd>
              </div>
              <div *ngIf="tier.aiAccelerator">
                <dt>AI accelerator</dt>
                <dd>{{ tier.aiAccelerator }}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{{ tier.network }}</dd>
              </div>
              <div>
                <dt>Power and protection</dt>
                <dd>{{ tier.powerAndProtection }}</dd>
              </div>
            </dl>
            <p class="quote-note">
              Firm pricing is confirmed by a HAI owner in a written 30-day
              quote.
            </p>
            <button
              type="button"
              class="tier-action"
              [disabled]="!chassisForTier(tier)"
              (click)="configureTier(tier)"
            >
              Explore this build
            </button>
          </article>
        </div>
      </section>

      <section class="preset-band">
        <article class="preset">
          <p>Edge + local AI</p>
          <strong>Dense quiet tower</strong>
          <span
            >For hybrid inference, content pipelines, and onsite
            operations.</span
          >
        </article>
        <article class="preset">
          <p>Storage anchor</p>
          <strong>NAS-first frame</strong>
          <span
            >For mirrored archives, backups, and media-heavy team
            workflows.</span
          >
        </article>
        <article class="preset">
          <p>Developer floor</p>
          <strong>Compile and test node</strong>
          <span
            >For CI staging, local orchestration, and durable dev
            environments.</span
          >
        </article>
      </section>

      <section class="systems-section" id="systems">
        <div class="section-header">
          <div>
            <p class="eyebrow">System families</p>
            <h2>Choose a chassis foundation</h2>
          </div>
          <p class="section-copy">
            Each HAI build begins with a chassis class tuned for a workload and
            physical footprint. Selection here seeds the full configuration
            draft.
          </p>
        </div>

        <div
          class="empty-state"
          *ngIf="!loading() && chassisList().length === 0"
        >
          No hardware families are available right now.
        </div>

        <div class="empty-state" *ngIf="errorMessage()">
          {{ errorMessage() }}
        </div>

        <div class="empty-state" *ngIf="loading()">
          Loading active hardware families...
        </div>

        <div
          class="systems-grid"
          *ngIf="!loading() && chassisList().length > 0"
        >
          <button
            *ngFor="let chassis of chassisList()"
            type="button"
            class="system-card"
            (click)="selectChassis(chassis)"
          >
            <div class="card-topline">
              <span class="type-badge">{{ chassis.type }}</span>
              <span class="use-case">{{ chassis.useCase }}</span>
            </div>

            <h3>{{ chassis.name }}</h3>
            <p class="description">{{ chassis.description }}</p>

            <dl class="spec-grid">
              <div>
                <dt>Form</dt>
                <dd>{{ chassis.specifications.formFactor }}</dd>
              </div>
              <div>
                <dt>Power</dt>
                <dd>{{ chassis.specifications.maxPower }}</dd>
              </div>
              <div>
                <dt>Acoustics</dt>
                <dd>{{ chassis.specifications.noiseLevel }}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{{ chassis.specifications.dimensions }}</dd>
              </div>
            </dl>

            <div class="card-footer">
              <div>
                <span class="price-label">Starting at</span>
                <strong>\${{ chassis.basePrice }}</strong>
              </div>
              <span class="card-cta">Configure</span>
            </div>
          </button>
        </div>
      </section>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .landing-shell {
        max-width: 1280px;
        margin: 0 auto;
        padding: 2rem;
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
        gap: 1.5rem;
        align-items: stretch;
      }

      .hero-copy,
      .hero-panel,
      .preset,
      .system-card,
      .tier-card {
        border: 1px solid rgba(207, 250, 244, 0.08);
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.05),
            rgba(255, 255, 255, 0.02)
          ),
          rgba(4, 12, 15, 0.8);
        backdrop-filter: blur(14px);
      }

      .hero-copy {
        padding: clamp(1.5rem, 3vw, 3rem);
        border-radius: 2rem;
        min-height: 30rem;
        display: grid;
        align-content: space-between;
        position: relative;
        overflow: hidden;
      }

      .hero-copy::after {
        content: '';
        position: absolute;
        inset: auto -10% -35% 25%;
        height: 18rem;
        background: radial-gradient(
          circle,
          rgba(45, 212, 191, 0.24),
          transparent 70%
        );
        pointer-events: none;
      }

      .eyebrow {
        margin: 0 0 1rem;
        text-transform: uppercase;
        letter-spacing: 0.22em;
        font-size: 0.75rem;
        color: #8be8db;
      }

      h1,
      h2,
      h3 {
        font-family: Georgia, 'Times New Roman', serif;
        line-height: 0.95;
        margin: 0;
      }

      h1 {
        max-width: 12ch;
        font-size: clamp(3.2rem, 8vw, 5.7rem);
      }

      .lede,
      .section-copy,
      .description,
      .preset span,
      .hero-stack small {
        color: rgba(235, 255, 251, 0.74);
        line-height: 1.6;
      }

      .hero-actions {
        display: grid;
        gap: 1rem;
      }

      .primary-action {
        width: fit-content;
        border: 0;
        border-radius: 999px;
        padding: 0.95rem 1.4rem;
        background: linear-gradient(135deg, #79f0e0, #2dd4bf);
        color: #041012;
        font-weight: 700;
        cursor: pointer;
      }

      .trust-strip {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .trust-strip span {
        border: 1px solid rgba(121, 240, 224, 0.14);
        border-radius: 999px;
        padding: 0.45rem 0.75rem;
        color: #b3f7ee;
        background: rgba(121, 240, 224, 0.06);
        font-size: 0.85rem;
      }

      .hero-panel {
        border-radius: 2rem;
        padding: 1.25rem;
      }

      .hero-stack {
        height: 100%;
        display: grid;
        gap: 1rem;
      }

      .hero-stack article {
        border-radius: 1.5rem;
        padding: 1.1rem;
        background: linear-gradient(
            135deg,
            rgba(45, 212, 191, 0.12),
            transparent 50%
          ),
          rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }

      .hero-stack span,
      .preset p,
      .price-label,
      .type-badge,
      .use-case,
      dt {
        display: block;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.72rem;
        color: rgba(139, 232, 219, 0.72);
      }

      .hero-stack strong,
      .preset strong,
      .card-footer strong {
        display: block;
        margin: 0.35rem 0;
        font-size: 1.15rem;
      }

      .preset-band {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
        margin: 1.25rem 0 2.25rem;
      }

      .preset {
        border-radius: 1.5rem;
        padding: 1.25rem;
      }

      .systems-section {
        display: grid;
        gap: 1.5rem;
      }

      .commercial-section {
        display: grid;
        gap: 1.25rem;
        margin: 0 0 2.5rem;
        scroll-margin-top: 1.5rem;
      }

      .tier-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 1rem;
        align-items: stretch;
      }

      .tier-card {
        min-width: 0;
        display: flex;
        flex-direction: column;
        border-radius: 1.75rem;
        padding: 1.4rem;
      }

      .tier-heading h3 {
        font-size: clamp(1.55rem, 2.4vw, 2rem);
        line-height: 1.05;
        margin: 0.85rem 0 0.55rem;
      }

      .tier-heading p {
        color: rgba(235, 255, 251, 0.74);
        margin: 0;
      }

      .tier-specs {
        display: grid;
        gap: 0.9rem;
        margin: 1.25rem 0;
      }

      .tier-specs dd {
        line-height: 1.45;
        overflow-wrap: anywhere;
      }

      .quote-note {
        margin: auto 0 1rem;
        padding-top: 1rem;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(235, 255, 251, 0.74);
        line-height: 1.55;
      }

      .tier-action {
        width: 100%;
        border: 1px solid rgba(121, 240, 224, 0.28);
        border-radius: 999px;
        padding: 0.85rem 1.1rem;
        background: rgba(45, 212, 191, 0.12);
        color: #b3f7ee;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      .tier-action:hover:not(:disabled),
      .tier-action:focus-visible {
        background: linear-gradient(135deg, #79f0e0, #2dd4bf);
        color: #041012;
      }

      .tier-action:focus-visible {
        outline: 3px solid #eefcf9;
        outline-offset: 3px;
      }

      .tier-action:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .section-header {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) minmax(260px, 0.6fr);
        gap: 1rem;
        align-items: end;
      }

      .systems-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
        gap: 1rem;
      }

      .system-card {
        border-radius: 1.75rem;
        padding: 1.3rem;
        color: inherit;
        text-align: left;
        cursor: pointer;
        transition: transform 180ms ease, border-color 180ms ease,
          box-shadow 180ms ease;
      }

      .system-card:hover {
        transform: translateY(-4px);
        border-color: rgba(121, 240, 224, 0.24);
        box-shadow: 0 22px 55px rgba(0, 0, 0, 0.28);
      }

      .card-topline {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }

      .type-badge {
        width: fit-content;
        padding: 0.38rem 0.55rem;
        border-radius: 999px;
        border: 1px solid rgba(121, 240, 224, 0.18);
        background: rgba(45, 212, 191, 0.08);
      }

      .use-case {
        color: #eefcf9;
      }

      .system-card h3 {
        font-size: 2rem;
        margin-bottom: 0.65rem;
      }

      .spec-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.9rem;
        margin: 1.3rem 0;
      }

      dd {
        margin: 0.3rem 0 0;
        color: #eefcf9;
      }

      .card-footer {
        display: flex;
        justify-content: space-between;
        align-items: end;
        gap: 1rem;
      }

      .card-cta {
        color: #79f0e0;
        font-weight: 700;
      }

      .empty-state {
        border: 1px dashed rgba(255, 255, 255, 0.18);
        border-radius: 1.25rem;
        padding: 2rem;
        color: rgba(235, 255, 251, 0.74);
      }

      @media (max-width: 980px) {
        .hero,
        .section-header,
        .preset-band,
        .tier-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .landing-shell {
          padding: 1rem;
        }

        .spec-grid {
          grid-template-columns: 1fr;
        }

        .card-footer {
          align-items: start;
          flex-direction: column;
        }
      }
    `,
  ],
})
export class LandingComponent implements OnInit {
  private readonly hardwareService = inject(HardwareService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly configuratorState = inject(ConfiguratorStateService);
  private readonly document = inject(DOCUMENT);

  readonly chassisList = signal<Chassis[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly tiers = signal<HardwareTier[]>([]);
  readonly tiersLoading = signal(true);
  readonly tiersError = signal('');

  ngOnInit(): void {
    this.hardwareService.getTiers().subscribe({
      next: (tiers) => {
        this.tiers.set(tiers);
        this.tiersError.set('');
        this.tiersLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to load HAI tiers', error);
        this.tiersError.set(
          'HAI system tiers are unavailable right now. Please retry shortly.'
        );
        this.tiersLoading.set(false);
      },
    });

    this.hardwareService.getChassis().subscribe({
      next: (chassis) => {
        const active = chassis.filter((item) => item.isActive);
        this.chassisList.set(active);
        this.errorMessage.set('');
        this.loading.set(false);

        const preset = this.route.snapshot.queryParamMap.get('preset');
        if (preset) {
          const target = this.findChassisByPreset(active, preset);
          if (target) {
            this.selectChassis(target, preset);
          }
        }
      },
      error: (error) => {
        console.error('Failed to load chassis', error);
        this.errorMessage.set(
          'The HAI catalog is currently unavailable. Please retry in a moment.'
        );
        this.loading.set(false);
      },
    });
  }

  private findChassisByPreset(
    list: Chassis[],
    preset: string
  ): Chassis | undefined {
    const normalized = preset.toLowerCase();
    if (normalized === 'tier1') {
      return (
        list.find((c) => c.id === 's-cloud') || list.find((c) => c.type === 'S')
      );
    }
    if (normalized === 'tier2') {
      return (
        list.find((c) => c.id === 'm-cloud') ||
        list.find((c) => c.id === 'l-cloud') ||
        list.find((c) => c.type === 'M')
      );
    }
    if (normalized === 'tier3') {
      return (
        list.find((c) => c.id === 'l-nas') ||
        list.find((c) => c.id === 'l-cloud') ||
        list.find((c) => c.type === 'L')
      );
    }
    return list.find((c) => c.id === preset);
  }

  jumpToSystems(): void {
    this.document
      .getElementById('systems')
      ?.scrollIntoView({ behavior: 'smooth' });
  }

  chassisForTier(tier: HardwareTier): Chassis | undefined {
    return this.findChassisByPreset(
      this.chassisList(),
      tier.configuratorPreset
    );
  }

  configureTier(tier: HardwareTier): void {
    const chassis = this.chassisForTier(tier);
    if (chassis) {
      this.selectChassis(chassis, tier.configuratorPreset);
    }
  }

  selectChassis(chassis: Chassis, preset?: string): void {
    this.configuratorState.setDraft({
      chassisId: chassis.id,
      chassisType: chassis.type,
      useCase: chassis.useCase,
      cpuId: '',
      ramId: '',
      storageIds: [],
      gpuId: '',
    });
    this.configuratorState.setPriceBreakdown(null);
    if (preset) {
      this.router.navigate(['/configure', chassis.id], {
        queryParams: { preset },
      });
    } else {
      this.router.navigate(['/configure', chassis.id]);
    }
  }
}
