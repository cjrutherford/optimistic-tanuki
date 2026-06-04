import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MaterialRichTextEditorComponent } from '../components/material-rich-text-editor.component';
import { MaterialTemplatePreviewComponent } from '../components/material-template-preview.component';
import { AUDIENCE_PERSONAS } from '../data/presets';
import { MarketingEnrichmentApiService } from '../services/marketing-enrichment-api.service';
import { MarketingGeneratorService } from '../services/marketing-generator.service';
import { MarketingInsightsService } from '../services/marketing-insights.service';
import { MarketingStateService } from '../services/marketing-state.service';
import {
  CampaignAsset,
  CampaignConcept,
  ChannelOutput,
  ConceptWorkflowStatus,
  DeliveryModel,
  GenerationProvenance,
  GenerationRequest,
  MarketingWorkspace,
  MarketingWorkspaceStatus,
  MaterialSurface,
  PricingModel,
} from '../types';

function cloneRequest<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

type EditorSurfaceType = 'web' | 'email' | 'social' | 'material';

interface PreviewRegion {
  id: string;
  label: string;
  value: string;
  role: string;
  kind: 'channel' | 'material';
  outputId?: string;
  materialId?: string;
  surfaceId?: string;
  blockId: string;
}

interface EditorSurface {
  id: string;
  type: EditorSurfaceType;
  title: string;
  subtitle: string;
  description: string;
  output?: ChannelOutput;
  asset?: CampaignAsset;
  surface?: MaterialSurface;
  regions: PreviewRegion[];
}

@Component({
  selector: 'app-results-page',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MaterialRichTextEditorComponent,
    MaterialTemplatePreviewComponent,
  ],
  template: `
    <section class="command-deck" *ngIf="concepts().length">
      <article class="deck-card deck-card-primary">
        <span class="eyebrow">Operating status</span>
        <h2>{{ workspaceStatus().currentWorkspaceName }}</h2>
        <p>
          {{ workspaceStatus().storageLabel }} ·
          {{ formatSavedAt(workspaceStatus().lastSavedAt) }}
        </p>
        <div class="deck-metrics">
          <div>
            <strong>{{ workspaceStatus().workspaceCount }}</strong>
            <span>workspaces</span>
          </div>
          <div>
            <strong>{{ workspaceStatus().currentVersionCount }}</strong>
            <span>versions</span>
          </div>
          <div>
            <strong>{{ workspaceStatus().conceptCount }}</strong>
            <span>concepts</span>
          </div>
        </div>
      </article>

      <article class="deck-card">
        <span class="eyebrow">Generation provenance</span>
        <h2>{{ provenanceLabel(selectedConcept().generationProvenance) }}</h2>
        <p>
          {{ provenanceDescription(selectedConcept().generationProvenance) }}
        </p>
        <ul class="deck-list">
          <li>
            AI polish:
            {{
              request.includeAiPolish
                ? 'enabled for this run'
                : 'disabled for this run'
            }}
          </li>
          <li>Primary channel: {{ request.channel | titlecase }}</li>
          <li>
            Deliverables:
            {{
              request.deliverables.length
                ? request.deliverables.length + ' configured'
                : 'native channel output only'
            }}
          </li>
        </ul>
      </article>
    </section>

    <section class="results-layout" *ngIf="concepts().length; else emptyState">
      <article class="gallery-panel">
        <div class="panel-head">
          <span class="eyebrow">Generated workbench</span>
          <h1>Compare strategy directions, then refine the built assets.</h1>
          <p>
            The concept gallery chooses the direction. The workbench below lets
            you tune the actual channel drafts and material copy before
            exporting or copying them.
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
            <span class="meta"
              >{{ concept.channelLabel }} · {{ concept.generationMode }}</span
            >
            <span class="workflow-pill">{{
              workflowLabel(concept.workflowStatus)
            }}</span>
            <strong>{{ concept.headline }}</strong>
            <p>{{ concept.subheadline }}</p>
            <small>{{ concept.angle }}</small>
            <div class="concept-actions">
              <button
                type="button"
                class="copy-mini"
                (click)="
                  markConceptSelected(concept.id); $event.stopPropagation()
                "
              >
                Pick
              </button>
              <button
                type="button"
                class="copy-mini"
                (click)="
                  toggleShortlistConcept(concept.id); $event.stopPropagation()
                "
              >
                Shortlist
              </button>
              <button
                type="button"
                class="copy-mini"
                (click)="
                  toggleCompareConcept(concept.id); $event.stopPropagation()
                "
              >
                Compare
              </button>
            </div>
          </button>
        </div>
      </article>

      <aside class="detail-panel">
        <section class="output-stack workspace-stack">
          <span class="eyebrow">Workspaces</span>
          <h3>{{ currentWorkspaceName() }}</h3>
          <label>
            <span>Workspace name</span>
            <input
              [ngModel]="workspaceName()"
              (ngModelChange)="workspaceName.set($event)"
              name="workspaceName"
            />
          </label>
          <div class="copy-actions">
            <button type="button" (click)="createWorkspaceFromCurrent()">
              New workspace
            </button>
            <button type="button" (click)="renameWorkspace()">Rename</button>
            <button type="button" (click)="duplicateWorkspace()">
              Duplicate
            </button>
            <button type="button" (click)="saveWorkspaceVersion()">
              Save version
            </button>
          </div>
          <div class="workspace-list">
            <button
              *ngFor="let workspace of workspaces()"
              type="button"
              class="channel-card"
              [class.active]="workspace.id === currentWorkspaceId()"
              (click)="loadWorkspace(workspace.id)"
            >
              <strong>{{ workspace.name }}</strong>
              <small>{{ workspace.concepts.length }} concepts</small>
            </button>
          </div>
          <div class="workspace-list" *ngIf="workspaceVersions().length">
            <h4>Version history</h4>
            <button
              *ngFor="let version of workspaceVersions()"
              type="button"
              class="channel-card"
              (click)="restoreWorkspaceVersion(version.id)"
            >
              <strong>{{ version.name }}</strong>
              <small>{{ version.createdAt | date : 'medium' }}</small>
            </button>
          </div>
        </section>

        <section class="output-stack">
          <span class="eyebrow">Performance loop</span>
          <h3>Usage signals</h3>
          <div class="metric-grid">
            <article class="channel-card">
              <strong>{{ insightsSummary().generationRuns }}</strong>
              <small>generation runs</small>
            </article>
            <article class="channel-card">
              <strong>{{ insightsSummary().conceptSelections }}</strong>
              <small>concept selections</small>
            </article>
            <article class="channel-card">
              <strong>{{ insightsSummary().exports }}</strong>
              <small>downloads</small>
            </article>
            <article class="channel-card">
              <strong>{{ insightsSummary().blockRegenerations }}</strong>
              <small>block regenerations</small>
            </article>
          </div>
        </section>

        <section class="output-stack" *ngIf="comparedConcepts().length === 2">
          <span class="eyebrow">Compare concepts</span>
          <h3>Compare concepts</h3>
          <div class="compare-grid">
            <article
              class="channel-card"
              *ngFor="let concept of comparedConcepts()"
            >
              <span class="workflow-pill">{{
                workflowLabel(concept.workflowStatus)
              }}</span>
              <strong>{{ concept.headline }}</strong>
              <p>{{ concept.subheadline }}</p>
              <ul class="rubric-list" *ngIf="concept.rubric">
                <li>Clarity: {{ concept.rubric.clarity }}/10</li>
                <li>
                  Differentiation: {{ concept.rubric.differentiation }}/10
                </li>
                <li>Specificity: {{ concept.rubric.specificity }}/10</li>
                <li>Actionability: {{ concept.rubric.actionability }}/10</li>
              </ul>
              <button
                type="button"
                class="copy-mini"
                (click)="chooseComparedWinner(concept.id)"
              >
                Choose as winner
              </button>
            </article>
          </div>
        </section>

        <div class="detail-card">
          <span class="eyebrow">Selected strategy</span>
          <div class="provenance-pill">
            {{ provenanceLabel(selectedConcept().generationProvenance) }}
          </div>
          <div class="workflow-pill">
            {{ workflowLabel(selectedConcept().workflowStatus) }}
          </div>
          <h2>{{ selectedConcept().headline }}</h2>
          <p class="detail-subhead">{{ selectedConcept().subheadline }}</p>
          <p class="copy-feedback" *ngIf="workspaceDecisionSummary()">
            {{ workspaceDecisionSummary() }}
          </p>
          <div class="alignment-card">
            <span class="eyebrow">Feedback loop</span>
            <div class="feedback-grid">
              <button
                type="button"
                class="copy-mini"
                (click)="submitConceptFeedback('positive', 'useful')"
              >
                Useful
              </button>
              <button
                type="button"
                class="copy-mini"
                (click)="
                  submitConceptFeedback('positive', 'strongest-direction')
                "
              >
                Strongest direction
              </button>
              <button
                type="button"
                class="copy-mini"
                (click)="submitConceptFeedback('negative', 'too-generic')"
              >
                Too generic
              </button>
              <button
                type="button"
                class="copy-mini"
                (click)="submitConceptFeedback('negative', 'too-long')"
              >
                Too long
              </button>
            </div>
            <p class="detail-subhead">
              {{ selectedConceptFeedback().positive }} positive ·
              {{ selectedConceptFeedback().negative }} negative
              <span *ngIf="selectedConceptFeedback().topReason">
                · top reason: {{ selectedConceptFeedback().topReason }}
              </span>
            </p>
          </div>
          <div
            class="alignment-card"
            *ngIf="
              selectedConcept().objectives?.length ||
              selectedConcept().proofPoints?.length
            "
          >
            <span class="eyebrow">Objective alignment</span>
            <p *ngIf="selectedConcept().positioning">
              {{ selectedConcept().positioning }}
            </p>
            <div class="alignment-grid">
              <section *ngIf="selectedConcept().objectives?.length">
                <h3>Objectives</h3>
                <ul>
                  <li *ngFor="let objective of selectedConcept().objectives">
                    {{ objective }}
                  </li>
                </ul>
              </section>
              <section *ngIf="selectedConcept().proofPoints?.length">
                <h3>Proof points</h3>
                <ul>
                  <li *ngFor="let proofPoint of selectedConcept().proofPoints">
                    {{ proofPoint }}
                  </li>
                </ul>
              </section>
            </div>
          </div>
          <div
            class="alignment-card"
            *ngIf="
              selectedConcept().deliveryModel ||
              selectedConcept().pricingModel ||
              selectedConcept().selfHostedNote
            "
          >
            <span class="eyebrow">Commercial posture</span>
            <div class="alignment-grid">
              <section *ngIf="selectedConcept().deliveryModel">
                <h3>Delivery model</h3>
                <p>
                  {{ describeDeliveryModel(selectedConcept().deliveryModel!) }}
                </p>
              </section>
              <section *ngIf="selectedConcept().pricingModel">
                <h3>Pricing model</h3>
                <p>
                  {{ describePricingModel(selectedConcept().pricingModel!) }}
                </p>
              </section>
            </div>
            <p *ngIf="selectedConcept().selfHostedNote">
              <strong>Self-hosted</strong>:
              {{ selectedConcept().selfHostedNote }}
            </p>
          </div>
          <div class="copy-actions">
            <button
              type="button"
              (click)="markConceptSelected(selectedConcept().id)"
            >
              Selected direction
            </button>
            <button type="button" (click)="copyConcept()">
              Copy strategy + outputs
            </button>
            <button type="button" (click)="downloadConceptBundle('markdown')">
              Download markdown
            </button>
            <button type="button" (click)="downloadConceptBundle('json')">
              Download JSON bundle
            </button>
            <button type="button" (click)="downloadConceptBundle('manifest')">
              Download manifest
            </button>
            <button type="button" class="secondary" routerLink="/create">
              Edit studio
            </button>
          </div>
          <p class="copy-feedback" *ngIf="copiedMessage()">
            {{ copiedMessage() }}
          </p>
          <div class="preview-frame">
            <span class="frame-label">{{ selectedConcept().sectionType }}</span>
            <section *ngFor="let section of selectedConcept().sections">
              <h3>{{ section.title }}</h3>
              <p>{{ section.body }}</p>
            </section>
            <button type="button" class="inline-cta">
              {{ selectedConcept().cta }}
            </button>
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

        <section class="editor-workbench">
          <div class="editor-topbar">
            <div>
              <span class="eyebrow">Editor</span>
              <h3>Preview-first campaign editor</h3>
            </div>
            <div class="surface-switcher">
              <button
                *ngFor="let surface of editorSurfaces()"
                type="button"
                [class.active]="activeEditorSurface()?.id === surface.id"
                (click)="setActiveEditorSurface(surface.id)"
              >
                {{ surface.title }}
              </button>
            </div>
          </div>

          <div
            class="editor-main"
            *ngIf="activeEditorSurface() as activeSurface"
          >
            <article class="preview-pane">
              <div class="editor-pane-head">
                <div>
                  <span class="eyebrow">Preview workspace</span>
                  <h3>{{ activeSurface.title }}</h3>
                  <p>{{ activeSurface.description }}</p>
                </div>
                <div class="mini-actions">
                  <button
                    type="button"
                    class="copy-mini"
                    (click)="copyActiveSurface()"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    class="copy-mini"
                    (click)="downloadActiveSurface()"
                  >
                    Download
                  </button>
                </div>
              </div>

              <div
                class="preview-canvas"
                [ngClass]="'preview-' + activeSurface.type"
              >
                <ng-container [ngSwitch]="activeSurface.type">
                  <ng-container *ngSwitchCase="'web'">
                    <div class="web-page-frame">
                      <div class="web-nav-bar">
                        <span>{{
                          request.brand.businessName || 'Signal Foundry'
                        }}</span>
                        <span>{{ activeSurface.subtitle }}</span>
                      </div>
                      <button
                        *ngFor="let region of activeSurface.regions"
                        type="button"
                        class="preview-region"
                        [class.selected]="
                          selectedPreviewRegion()?.id === region.id
                        "
                        [ngClass]="'region-' + region.role"
                        (click)="selectPreviewRegion(region.id)"
                      >
                        <span class="region-label">{{ region.label }}</span>
                        <span
                          class="region-value"
                          [innerHTML]="previewRegionHtml(region.value)"
                        ></span>
                      </button>
                    </div>
                  </ng-container>

                  <ng-container *ngSwitchCase="'email'">
                    <div class="email-frame">
                      <div class="email-chrome">
                        <span>Inbox preview</span>
                        <span>{{
                          request.brand.businessName || 'Signal Foundry'
                        }}</span>
                      </div>
                      <button
                        *ngFor="let region of activeSurface.regions"
                        type="button"
                        class="preview-region"
                        [class.selected]="
                          selectedPreviewRegion()?.id === region.id
                        "
                        [ngClass]="'region-' + region.role"
                        (click)="selectPreviewRegion(region.id)"
                      >
                        <span class="region-label">{{ region.label }}</span>
                        <span
                          class="region-value"
                          [innerHTML]="previewRegionHtml(region.value)"
                        ></span>
                      </button>
                    </div>
                  </ng-container>

                  <ng-container *ngSwitchCase="'social'">
                    <div class="social-frame">
                      <div class="social-chrome">
                        <strong>{{
                          request.brand.businessName || 'Signal Foundry'
                        }}</strong>
                        <small>Campaign post preview</small>
                      </div>
                      <button
                        *ngFor="let region of activeSurface.regions"
                        type="button"
                        class="preview-region"
                        [class.selected]="
                          selectedPreviewRegion()?.id === region.id
                        "
                        [ngClass]="'region-' + region.role"
                        (click)="selectPreviewRegion(region.id)"
                      >
                        <span class="region-label">{{ region.label }}</span>
                        <span
                          class="region-value"
                          [innerHTML]="previewRegionHtml(region.value)"
                        ></span>
                      </button>
                    </div>
                  </ng-container>

                  <ng-container *ngSwitchDefault>
                    <div class="material-artboard">
                      <div class="material-artboard-meta">
                        <span>{{ activeSurface.title }}</span>
                        <span>{{ activeSurface.subtitle }}</span>
                      </div>
                      <button
                        *ngFor="let region of activeSurface.regions"
                        type="button"
                        class="preview-region"
                        [class.selected]="
                          selectedPreviewRegion()?.id === region.id
                        "
                        [ngClass]="'region-' + region.role"
                        (click)="selectPreviewRegion(region.id)"
                      >
                        <span class="region-label">{{ region.label }}</span>
                        <span
                          class="region-value"
                          [innerHTML]="previewRegionHtml(region.value)"
                        ></span>
                      </button>
                    </div>
                  </ng-container>
                </ng-container>
              </div>
            </article>

            <aside
              class="inspector-pane"
              *ngIf="selectedPreviewRegion() as region"
            >
              <div class="editor-pane-head">
                <div>
                  <span class="eyebrow">Inspector</span>
                  <h3>{{ region.label }}</h3>
                  <p>{{ activeSurface.subtitle }}</p>
                </div>
                <button
                  type="button"
                  class="copy-mini"
                  (click)="regenerateSelectedPreviewRegion()"
                >
                  Regenerate
                </button>
              </div>

              <label class="inspector-field">
                <span>Selected content</span>
                <app-material-rich-text-editor
                  [content]="region.value"
                  (contentChange)="updateSelectedPreviewRegion($event)"
                  (editorBlur)="recordSelectedPreviewRegionEdit()"
                />
              </label>

              <div class="inspector-meta">
                <div>
                  <strong>Region role</strong>
                  <small>{{ region.role }}</small>
                </div>
                <div>
                  <strong>Surface type</strong>
                  <small>{{ activeSurface.type }}</small>
                </div>
              </div>
            </aside>
          </div>
        </section>

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
                  <span *ngFor="let block of output.blocks.slice(1, 4)">{{
                    plainText(block.value)
                  }}</span>
                </div>
              </div>
            </button>
          </div>
        </section>

        <section
          class="editor-stack"
          *ngIf="selectedChannelOutput() as activeChannel"
        >
          <div class="editor-card">
            <div class="output-head">
              <div>
                <span class="eyebrow">Edit channel draft</span>
                <h3>{{ activeChannel.label }}</h3>
              </div>
              <div class="mini-actions">
                <button
                  type="button"
                  class="copy-mini"
                  (click)="copyOutput(activeChannel)"
                >
                  Copy
                </button>
                <button
                  type="button"
                  class="copy-mini"
                  (click)="downloadOutputHtml(activeChannel)"
                >
                  Download HTML
                </button>
                <button
                  type="button"
                  class="copy-mini"
                  (click)="downloadOutput(activeChannel)"
                >
                  Markdown
                </button>
              </div>
            </div>
            <div class="editor-grid">
              <label *ngFor="let block of activeChannel.blocks">
                <span class="field-row">
                  <span>{{ block.label }}</span>
                  <button
                    type="button"
                    class="copy-mini"
                    (click)="
                      regenerateSelectedChannelBlock(activeChannel.id, block.id)
                    "
                  >
                    Regenerate
                  </button>
                </span>
                <app-material-rich-text-editor
                  [content]="block.value"
                  (contentChange)="
                    updateChannelBlock(activeChannel.id, block.id, $event)
                  "
                  (editorBlur)="
                    recordChannelBlockEdit(activeChannel.id, block.id)
                  "
                />
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
              <div class="mini-actions">
                <button
                  type="button"
                  class="copy-mini"
                  (click)="copyMaterial(activeMaterial)"
                >
                  Copy
                </button>
                <button
                  type="button"
                  class="copy-mini"
                  (click)="downloadMaterial(activeMaterial)"
                >
                  Download HTML
                </button>
              </div>
            </div>

            <div
              class="surface-tabs"
              *ngIf="activeMaterial.surfaces.length > 1"
            >
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
              <app-material-template-preview
                [asset]="activeMaterial"
                [surface]="activeSurface"
              />

              <div class="editor-grid">
                <label *ngFor="let block of activeSurface.textBlocks">
                  <span class="field-row">
                    <span>{{ block.label }}</span>
                    <button
                      type="button"
                      class="copy-mini"
                      (click)="
                        regenerateSelectedMaterialBlock(
                          activeMaterial.id,
                          activeSurface.id,
                          block.id
                        )
                      "
                    >
                      Regenerate
                    </button>
                  </span>
                  <app-material-rich-text-editor
                    [content]="block.value"
                    (contentChange)="
                      updateMaterialTextBlock(
                        activeMaterial.id,
                        activeSurface.id,
                        block.id,
                        $event
                      )
                    "
                    (editorBlur)="
                      recordMaterialBlockEdit(
                        activeMaterial.id,
                        activeSurface.id,
                        block.id
                      )
                    "
                  />
                </label>
              </div>

              <div
                class="image-editor-stack"
                *ngIf="activeSurface.imageSlots.length"
              >
                <div
                  class="image-editor-card"
                  *ngFor="let slot of activeSurface.imageSlots"
                >
                  <div class="field-row">
                    <span>{{ slot.alt || 'Imagery' }}</span>
                    <span class="image-status">{{ slot.status }}</span>
                  </div>

                  <label>
                    <span>Rendered image URL</span>
                    <input
                      [ngModel]="slot.imageUrl"
                      (ngModelChange)="
                        updateMaterialImageUrl(
                          activeMaterial.id,
                          activeSurface.id,
                          slot.id,
                          $event
                        )
                      "
                      (blur)="
                        recordMaterialImageEdit(activeMaterial.id, slot.id)
                      "
                      [name]="slot.id + '-imageUrl'"
                      placeholder="https://..."
                    />
                  </label>

                  <label>
                    <span>Alt text</span>
                    <input
                      [ngModel]="slot.alt"
                      (ngModelChange)="
                        updateMaterialImageAlt(
                          activeMaterial.id,
                          activeSurface.id,
                          slot.id,
                          $event
                        )
                      "
                      (blur)="
                        recordMaterialImageEdit(activeMaterial.id, slot.id)
                      "
                      [name]="slot.id + '-alt'"
                    />
                  </label>

                  <label>
                    <span>Image prompt</span>
                    <textarea
                      [ngModel]="slot.prompt"
                      (ngModelChange)="
                        updateMaterialImagePrompt(
                          activeMaterial.id,
                          activeSurface.id,
                          slot.id,
                          $event
                        )
                      "
                      (blur)="
                        recordMaterialImageEdit(activeMaterial.id, slot.id)
                      "
                      [name]="slot.id + '-prompt'"
                    ></textarea>
                  </label>
                </div>
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
        <p>
          Your strategy and outputs will appear here after the studio brief is
          complete.
        </p>
        <a routerLink="/create">Go to the generator</a>
      </section>
    </ng-template>
  `,
  styles: [
    `
      .command-deck {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .deck-card {
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 90%,
          transparent
        );
        border-radius: var(--border-radius-lg, 20px);
        box-shadow: var(--shadow-lg, 0 18px 60px rgba(0, 0, 0, 0.25));
        padding: 1.3rem 1.4rem;
      }

      .deck-card-primary {
        background: radial-gradient(
            circle at top left,
            color-mix(in srgb, var(--primary, #d97706) 22%, transparent),
            transparent 55%
          ),
          color-mix(in srgb, var(--surface, #10151c) 90%, transparent);
      }

      .deck-card h2 {
        margin: 0.35rem 0 0.6rem;
        font-family: var(--font-heading, 'Instrument Serif', serif);
        font-weight: 500;
        line-height: 0.98;
      }

      .deck-card p,
      .deck-list,
      .deck-list li {
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      .deck-metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.75rem;
        margin-top: 1rem;
      }

      .deck-metrics div {
        padding: 0.85rem 0.9rem;
        border-radius: 1rem;
        background: color-mix(in srgb, var(--foreground, #fff) 5%, transparent);
        display: grid;
        gap: 0.18rem;
      }

      .deck-metrics strong {
        font-size: 1.25rem;
      }

      .deck-list {
        margin: 0.9rem 0 0;
        padding-left: 1rem;
        display: grid;
        gap: 0.45rem;
      }

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
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 90%,
          transparent
        );
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
        transition: transform var(--animation-duration-fast, 180ms)
            var(--animation-easing, ease),
          border-color var(--animation-duration-fast, 180ms)
            var(--animation-easing, ease),
          background var(--animation-duration-fast, 180ms)
            var(--animation-easing, ease);
      }

      .concept-card.selected,
      .channel-card.active,
      .material-card.active {
        border-color: var(--primary, #f59e0b);
        background: color-mix(
          in srgb,
          var(--primary, #f59e0b) 12%,
          var(--surface, #10151c)
        );
      }

      .material-card.primary {
        box-shadow: var(--shadow-lg, 0 18px 60px rgba(0, 0, 0, 0.25)),
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

      .provenance-pill {
        display: inline-flex;
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        background: color-mix(
          in srgb,
          var(--primary, #f59e0b) 14%,
          transparent
        );
        color: var(--foreground, #f7f1e6);
      }

      .workflow-pill {
        display: inline-flex;
        padding: 0.3rem 0.6rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--foreground, #fff) 8%, transparent);
        color: var(--foreground, #f7f1e6);
        width: fit-content;
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
        background: linear-gradient(
            180deg,
            color-mix(in srgb, var(--primary, #f59e0b) 10%, transparent),
            transparent
          ),
          color-mix(in srgb, var(--surface, #10151c) 96%, transparent);
      }

      .alignment-card {
        display: grid;
        gap: 0.8rem;
        margin: 1rem 0;
        padding: 1rem;
        border-radius: var(--border-radius-md, 14px);
        background: color-mix(
          in srgb,
          var(--primary, #f59e0b) 10%,
          var(--surface, #10151c)
        );
      }

      .alignment-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.9rem;
      }

      .alignment-grid ul {
        margin: 0;
        padding-left: 1.1rem;
      }

      .alignment-grid li {
        color: var(--muted, rgba(255, 255, 255, 0.72));
        line-height: 1.5;
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
        background: var(
          --primary-gradient,
          linear-gradient(135deg, #f59e0b, #0ea5e9)
        );
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
      .image-editor-card input,
      .image-editor-card textarea {
        border-radius: var(--border-radius-md, 14px);
        border: 1px solid
          color-mix(
            in srgb,
            var(--border, rgba(255, 255, 255, 0.12)) 90%,
            transparent
          );
        padding: 0.85rem 0.95rem;
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 86%,
          transparent
        );
        color: var(--foreground, #f7f1e6);
      }

      .image-editor-card textarea {
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

      .concept-actions,
      .workspace-list,
      .compare-grid,
      .metric-grid,
      .feedback-grid {
        display: grid;
        gap: 0.75rem;
      }

      .compare-grid,
      .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .rubric-list {
        margin: 0.75rem 0 0;
        padding-left: 1rem;
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      .copy-mini {
        padding: 0.45rem 0.75rem;
      }

      .mini-actions {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }

      .field-row {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        align-items: center;
      }

      .editor-workbench {
        display: grid;
        gap: 1rem;
        padding: 1.4rem;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        border-radius: var(--border-radius-lg, 20px);
        background: radial-gradient(
            circle at top right,
            color-mix(in srgb, var(--asset-accent, #34d399) 18%, transparent),
            transparent 32%
          ),
          color-mix(in srgb, var(--surface, #10151c) 92%, transparent);
        box-shadow: var(--shadow-lg, 0 18px 60px rgba(0, 0, 0, 0.25));
      }

      .editor-topbar,
      .editor-pane-head {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: flex-start;
      }

      .surface-switcher {
        display: flex;
        flex-wrap: wrap;
        gap: 0.65rem;
      }

      .surface-switcher button {
        padding: 0.65rem 0.9rem;
        border-radius: 999px;
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        background: transparent;
        color: var(--foreground, #f7f1e6);
      }

      .surface-switcher button.active {
        color: var(--background, #081018);
        background: var(
          --primary-gradient,
          linear-gradient(135deg, #f59e0b, #0ea5e9)
        );
        border-color: transparent;
      }

      .editor-main {
        display: grid;
        grid-template-columns: minmax(0, 1.45fr) minmax(320px, 0.8fr);
        gap: 1rem;
      }

      .preview-pane,
      .inspector-pane {
        display: grid;
        gap: 1rem;
        padding: 1.2rem;
        border-radius: calc(var(--border-radius-lg, 20px) - 4px);
        border: 1px solid
          color-mix(
            in srgb,
            var(--border, rgba(255, 255, 255, 0.12)) 90%,
            transparent
          );
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 88%,
          transparent
        );
      }

      .preview-canvas {
        min-height: 42rem;
        padding: 1.1rem;
        border-radius: calc(var(--border-radius-lg, 20px) - 8px);
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.04),
            transparent
          ),
          rgba(6, 10, 18, 0.82);
        border: 1px solid rgba(255, 255, 255, 0.06);
      }

      .web-page-frame,
      .email-frame,
      .social-frame,
      .material-artboard {
        display: grid;
        gap: 0.9rem;
        min-height: 100%;
      }

      .web-page-frame {
        padding: 1.4rem;
        border-radius: 1.2rem;
        background: radial-gradient(
            circle at top right,
            rgba(14, 165, 233, 0.16),
            transparent 22%
          ),
          linear-gradient(180deg, #faf3e6 0%, #fffdf8 100%);
        color: #111827;
      }

      .web-nav-bar,
      .email-chrome,
      .social-chrome,
      .material-artboard-meta {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: center;
        font-size: 0.82rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .email-frame {
        padding: 1.2rem;
        border-radius: 1.2rem;
        background: linear-gradient(180deg, #f5f8ff 0%, #ffffff 100%);
        color: #111827;
        box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
      }

      .social-frame {
        padding: 1.2rem;
        border-radius: 1.3rem;
        background: linear-gradient(
            180deg,
            rgba(255, 255, 255, 0.08),
            transparent
          ),
          linear-gradient(155deg, #111827, #1f2937 58%, #0f172a);
      }

      .material-artboard {
        padding: 1.4rem;
        border-radius: 1.2rem;
        background: linear-gradient(
            180deg,
            rgba(52, 211, 153, 0.08),
            transparent 26%
          ),
          linear-gradient(180deg, #fffdf8 0%, #fff7ed 100%);
        color: #111827;
      }

      .preview-region {
        display: grid;
        gap: 0.35rem;
        text-align: left;
        width: 100%;
        padding: 1rem;
        border-radius: 1rem;
        border: 1px solid rgba(15, 23, 42, 0.08);
        background: rgba(255, 255, 255, 0.76);
        color: inherit;
      }

      .social-frame .preview-region {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.08);
        color: #f8fafc;
      }

      .preview-region.selected {
        outline: 2px solid var(--primary, #f59e0b);
        outline-offset: 2px;
        transform: translateY(-1px);
      }

      .preview-region.region-hero .region-value,
      .preview-region.region-headline .region-value,
      .preview-region.region-subject .region-value,
      .preview-region.region-hook .region-value {
        font-family: var(--font-heading, 'Instrument Serif', serif);
        font-size: clamp(1.4rem, 2vw, 2.25rem);
        line-height: 0.98;
        text-wrap: balance;
      }

      .preview-region.region-cta .region-value {
        display: inline-flex;
        width: fit-content;
        padding: 0.7rem 1rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--primary, #f59e0b) 84%, white);
        color: #081018;
        font-weight: 700;
      }

      .region-label {
        font-size: 0.72rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: color-mix(in srgb, currentColor 58%, transparent);
      }

      .region-value {
        line-height: 1.55;
      }

      .region-value :is(p, ul, ol) {
        margin: 0;
      }

      .region-value :is(ul, ol) {
        padding-left: 1.1rem;
      }

      .inspector-field {
        display: grid;
        gap: 0.5rem;
      }

      .inspector-field app-material-rich-text-editor {
        display: block;
      }

      .inspector-meta {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.75rem;
      }

      .inspector-meta div {
        display: grid;
        gap: 0.25rem;
        padding: 0.85rem;
        border-radius: 1rem;
        background: rgba(255, 255, 255, 0.04);
      }

      .channel-preview,
      .surface-preview,
      .surface-canvas {
        display: grid;
        gap: 0.65rem;
        min-height: 13rem;
        padding: 1rem;
        border-radius: calc(var(--border-radius-lg, 20px) - 4px);
        background: radial-gradient(
            circle at top right,
            color-mix(in srgb, var(--asset-accent, #2563eb) 20%, transparent),
            transparent 32%
          ),
          linear-gradient(
            155deg,
            color-mix(in srgb, var(--asset-primary, #d97706) 26%, #10151c),
            color-mix(in srgb, var(--surface, #10151c) 88%, black)
          );
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
        background: var(
          --primary-gradient,
          linear-gradient(135deg, #f59e0b, #0ea5e9)
        );
        border-color: transparent;
      }

      .surface-workbench {
        display: grid;
        grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
        gap: 1rem;
        align-items: start;
      }

      .image-editor-stack {
        display: grid;
        gap: 0.85rem;
        margin-top: 1rem;
      }

      .image-editor-card {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border-radius: var(--border-radius-md, 14px);
        border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
        background: color-mix(
          in srgb,
          var(--surface, #10151c) 84%,
          transparent
        );
      }

      .image-editor-card label {
        display: grid;
        gap: 0.4rem;
        color: var(--muted, rgba(255, 255, 255, 0.72));
      }

      .image-status {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--foreground, #fff) 8%, transparent);
        color: var(--primary, #f59e0b);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.72rem;
      }

      .surface-canvas,
      app-material-template-preview {
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
      input:focus-visible,
      a:focus-visible,
      textarea:focus-visible {
        outline: 2px solid var(--primary, #f59e0b);
        outline-offset: 2px;
      }

      @media (max-width: 1180px) {
        .command-deck,
        .results-layout,
        .gallery-grid,
        .channel-grid,
        .material-grid,
        .surface-workbench,
        .alignment-grid,
        .editor-main,
        .inspector-meta {
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
  private readonly state = inject(MarketingStateService);
  private readonly generator = inject(MarketingGeneratorService);
  private readonly enrichmentApi = inject(MarketingEnrichmentApiService);
  private readonly insights = inject(MarketingInsightsService);
  private readonly router = inject(Router);

  protected readonly concepts = this.state.concepts;
  protected readonly workspaces = computed(() =>
    typeof (this.state as { workspaces?: unknown }).workspaces === 'function'
      ? (this.state as { workspaces: () => MarketingWorkspace[] }).workspaces()
      : []
  );
  protected readonly currentWorkspaceId = computed(() =>
    typeof (this.state as { currentWorkspaceId?: unknown })
      .currentWorkspaceId === 'function'
      ? (
          this.state as { currentWorkspaceId: () => string }
        ).currentWorkspaceId()
      : ''
  );
  protected readonly workspaceStatus = computed<MarketingWorkspaceStatus>(() =>
    typeof (this.state as { workspaceStatus?: unknown }).workspaceStatus ===
    'function'
      ? (
          this.state as {
            workspaceStatus: () => MarketingWorkspaceStatus;
          }
        ).workspaceStatus()
      : {
          storageLabel: 'Browser storage only',
          currentWorkspaceName: this.currentWorkspaceName(),
          workspaceCount: this.workspaces().length,
          currentVersionCount: this.workspaceVersions().length,
          conceptCount: this.concepts().length,
          lastSavedAt: '',
        }
  );
  protected readonly request = cloneRequest(this.state.request());
  protected readonly personas = AUDIENCE_PERSONAS;
  protected readonly selectedId = signal('');
  protected readonly selectedChannelOutputId = signal('');
  protected readonly selectedMaterialId = signal('');
  protected readonly selectedSurfaceId = signal('');
  protected readonly activeEditorSurfaceId = signal('');
  protected readonly selectedPreviewRegionId = signal('');
  protected readonly compareConceptIds = signal<string[]>([]);
  protected readonly copiedMessage = signal('');
  protected readonly workspaceName = signal('Current Workspace');
  protected readonly selectedConcept = computed<CampaignConcept>(() => {
    const selected = this.concepts().find(
      (concept) => concept.id === this.selectedId()
    );

    return selected ?? this.concepts()[0];
  });
  protected readonly selectedChannelOutput = computed<
    ChannelOutput | undefined
  >(() => {
    const concept = this.selectedConcept();
    return (
      concept.channelOutputs.find(
        (output) => output.id === this.selectedChannelOutputId()
      ) || concept.channelOutputs[0]
    );
  });
  protected readonly selectedMaterialOutput = computed<
    CampaignAsset | undefined
  >(() => {
    const concept = this.selectedConcept();
    return (
      concept.materialOutputs.find(
        (asset) => asset.id === this.selectedMaterialId()
      ) || concept.materialOutputs[0]
    );
  });
  protected readonly selectedMaterialSurface = computed<
    MaterialSurface | undefined
  >(() => {
    const material = this.selectedMaterialOutput();
    if (!material) {
      return undefined;
    }

    return (
      material.surfaces.find(
        (surface) => surface.id === this.selectedSurfaceId()
      ) || material.surfaces[0]
    );
  });
  protected readonly comparedConcepts = computed(
    () =>
      this.compareConceptIds()
        .map((id) => this.concepts().find((concept) => concept.id === id))
        .filter(Boolean) as CampaignConcept[]
  );
  protected readonly insightsSummary = this.insights.summary;
  protected readonly workspaceVersions = computed(
    () => this.readCurrentWorkspace()?.versions ?? []
  );
  protected readonly workspaceDecisionSummary = computed(
    () => this.readCurrentWorkspace()?.decisionSummary ?? ''
  );
  protected readonly selectedConceptFeedback = computed(() =>
    this.insights.feedbackSummaryForConcept(this.selectedConcept()?.id || '')
  );
  protected readonly editorSurfaces = computed<EditorSurface[]>(() => {
    const concept = this.selectedConcept();
    const channelSurfaces = concept.channelOutputs.map((output) =>
      this.buildChannelEditorSurface(output)
    );
    const materialSurfaces = concept.materialOutputs.flatMap((asset) =>
      asset.surfaces.map((surface) =>
        this.buildMaterialEditorSurface(asset, surface)
      )
    );

    return [...channelSurfaces, ...materialSurfaces];
  });
  protected readonly activeEditorSurface = computed<EditorSurface | undefined>(
    () => {
      return (
        this.editorSurfaces().find(
          (surface) => surface.id === this.activeEditorSurfaceId()
        ) || this.editorSurfaces()[0]
      );
    }
  );
  protected readonly selectedPreviewRegion = computed<
    PreviewRegion | undefined
  >(() => {
    const activeSurface = this.activeEditorSurface();
    if (!activeSurface) {
      return undefined;
    }

    return (
      activeSurface.regions.find(
        (region) => region.id === this.selectedPreviewRegionId()
      ) || activeSurface.regions[0]
    );
  });

  constructor() {
    const currentWorkspace = this.readCurrentWorkspace();
    this.selectedId.set(
      currentWorkspace?.selectedConceptId || this.concepts()[0]?.id || ''
    );
    this.workspaceName.set(currentWorkspace?.name || 'Current Workspace');

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
        !concept.materialOutputs.some(
          (asset) => asset.id === this.selectedMaterialId()
        )
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
          !material.surfaces.some(
            (surface) => surface.id === this.selectedSurfaceId()
          )
        ) {
          this.selectedSurfaceId.set(material.surfaces[0]?.id ?? '');
        }
      }

      const activeSurface = this.activeEditorSurface();
      if (
        !activeSurface ||
        !this.editorSurfaces().some(
          (surface) => surface.id === this.activeEditorSurfaceId()
        )
      ) {
        this.activeEditorSurfaceId.set(this.editorSurfaces()[0]?.id ?? '');
      }

      const currentSurface = this.activeEditorSurface();
      if (
        currentSurface &&
        !currentSurface.regions.some(
          (region) => region.id === this.selectedPreviewRegionId()
        )
      ) {
        this.selectedPreviewRegionId.set(currentSurface.regions[0]?.id ?? '');
      }
    });
  }

  selectConcept(conceptId: string): void {
    this.selectedId.set(conceptId);
    this.state.setSelectedConceptId(conceptId);
    this.logEvent('concept_selected', { conceptId });
  }

  selectChannelOutput(outputId: string): void {
    this.selectedChannelOutputId.set(outputId);
  }

  selectMaterialOutput(materialId: string, surfaceId: string): void {
    this.selectedMaterialId.set(materialId);
    this.selectedSurfaceId.set(surfaceId);
  }

  setActiveEditorSurface(surfaceId: string): void {
    this.activeEditorSurfaceId.set(surfaceId);
    const surface = this.activeEditorSurface();
    if (surface?.output) {
      this.selectedChannelOutputId.set(surface.output.id);
    }
    if (surface?.asset && surface.surface) {
      this.selectedMaterialId.set(surface.asset.id);
      this.selectedSurfaceId.set(surface.surface.id);
    }
    this.selectedPreviewRegionId.set(surface?.regions[0]?.id ?? '');
  }

  selectPreviewRegion(regionId: string): void {
    this.selectedPreviewRegionId.set(regionId);
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

  updateSelectedPreviewRegion(value: string): void {
    const region = this.selectedPreviewRegion();
    if (!region) {
      return;
    }

    if (region.kind === 'channel' && region.outputId) {
      this.updateChannelBlock(region.outputId, region.blockId, value);
      return;
    }

    if (region.materialId && region.surfaceId) {
      this.updateMaterialTextBlock(
        region.materialId,
        region.surfaceId,
        region.blockId,
        value
      );
    }
  }

  previewRegionHtml(value: string): string {
    return this.sanitizeRichTextHtml(value);
  }

  plainText(value: string): string {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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

  updateMaterialImagePrompt(
    materialId: string,
    surfaceId: string,
    slotId: string,
    prompt: string
  ): void {
    this.updateMaterialImageSlot(materialId, surfaceId, slotId, { prompt });
  }

  updateMaterialImageAlt(
    materialId: string,
    surfaceId: string,
    slotId: string,
    alt: string
  ): void {
    this.updateMaterialImageSlot(materialId, surfaceId, slotId, { alt });
  }

  updateMaterialImageUrl(
    materialId: string,
    surfaceId: string,
    slotId: string,
    imageUrl: string
  ): void {
    this.updateMaterialImageSlot(materialId, surfaceId, slotId, { imageUrl });
  }

  async regenerate(): Promise<void> {
    const normalizedRequest = this.normalizedRequest();
    this.state.setRequest(normalizedRequest);
    this.logEvent('generation_regenerated', {
      conceptId: this.selectedConcept().id,
      metadata: { channel: normalizedRequest.channel },
    });
    const baseConcepts = await this.generator.generateConcepts(
      normalizedRequest
    );
    const enrichmentResult = normalizedRequest.includeAiPolish
      ? await this.enrichmentApi.enrichConcepts(normalizedRequest, baseConcepts)
      : null;
    const concepts = enrichmentResult
      ? this.applyProvenance(
          enrichmentResult.concepts,
          true,
          enrichmentResult.enrichmentApplied
        )
      : this.applyProvenance(baseConcepts, false, false);
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
      ...concept.channelOutputs.map((output) =>
        this.formatChannelOutput(output)
      ),
      ...concept.materialOutputs.map((asset) =>
        this.formatMaterialOutput(asset)
      ),
      concept.cta,
    ].join('\n\n');

    await this.copyText(payload, 'Strategy and outputs copied to clipboard.');
  }

  async copyOutput(output: ChannelOutput): Promise<void> {
    this.logEvent('output_copied', {
      conceptId: this.selectedConcept().id,
      outputId: output.id,
    });
    await this.copyText(
      this.formatChannelOutput(output),
      `${output.label} copied to clipboard.`
    );
  }

  async copyMaterial(asset: CampaignAsset): Promise<void> {
    this.logEvent('material_copied', {
      conceptId: this.selectedConcept().id,
      outputId: asset.id,
    });
    await this.copyText(
      this.formatMaterialOutput(asset),
      `${asset.label} copied to clipboard.`
    );
  }

  async copyActiveSurface(): Promise<void> {
    const activeSurface = this.activeEditorSurface();
    if (!activeSurface) {
      return;
    }

    if (activeSurface.output) {
      await this.copyOutput(activeSurface.output);
      return;
    }

    if (activeSurface.asset) {
      await this.copyMaterial(activeSurface.asset);
    }
  }

  downloadActiveSurface(): void {
    const activeSurface = this.activeEditorSurface();
    if (!activeSurface) {
      return;
    }

    if (activeSurface.output) {
      this.downloadOutputHtml(activeSurface.output);
      return;
    }

    if (activeSurface.asset) {
      this.downloadMaterial(activeSurface.asset);
    }
  }

  downloadConceptBundle(format: 'markdown' | 'json' | 'manifest'): void {
    const bundle = this.buildConceptExportBundle();
    this.logEvent('bundle_exported', {
      conceptId: bundle.conceptId,
      metadata: { format },
    });

    if (format === 'markdown') {
      this.downloadText(
        `${bundle.conceptId}.md`,
        bundle.markdown,
        'text/markdown'
      );
      return;
    }

    if (format === 'manifest') {
      this.downloadText(
        `${bundle.conceptId}.manifest.json`,
        JSON.stringify(bundle.manifest, null, 2),
        'application/json'
      );
      return;
    }

    this.downloadText(
      `${bundle.conceptId}.bundle.json`,
      JSON.stringify(bundle.json, null, 2),
      'application/json'
    );
  }

  downloadOutput(output: ChannelOutput): void {
    this.logEvent('output_downloaded', {
      conceptId: this.selectedConcept().id,
      outputId: output.id,
      metadata: { format: 'markdown' },
    });
    this.downloadText(
      `${output.id}.md`,
      this.formatChannelOutput(output),
      'text/markdown'
    );
  }

  downloadOutputHtml(output: ChannelOutput): void {
    this.logEvent('output_downloaded', {
      conceptId: this.selectedConcept().id,
      outputId: output.id,
      metadata: { format: 'html' },
    });
    this.downloadText(
      `${output.id}.html`,
      this.buildChannelExportHtml(output),
      'text/html'
    );
  }

  downloadMaterial(asset: CampaignAsset): void {
    const html = this.buildMaterialExportHtml(asset);
    this.logEvent('material_downloaded', {
      conceptId: this.selectedConcept().id,
      outputId: asset.id,
    });

    this.downloadText(`${asset.downloadFileName}.html`, html, 'text/html');
  }

  buildConceptExportBundle(): {
    conceptId: string;
    markdown: string;
    manifest: {
      conceptId: string;
      headline: string;
      provenance: string;
      channels: string[];
      assets: string[];
      businessName: string;
      exportFiles: Array<{
        path: string;
        type: string;
        surface: 'channel' | 'material' | 'bundle';
      }>;
    };
    json: {
      request: GenerationRequest;
      concept: CampaignConcept;
      manifest: {
        conceptId: string;
        headline: string;
        provenance: string;
        channels: string[];
        assets: string[];
        businessName: string;
        exportFiles: Array<{
          path: string;
          type: string;
          surface: 'channel' | 'material' | 'bundle';
        }>;
      };
      files: Array<{ path: string; type: string; content: string }>;
    };
  } {
    const concept = this.selectedConcept();
    const exportFiles: Array<{
      path: string;
      type: string;
      surface: 'channel' | 'material' | 'bundle';
    }> = [
      { path: `${concept.id}.md`, type: 'text/markdown', surface: 'bundle' },
    ];
    const channelFiles = concept.channelOutputs.flatMap((output) => [
      {
        path: `${output.id}.html`,
        type: 'text/html',
        surface: 'channel' as const,
        content: this.buildChannelExportHtml(output),
      },
      {
        path: `${output.id}.md`,
        type: 'text/markdown',
        surface: 'channel' as const,
        content: this.formatChannelOutput(output),
      },
    ]);
    const assetFiles = concept.materialOutputs.map((asset) => ({
      path: asset.downloadFileName + '.html',
      type: 'text/html',
      surface: 'material' as const,
      content: this.buildMaterialExportHtml(asset),
    }));
    const manifestExportFiles: Array<{
      path: string;
      type: string;
      surface: 'channel' | 'material' | 'bundle';
    }> = [
      ...exportFiles,
      ...channelFiles.map(({ path, type, surface }) => ({
        path,
        type,
        surface,
      })),
      ...assetFiles.map(({ path, type, surface }) => ({
        path,
        type,
        surface,
      })),
    ];
    const markdown = [
      `# ${concept.headline}`,
      `Provenance: ${this.provenanceLabel(concept.generationProvenance)}`,
      `Primary channel: ${this.request.channel}`,
      `Bundled channels: ${[
        this.request.channel,
        ...this.request.secondaryChannels,
      ].join(', ')}`,
      concept.subheadline,
      ...concept.sections.map(
        (section) => `## ${section.title}\n${section.body}`
      ),
      '## Production exports',
      ...channelFiles.map((file) => `- ${file.path}`),
      ...assetFiles.map((file) => `- ${file.path}`),
      ...concept.channelOutputs.map((output) =>
        this.formatChannelOutput(output)
      ),
      ...concept.materialOutputs.map((asset) =>
        this.formatMaterialOutput(asset)
      ),
    ].join('\n\n');
    const manifest = {
      conceptId: concept.id,
      headline: concept.headline,
      provenance: this.provenanceLabel(concept.generationProvenance),
      channels: concept.channelOutputs.map((output) => output.type),
      assets: assetFiles.map((file) => file.path),
      businessName: this.request.brand.businessName || 'Unspecified brand',
      exportFiles: manifestExportFiles,
    };

    return {
      conceptId: concept.id,
      markdown,
      manifest,
      json: {
        request: this.normalizedRequest(),
        concept,
        manifest,
        files: [
          {
            path: `${concept.id}.md`,
            type: 'text/markdown',
            content: markdown,
          },
          ...channelFiles.map(({ path, type, content }) => ({
            path,
            type,
            content,
          })),
          ...assetFiles,
        ],
      },
    };
  }

  private buildMaterialExportHtml(asset: CampaignAsset): string {
    const payload = asset.surfaces
      .map((surface) =>
        `
<section class="surface-section">
  <h2>${this.escapeHtml(surface.label)}</h2>
  ${
    surface.imageSlots.length
      ? `<div class="image-export-grid">
  ${surface.imageSlots
    .map((slot) => this.buildImageExportHtml(slot))
    .join('\n')}
</div>`
      : ''
  }
  ${surface.textBlocks
    .map(
      (block) => `<div class="text-block ${block.role}">
    <span class="block-label">${this.escapeHtml(block.label)}</span>
    <div class="block-copy">${this.sanitizeRichTextHtml(block.value)}</div>
  </div>`
    )
    .join('\n')}
</section>`.trim()
      )
      .join('\n');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${this.escapeHtml(asset.label)}</title>
    <style>
      body {
        font-family: Inter, system-ui, sans-serif;
        margin: 0;
        color: #111827;
        background: #fff7ed;
      }
      .shell {
        width: min(1080px, calc(100% - 3rem));
        margin: 2rem auto;
        border: 2px solid ${this.escapeHtml(this.request.brand.primaryColor)};
        border-radius: 24px;
        padding: 2rem;
        background: linear-gradient(180deg, ${this.escapeHtml(
          this.request.brand.accentColor
        )}22, transparent 24%);
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
      }
      h1, h2 { margin: 0 0 1rem; }
      .meta {
        display: inline-block;
        margin-bottom: 1rem;
        padding: 0.35rem 0.7rem;
        border-radius: 999px;
        background: ${this.escapeHtml(this.request.brand.primaryColor)};
        color: white;
      }
      .surface-section { margin-top: 1.5rem; display: grid; gap: 1rem; }
      .text-block { display: grid; gap: 0.4rem; }
      .block-label {
        font-size: 0.78rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: #92400e;
      }
      .block-copy { line-height: 1.7; }
      .block-copy :is(p, h1, h2, h3, ul, ol) { margin: 0; }
      .text-block.headline .block-copy,
      .text-block.subheadline .block-copy {
        font-family: Georgia, serif;
      }
      .text-block.headline .block-copy {
        font-size: clamp(2rem, 4vw, 3rem);
        line-height: 0.96;
      }
      .text-block.cta .block-copy {
        display: inline-flex;
        width: fit-content;
        padding: 0.75rem 1rem;
        border-radius: 999px;
        background: ${this.escapeHtml(this.request.brand.accentColor)};
        color: #081018;
        font-weight: 700;
      }
      .image-export-grid {
        display: grid;
        gap: 1rem;
      }
      .image-export-card {
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.08);
        border-radius: 18px;
        background: white;
      }
      .image-export-card img {
        display: block;
        width: 100%;
        max-height: 24rem;
        object-fit: cover;
      }
      .image-export-fallback {
        min-height: 14rem;
        padding: 1rem;
        display: grid;
        align-content: end;
        background: linear-gradient(135deg, ${this.escapeHtml(
          this.request.brand.primaryColor
        )}22, ${this.escapeHtml(this.request.brand.accentColor)}22);
      }
      .image-export-meta {
        display: grid;
        gap: 0.35rem;
        padding: 1rem;
      }
      .image-export-meta p {
        margin: 0;
        line-height: 1.6;
      }
    </style>
  </head>
  <body>
    <article class="shell">
      <div class="meta">${this.escapeHtml(
        this.request.brand.businessName || 'Signal Foundry'
      )}</div>
      <h1>${this.escapeHtml(asset.label)}</h1>
      ${payload}
    </article>
  </body>
</html>`;
  }

  private buildChannelExportHtml(output: ChannelOutput): string {
    const renderedBlocks = output.blocks
      .map(
        (block) => `<section class="channel-block ${block.role}">
  <span class="channel-label">${this.escapeHtml(block.label)}</span>
  <div class="channel-copy">${this.sanitizeRichTextHtml(block.value)}</div>
</section>`
      )
      .join('\n');

    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${this.escapeHtml(output.label)}</title>
    <style>
      body {
        margin: 0;
        font-family: Inter, system-ui, sans-serif;
        background: ${output.type === 'email-sequence' ? '#eef2ff' : '#f8fafc'};
        color: #111827;
      }
      .shell {
        width: min(960px, calc(100% - 3rem));
        margin: 2rem auto;
        padding: 2rem;
        border-radius: 24px;
        background: white;
        border: 1px solid rgba(15, 23, 42, 0.08);
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.14);
      }
      .meta {
        display: inline-flex;
        margin-bottom: 1rem;
        padding: 0.3rem 0.65rem;
        border-radius: 999px;
        background: ${this.escapeHtml(this.request.brand.primaryColor)};
        color: white;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 0.78rem;
      }
      .channel-stack {
        display: grid;
        gap: 1rem;
      }
      .channel-block {
        display: grid;
        gap: 0.45rem;
        padding: 1rem;
        border-radius: 18px;
        background: ${
          output.type === 'social-campaign'
            ? 'linear-gradient(155deg, #111827, #1f2937)'
            : '#fff7ed'
        };
        color: ${output.type === 'social-campaign' ? '#f8fafc' : '#111827'};
      }
      .channel-block.cta .channel-copy {
        display: inline-flex;
        width: fit-content;
        padding: 0.75rem 1rem;
        border-radius: 999px;
        background: ${this.escapeHtml(this.request.brand.accentColor)};
        color: #081018;
        font-weight: 700;
      }
      .channel-copy { line-height: 1.7; }
      .channel-copy :is(p, h1, h2, h3, ul, ol) { margin: 0; }
      .channel-label {
        font-size: 0.78rem;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: ${
          output.type === 'social-campaign'
            ? 'rgba(248, 250, 252, 0.72)'
            : '#92400e'
        };
      }
      .channel-block.hero .channel-copy,
      .channel-block.subject .channel-copy,
      .channel-block.hook .channel-copy {
        font-family: Georgia, serif;
        font-size: clamp(1.8rem, 4vw, 2.8rem);
        line-height: 0.96;
      }
    </style>
  </head>
  <body>
    <article class="shell">
      <div class="meta">${this.escapeHtml(output.type)}</div>
      <h1>${this.escapeHtml(output.label)}</h1>
      <div class="channel-stack">
        ${renderedBlocks}
      </div>
    </article>
  </body>
</html>`;
  }

  private buildImageExportHtml(
    slot: MaterialSurface['imageSlots'][number]
  ): string {
    const imageSrc = this.safeImageUrl(slot.imageUrl, slot.imageBase64);
    return `<article class="image-export-card">
  ${
    imageSrc
      ? `<img src="${imageSrc}" alt="${this.escapeHtml(slot.alt)}" />`
      : `<div class="image-export-fallback">
    <strong>${this.escapeHtml(slot.alt || 'Image placeholder')}</strong>
    <p>${this.escapeHtml(slot.prompt)}</p>
  </div>`
  }
  <div class="image-export-meta">
    <p><strong>Alt:</strong> ${this.escapeHtml(slot.alt)}</p>
    <p><strong>Status:</strong> ${this.escapeHtml(slot.status)}</p>
    <p><strong>Prompt:</strong> ${this.escapeHtml(slot.prompt)}</p>
  </div>
</article>`;
  }

  protected assetPreviewText(asset: CampaignAsset): string {
    return asset.surfaces
      .flatMap((surface) => surface.textBlocks)
      .map((block) => this.plainText(block.value))
      .filter(Boolean)
      .slice(0, 3)
      .join(' ');
  }

  protected assetHeadline(asset: CampaignAsset): string {
    return this.plainText(
      asset.surfaces[0]?.textBlocks[0]?.value || asset.label
    );
  }

  protected channelHeadline(output: ChannelOutput): string {
    return this.plainText(output.blocks[0]?.value || output.label);
  }

  protected firstSurfaceId(asset: CampaignAsset): string {
    return asset.surfaces[0]?.id || '';
  }

  protected firstSurfaceLabel(asset: CampaignAsset): string {
    return asset.surfaces[0]?.label || 'Surface';
  }

  describeDeliveryModel(deliveryModel: DeliveryModel): string {
    switch (deliveryModel) {
      case 'hosted':
        return 'Hosted';
      case 'self-hosted':
        return 'Self-hosted';
      case 'hybrid':
        return 'Hybrid hosted and self-hosted';
      case 'npm-package':
        return 'npm package';
    }
  }

  describePricingModel(pricingModel: PricingModel): string {
    switch (pricingModel) {
      case 'metered':
        return 'Metered usage';
      case 'block-usage':
        return 'Block usage';
      case 'subscription-unlimited':
        return 'Subscription unlimited';
      case 'free':
        return 'Free';
    }
  }

  provenanceLabel(provenance: GenerationProvenance | undefined): string {
    switch (provenance) {
      case 'ai-enriched':
        return 'AI enriched';
      case 'ai-fallback':
        return 'AI fallback';
      default:
        return 'Template only';
    }
  }

  provenanceDescription(provenance: GenerationProvenance | undefined): string {
    switch (provenance) {
      case 'ai-enriched':
        return 'Hybrid assistance shaped this concept and the workbench is carrying the enriched copy forward.';
      case 'ai-fallback':
        return 'Template-safe copy is in place because enrichment was unavailable for this run.';
      default:
        return 'This concept was produced from the structured template system without enrichment.';
    }
  }

  formatSavedAt(value: string): string {
    if (!value) {
      return 'Saved locally during this session';
    }

    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      return 'Saved locally';
    }

    return `Saved locally ${timestamp.toLocaleString()}`;
  }

  workflowLabel(status: ConceptWorkflowStatus | undefined): string {
    switch (status) {
      case 'selected':
        return 'Selected';
      case 'shortlisted':
        return 'Shortlisted';
      case 'archived':
        return 'Archived';
      default:
        return 'Candidate';
    }
  }

  markConceptSelected(conceptId: string): void {
    this.selectedId.set(conceptId);
    this.state.setSelectedConceptId(conceptId);
    this.logEvent('concept_selected', { conceptId });
    this.state.setConcepts(
      this.state.concepts().map((concept) => ({
        ...concept,
        workflowStatus:
          concept.id === conceptId
            ? ('selected' as const)
            : concept.workflowStatus === 'archived'
            ? 'archived'
            : 'candidate',
      }))
    );
  }

  chooseComparedWinner(conceptId: string): void {
    const winner = this.state
      .concepts()
      .find((concept) => concept.id === conceptId);
    const loserIds = this.compareConceptIds().filter((id) => id !== conceptId);
    if (!winner) {
      return;
    }

    this.markConceptSelected(conceptId);
    this.state.setConcepts(
      this.state.concepts().map((concept) => ({
        ...concept,
        workflowStatus:
          concept.id === conceptId
            ? ('selected' as const)
            : loserIds.includes(concept.id)
            ? ('archived' as const)
            : concept.workflowStatus === 'shortlisted'
            ? 'shortlisted'
            : 'candidate',
      }))
    );
    this.compareConceptIds.set([]);
    this.state.setDecisionSummary(
      `Winner chosen: ${winner.headline} over ${
        loserIds.length
      } compared option${loserIds.length === 1 ? '' : 's'}.`
    );
    this.logEvent('compare_winner_selected', { conceptId });
    if (
      typeof (this.state as { saveWorkspaceVersion?: unknown })
        .saveWorkspaceVersion === 'function'
    ) {
      (
        this.state as { saveWorkspaceVersion: (name?: string) => void }
      ).saveWorkspaceVersion(`Winner selected: ${winner.headline}`);
    }
  }

  toggleShortlistConcept(conceptId: string): void {
    this.logEvent('concept_shortlisted', { conceptId });
    this.state.setConcepts(
      this.state.concepts().map((concept) =>
        concept.id === conceptId
          ? {
              ...concept,
              workflowStatus:
                concept.workflowStatus === 'shortlisted'
                  ? ('candidate' as const)
                  : ('shortlisted' as const),
            }
          : concept
      )
    );
  }

  toggleCompareConcept(conceptId: string): void {
    this.logEvent('concept_compared', { conceptId });
    if (this.compareConceptIds().includes(conceptId)) {
      this.compareConceptIds.set(
        this.compareConceptIds().filter((id) => id !== conceptId)
      );
      return;
    }

    this.compareConceptIds.set(
      [...this.compareConceptIds(), conceptId].slice(-2)
    );
  }

  createWorkspaceFromCurrent(): void {
    this.state.setRequest(this.normalizedRequest());
    this.state.setConcepts(this.state.concepts());
    this.state.createWorkspace(this.workspaceName() || 'New Workspace');
  }

  renameWorkspace(): void {
    this.state.renameCurrentWorkspace(
      this.workspaceName() || 'Current Workspace'
    );
  }

  duplicateWorkspace(): void {
    this.state.duplicateCurrentWorkspace();
  }

  saveWorkspaceVersion(): void {
    if (
      typeof (this.state as { saveWorkspaceVersion?: unknown })
        .saveWorkspaceVersion === 'function'
    ) {
      (
        this.state as { saveWorkspaceVersion: (name?: string) => void }
      ).saveWorkspaceVersion(
        `${this.currentWorkspaceName()} snapshot ${
          this.workspaceVersions().length + 1
        }`
      );
      this.logEvent('workspace_version_saved', {
        conceptId: this.selectedConcept().id,
      });
    }
  }

  restoreWorkspaceVersion(versionId: string): void {
    if (
      typeof (this.state as { restoreWorkspaceVersion?: unknown })
        .restoreWorkspaceVersion === 'function'
    ) {
      (
        this.state as { restoreWorkspaceVersion: (versionId: string) => void }
      ).restoreWorkspaceVersion(versionId);
      Object.assign(this.request, cloneRequest(this.state.request()));
      const currentWorkspace = this.readCurrentWorkspace();
      this.workspaceName.set(currentWorkspace?.name || 'Current Workspace');
      this.selectedId.set(
        currentWorkspace?.selectedConceptId ||
          this.state.concepts()[0]?.id ||
          ''
      );
      this.compareConceptIds.set([]);
      this.copiedMessage.set('Workspace version restored.');
      this.logEvent('workspace_version_restored', {
        conceptId:
          currentWorkspace?.selectedConceptId || this.state.concepts()[0]?.id,
      });
    }
  }

  loadWorkspace(id: string): void {
    this.state.selectWorkspace(id);
    Object.assign(this.request, cloneRequest(this.state.request()));
    const currentWorkspace = this.readCurrentWorkspace();
    this.workspaceName.set(currentWorkspace?.name || 'Current Workspace');
    this.selectedId.set(
      currentWorkspace?.selectedConceptId || this.state.concepts()[0]?.id || ''
    );
    this.compareConceptIds.set([]);
  }

  currentWorkspaceName(): string {
    return this.readCurrentWorkspace()?.name || 'Current Workspace';
  }

  submitConceptFeedback(
    sentiment: 'positive' | 'negative',
    reason: string
  ): void {
    this.insights.recordConceptFeedback({
      workspaceId: this.readCurrentWorkspace()?.id,
      conceptId: this.selectedConcept().id,
      sentiment,
      reason,
    });
    this.copiedMessage.set('Feedback recorded.');
  }

  async regenerateSelectedChannelBlock(
    outputId: string,
    blockId: string
  ): Promise<void> {
    const output = this.selectedConcept().channelOutputs.find(
      (item) => item.id === outputId
    );
    const block = output?.blocks.find((item) => item.id === blockId);
    if (!output || !block) {
      return;
    }

    const value = await this.generator.regenerateChannelBlock(
      this.normalizedRequest(),
      this.selectedConcept(),
      output,
      block
    );

    this.updateChannelBlock(outputId, blockId, value);
    this.logEvent('block_regenerated', {
      conceptId: this.selectedConcept().id,
      outputId,
      blockId,
      metadata: { surface: 'channel' },
    });
    this.copiedMessage.set(`${block.label} regenerated.`);
  }

  async regenerateSelectedPreviewRegion(): Promise<void> {
    const region = this.selectedPreviewRegion();
    if (!region) {
      return;
    }

    if (region.kind === 'channel' && region.outputId) {
      await this.regenerateSelectedChannelBlock(
        region.outputId,
        region.blockId
      );
      return;
    }

    if (region.materialId && region.surfaceId) {
      await this.regenerateSelectedMaterialBlock(
        region.materialId,
        region.surfaceId,
        region.blockId
      );
    }
  }

  async regenerateSelectedMaterialBlock(
    materialId: string,
    surfaceId: string,
    blockId: string
  ): Promise<void> {
    const asset = this.selectedConcept().materialOutputs.find(
      (item) => item.id === materialId
    );
    const surface = asset?.surfaces.find((item) => item.id === surfaceId);
    const block = surface?.textBlocks.find((item) => item.id === blockId);
    if (!asset || !surface || !block) {
      return;
    }

    const value = await this.generator.regenerateMaterialTextBlock(
      this.normalizedRequest(),
      this.selectedConcept(),
      asset,
      surface,
      block
    );

    this.updateMaterialTextBlock(materialId, surfaceId, blockId, value);
    this.logEvent('block_regenerated', {
      conceptId: this.selectedConcept().id,
      outputId: materialId,
      blockId,
      metadata: { surface: surfaceId },
    });
    this.copiedMessage.set(`${block.label} regenerated.`);
  }

  recordChannelBlockEdit(outputId: string, blockId: string): void {
    this.logEvent('block_updated', {
      conceptId: this.selectedConcept().id,
      outputId,
      blockId,
      metadata: { surface: 'channel' },
    });
  }

  recordMaterialBlockEdit(
    materialId: string,
    surfaceId: string,
    blockId: string
  ): void {
    this.logEvent('block_updated', {
      conceptId: this.selectedConcept().id,
      outputId: materialId,
      blockId,
      metadata: { surface: surfaceId },
    });
  }

  recordMaterialImageEdit(materialId: string, blockId: string): void {
    this.logEvent('block_updated', {
      conceptId: this.selectedConcept().id,
      outputId: materialId,
      blockId,
      metadata: { surface: 'image' },
    });
  }

  recordSelectedPreviewRegionEdit(): void {
    const region = this.selectedPreviewRegion();
    if (!region) {
      return;
    }

    if (region.kind === 'channel' && region.outputId) {
      this.recordChannelBlockEdit(region.outputId, region.blockId);
      return;
    }

    if (region.materialId && region.surfaceId) {
      this.recordMaterialBlockEdit(
        region.materialId,
        region.surfaceId,
        region.blockId
      );
    }
  }

  private updateConcepts(
    updater: (concept: CampaignConcept) => CampaignConcept
  ): void {
    const updated = this.state
      .concepts()
      .map((concept) =>
        concept.id === this.selectedConcept().id ? updater(concept) : concept
      );
    this.state.setConcepts(updated);
  }

  private updateMaterialImageSlot(
    materialId: string,
    surfaceId: string,
    slotId: string,
    updates: Partial<MaterialSurface['imageSlots'][number]>
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
                      imageSlots: surface.imageSlots.map((slot) =>
                        slot.id === slotId ? { ...slot, ...updates } : slot
                      ),
                    }
                  : surface
              ),
            }
          : asset
      ),
    }));
  }

  private buildChannelEditorSurface(output: ChannelOutput): EditorSurface {
    return {
      id: `surface-${output.id}`,
      type:
        output.type === 'landing-page'
          ? 'web'
          : output.type === 'email-sequence'
          ? 'email'
          : 'social',
      title: output.label,
      subtitle: output.type,
      description: output.summary,
      output,
      regions: output.blocks.map((block) => ({
        id: `region-${output.id}-${block.id}`,
        label: block.label,
        value: block.value,
        role: block.role,
        kind: 'channel' as const,
        outputId: output.id,
        blockId: block.id,
      })),
    };
  }

  private buildMaterialEditorSurface(
    asset: CampaignAsset,
    surface: MaterialSurface
  ): EditorSurface {
    return {
      id: `surface-${asset.id}-${surface.id}`,
      type: 'material',
      title: asset.label,
      subtitle: surface.label,
      description: `${asset.layoutVariant} artboard preview`,
      asset,
      surface,
      regions: surface.textBlocks.map((block) => ({
        id: `region-${asset.id}-${surface.id}-${block.id}`,
        label: block.label,
        value: block.value,
        role: block.role,
        kind: 'material' as const,
        materialId: asset.id,
        surfaceId: surface.id,
        blockId: block.id,
      })),
    };
  }

  private formatChannelOutput(output: ChannelOutput): string {
    return [
      output.label,
      output.summary,
      ...output.blocks.map(
        (block) => `${block.label}: ${this.plainText(block.value)}`
      ),
    ].join('\n');
  }

  private formatMaterialOutput(asset: CampaignAsset): string {
    return [
      asset.label,
      `Layout: ${asset.layoutVariant}`,
      ...asset.surfaces.flatMap((surface) => [
        `${surface.label}`,
        ...surface.textBlocks.map(
          (block) => `${block.label}: ${this.plainText(block.value)}`
        ),
        ...surface.imageSlots.map(
          (slot) =>
            `Image: ${slot.alt} | ${slot.status} | ${
              slot.imageUrl || slot.prompt
            }`
        ),
      ]),
    ].join('\n');
  }

  private sanitizeRichTextHtml(value: string): string {
    const normalized = value.trim()
      ? this.looksLikeHtml(value)
        ? value
        : `<p>${this.escapeHtml(value.trim())}</p>`
      : '<p></p>';

    return normalized
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '')
      .replace(/\son\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '');
  }

  private looksLikeHtml(value: string): boolean {
    return /^<(?:(?:[A-Za-z][\w:-]*)|\/(?:[A-Za-z][\w:-]*)|!DOCTYPE|!--)/.test(
      value.trim()
    );
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private safeImageUrl(
    imageUrl?: string | null,
    imageBase64?: string | null
  ): string | null {
    if (imageBase64) {
      return imageBase64.startsWith('data:image/')
        ? imageBase64
        : `data:image/png;base64,${imageBase64}`;
    }

    if (!imageUrl) {
      return null;
    }

    return /^(https?:)?\/\//i.test(imageUrl) ? this.escapeHtml(imageUrl) : null;
  }

  private applyProvenance(
    concepts: CampaignConcept[],
    includeAiPolish: boolean,
    enrichmentApplied: boolean
  ): CampaignConcept[] {
    return concepts.map((concept) => ({
      ...concept,
      generationProvenance: !includeAiPolish
        ? ('template-only' as const)
        : enrichmentApplied && concept.generationMode === 'hybrid'
        ? ('ai-enriched' as const)
        : enrichmentApplied
        ? ('template-only' as const)
        : ('ai-fallback' as const),
    }));
  }

  private normalizedRequest(): typeof this.request {
    return {
      ...this.request,
      secondaryChannels: this.request.secondaryChannels.filter(
        (channel) => channel !== this.request.channel
      ),
    };
  }

  private readCurrentWorkspace(): MarketingWorkspace | null {
    return typeof (this.state as { currentWorkspace?: unknown })
      .currentWorkspace === 'function'
      ? (
          this.state as { currentWorkspace: () => MarketingWorkspace | null }
        ).currentWorkspace()
      : null;
  }

  private logEvent(
    type:
      | 'generation_regenerated'
      | 'concept_selected'
      | 'concept_shortlisted'
      | 'concept_compared'
      | 'compare_winner_selected'
      | 'bundle_exported'
      | 'output_copied'
      | 'output_downloaded'
      | 'material_copied'
      | 'material_downloaded'
      | 'block_updated'
      | 'block_regenerated'
      | 'workspace_version_saved'
      | 'workspace_version_restored',
    payload: {
      conceptId?: string;
      outputId?: string;
      blockId?: string;
      metadata?: Record<string, string | number | boolean>;
    }
  ): void {
    this.insights.logEvent({
      type,
      workspaceId: this.readCurrentWorkspace()?.id,
      conceptId: payload.conceptId,
      outputId: payload.outputId,
      blockId: payload.blockId,
      metadata: payload.metadata,
    });
  }

  private downloadText(filename: string, value: string, type: string): void {
    if (typeof document === 'undefined') {
      this.copiedMessage.set('Download unavailable here.');
      return;
    }

    const blob = new Blob([value], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
    this.copiedMessage.set(`${filename} downloaded.`);
  }

  private async copyText(value: string, successMessage: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      this.copiedMessage.set(successMessage);
      return;
    }

    this.copiedMessage.set(
      'Clipboard unavailable here. Returning to the generator.'
    );
    await this.router.navigate(['/create']);
  }
}
