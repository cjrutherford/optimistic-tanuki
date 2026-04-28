import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AUDIENCE_PERSONAS } from '../data/presets';
import { MarketingEnrichmentApiService } from '../services/marketing-enrichment-api.service';
import { MarketingGeneratorService } from '../services/marketing-generator.service';
import { MarketingStateService } from '../services/marketing-state.service';
import {
  CampaignAsset,
  CampaignConcept,
  ChannelOutput,
  MaterialSurface,
} from '../types';

function cloneRequest<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

@Component({
  selector: 'app-results-page',
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="results-layout" *ngIf="concepts().length; else emptyState">
      <article class="gallery-panel">
        <div class="panel-head">
          <span class="eyebrow">Generated workbench</span>
          <h1>Compare strategy directions, then refine the built assets.</h1>
          <p>
            The concept gallery chooses the direction. The workbench below lets you tune the
            actual channel drafts and material copy before exporting or copying them.
          </p>
        </div>

        <div class="gallery-grid">
          <button
            *ngFor="let concept of concepts()"
            type="button"
            class="concept-card"
            [class.selected]="selectedConcept().id === concept.id"
            (click)="selectConcept(concept.id)"
          >
            <span class="meta">{{ concept.channelLabel }} · {{ concept.generationMode }}</span>
            <strong>{{ concept.headline }}</strong>
            <p>{{ concept.subheadline }}</p>
            <small>{{ concept.angle }}</small>
          </button>
        </div>
      </article>

      <aside class="detail-panel">
        <div class="detail-card">
          <span class="eyebrow">Selected strategy</span>
          <h2>{{ selectedConcept().headline }}</h2>
          <p class="detail-subhead">{{ selectedConcept().subheadline }}</p>
          <div class="copy-actions">
            <button type="button" (click)="copyConcept()">Copy strategy + outputs</button>
            <button type="button" class="secondary" routerLink="/create">Edit studio</button>
          </div>
          <p class="copy-feedback" *ngIf="copiedMessage()">{{ copiedMessage() }}</p>
          <div class="preview-frame">
            <span class="frame-label">{{ selectedConcept().sectionType }}</span>
            <section *ngFor="let section of selectedConcept().sections">
              <h3>{{ section.title }}</h3>
              <p>{{ section.body }}</p>
            </section>
            <button type="button" class="inline-cta">{{ selectedConcept().cta }}</button>
          </div>
        </div>

        <form class="tuning-card" (ngSubmit)="regenerate()">
          <span class="eyebrow">Tuning</span>
          <h3>Regenerate with brief adjustments</h3>
          <label>
            <span>Audience</span>
            <select [(ngModel)]="request.audienceId" name="audienceId">
              <option *ngFor="let persona of personas" [value]="persona.id">
                {{ persona.label }}
              </option>
            </select>
          </label>
          <label>
            <span>Intent</span>
            <select [(ngModel)]="request.campaignIntent" name="campaignIntent">
              <option value="awareness">Awareness</option>
              <option value="conversion">Conversion</option>
              <option value="launch">Launch</option>
            </select>
          </label>
          <label>
            <span>Channel</span>
            <select [(ngModel)]="request.channel" name="channel">
              <option value="web">Web</option>
              <option value="email">Email</option>
              <option value="social">Social</option>
            </select>
          </label>
          <button type="submit">Regenerate set</button>
        </form>

        <section class="output-stack">
          <span class="eyebrow">Channel outputs</span>
          <h3>Built channel drafts</h3>
          <div class="channel-grid">
            <button
              *ngFor="let output of selectedConcept().channelOutputs"
              type="button"
              class="channel-card"
              [class.active]="selectedChannelOutput()?.id === output.id"
              (click)="selectChannelOutput(output.id)"
            >
              <div class="output-head">
                <span class="asset-label">{{ output.label }}</span>
                <span class="output-type">{{ output.type }}</span>
              </div>
              <div class="channel-preview">
                <strong>{{ channelHeadline(output) }}</strong>
                <p>{{ output.summary }}</p>
                <div class="preview-lines">
                  <span *ngFor="let block of output.blocks.slice(1, 4)">{{ block.value }}</span>
                </div>
              </div>
            </button>
          </div>
        </section>

        <section class="editor-stack" *ngIf="selectedChannelOutput() as activeChannel">
          <div class="editor-card">
            <div class="output-head">
              <div>
                <span class="eyebrow">Edit channel draft</span>
                <h3>{{ activeChannel.label }}</h3>
              </div>
              <button type="button" class="copy-mini" (click)="copyOutput(activeChannel)">Copy</button>
            </div>
            <div class="editor-grid">
              <label *ngFor="let block of activeChannel.blocks">
                <span>{{ block.label }}</span>
                <textarea
                  [ngModel]="block.value"
                  (ngModelChange)="updateChannelBlock(activeChannel.id, block.id, $event)"
                  [name]="block.id"
                ></textarea>
              </label>
            </div>
          </div>
        </section>

        <section class="output-stack">
          <span class="eyebrow">Material outputs</span>
          <h3>Built marketing assets</h3>
          <div class="material-grid">
            <button
              *ngFor="let asset of selectedConcept().materialOutputs"
              type="button"
              class="material-card"
              [class.primary]="asset.isPrimary"
              [class.active]="selectedMaterialOutput()?.id === asset.id"
              (click)="selectMaterialOutput(asset.id, firstSurfaceId(asset))"
            >
              <div class="output-head">
                <span class="asset-label">{{ asset.label }}</span>
                <span class="output-type">{{ asset.layoutVariant }}</span>
              </div>
              <div
                class="surface-preview"
                [style.--asset-primary]="request.brand.primaryColor"
                [style.--asset-accent]="request.brand.accentColor"
              >
                <span class="surface-chip">{{ firstSurfaceLabel(asset) }}</span>
                <strong>{{ assetHeadline(asset) }}</strong>
                <p>{{ assetPreviewText(asset) }}</p>
              </div>
            </button>
          </div>
        </section>

        <section
          class="editor-stack"
          *ngIf="selectedMaterialOutput() as activeMaterial"
        >
          <div class="editor-card">
            <div class="output-head">
              <div>
                <span class="eyebrow">Edit material asset</span>
                <h3>{{ activeMaterial.label }}</h3>
              </div>
              <button type="button" class="copy-mini" (click)="copyMaterial(activeMaterial)">Copy</button>
            </div>

            <div class="surface-tabs" *ngIf="activeMaterial.surfaces.length > 1">
              <button
                *ngFor="let surface of activeMaterial.surfaces"
                type="button"
                [class.active]="selectedMaterialSurface()?.id === surface.id"
                (click)="selectMaterialOutput(activeMaterial.id, surface.id)"
              >
                {{ surface.label }}
              </button>
            </div>

            <div
              class="surface-workbench"
              *ngIf="selectedMaterialSurface() as activeSurface"
              [style.--asset-primary]="request.brand.primaryColor"
              [style.--asset-accent]="request.brand.accentColor"
            >
              <article class="surface-canvas">
                <span class="surface-chip">{{ activeSurface.label }}</span>
                <div *ngFor="let block of activeSurface.textBlocks" class="surface-block" [class.headline]="block.role === 'headline'" [class.cta]="block.role === 'cta'">
                  {{ block.value }}
                </div>
              </article>

              <div class="editor-grid">
                <label *ngFor="let block of activeSurface.textBlocks">
                  <span>{{ block.label }}</span>
                  <textarea
                    [ngModel]="block.value"
                    (ngModelChange)="updateMaterialTextBlock(activeMaterial.id, activeSurface.id, block.id, $event)"
                    [name]="block.id"
                  ></textarea>
                </label>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </section>

    <ng-template #emptyState>
      <section class="empty-state">
        <span class="eyebrow">No concepts yet</span>
        <h1>Generate a campaign workbench first.</h1>
        <p>Your strategy and outputs will appear here after the studio brief is complete.</p>
        <a routerLink="/create">Go to the generator</a>
      </section>
    </ng-template>
  `,
  styles: [
    `
      .results-layout {
        display: grid;
        grid-template-columns: minmax(0, 0.95fr) minmax(380px, 1.05fr);
        gap: 1rem;
      }

      .gallery-panel,
      .detail-card,
      .tuning-card,
      .concept-card,
      .empty-state,
      .output-stack,
      .channel-card,
      .material-card,
      .editor-card {
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        background: color-mix(in srgb, var(--surface, #10151c) 90%, transparent);
        border-radius: var(--border-radius-lg, 20px);
        box-shadow: var(--shadow-lg, 0 18px 60px rgba(0, 0, 0, 0.25));
      }

      .gallery-panel,
      .detail-card,
      .tuning-card,
      .empty-state,
      .output-stack,
      .editor-card {
        padding: 1.4rem;
      }

      .panel-head h1,
      .detail-card h2,
      .tuning-card h3,
      .empty-state h1,
      .output-stack h3,
      .editor-card h3 {
        margin: 0.35rem 0 0.8rem;
        font-family: var(--font-heading, 'Instrument Serif', serif);
        font-weight: 500;
        line-height: 0.98;
        text-wrap: balance;
      }

      .gallery-grid,
      .channel-grid,
      .material-grid {
        display: grid;
        gap: 0.9rem;
      }

      .gallery-grid,
      .channel-grid,
      .material-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .concept-card,
      .channel-card,
      .material-card {
        text-align: left;
        padding: 1rem;
        cursor: pointer;
        transition:
          transform var(--animation-duration-fast, 180ms) var(--animation-easing, ease),
          border-color var(--animation-duration-fast, 180ms) var(--animation-easing, ease),
          background var(--animation-duration-fast, 180ms) var(--animation-easing, ease);
      }

      .concept-card.selected,
      .channel-card.active,
      .material-card.active {
        border-color: var(--primary, #f59e0b);
        background: color-mix(in srgb, var(--primary, #f59e0b) 12%, var(--surface, #10151c));
      }

      .material-card.primary {
        box-shadow:
          var(--shadow-lg, 0 18px 60px rgba(0, 0, 0, 0.25)),
          0 0 0 1px color-mix(in srgb, var(--primary, #f59e0b) 38%, transparent);
      }

      .concept-card .meta,
      .detail-subhead,
      .preview-frame p,
      .empty-state p,
      .panel-head p,
      .channel-card p,
      .material-card p,
      .surface-block:not(.headline):not(.cta) {
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      .detail-panel {
        display: grid;
        gap: 1rem;
      }

      .copy-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin: 1rem 0;
      }

      .copy-feedback {
        color: var(--success, #22c55e);
      }

      .copy-actions button,
      .tuning-card button,
      .empty-state a,
      .copy-mini,
      .inline-cta,
      .surface-tabs button {
        padding: 0.8rem 1rem;
        border-radius: 999px;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        background: transparent;
        color: var(--foreground, #f7f1e6);
      }

      .copy-actions .secondary,
      .empty-state a {
        text-decoration: none;
      }

      .preview-frame {
        padding: 1rem;
        border-radius: var(--border-radius-md, 14px);
        background:
          linear-gradient(180deg, color-mix(in srgb, var(--primary, #f59e0b) 10%, transparent), transparent),
          color-mix(in srgb, var(--surface, #10151c) 96%, transparent);
      }

      .frame-label,
      .surface-chip,
      .output-type {
        display: inline-flex;
        margin-bottom: 0.7rem;
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--foreground, #fff) 8%, transparent);
        color: var(--primary, #f59e0b);
      }

      .preview-frame section + section {
        margin-top: 1rem;
      }

      .inline-cta {
        margin-top: 1rem;
        color: var(--background, #081018);
        background: var(--primary-gradient, linear-gradient(135deg, #f59e0b, #0ea5e9));
        border-color: transparent;
      }

      .tuning-card,
      .editor-grid {
        display: grid;
        gap: 0.75rem;
      }

      .tuning-card label,
      .editor-grid label {
        display: grid;
        gap: 0.4rem;
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      .tuning-card select,
      .editor-grid textarea {
        border-radius: var(--border-radius-md, 14px);
        border: 1px solid color-mix(in srgb, var(--border, rgba(255, 255, 255, 0.12)) 90%, transparent);
        padding: 0.85rem 0.95rem;
        background: color-mix(in srgb, var(--surface, #10151c) 86%, transparent);
        color: var(--foreground, #f7f1e6);
      }

      .editor-grid textarea {
        min-height: 5.8rem;
        resize: vertical;
      }

      .output-head {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
        margin-bottom: 0.65rem;
      }

      .asset-label {
        display: inline-flex;
        color: var(--primary, #f59e0b);
      }

      .copy-mini {
        padding: 0.45rem 0.75rem;
      }

      .channel-preview,
      .surface-preview,
      .surface-canvas {
        display: grid;
        gap: 0.65rem;
        min-height: 13rem;
        padding: 1rem;
        border-radius: calc(var(--border-radius-lg, 20px) - 4px);
        background:
          radial-gradient(circle at top right, color-mix(in srgb, var(--asset-accent, #2563eb) 20%, transparent), transparent 32%),
          linear-gradient(155deg, color-mix(in srgb, var(--asset-primary, #d97706) 26%, #10151c), color-mix(in srgb, var(--surface, #10151c) 88%, black));
      }

      .channel-preview strong,
      .surface-canvas .headline {
        font-family: var(--font-heading, 'Instrument Serif', serif);
        font-size: 1.5rem;
        line-height: 1;
        text-wrap: balance;
      }

      .preview-lines {
        display: grid;
        gap: 0.45rem;
      }

      .preview-lines span {
        font-size: 0.9rem;
        color: color-mix(in srgb, var(--foreground, #fff) 82%, transparent);
      }

      .editor-stack {
        display: grid;
      }

      .surface-tabs {
        display: flex;
        gap: 0.65rem;
        flex-wrap: wrap;
        margin: 1rem 0;
      }

      .surface-tabs button.active {
        color: var(--background, #081018);
        background: var(--primary-gradient, linear-gradient(135deg, #f59e0b, #0ea5e9));
        border-color: transparent;
      }

      .surface-workbench {
        display: grid;
        grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
        gap: 1rem;
        align-items: start;
      }

      .surface-canvas {
        position: sticky;
        top: 6rem;
      }

      .surface-block {
        font-size: 0.95rem;
        line-height: 1.5;
      }

      .surface-block.cta {
        display: inline-flex;
        width: fit-content;
        margin-top: 0.6rem;
        padding: 0.65rem 0.95rem;
        border-radius: 999px;
        color: var(--background, #081018);
        background: color-mix(in srgb, var(--asset-accent, #2563eb) 75%, white);
      }

      .empty-state {
        text-align: center;
        padding: 4rem 1.5rem;
      }

      button:focus-visible,
      select:focus-visible,
      a:focus-visible,
      textarea:focus-visible {
        outline: 2px solid var(--primary, #f59e0b);
        outline-offset: 2px;
      }

      @media (max-width: 1180px) {
        .results-layout,
        .gallery-grid,
        .channel-grid,
        .material-grid,
        .surface-workbench {
          grid-template-columns: 1fr;
        }

        .surface-canvas {
          position: static;
        }
      }
    `,
  ],
})
export class ResultsPageComponent {
  protected readonly concepts = inject(MarketingStateService).concepts;
  protected readonly request = cloneRequest(inject(MarketingStateService).request());
  protected readonly personas = AUDIENCE_PERSONAS;
  protected readonly selectedId = signal(this.concepts()[0]?.id ?? '');
  protected readonly selectedChannelOutputId = signal('');
  protected readonly selectedMaterialId = signal('');
  protected readonly selectedSurfaceId = signal('');
  protected readonly copiedMessage = signal('');
  protected readonly selectedConcept = computed<CampaignConcept>(() => {
    const selected = this.concepts().find(
      (concept) => concept.id === this.selectedId()
    );

    return selected ?? this.concepts()[0];
  });
  protected readonly selectedChannelOutput = computed<ChannelOutput | undefined>(() => {
    const concept = this.selectedConcept();
    return (
      concept.channelOutputs.find((output) => output.id === this.selectedChannelOutputId()) ||
      concept.channelOutputs[0]
    );
  });
  protected readonly selectedMaterialOutput = computed<CampaignAsset | undefined>(() => {
    const concept = this.selectedConcept();
    return (
      concept.materialOutputs.find((asset) => asset.id === this.selectedMaterialId()) ||
      concept.materialOutputs[0]
    );
  });
  protected readonly selectedMaterialSurface = computed<MaterialSurface | undefined>(() => {
    const material = this.selectedMaterialOutput();
    if (!material) {
      return undefined;
    }

    return (
      material.surfaces.find((surface) => surface.id === this.selectedSurfaceId()) ||
      material.surfaces[0]
    );
  });

  private readonly state = inject(MarketingStateService);
  private readonly generator = inject(MarketingGeneratorService);
  private readonly enrichmentApi = inject(MarketingEnrichmentApiService);
  private readonly router = inject(Router);

  constructor() {
    effect(() => {
      const concept = this.selectedConcept();
      if (!concept) {
        return;
      }

      if (
        !concept.channelOutputs.some(
          (output) => output.id === this.selectedChannelOutputId()
        )
      ) {
        this.selectedChannelOutputId.set(concept.channelOutputs[0]?.id ?? '');
      }

      if (
        !concept.materialOutputs.some((asset) => asset.id === this.selectedMaterialId())
      ) {
        const firstAsset = concept.materialOutputs[0];
        this.selectedMaterialId.set(firstAsset?.id ?? '');
        this.selectedSurfaceId.set(firstAsset?.surfaces[0]?.id ?? '');
      } else {
        const material = concept.materialOutputs.find(
          (asset) => asset.id === this.selectedMaterialId()
        );
        if (
          material &&
          !material.surfaces.some((surface) => surface.id === this.selectedSurfaceId())
        ) {
          this.selectedSurfaceId.set(material.surfaces[0]?.id ?? '');
        }
      }
    });
  }

  selectConcept(conceptId: string): void {
    this.selectedId.set(conceptId);
  }

  selectChannelOutput(outputId: string): void {
    this.selectedChannelOutputId.set(outputId);
  }

  selectMaterialOutput(materialId: string, surfaceId: string): void {
    this.selectedMaterialId.set(materialId);
    this.selectedSurfaceId.set(surfaceId);
  }

  updateChannelBlock(outputId: string, blockId: string, value: string): void {
    this.updateConcepts((concept) => ({
      ...concept,
      channelOutputs: concept.channelOutputs.map((output) =>
        output.id === outputId
          ? {
              ...output,
              blocks: output.blocks.map((block) =>
                block.id === blockId ? { ...block, value } : block
              ),
            }
          : output
      ),
    }));
  }

  updateMaterialTextBlock(
    materialId: string,
    surfaceId: string,
    blockId: string,
    value: string
  ): void {
    this.updateConcepts((concept) => ({
      ...concept,
      materialOutputs: concept.materialOutputs.map((asset) =>
        asset.id === materialId
          ? {
              ...asset,
              surfaces: asset.surfaces.map((surface) =>
                surface.id === surfaceId
                  ? {
                      ...surface,
                      textBlocks: surface.textBlocks.map((block) =>
                        block.id === blockId ? { ...block, value } : block
                      ),
                    }
                  : surface
              ),
            }
          : asset
      ),
    }));
  }

  async regenerate(): Promise<void> {
    this.state.setRequest(this.request);
    const baseConcepts = await this.generator.generateConcepts(this.request);
    const concepts = this.request.includeAiPolish
      ? await this.enrichmentApi.enrichConcepts(this.request, baseConcepts)
      : baseConcepts;
    this.state.setConcepts(concepts);
    this.selectedId.set(concepts[0]?.id ?? '');
    this.copiedMessage.set('');
  }

  async copyConcept(): Promise<void> {
    const concept = this.selectedConcept();
    const payload = [
      concept.headline,
      concept.subheadline,
      ...concept.sections.map((section) => `${section.title}: ${section.body}`),
      ...concept.channelOutputs.map((output) => this.formatChannelOutput(output)),
      ...concept.materialOutputs.map((asset) => this.formatMaterialOutput(asset)),
      concept.cta,
    ].join('\n\n');

    await this.copyText(payload, 'Strategy and outputs copied to clipboard.');
  }

  async copyOutput(output: ChannelOutput): Promise<void> {
    await this.copyText(
      this.formatChannelOutput(output),
      `${output.label} copied to clipboard.`
    );
  }

  async copyMaterial(asset: CampaignAsset): Promise<void> {
    await this.copyText(
      this.formatMaterialOutput(asset),
      `${asset.label} copied to clipboard.`
    );
  }

  protected assetPreviewText(asset: CampaignAsset): string {
    return asset.surfaces
      .flatMap((surface) => surface.textBlocks)
      .map((block) => block.value)
      .filter(Boolean)
      .slice(0, 3)
      .join(' ');
  }

  protected assetHeadline(asset: CampaignAsset): string {
    return asset.surfaces[0]?.textBlocks[0]?.value || asset.label;
  }

  protected channelHeadline(output: ChannelOutput): string {
    return output.blocks[0]?.value || output.label;
  }

  protected firstSurfaceId(asset: CampaignAsset): string {
    return asset.surfaces[0]?.id || '';
  }

  protected firstSurfaceLabel(asset: CampaignAsset): string {
    return asset.surfaces[0]?.label || 'Surface';
  }

  private updateConcepts(
    updater: (concept: CampaignConcept) => CampaignConcept
  ): void {
    const updated = this.state.concepts().map((concept) =>
      concept.id === this.selectedConcept().id ? updater(concept) : concept
    );
    this.state.setConcepts(updated);
  }

  private formatChannelOutput(output: ChannelOutput): string {
    return [
      output.label,
      output.summary,
      ...output.blocks.map((block) => `${block.label}: ${block.value}`),
    ].join('\n');
  }

  private formatMaterialOutput(asset: CampaignAsset): string {
    return [
      asset.label,
      `Layout: ${asset.layoutVariant}`,
      ...asset.surfaces.flatMap((surface) => [
        `${surface.label}`,
        ...surface.textBlocks.map((block) => `${block.label}: ${block.value}`),
      ]),
    ].join('\n');
  }

  private async copyText(value: string, successMessage: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      this.copiedMessage.set(successMessage);
      return;
    }

    this.copiedMessage.set('Clipboard unavailable here. Returning to the generator.');
    await this.router.navigate(['/create']);
  }
}
