import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AUDIENCE_PERSONAS, OFFERING_PRESETS } from '../data/presets';
import { MATERIAL_FORMAT_PRESETS } from '../data/material-format-presets';
import { MarketingEnrichmentApiService } from '../services/marketing-enrichment-api.service';
import { MarketingGeneratorService } from '../services/marketing-generator.service';
import { MarketingStateService } from '../services/marketing-state.service';
import {
  GenerationRequest,
  MarketingMaterialType,
  MaterialDeliverableRequest,
  OfferingPreset,
} from '../types';

function cloneRequest(request: GenerationRequest): GenerationRequest {
  return JSON.parse(JSON.stringify(request)) as GenerationRequest;
}

@Component({
  selector: 'app-create-page',
  imports: [CommonModule, FormsModule],
  template: `
    <section class="studio-shell">
      <article class="wizard-panel">
        <div class="panel-head">
          <span class="eyebrow">Studio brief</span>
          <h1>Build a campaign system that matches the offer.</h1>
          <p>
            Define the product, audience, strategy, outputs, and brand direction. The result is a
            grouped workbench with channel drafts and material-ready copy.
          </p>
        </div>

        <div class="steps">
          <button
            *ngFor="let label of stepLabels; let idx = index"
            type="button"
            [class.active]="step() === idx"
            (click)="step.set(idx)"
          >
            {{ idx + 1 }}. {{ label }}
          </button>
        </div>

        <form (ngSubmit)="generate()" class="wizard-form">
          <ng-container [ngSwitch]="step()">
            <section *ngSwitchCase="0" class="block">
              <h2>Offer</h2>
              <div class="selection-grid">
                <button
                  *ngFor="let offering of offerings"
                  type="button"
                  class="selection-card"
                  [class.selected]="request.selectedOfferingId === offering.id && request.offeringKind !== 'custom-app'"
                  (click)="selectPreset(offering)"
                >
                  <span class="badge">{{ offering.kind === 'service' ? 'Service' : 'App' }}</span>
                  <strong>{{ offering.name }}</strong>
                  <small>{{ offering.summary }}</small>
                </button>

                <button
                  type="button"
                  class="selection-card custom-card"
                  [class.selected]="request.offeringKind === 'custom-app'"
                  (click)="selectCustomApp()"
                >
                  <span class="badge">Custom</span>
                  <strong>Custom app brief</strong>
                  <small>Define a product from scratch for this campaign run.</small>
                </button>
              </div>

              <div *ngIf="request.offeringKind === 'custom-app'" class="brief-form">
                <h3>Custom app brief</h3>
                <label>
                  <span>Name</span>
                  <input [(ngModel)]="request.customApp.name" name="name" />
                </label>
                <label>
                  <span>Category</span>
                  <input [(ngModel)]="request.customApp.category" name="category" />
                </label>
                <label>
                  <span>Summary</span>
                  <textarea [(ngModel)]="request.customApp.summary" name="summary"></textarea>
                </label>
                <label>
                  <span>Features</span>
                  <textarea
                    [(ngModel)]="request.customApp.features"
                    name="features"
                    placeholder="Shared boards, checkout routing, daily planning…"
                  ></textarea>
                </label>
                <label>
                  <span>Differentiators</span>
                  <textarea
                    [(ngModel)]="request.customApp.differentiators"
                    name="differentiators"
                    placeholder="Faster synthesis, clearer buy path, stronger handoff…"
                  ></textarea>
                </label>
                <label>
                  <span>Primary goal</span>
                  <input [(ngModel)]="request.customApp.primaryGoal" name="primaryGoal" />
                </label>
              </div>

              <p class="validation-copy" *ngIf="request.offeringKind === 'custom-app' && !canAdvance()">
                Complete the custom app brief before moving forward.
              </p>
            </section>

            <section *ngSwitchCase="1" class="block">
              <h2>Audience</h2>
              <div class="persona-grid">
                <button
                  *ngFor="let persona of personas"
                  type="button"
                  class="persona-card"
                  [class.selected]="request.audienceId === persona.id"
                  (click)="request.audienceId = persona.id"
                >
                  <strong>{{ persona.label }}</strong>
                  <p>{{ persona.profile }}</p>
                  <small>{{ persona.desiredOutcome }}</small>
                </button>
              </div>
            </section>

            <section *ngSwitchCase="2" class="block matrix">
              <h2>Strategy</h2>
              <label>
                <span>Intent</span>
                <select [(ngModel)]="request.campaignIntent" name="campaignIntent">
                  <option value="awareness">Awareness</option>
                  <option value="conversion">Conversion</option>
                  <option value="launch">Launch</option>
                </select>
              </label>
              <label>
                <span>Primary channel</span>
                <select [(ngModel)]="request.channel" name="channel">
                  <option value="web">Web</option>
                  <option value="email">Email</option>
                  <option value="social">Social</option>
                </select>
              </label>
              <label>
                <span>Tone</span>
                <select [(ngModel)]="request.tone" name="tone">
                  <option value="editorial">Editorial</option>
                  <option value="direct">Direct</option>
                  <option value="technical">Technical</option>
                  <option value="warm">Warm</option>
                </select>
              </label>
            </section>

            <section *ngSwitchCase="3" class="block outputs-block">
              <h2>Outputs</h2>
              <p class="section-copy">
                The primary channel always produces a native draft. Choose the supporting material
                outputs you want in the same run.
              </p>

              <div class="channel-banner">
                <span class="badge">Primary channel</span>
                <strong>{{ request.channel | titlecase }}</strong>
                <small>{{ currentChannelOutputLabel() }}</small>
              </div>

              <div class="deliverable-grid">
                <button
                  *ngFor="let option of deliverableOptions"
                  type="button"
                  class="deliverable-card"
                  [class.selected]="isDeliverableSelected(option.type, option.formatId)"
                  (click)="toggleDeliverable(option.type, option.formatId)"
                >
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.meta }}</small>
                </button>
              </div>
            </section>

            <section *ngSwitchCase="4" class="block brand-block">
              <h2>Brand</h2>
              <div class="brand-grid">
                <label>
                  <span>Business name</span>
                  <input [(ngModel)]="request.brand.businessName" name="businessName" />
                </label>
                <label>
                  <span>Tagline</span>
                  <input [(ngModel)]="request.brand.tagline" name="tagline" />
                </label>
                <label>
                  <span>Primary color</span>
                  <input [(ngModel)]="request.brand.primaryColor" name="primaryColor" />
                </label>
                <label>
                  <span>Secondary color</span>
                  <input [(ngModel)]="request.brand.secondaryColor" name="secondaryColor" />
                </label>
                <label>
                  <span>Accent color</span>
                  <input [(ngModel)]="request.brand.accentColor" name="accentColor" />
                </label>
                <label>
                  <span>Logo URL</span>
                  <input [(ngModel)]="request.brand.logoUrl" name="logoUrl" />
                </label>
                <label class="full-width">
                  <span>Visual style</span>
                  <input [(ngModel)]="request.brand.visualStyle" name="visualStyle" />
                </label>
                <label class="full-width">
                  <span>Visual direction</span>
                  <textarea
                    [(ngModel)]="request.visualDirection"
                    name="visualDirection"
                    placeholder="Architecture, motion, imagery, and composition notes…"
                  ></textarea>
                </label>
                <label class="checkbox full-width">
                  <input type="checkbox" [(ngModel)]="request.generateImages" name="generateImages" />
                  <span>Prepare image prompts for generation</span>
                </label>
                <label class="checkbox full-width">
                  <input type="checkbox" [(ngModel)]="request.includeAiPolish" name="includeAiPolish" />
                  <span>Apply AI polish where available</span>
                </label>
              </div>
            </section>

            <section *ngSwitchCase="5" class="block">
              <h2>Review</h2>
              <div class="review-card">
                <p><strong>Offer:</strong> {{ summaryOffering() }}</p>
                <p><strong>Audience:</strong> {{ summaryAudience() }}</p>
                <p><strong>Strategy:</strong> {{ request.campaignIntent }} / {{ request.channel }} / {{ request.tone }}</p>
                <p><strong>Outputs:</strong> {{ selectedDeliverableSummary() }}</p>
                <p><strong>Brand:</strong> {{ request.brand.businessName || 'Unspecified brand profile' }}</p>
              </div>
            </section>
          </ng-container>

          <div class="actions">
            <button type="button" class="ghost" (click)="back()" [disabled]="step() === 0">Back</button>
            <button
              type="button"
              class="ghost"
              (click)="next()"
              *ngIf="step() < stepLabels.length - 1"
              [disabled]="step() === 0 && !canAdvance()"
            >
              Next
            </button>
            <button type="submit" class="primary" *ngIf="step() === stepLabels.length - 1">
              Generate workbench
            </button>
          </div>
        </form>
      </article>

      <aside class="summary-panel">
        <span class="eyebrow">Live brief</span>
        <h2>{{ summaryOffering() }}</h2>
        <p>{{ summaryAudience() }}</p>
        <dl>
          <div>
            <dt>Intent</dt>
            <dd>{{ request.campaignIntent }}</dd>
          </div>
          <div>
            <dt>Channel</dt>
            <dd>{{ request.channel }}</dd>
          </div>
          <div>
            <dt>Outputs</dt>
            <dd>{{ request.deliverables.length }} material selections</dd>
          </div>
          <div>
            <dt>Brand</dt>
            <dd>{{ request.brand.businessName || 'Not set' }}</dd>
          </div>
        </dl>
      </aside>
    </section>
  `,
  styles: [
    `
      .studio-shell {
        display: grid;
        grid-template-columns: minmax(0, 1.18fr) minmax(290px, 0.82fr);
        gap: 1rem;
      }

      .wizard-panel,
      .summary-panel,
      .selection-card,
      .persona-card,
      .review-card,
      .deliverable-card,
      .channel-banner {
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        border-radius: var(--border-radius-lg, 20px);
        background: color-mix(in srgb, var(--surface, #10151c) 90%, transparent);
        box-shadow: var(--shadow-lg, 0 18px 60px rgba(0, 0, 0, 0.25));
      }

      .wizard-panel,
      .summary-panel {
        padding: 1.4rem;
      }

      .panel-head h1,
      .summary-panel h2,
      .block h2 {
        margin: 0.35rem 0 0.8rem;
        font-family: var(--font-heading, 'Instrument Serif', serif);
        font-weight: 500;
        line-height: 0.96;
        text-wrap: balance;
      }

      .panel-head h1 {
        font-size: clamp(2.5rem, 5vw, 4.7rem);
        max-width: 10ch;
      }

      .panel-head p,
      .summary-panel p,
      .section-copy {
        color: var(--muted, rgba(255, 255, 255, 0.72));
        line-height: 1.6;
      }

      .steps {
        display: flex;
        gap: 0.65rem;
        flex-wrap: wrap;
        margin: 1rem 0 1.2rem;
      }

      .steps button,
      .actions button,
      .selection-card,
      .persona-card,
      .deliverable-card {
        transition:
          transform var(--animation-duration-fast, 180ms) var(--animation-easing, ease),
          background var(--animation-duration-fast, 180ms) var(--animation-easing, ease),
          border-color var(--animation-duration-fast, 180ms) var(--animation-easing, ease),
          box-shadow var(--animation-duration-fast, 180ms) var(--animation-easing, ease);
      }

      .steps button,
      .actions button {
        padding: 0.75rem 1rem;
        border-radius: 999px;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        color: var(--muted, rgba(255, 255, 255, 0.72));
        background: transparent;
      }

      .steps button.active {
        color: var(--background, #081018);
        background: var(--primary-gradient, linear-gradient(135deg, #f59e0b, #0ea5e9));
        border-color: transparent;
      }

      .selection-grid,
      .persona-grid,
      .deliverable-grid,
      .brand-grid {
        display: grid;
        gap: 0.9rem;
      }

      .selection-grid,
      .persona-grid,
      .deliverable-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .selection-card,
      .persona-card,
      .deliverable-card {
        text-align: left;
        padding: 1rem;
        cursor: pointer;
      }

      .selection-card.selected,
      .persona-card.selected,
      .deliverable-card.selected {
        border-color: var(--primary, #f59e0b);
        transform: translateY(-2px);
        background: color-mix(in srgb, var(--primary, #f59e0b) 14%, var(--surface, #10151c));
      }

      .selection-card strong,
      .persona-card strong,
      .deliverable-card strong {
        display: block;
        margin: 0.45rem 0;
      }

      .selection-card small,
      .persona-card small,
      .persona-card p,
      .deliverable-card small {
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      .badge {
        display: inline-flex;
        padding: 0.3rem 0.55rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--foreground, #fff) 8%, transparent);
        color: var(--primary, #f59e0b);
      }

      .brief-form,
      .matrix,
      .review-card,
      .outputs-block,
      .brand-block {
        margin-top: 1rem;
      }

      .channel-banner {
        display: grid;
        gap: 0.35rem;
        padding: 1rem;
        margin: 1rem 0;
      }

      .validation-copy {
        margin-top: 1rem;
        color: var(--warning, #f59e0b);
      }

      .brief-form,
      .brand-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .brief-form h3,
      .full-width {
        grid-column: 1 / -1;
      }

      label {
        display: grid;
        gap: 0.45rem;
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      input,
      select,
      textarea {
        width: 100%;
        border-radius: var(--border-radius-md, 14px);
        border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.12)) 90%, transparent);
        padding: 0.85rem 0.95rem;
        background: color-mix(in srgb, var(--surface, #10151c) 86%, transparent);
        color: var(--foreground, #f7f1e6);
      }

      textarea {
        min-height: 6rem;
        resize: vertical;
      }

      .matrix {
        display: grid;
        gap: 0.85rem;
      }

      .checkbox {
        grid-template-columns: auto 1fr;
        align-items: center;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.8rem;
        margin-top: 1.2rem;
      }

      .actions button[disabled] {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .ghost {
        color: var(--foreground, #f7f1e6);
      }

      .primary {
        color: var(--background, #081018);
        background: var(--primary-gradient, linear-gradient(135deg, #f59e0b, #0ea5e9));
        border-color: transparent;
      }

      .summary-panel dl {
        display: grid;
        gap: 0.8rem;
      }

      .summary-panel dt {
        color: var(--muted, rgba(255, 255, 255, 0.72));
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .summary-panel dd {
        margin: 0.3rem 0 0;
        font-size: 1.05rem;
      }

      button:focus-visible,
      input:focus-visible,
      select:focus-visible,
      textarea:focus-visible {
        outline: 2px solid var(--primary, #f59e0b);
        outline-offset: 2px;
      }

      @media (max-width: 980px) {
        .studio-shell,
        .selection-grid,
        .persona-grid,
        .deliverable-grid,
        .brief-form,
        .brand-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class CreatePageComponent {
  protected readonly stepLabels = ['Offer', 'Audience', 'Strategy', 'Outputs', 'Brand', 'Review'];
  protected readonly offerings = OFFERING_PRESETS;
  protected readonly personas = AUDIENCE_PERSONAS;
  protected readonly step = signal(0);
  protected readonly request = cloneRequest(inject(MarketingStateService).request());
  protected readonly deliverableOptions = this.buildDeliverableOptions();
  protected readonly summaryOffering = computed(() =>
    this.request.offeringKind === 'custom-app'
      ? this.request.customApp.name || 'Custom app'
      : this.offerings.find((offering) => offering.id === this.request.selectedOfferingId)
          ?.name || 'Select an offering'
  );
  protected readonly summaryAudience = computed(
    () =>
      this.personas.find((persona) => persona.id === this.request.audienceId)
        ?.profile || 'Choose an audience'
  );
  protected readonly customBriefMissingFields = computed(() => {
    if (this.request.offeringKind !== 'custom-app') {
      return [];
    }

    return [
      this.request.customApp.name,
      this.request.customApp.category,
      this.request.customApp.summary,
      this.request.customApp.features,
      this.request.customApp.differentiators,
      this.request.customApp.primaryGoal,
    ].filter((value) => !value.trim());
  });
  protected readonly canAdvance = computed(
    () =>
      this.request.offeringKind !== 'custom-app' ||
      this.customBriefMissingFields().length === 0
  );

  private readonly router = inject(Router);
  private readonly state = inject(MarketingStateService);
  private readonly generator = inject(MarketingGeneratorService);
  private readonly enrichmentApi = inject(MarketingEnrichmentApiService);

  selectPreset(offering: OfferingPreset): void {
    this.request.offeringKind = offering.kind;
    this.request.selectedOfferingId = offering.id;
  }

  selectCustomApp(): void {
    this.request.offeringKind = 'custom-app';
    this.request.selectedOfferingId = null;
  }

  next(): void {
    if (this.step() === 0 && !this.canAdvance()) {
      return;
    }

    this.step.update((value) => Math.min(value + 1, this.stepLabels.length - 1));
  }

  back(): void {
    this.step.update((value) => Math.max(value - 1, 0));
  }

  isDeliverableSelected(type: MarketingMaterialType, formatId: string): boolean {
    return this.request.deliverables.some(
      (item) => item.type === type && item.formatId === formatId
    );
  }

  toggleDeliverable(type: MarketingMaterialType, formatId: string): void {
    if (this.isDeliverableSelected(type, formatId)) {
      this.request.deliverables = this.request.deliverables.filter(
        (item) => !(item.type === type && item.formatId === formatId)
      );
      return;
    }

    this.request.deliverables = [
      ...this.request.deliverables,
      { type, formatId, quantity: 1 },
    ];
  }

  currentChannelOutputLabel(): string {
    switch (this.request.channel) {
      case 'web':
        return 'Landing page draft with proof and CTA blocks.';
      case 'email':
        return 'Email sequence draft with subject, preview, and body copy.';
      case 'social':
        return 'Social campaign draft with hook, caption, and proof lines.';
    }
  }

  selectedDeliverableSummary(): string {
    if (!this.request.deliverables.length) {
      return `Native ${this.request.channel} output only`;
    }

    return this.request.deliverables
      .map((item) =>
        this.deliverableOptions.find(
          (option) => option.type === item.type && option.formatId === item.formatId
        )?.label || item.type
      )
      .join(', ');
  }

  async generate(): Promise<void> {
    if (!this.canAdvance()) {
      return;
    }

    this.state.setRequest(this.request as GenerationRequest);
    const baseConcepts = await this.generator.generateConcepts(
      this.request as GenerationRequest
    );
    const concepts = this.request.includeAiPolish
      ? await this.enrichmentApi.enrichConcepts(this.request as GenerationRequest, baseConcepts)
      : baseConcepts;
    this.state.setConcepts(concepts);
    await this.router.navigate(['/results']);
  }

  private buildDeliverableOptions(): Array<{
    type: MarketingMaterialType;
    formatId: string;
    label: string;
    meta: string;
  }> {
    return (
      Object.entries(MATERIAL_FORMAT_PRESETS) as [
        MarketingMaterialType,
        Array<{ id: string; label: string; surfaces: string[]; width: number; height: number }>
      ][]
    ).flatMap(([type, presets]) =>
      presets.map((preset) => ({
        type,
        formatId: preset.id,
        label: preset.label,
        meta: `${preset.width}×${preset.height} · ${preset.surfaces.length} surface${preset.surfaces.length > 1 ? 's' : ''}`,
      }))
    );
  }
}
