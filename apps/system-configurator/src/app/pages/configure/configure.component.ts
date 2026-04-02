import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  Chassis,
  CompatibleComponents,
  Component as HardwareComponent,
  HardwareService,
  PriceBreakdown,
} from '../../services/hardware.service';
import { ConfiguratorStateService } from '../../state/configurator-state.service';

@Component({
  selector: 'app-configure',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="configure-shell" *ngIf="chassis() as selectedChassis; else configureState">
      <header class="configure-header">
        <button type="button" class="back-link" (click)="goBack()">Back to systems</button>

        <div class="header-grid">
          <div class="headline">
            <p class="eyebrow">HAI Build Bench</p>
            <h1>{{ selectedChassis.name }}</h1>
            <p class="intro">{{ selectedChassis.description }}</p>
          </div>

          <aside class="build-meta">
            <div>
              <span>Profile</span>
              <strong>{{ selectedChassis.type }} / {{ selectedChassis.useCase }}</strong>
            </div>
            <div>
              <span>Envelope</span>
              <strong>{{ selectedChassis.specifications.formFactor }}</strong>
            </div>
            <div>
              <span>Power</span>
              <strong>{{ selectedChassis.specifications.maxPower }}</strong>
            </div>
          </aside>
        </div>
      </header>

      <div class="configure-layout" *ngIf="compatible() as parts">
        <div class="selection-stack">
          <section class="selection-group">
            <div class="section-heading">
              <p class="eyebrow">Compute</p>
              <h2>Choose the processor core</h2>
            </div>

            <div class="option-grid">
              <button
                *ngFor="let cpu of parts.cpu"
                type="button"
                class="option-card"
                [class.active]="draft().cpuId === cpu.id"
                (click)="selectSingle('cpuId', cpu.id)"
              >
                <span class="option-type">CPU</span>
                <strong>{{ cpu.name }}</strong>
                <small>{{ cpu.specs['cores'] }} cores · {{ cpu.specs['frequency'] }}</small>
                <em>\${{ cpu.sellingPrice }}</em>
              </button>
            </div>
          </section>

          <section class="selection-group">
            <div class="section-heading">
              <p class="eyebrow">Memory</p>
              <h2>Set the working memory floor</h2>
            </div>

            <div class="option-grid">
              <button
                *ngFor="let ram of parts.ram"
                type="button"
                class="option-card"
                [class.active]="draft().ramId === ram.id"
                (click)="selectSingle('ramId', ram.id)"
              >
                <span class="option-type">RAM</span>
                <strong>{{ ram.name }}</strong>
                <small>{{ ram.specs['capacity'] }} · {{ ram.specs['speed'] }}</small>
                <em>\${{ ram.sellingPrice }}</em>
              </button>
            </div>
          </section>

          <section class="selection-group">
            <div class="section-heading">
              <p class="eyebrow">Storage</p>
              <h2>Layer primary and secondary storage</h2>
            </div>

            <div class="option-grid">
              <button
                *ngFor="let storage of parts.storage"
                type="button"
                class="option-card"
                [class.active]="draft().storageIds.includes(storage.id)"
                (click)="toggleStorage(storage.id)"
              >
                <span class="option-type">Storage</span>
                <strong>{{ storage.name }}</strong>
                <small>{{ storage.specs['capacity'] }} · {{ storage.specs['type'] }}</small>
                <em>\${{ storage.sellingPrice }}</em>
              </button>
            </div>
          </section>

          <section class="selection-group">
            <div class="section-heading">
              <p class="eyebrow">Graphics</p>
              <h2>Optional acceleration</h2>
            </div>

            <div class="option-grid">
              <button
                *ngFor="let gpu of parts.gpu"
                type="button"
                class="option-card"
                [class.active]="draft().gpuId === gpu.id"
                (click)="selectGpu(gpu.id)"
              >
                <span class="option-type">GPU</span>
                <strong>{{ gpu.name }}</strong>
                <small>{{ gpu.specs['vram'] || 'Shared' }} VRAM</small>
                <em>{{ gpu.sellingPrice > 0 ? '$' + gpu.sellingPrice : 'Included' }}</em>
              </button>
            </div>
          </section>
        </div>

        <aside class="summary-card">
          <p class="eyebrow">Current build</p>
          <h2>HAI configuration summary</h2>

          <div class="summary-list">
            <div>
              <span>Chassis</span>
              <strong>{{ selectedChassis.name }}</strong>
            </div>
            <div>
              <span>CPU</span>
              <strong>{{ selectedName(parts.cpu, draft().cpuId) || 'Select one' }}</strong>
            </div>
            <div>
              <span>RAM</span>
              <strong>{{ selectedName(parts.ram, draft().ramId) || 'Select one' }}</strong>
            </div>
            <div>
              <span>Storage</span>
              <strong>{{ storageSummary(parts.storage) }}</strong>
            </div>
            <div>
              <span>GPU</span>
              <strong>{{ selectedName(parts.gpu, draft().gpuId || '') || 'Integrated / none' }}</strong>
            </div>
          </div>

          <div class="price-panel" *ngIf="price() as currentPrice">
            <div>
              <span>Estimated total</span>
              <strong>\${{ currentPrice.totalPrice }}</strong>
            </div>
            <small>Includes assembly guidance and current component pricing.</small>
          </div>

          <button
            type="button"
            class="continue-action"
            [disabled]="!isValid()"
            (click)="goToReview()"
          >
            Continue to review
          </button>
        </aside>
      </div>
    </section>

    <ng-template #configureState>
      <section class="configure-shell">
        <aside class="summary-card">
          <p class="eyebrow">HAI Build Bench</p>
          <h2>{{ loading() ? 'Loading build options...' : 'Configuration unavailable' }}</h2>
          <p>{{ errorMessage() || 'Preparing the selected chassis and compatibility data.' }}</p>
        </aside>
      </section>
    </ng-template>
  `,
  styles: [
    `
      :host {
        display: block;
      }

      .configure-shell {
        max-width: 1280px;
        margin: 0 auto;
        padding: 1.5rem 2rem 2rem;
      }

      .back-link,
      .continue-action,
      .option-card {
        cursor: pointer;
      }

      .configure-header,
      .selection-group,
      .summary-card {
        border: 1px solid rgba(255, 255, 255, 0.08);
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015)),
          rgba(4, 12, 15, 0.78);
      }

      .configure-header {
        border-radius: 2rem;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
      }

      .back-link {
        border: 0;
        background: transparent;
        color: #97f5e7;
        padding: 0;
        margin-bottom: 1.1rem;
      }

      .header-grid,
      .configure-layout {
        display: grid;
        gap: 1.5rem;
      }

      .header-grid {
        grid-template-columns: minmax(0, 1fr) 320px;
        align-items: end;
      }

      .headline h1,
      .section-heading h2,
      .summary-card h2 {
        font-family: Georgia, 'Times New Roman', serif;
        margin: 0;
      }

      .headline h1 {
        font-size: clamp(2.6rem, 7vw, 4.4rem);
      }

      .eyebrow {
        margin: 0 0 0.5rem;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        font-size: 0.74rem;
        color: #92efe2;
      }

      .intro {
        max-width: 60ch;
        color: rgba(235, 255, 251, 0.72);
        line-height: 1.6;
      }

      .build-meta {
        display: grid;
        gap: 0.8rem;
      }

      .build-meta div,
      .summary-list div,
      .price-panel {
        border-radius: 1.25rem;
        padding: 0.95rem 1rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.03);
      }

      .build-meta span,
      .summary-list span,
      .price-panel span,
      .option-type {
        display: block;
        margin-bottom: 0.3rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
        font-size: 0.68rem;
        color: rgba(146, 239, 226, 0.72);
      }

      .configure-layout {
        grid-template-columns: minmax(0, 1fr) 340px;
        align-items: start;
      }

      .selection-stack {
        display: grid;
        gap: 1rem;
      }

      .selection-group,
      .summary-card {
        border-radius: 1.75rem;
        padding: 1.2rem;
      }

      .option-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 0.9rem;
        margin-top: 1rem;
      }

      .option-card {
        text-align: left;
        color: inherit;
        border-radius: 1.35rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background:
          linear-gradient(135deg, rgba(45, 212, 191, 0.07), transparent 55%),
          rgba(255, 255, 255, 0.03);
        padding: 1rem;
        display: grid;
        gap: 0.3rem;
        transition:
          transform 160ms ease,
          border-color 160ms ease,
          box-shadow 160ms ease;
      }

      .option-card:hover,
      .option-card.active {
        transform: translateY(-2px);
        border-color: rgba(121, 240, 224, 0.28);
        box-shadow: inset 0 0 0 1px rgba(121, 240, 224, 0.18);
      }

      .option-card strong,
      .summary-list strong,
      .price-panel strong {
        font-size: 1.02rem;
      }

      .option-card small {
        color: rgba(235, 255, 251, 0.72);
      }

      .option-card em {
        margin-top: 0.35rem;
        font-style: normal;
        color: #79f0e0;
        font-weight: 700;
      }

      .summary-card {
        position: sticky;
        top: 6.5rem;
        display: grid;
        gap: 1rem;
      }

      .summary-list {
        display: grid;
        gap: 0.75rem;
      }

      .price-panel strong {
        display: block;
        font-size: 1.8rem;
        margin-top: 0.1rem;
      }

      .price-panel small {
        display: block;
        margin-top: 0.5rem;
        color: rgba(235, 255, 251, 0.7);
        line-height: 1.5;
      }

      .continue-action {
        border: 0;
        border-radius: 999px;
        padding: 1rem 1.2rem;
        background: linear-gradient(135deg, #79f0e0, #2dd4bf);
        color: #031011;
        font-weight: 700;
      }

      .continue-action:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      @media (max-width: 980px) {
        .header-grid,
        .configure-layout {
          grid-template-columns: 1fr;
        }

        .summary-card {
          position: static;
        }
      }

      @media (max-width: 640px) {
        .configure-shell {
          padding: 1rem;
        }
      }
    `,
  ],
})
export class ConfigureComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly hardwareService = inject(HardwareService);
  private readonly configuratorState = inject(ConfiguratorStateService);

  readonly chassis = signal<Chassis | null>(null);
  readonly compatible = signal<CompatibleComponents | null>(null);
  readonly price = signal<PriceBreakdown | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly draft = computed(
    () =>
      this.configuratorState.draft() || {
        chassisId: '',
        chassisType: '',
        useCase: '',
        cpuId: '',
        ramId: '',
        storageIds: [],
        gpuId: '',
      }
  );

  ngOnInit(): void {
    const chassisId = this.route.snapshot.paramMap.get('chassisId');
    if (!chassisId) {
      this.router.navigate(['/']);
      return;
    }

    this.hardwareService.getChassisById(chassisId).subscribe({
      next: (chassis) => {
        this.chassis.set(chassis);
        this.errorMessage.set('');
        this.configuratorState.patchDraft({
          chassisId: chassis.id,
          chassisType: chassis.type,
          useCase: chassis.useCase,
        });
      },
      error: () => {
        this.errorMessage.set(
          'The selected HAI chassis could not be loaded. Return to the catalog and try again.'
        );
        this.loading.set(false);
      },
    });

    this.hardwareService.getCompatibleComponents(chassisId).subscribe({
      next: (compatible) => {
        this.compatible.set(compatible);
        this.ensureDefaults(compatible);
        this.refreshPrice();
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set(
          'Component compatibility data is unavailable for this chassis right now.'
        );
        this.loading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  selectSingle(key: 'cpuId' | 'ramId', value: string): void {
    this.configuratorState.patchDraft({ [key]: value });
    this.refreshPrice();
  }

  toggleStorage(storageId: string): void {
    const currentIds = this.draft().storageIds;
    const nextIds = currentIds.includes(storageId)
      ? currentIds.filter((id) => id !== storageId)
      : [...currentIds, storageId];

    this.configuratorState.patchDraft({ storageIds: nextIds });
    this.refreshPrice();
  }

  selectGpu(gpuId: string): void {
    const nextGpu = this.draft().gpuId === gpuId ? '' : gpuId;
    this.configuratorState.patchDraft({ gpuId: nextGpu });
    this.refreshPrice();
  }

  isValid(): boolean {
    const draft = this.draft();
    return Boolean(draft.cpuId && draft.ramId && draft.storageIds.length > 0);
  }

  goToReview(): void {
    if (!this.isValid()) {
      return;
    }

    this.router.navigate(['/review']);
  }

  selectedName(items: HardwareComponent[], id: string): string {
    return items.find((item) => item.id === id)?.name || '';
  }

  storageSummary(items: HardwareComponent[]): string {
    const selected = items.filter((item) => this.draft().storageIds.includes(item.id));
    if (selected.length === 0) {
      return 'Select one or more';
    }

    return selected.map((item) => item.name).join(', ');
  }

  private ensureDefaults(compatible: CompatibleComponents): void {
    const current = this.draft();
    this.configuratorState.patchDraft({
      cpuId: current.cpuId || compatible.cpu[0]?.id || '',
      ramId: current.ramId || compatible.ram[0]?.id || '',
      storageIds:
        current.storageIds.length > 0
          ? current.storageIds
          : compatible.storage[0]
            ? [compatible.storage[0].id]
            : [],
      gpuId:
        current.gpuId && compatible.gpu.some((item) => item.id === current.gpuId)
          ? current.gpuId
          : '',
    });
  }

  private refreshPrice(): void {
    if (!this.isValid()) {
      this.price.set(null);
      this.configuratorState.setPriceBreakdown(null);
      return;
    }

    this.hardwareService.calculatePrice(this.draft()).subscribe({
      next: (price) => {
        this.price.set(price);
        this.configuratorState.setPriceBreakdown(price);
        this.errorMessage.set('');
      },
      error: () => {
        this.price.set(null);
        this.configuratorState.setPriceBreakdown(null);
        this.errorMessage.set(
          'Pricing could not be refreshed for the current build. Adjust the configuration or retry.'
        );
      },
    });
  }
}
