import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  Chassis,
  CompatibleComponents,
  Component as HardwareComponent,
  HardwareService,
  PriceBreakdown,
} from '../../services/hardware.service';
import { ConfiguratorStateService } from '../../state/configurator-state.service';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="review-shell" *ngIf="draft() as build; else missingDraft">
      <header class="review-header">
        <button type="button" class="back-link" (click)="goBack()">Back to build bench</button>
        <div class="review-headline">
          <div>
            <p class="eyebrow">HAI Preflight</p>
            <h1>Review your system before checkout</h1>
          </div>
          <p>
            This is the handoff view the HAI team uses before the order enters
            payment orchestration and profile-linked fulfillment.
          </p>
        </div>
      </header>

      <div class="review-layout" *ngIf="chassis() && compatible()">
        <div class="overview-stack">
          <section class="overview-card">
            <p class="eyebrow">Foundation</p>
            <h2>{{ chassis()!.name }}</h2>
            <p>{{ chassis()!.description }}</p>
          </section>

          <section class="detail-grid">
            <article class="detail-card">
              <p class="eyebrow">Processor</p>
              <strong>{{ selectedName(compatible()!.cpu, build.cpuId) }}</strong>
              <span>{{ selectedSpecs(compatible()!.cpu, build.cpuId) }}</span>
            </article>
            <article class="detail-card">
              <p class="eyebrow">Memory</p>
              <strong>{{ selectedName(compatible()!.ram, build.ramId) }}</strong>
              <span>{{ selectedSpecs(compatible()!.ram, build.ramId) }}</span>
            </article>
            <article class="detail-card">
              <p class="eyebrow">Storage</p>
              <strong>{{ storageNames() }}</strong>
              <span>{{ storageSpecs() }}</span>
            </article>
            <article class="detail-card">
              <p class="eyebrow">Graphics</p>
              <strong>{{ selectedName(compatible()!.gpu, build.gpuId || '') || 'Integrated / none' }}</strong>
              <span>{{ selectedSpecs(compatible()!.gpu, build.gpuId || '') || 'No discrete accelerator selected.' }}</span>
            </article>
          </section>
        </div>

        <aside class="price-card" *ngIf="price() as totals">
          <p class="eyebrow">Costed summary</p>
          <h2>Estimated order total</h2>

          <div class="price-row">
            <span>Chassis</span>
            <strong>\${{ totals.chassisPrice }}</strong>
          </div>
          <div class="price-row">
            <span>CPU</span>
            <strong>\${{ totals.cpuPrice }}</strong>
          </div>
          <div class="price-row">
            <span>RAM</span>
            <strong>\${{ totals.ramPrice }}</strong>
          </div>
          <div class="price-row">
            <span>Storage</span>
            <strong>\${{ totals.storagePrice }}</strong>
          </div>
          <div class="price-row" *ngIf="totals.gpuPrice > 0">
            <span>GPU</span>
            <strong>\${{ totals.gpuPrice }}</strong>
          </div>
          <div class="price-row">
            <span>Assembly</span>
            <strong>\${{ totals.assemblyFee }}</strong>
          </div>
          <div class="price-row total">
            <span>Total</span>
            <strong>\${{ totals.totalPrice }}</strong>
          </div>

          <button type="button" class="checkout-action" (click)="goToCheckout()">
            Continue to checkout
          </button>
        </aside>
      </div>
    </section>

    <ng-template #missingDraft>
      <section class="review-shell">
        <section class="overview-card">
          <p class="eyebrow">HAI Preflight</p>
          <h2>Build draft unavailable</h2>
          <p>{{ errorMessage() || 'Select a chassis and components before opening review.' }}</p>
        </section>
      </section>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .review-shell {
        max-width: 1280px;
        margin: 0 auto;
        padding: 1.5rem 2rem 2rem;
      }

      .review-header,
      .overview-card,
      .detail-card,
      .price-card {
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 1.8rem;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015)),
          rgba(4, 12, 15, 0.78);
      }

      .review-header {
        padding: 1.25rem;
        margin-bottom: 1.5rem;
      }

      .back-link {
        border: 0;
        background: transparent;
        color: #97f5e7;
        padding: 0;
        cursor: pointer;
      }

      .review-headline {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 320px;
        gap: 1rem;
        margin-top: 1rem;
        align-items: end;
      }

      .eyebrow {
        margin: 0 0 0.45rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.74rem;
        color: #92efe2;
      }

      h1,
      h2 {
        margin: 0;
        font-family: Georgia, 'Times New Roman', serif;
      }

      h1 {
        font-size: clamp(2.3rem, 6vw, 4rem);
      }

      .review-header p,
      .overview-card p,
      .detail-card span {
        color: rgba(235, 255, 251, 0.72);
        line-height: 1.6;
      }

      .review-layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 340px;
        gap: 1.5rem;
      }

      .overview-stack {
        display: grid;
        gap: 1rem;
      }

      .overview-card {
        padding: 1.3rem;
      }

      .overview-card h2 {
        font-size: 2.2rem;
        margin-bottom: 0.6rem;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .detail-card,
      .price-card {
        padding: 1.2rem;
      }

      .detail-card strong,
      .price-row strong,
      .total strong {
        display: block;
        font-size: 1.05rem;
      }

      .price-card {
        height: fit-content;
        position: sticky;
        top: 6.5rem;
      }

      .price-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 0.8rem 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .price-row.total {
        border-bottom: 0;
      }

      .price-row span {
        color: rgba(235, 255, 251, 0.72);
      }

      .price-row.total strong {
        font-size: 1.7rem;
        color: #79f0e0;
      }

      .checkout-action {
        width: 100%;
        margin-top: 1rem;
        border: 0;
        border-radius: 999px;
        padding: 1rem 1.2rem;
        background: linear-gradient(135deg, #79f0e0, #2dd4bf);
        color: #031011;
        font-weight: 700;
        cursor: pointer;
      }

      @media (max-width: 980px) {
        .review-headline,
        .review-layout,
        .detail-grid {
          grid-template-columns: 1fr;
        }

        .price-card {
          position: static;
        }
      }

      @media (max-width: 640px) {
        .review-shell {
          padding: 1rem;
        }
      }
    `,
  ],
})
export class ReviewComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly hardwareService = inject(HardwareService);
  private readonly configuratorState = inject(ConfiguratorStateService);

  readonly draft = computed(() => this.configuratorState.draft());
  readonly price = signal<PriceBreakdown | null>(this.configuratorState.priceBreakdown());
  readonly chassis = signal<Chassis | null>(null);
  readonly compatible = signal<CompatibleComponents | null>(null);
  readonly errorMessage = signal('');

  ngOnInit(): void {
    const draft = this.draft();
    if (!draft) {
      this.router.navigate(['/']);
      return;
    }

    this.hardwareService.getChassisById(draft.chassisId).subscribe({
      next: (chassis) => {
        this.chassis.set(chassis);
        this.errorMessage.set('');
      },
      error: () =>
        this.errorMessage.set(
          'The selected chassis could not be loaded for review.'
        ),
    });

    this.hardwareService.getCompatibleComponents(draft.chassisId).subscribe({
      next: (compatible) => this.compatible.set(compatible),
      error: () =>
        this.errorMessage.set(
          'Compatibility data is unavailable for this build.'
        ),
    });

    if (!this.price()) {
      this.hardwareService.calculatePrice(draft).subscribe({
        next: (price) => {
          this.price.set(price);
          this.configuratorState.setPriceBreakdown(price);
        },
        error: () =>
          this.errorMessage.set(
            'Live pricing could not be refreshed for this build.'
          ),
      });
    }
  }

  goBack(): void {
    const chassisId = this.draft()?.chassisId;
    this.router.navigate(chassisId ? ['/configure', chassisId] : ['/']);
  }

  goToCheckout(): void {
    if (!this.price()) {
      return;
    }
    this.router.navigate(['/checkout']);
  }

  selectedName(items: HardwareComponent[], id: string): string {
    return items.find((item) => item.id === id)?.name || '';
  }

  selectedSpecs(items: HardwareComponent[], id: string): string {
    const selected = items.find((item) => item.id === id);
    if (!selected) {
      return '';
    }

    return Object.values(selected.specs).join(' · ');
  }

  storageNames(): string {
    const compatible = this.compatible();
    const draft = this.draft();
    if (!compatible || !draft) {
      return '';
    }

    return compatible.storage
      .filter((item) => draft.storageIds.includes(item.id))
      .map((item) => item.name)
      .join(', ');
  }

  storageSpecs(): string {
    const compatible = this.compatible();
    const draft = this.draft();
    if (!compatible || !draft) {
      return '';
    }

    return compatible.storage
      .filter((item) => draft.storageIds.includes(item.id))
      .map((item) => `${item.specs['capacity']} ${item.specs['type']}`)
      .join(' · ');
  }
}
