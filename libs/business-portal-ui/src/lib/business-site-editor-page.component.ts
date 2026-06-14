import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  type BlockFieldDefinition,
  type BlockDefinition,
  type BlockInstance,
} from '@optimistic-tanuki/app-config-models';
import {
  BusinessAssetLibraryItem,
  BusinessApiService,
  BusinessAuthService,
  BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS,
  BusinessSiteConfig,
  BusinessSiteConfigStore,
  BusinessStoreProduct,
  businessSiteConfigToConfigDocument,
  cloneBusinessSiteConfig,
  configDocumentToBusinessSiteConfig,
  GridLayoutSlot,
  LandingSection,
  LandingSectionMediaItem,
  LandingSectionMotionKind,
  LandingSectionRichContent,
  normalizeLandingSections,
  SplitLayoutSlot,
} from '@optimistic-tanuki/business-data-access';
import { BusinessLandingPageComponent } from '@optimistic-tanuki/business-public-ui';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import {
  CheckboxComponent,
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';
import {
  EditorBlockTreeComponent,
  EditorDesignSystemPanelComponent,
  type EditorThemeDraftValue,
  SchemaBlockInspectorComponent,
  SchemaCollectionPanelComponent,
  SchemaFormPanelComponent,
  SchemaStringListPanelComponent,
} from '@optimistic-tanuki/configurable-client-ui';
import { ComposeComponent, type PostData } from '@optimistic-tanuki/social-ui';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { PREDEFINED_PERSONALITIES } from '@optimistic-tanuki/theme-models';
import { firstValueFrom } from 'rxjs';

interface AssetUploadPayload {
  name: string;
  profileId: string;
  type: 'image';
  content: string;
  fileExtension: string;
}

const MAX_IMAGE_UPLOAD_BYTES = 20 * 1024 * 1024;

type EditorMode = 'guided' | 'studio';
type SupportedThemeFieldKey = keyof BusinessSiteConfig['theme'];

interface GuidedStepDefinition {
  id: string;
  label: string;
  summary: string;
  anchorId: string;
}

type EditorPanelId =
  | 'design'
  | 'business-info'
  | 'contact'
  | 'features'
  | 'layout'
  | 'offers'
  | 'review'
  | 'testimonials';

const BRAND_IDENTITY_FIELDS: BlockFieldDefinition[] = [
  {
    key: 'brand.businessName',
    type: 'string',
    label: 'Business Name',
    editor: 'text',
    placeholder: 'North Star Coaching',
  },
  {
    key: 'brand.monogram',
    type: 'string',
    label: 'Monogram',
    editor: 'text',
    placeholder: 'NS',
  },
  {
    key: 'brand.ownerName',
    type: 'string',
    label: 'Owner Name',
    editor: 'text',
    placeholder: 'Jordan Vale',
  },
  {
    key: 'businessType',
    type: 'select',
    label: 'Business Type',
    editor: 'select',
    options: [
      { label: 'General', value: 'general' },
      { label: 'Consulting', value: 'consulting' },
      { label: 'Coaching', value: 'coaching' },
      { label: 'Wellness', value: 'wellness' },
      { label: 'Fitness', value: 'fitness' },
    ],
  },
  {
    key: 'brand.trainerName',
    type: 'string',
    label: 'Alternate Public Name',
    editor: 'text',
    placeholder: 'Jordan Vale',
  },
  {
    key: 'brand.tagline',
    type: 'string',
    label: 'Tagline',
    editor: 'text',
    placeholder: 'Confident growth, deliberate systems.',
  },
  {
    key: 'brand.intro',
    type: 'string',
    label: 'Short Intro',
    editor: 'textarea',
    rows: 3,
    placeholder: 'Short positioning statement for the top of the page.',
  },
  {
    key: 'brand.longBio',
    type: 'string',
    label: 'Full Bio',
    editor: 'textarea',
    rows: 5,
    placeholder: 'Longer editorial biography for visitors.',
  },
];

const CONTACT_FIELDS: BlockFieldDefinition[] = [
  {
    key: 'contact.email',
    type: 'string',
    label: 'Email',
    editor: 'text',
    placeholder: 'hello@example.com',
  },
  {
    key: 'contact.phone',
    type: 'string',
    label: 'Phone',
    editor: 'text',
    placeholder: '(555) 555-5555',
  },
  {
    key: 'contact.location',
    type: 'string',
    label: 'Location / Notes',
    editor: 'textarea',
    rows: 3,
    placeholder: 'Remote, New York, or by appointment.',
  },
  {
    key: 'contact.consultationLabel',
    type: 'string',
    label: 'Consultation CTA Label',
    editor: 'text',
    placeholder: 'Book a consultation',
  },
];

const CLIENT_PORTAL_FIELDS: BlockFieldDefinition[] = [
  {
    key: 'clientPortal.headline',
    type: 'string',
    label: 'Headline',
    editor: 'text',
    placeholder: 'Everything your clients need in one place.',
  },
  {
    key: 'clientPortal.description',
    type: 'string',
    label: 'Description',
    editor: 'textarea',
    rows: 4,
    placeholder: 'Describe the client portal experience.',
  },
];

const SERVICE_FIELDS: BlockFieldDefinition[] = [
  {
    key: 'name',
    type: 'string',
    label: 'Offer Name',
    editor: 'text',
    placeholder: 'Strategy Intensive',
  },
  {
    key: 'price',
    type: 'number',
    label: 'Hourly Price',
    editor: 'text',
    placeholder: '150',
  },
  {
    key: 'duration',
    type: 'number',
    label: 'Duration (minutes)',
    editor: 'text',
    placeholder: '60',
  },
  {
    key: 'allowOnlineBooking',
    type: 'boolean',
    label: 'Public Booking',
    description: 'Allow clients to book this offer from the public site.',
  },
  {
    key: 'description',
    type: 'string',
    label: 'Description',
    editor: 'textarea',
    rows: 3,
    placeholder: 'Describe what this engagement includes.',
  },
];

const TESTIMONIAL_FIELDS: BlockFieldDefinition[] = [
  {
    key: 'quote',
    type: 'string',
    label: 'Quote',
    editor: 'textarea',
    rows: 3,
    placeholder: 'Share a concrete client result or impression.',
  },
  {
    key: 'clientName',
    type: 'string',
    label: 'Client Name',
    editor: 'text',
    placeholder: 'Avery Stone',
  },
  {
    key: 'clientDetail',
    type: 'string',
    label: 'Client Detail',
    editor: 'text',
    placeholder: 'Founder, Northfield Studio',
  },
];

@Component({
  selector: 'business-site-editor-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    ButtonComponent,
    CardComponent,
    BusinessLandingPageComponent,
    CheckboxComponent,
    EditorBlockTreeComponent,
    EditorDesignSystemPanelComponent,
    SelectComponent,
    SchemaBlockInspectorComponent,
    SchemaCollectionPanelComponent,
    SchemaFormPanelComponent,
    SchemaStringListPanelComponent,
    ComposeComponent,
    TextAreaComponent,
    TextInputComponent,
  ],
  template: `
    <div class="editor-shell">
      <div class="page-header entrance">
        <div class="page-header-copy">
          <p class="workspace-kicker">
            {{ editorMode() === 'guided' ? 'Guided Setup' : 'Studio' }}
            workspace
          </p>
          <h1>Site Content Editor</h1>
          <p>
            Edit your public landing-page copy, brand identity, and visual
            theme. Changes take effect after saving.
          </p>
          <p class="workspace-theme-note">
            Active personality:
            <strong>{{ currentPersonalityLabel() }}</strong>
          </p>
        </div>
        <div class="workspace-controls">
          <div class="mode-switch" data-editor-mode-switch>
            <otui-button
              class="mode-switch-btn"
              [class.active]="editorMode() === 'guided'"
              variant="text"
              [useGradient]="false"
              (action)="setEditorMode('guided')"
            >
              Guided Setup
            </otui-button>
            <otui-button
              class="mode-switch-btn"
              [class.active]="editorMode() === 'studio'"
              variant="text"
              [useGradient]="false"
              (action)="setEditorMode('studio')"
            >
              Studio
            </otui-button>
          </div>
        </div>
      </div>

      @if (editorMode() === 'guided') {
      <div class="guided-rail entrance">
        <div class="guided-rail-copy">
          <strong>{{ guidedSteps[guidedStep()].label }}</strong>
          <p>{{ guidedSteps[guidedStep()].summary }}</p>
        </div>
        <div class="guided-steps">
          @for (step of guidedSteps; track step.id; let i = $index) {
          <otui-button
            class="guided-step-chip"
            [class.active]="guidedStep() === i"
            variant="outlined"
            [useGradient]="false"
            (action)="setGuidedStep(i)"
          >
            <span>{{ i + 1 }}</span>
            {{ step.label }}
          </otui-button>
          }
        </div>
        <div class="guided-actions">
          <otui-button
            class="guided-nav-btn"
            [disabled]="guidedStep() === 0"
            variant="outlined"
            [useGradient]="false"
            (action)="prevGuidedStep()"
          >
            Back
          </otui-button>
          <otui-button
            class="guided-nav-btn primary"
            [disabled]="guidedStep() === guidedSteps.length - 1"
            variant="primary"
            (action)="nextGuidedStep()"
          >
            Next
          </otui-button>
        </div>
      </div>
      }

      <div class="workspace-layout">
        <div class="editor-pane">
          @if (loading()) {
          <p class="status-msg entrance">Loading current site content…</p>
          } @else {

          <!-- Theme & Appearance section -->
          <otui-card
            id="guided-design"
            class="section-card entrance"
            [class.collapsed]="!isPanelExpanded('design')"
            style="animation-delay: 0.06s"
          >
            <otui-button
              class="section-toggle-header"
              [attr.aria-expanded]="isPanelExpanded('design')"
              variant="text"
              [useGradient]="false"
              (action)="togglePanel('design')"
            >
              <h2 class="section-title">
                <span class="section-icon">🎨</span>
                Theme &amp; Appearance
              </h2>
              <span class="section-toggle-indicator">{{
                isPanelExpanded('design') ? 'Hide' : 'Show'
              }}</span>
            </otui-button>
            @if (isPanelExpanded('design')) {
            <app-editor-design-system-panel
              [theme]="draft().theme"
              (themeFieldChange)="
                updateDraftThemeField($event.key, $event.value)
              "
            ></app-editor-design-system-panel>
            }
          </otui-card>

          <!-- Brand section -->
          <otui-card
            id="guided-business-info"
            class="section-card entrance"
            [class.collapsed]="!isPanelExpanded('business-info')"
            style="animation-delay: 0.12s"
          >
            <otui-button
              class="section-toggle-header"
              [attr.aria-expanded]="isPanelExpanded('business-info')"
              variant="text"
              [useGradient]="false"
              (action)="togglePanel('business-info')"
            >
              <h2 class="section-title">
                <span class="section-icon">✦</span>
                Brand &amp; Identity
              </h2>
              <span class="section-toggle-indicator">{{
                isPanelExpanded('business-info') ? 'Hide' : 'Show'
              }}</span>
            </otui-button>
            @if (isPanelExpanded('business-info')) {
            <app-schema-form-panel
              [model]="draft()"
              [fields]="brandIdentityFields"
              (fieldChanged)="patchDraftField($event.key, $event.value)"
            ></app-schema-form-panel>
            <div class="field-grid">
              <app-schema-string-list-panel
                title="Credentials"
                description="List the credentials or certifications that build trust."
                [items]="draft().brand.credentials"
                addLabel="+ Add credential"
                emptyText="No credentials added yet."
                itemPlaceholder="Certified Nutrition Specialist"
                (itemAdded)="addCredential()"
                (itemRemoved)="removeCredential($event)"
                (itemChanged)="
                  updateStringListItem(
                    'brand.credentials',
                    $event.index,
                    $event.value
                  )
                "
              ></app-schema-string-list-panel>
              <app-schema-string-list-panel
                title="Specializations"
                description="List the types of outcomes, audiences, or domains you focus on."
                [items]="draft().brand.specializations"
                addLabel="+ Add specialization"
                emptyText="No specializations added yet."
                itemPlaceholder="Executive coaching"
                (itemAdded)="addSpecialization()"
                (itemRemoved)="removeSpecialization($event)"
                (itemChanged)="
                  updateStringListItem(
                    'brand.specializations',
                    $event.index,
                    $event.value
                  )
                "
              ></app-schema-string-list-panel>
            </div>
            }
          </otui-card>

          <!-- Contact section -->
          <otui-card
            id="guided-contact"
            class="section-card entrance"
            [class.collapsed]="!isPanelExpanded('contact')"
            style="animation-delay: 0.18s"
          >
            <otui-button
              class="section-toggle-header"
              [attr.aria-expanded]="isPanelExpanded('contact')"
              variant="text"
              [useGradient]="false"
              (action)="togglePanel('contact')"
            >
              <h2 class="section-title">
                <span class="section-icon">✉</span>
                Contact Details
              </h2>
              <span class="section-toggle-indicator">{{
                isPanelExpanded('contact') ? 'Hide' : 'Show'
              }}</span>
            </otui-button>
            @if (isPanelExpanded('contact')) {
            <app-schema-form-panel
              [model]="draft()"
              [fields]="contactFields"
              (fieldChanged)="patchDraftField($event.key, $event.value)"
            ></app-schema-form-panel>
            }
          </otui-card>

          <otui-card
            id="guided-features"
            class="section-card entrance"
            [class.collapsed]="!isPanelExpanded('features')"
            style="animation-delay: 0.21s"
          >
            <otui-button
              class="section-toggle-header"
              [attr.aria-expanded]="isPanelExpanded('features')"
              variant="text"
              [useGradient]="false"
              (action)="togglePanel('features')"
            >
              <h2 class="section-title">
                <span class="section-icon">⚙</span>
                Features
              </h2>
              <span class="section-toggle-indicator">{{
                isPanelExpanded('features') ? 'Hide' : 'Show'
              }}</span>
            </otui-button>
            @if (isPanelExpanded('features')) {
            <div class="feature-row">
              <label class="toggle-card">
                <span class="toggle-copy">
                  <strong>Booking</strong>
                  <small
                    >Show public booking entry points and booking-related
                    landing content.</small
                  >
                </span>
                <lib-checkbox
                  [value]="draft().features.booking.enabled"
                  (changeEvent)="updateFeatureFlag('booking.enabled', $event)"
                ></lib-checkbox>
              </label>
              <label
                class="toggle-card dependent"
                [class.disabled]="!draft().features.booking.enabled"
              >
                <span class="toggle-copy">
                  <strong>Online payment</strong>
                  <small
                    >Allow online payment only when booking is enabled.</small
                  >
                </span>
                <lib-checkbox
                  [value]="draft().features.booking.allowOnlinePayment || false"
                  [disabled]="!draft().features.booking.enabled"
                  (changeEvent)="
                    updateFeatureFlag('booking.allowOnlinePayment', $event)
                  "
                ></lib-checkbox>
              </label>
              <label class="toggle-card">
                <span class="toggle-copy">
                  <strong>Client portal</strong>
                  <small
                    >Show client portal calls to action on the public
                    site.</small
                  >
                </span>
                <lib-checkbox
                  [value]="draft().features.clientPortal.enabled"
                  (changeEvent)="
                    updateFeatureFlag('clientPortal.enabled', $event)
                  "
                ></lib-checkbox>
              </label>
              <label class="toggle-card">
                <span class="toggle-copy">
                  <strong>Testimonials</strong>
                  <small>Render testimonials on the public landing page.</small>
                </span>
                <lib-checkbox
                  [value]="draft().features.testimonials.enabled"
                  (changeEvent)="
                    updateFeatureFlag('testimonials.enabled', $event)
                  "
                ></lib-checkbox>
              </label>
              <label class="toggle-card">
                <span class="toggle-copy">
                  <strong>Invoices</strong>
                  <small>Keep invoice-related portal features available.</small>
                </span>
                <lib-checkbox
                  [value]="draft().features.invoices.enabled"
                  (changeEvent)="updateFeatureFlag('invoices.enabled', $event)"
                ></lib-checkbox>
              </label>
              <label class="toggle-card">
                <span class="toggle-copy">
                  <strong>Client tasks</strong>
                  <small
                    >Enable routines and check-ins across the client and owner
                    portal.</small
                  >
                </span>
                <lib-checkbox
                  [value]="draft().features.clientTasks.enabled"
                  (changeEvent)="
                    updateFeatureFlag('clientTasks.enabled', $event)
                  "
                ></lib-checkbox>
              </label>
              <label
                class="toggle-card dependent"
                [class.disabled]="!draft().features.clientTasks.enabled"
              >
                <span class="toggle-copy">
                  <strong>Client completion</strong>
                  <small
                    >Allow clients to mark assigned work complete when tasks are
                    enabled.</small
                  >
                </span>
                <lib-checkbox
                  [value]="draft().features.clientTasks.allowClientCompletion"
                  [disabled]="!draft().features.clientTasks.enabled"
                  (changeEvent)="
                    updateFeatureFlag(
                      'clientTasks.allowClientCompletion',
                      $event
                    )
                  "
                ></lib-checkbox>
              </label>
            </div>
            }
          </otui-card>

          <otui-card
            id="guided-services"
            class="section-card entrance"
            [class.collapsed]="!isPanelExpanded('layout')"
            style="animation-delay: 0.225s"
          >
            <otui-button
              class="section-toggle-header"
              [attr.aria-expanded]="isPanelExpanded('layout')"
              variant="text"
              [useGradient]="false"
              (action)="togglePanel('layout')"
            >
              <h2 class="section-title">
                <span class="section-icon">☰</span>
                Landing Page Layout
              </h2>
              <span class="section-toggle-indicator">{{
                isPanelExpanded('layout') ? 'Hide' : 'Show'
              }}</span>
            </otui-button>
            @if (isPanelExpanded('layout')) {
            <div class="layout-option-grid">
              @for (option of layoutOptions; track option.value) {
              <otui-button
                class="layout-option-card"
                [class.selected]="draft().landingPage.layout === option.value"
                variant="outlined"
                [useGradient]="false"
                (action)="setLandingLayout(option.value)"
              >
                <div
                  class="layout-option-preview"
                  [class]="'preview-' + option.value"
                >
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <div class="layout-option-copy">
                  <strong>{{ option.label }}</strong>
                  <small>{{ option.description }}</small>
                </div>
              </otui-button>
              }
            </div>
            <div class="layout-toolbar">
              <otui-button
                class="layout-toolbar-btn"
                variant="outlined"
                [useGradient]="false"
                (action)="restoreRecommendedSectionState()"
              >
                Show recommended
              </otui-button>
              <otui-button
                class="layout-toolbar-btn"
                variant="outlined"
                [useGradient]="false"
                (action)="setAllSectionsEnabled(true)"
              >
                Enable all
              </otui-button>
              <otui-button
                class="layout-toolbar-btn"
                variant="outlined"
                [useGradient]="false"
                (action)="setAllSectionsEnabled(false)"
              >
                Disable all
              </otui-button>
              <otui-button
                class="layout-toolbar-btn"
                variant="outlined"
                [useGradient]="false"
                (action)="resetSectionOrder()"
              >
                Reset order
              </otui-button>
            </div>
            <div class="layout-canvas-shell">
              @if (draft().landingPage.layout === 'single-column') {
              <div class="canvas-frame">
                <div class="canvas-heading">
                  <strong>Single-column canvas</strong>
                  <small
                    >Drag sections up or down to control the public narrative
                    flow.</small
                  >
                </div>
                <div
                  class="layout-drop-zone column-zone"
                  data-drop-zone="single-column:main"
                  cdkDropList
                  [id]="dropListId('single-column', 'main')"
                  [cdkDropListData]="sectionIdsForZone('single-column', 'main')"
                  [cdkDropListConnectedTo]="connectedDropLists()"
                  (cdkDropListDropped)="
                    dropSection($event, 'single-column', 'main')
                  "
                >
                  @for (section of sectionsForZone('single-column', 'main');
                  track section.id) {
                  <div class="canvas-card" cdkDrag>
                    <div class="canvas-card-header">
                      <span class="canvas-card-type">{{
                        section.type | titlecase
                      }}</span>
                      <span class="canvas-card-order"
                        >#{{ section.order + 1 }}</span
                      >
                    </div>
                    @if (sectionPreviewImage(section); as previewImage) {
                    <div class="canvas-card-media">
                      <img
                        [src]="previewImage.src"
                        [alt]="previewImage.alt || section.title"
                      />
                    </div>
                    }
                    <label class="section-toggle">
                      <lib-checkbox
                        [value]="section.enabled"
                        (changeEvent)="toggleSectionEnabled(section.id, $event)"
                      ></lib-checkbox>
                      <span>{{ section.title }}</span>
                    </label>
                    <p class="section-help">
                      {{ sectionDescription(section.type) }}
                    </p>
                    <p class="canvas-card-summary">
                      {{ sectionSummary(section) }}
                    </p>
                    <div class="canvas-card-meta">
                      @if (section.motion?.kind && section.motion?.kind !==
                      'none') {
                      <span class="canvas-card-chip accent"
                        >Motion:
                        {{ motionLabel(section.motion?.kind ?? 'none') }}</span
                      >
                      } @if (section.type === 'gallery') {
                      <span class="canvas-card-chip"
                        >Gallery •
                        {{ section.gallery?.items?.length ?? 0 }} items</span
                      >
                      } @if (section.type === 'image') {
                      <span class="canvas-card-chip">Image block</span>
                      }
                    </div>
                  </div>
                  }
                </div>
              </div>
              } @else if (draft().landingPage.layout === 'split') {
              <div class="canvas-frame">
                <div class="canvas-heading">
                  <strong>Split canvas</strong>
                  <small
                    >Drag sections between the primary and secondary columns to
                    mirror the live layout.</small
                  >
                </div>
                <div class="split-canvas">
                  @for (zone of splitZones; track zone.id) {
                  <div class="canvas-lane">
                    <div class="canvas-lane-head">
                      <strong>{{ zone.label }}</strong>
                      <small>{{ zone.description }}</small>
                    </div>
                    <div
                      class="layout-drop-zone"
                      [attr.data-drop-zone]="'split:' + zone.id"
                      cdkDropList
                      [id]="dropListId('split', zone.id)"
                      [cdkDropListData]="sectionIdsForZone('split', zone.id)"
                      [cdkDropListConnectedTo]="connectedDropLists()"
                      (cdkDropListDropped)="
                        dropSection($event, 'split', zone.id)
                      "
                    >
                      @for (section of sectionsForZone('split', zone.id); track
                      section.id) {
                      <div class="canvas-card" cdkDrag>
                        <div class="canvas-card-header">
                          <span class="canvas-card-type">{{
                            section.type | titlecase
                          }}</span>
                          <span class="canvas-card-order"
                            >#{{ section.order + 1 }}</span
                          >
                        </div>
                        @if (sectionPreviewImage(section); as previewImage) {
                        <div class="canvas-card-media">
                          <img
                            [src]="previewImage.src"
                            [alt]="previewImage.alt || section.title"
                          />
                        </div>
                        }
                        <label class="section-toggle">
                          <lib-checkbox
                            [value]="section.enabled"
                            (changeEvent)="
                              toggleSectionEnabled(section.id, $event)
                            "
                          ></lib-checkbox>
                          <span>{{ section.title }}</span>
                        </label>
                        <p class="section-help">
                          {{ sectionDescription(section.type) }}
                        </p>
                        <p class="canvas-card-summary">
                          {{ sectionSummary(section) }}
                        </p>
                        <div class="canvas-card-meta">
                          @if (section.motion?.kind && section.motion?.kind !==
                          'none') {
                          <span class="canvas-card-chip accent"
                            >Motion:
                            {{
                              motionLabel(section.motion?.kind ?? 'none')
                            }}</span
                          >
                          } @if (section.type === 'gallery') {
                          <span class="canvas-card-chip"
                            >Gallery •
                            {{ section.gallery?.items?.length ?? 0 }}
                            items</span
                          >
                          } @if (section.type === 'image') {
                          <span class="canvas-card-chip">Image block</span>
                          }
                        </div>
                      </div>
                      }
                    </div>
                  </div>
                  }
                </div>
              </div>
              } @else {
              <div class="canvas-frame">
                <div class="canvas-heading">
                  <strong>Grid canvas</strong>
                  <small
                    >Place sections into the grid slots the public landing page
                    will use.</small
                  >
                </div>
                <div class="grid-canvas">
                  @for (zone of gridZones; track zone.id) {
                  <div class="canvas-lane" [class]="'grid-zone-' + zone.id">
                    <div class="canvas-lane-head">
                      <strong>{{ zone.label }}</strong>
                      <small>{{ zone.description }}</small>
                    </div>
                    <div
                      class="layout-drop-zone"
                      [attr.data-drop-zone]="'grid:' + zone.id"
                      cdkDropList
                      [id]="dropListId('grid', zone.id)"
                      [cdkDropListData]="sectionIdsForZone('grid', zone.id)"
                      [cdkDropListConnectedTo]="connectedDropLists()"
                      (cdkDropListDropped)="
                        dropSection($event, 'grid', zone.id)
                      "
                    >
                      @for (section of sectionsForZone('grid', zone.id); track
                      section.id) {
                      <div class="canvas-card" cdkDrag>
                        <div class="canvas-card-header">
                          <span class="canvas-card-type">{{
                            section.type | titlecase
                          }}</span>
                          <span class="canvas-card-order"
                            >#{{ section.order + 1 }}</span
                          >
                        </div>
                        @if (sectionPreviewImage(section); as previewImage) {
                        <div class="canvas-card-media">
                          <img
                            [src]="previewImage.src"
                            [alt]="previewImage.alt || section.title"
                          />
                        </div>
                        }
                        <label class="section-toggle">
                          <lib-checkbox
                            [value]="section.enabled"
                            (changeEvent)="
                              toggleSectionEnabled(section.id, $event)
                            "
                          ></lib-checkbox>
                          <span>{{ section.title }}</span>
                        </label>
                        <p class="section-help">
                          {{ sectionDescription(section.type) }}
                        </p>
                        <p class="canvas-card-summary">
                          {{ sectionSummary(section) }}
                        </p>
                        <div class="canvas-card-meta">
                          @if (section.motion?.kind && section.motion?.kind !==
                          'none') {
                          <span class="canvas-card-chip accent"
                            >Motion:
                            {{
                              motionLabel(section.motion?.kind ?? 'none')
                            }}</span
                          >
                          } @if (section.type === 'gallery') {
                          <span class="canvas-card-chip"
                            >Gallery •
                            {{ section.gallery?.items?.length ?? 0 }}
                            items</span
                          >
                          } @if (section.type === 'image') {
                          <span class="canvas-card-chip">Image block</span>
                          }
                        </div>
                      </div>
                      }
                    </div>
                  </div>
                  }
                </div>
              </div>
              }
            </div>
            <div class="layout-list">
              <div class="section-editor-grid">
                <div class="section-side-panel">
                  <app-editor-block-tree
                    [blocks]="landingPageBlocks()"
                    [selectedBlockId]="selectedSectionId()"
                    [fallbackTitle]="landingBlockFallbackTitle"
                    (blockSelected)="selectSection($event)"
                  ></app-editor-block-tree>
                </div>

                <div class="selected-section-shell">
                  @if (selectedSection(); as section) {
                  <div class="selected-section-head">
                    <div>
                      <strong>{{
                        selectedSectionDefinition()?.name || section.type
                      }}</strong>
                      <p>{{ sectionSummary(section) }}</p>
                    </div>
                    <div class="layout-actions">
                      @if (selectedSectionSupportsCompose() && section.type !==
                      'custom') {
                      <otui-button
                        class="layout-btn"
                        variant="outlined"
                        [useGradient]="false"
                        (action)="toggleRichTextEditor()"
                      >
                        {{
                          richTextEditorOpen()
                            ? 'Hide content editor'
                            : 'Open content editor'
                        }}
                      </otui-button>
                      }
                      <otui-button
                        class="layout-btn"
                        variant="outlined"
                        [useGradient]="false"
                        (action)="moveSectionUp(selectedSectionIndex())"
                        [disabled]="selectedSectionIndex() === 0"
                      >
                        Move up
                      </otui-button>
                      <otui-button
                        class="layout-btn"
                        variant="outlined"
                        [useGradient]="false"
                        (action)="moveSectionDown(selectedSectionIndex())"
                        [disabled]="
                          selectedSectionIndex() ===
                          draft().landingPage.sections.length - 1
                        "
                      >
                        Move down
                      </otui-button>
                      @if (section.type === 'custom' || section.type === 'image'
                      || section.type === 'gallery') {
                      <otui-button
                        class="layout-btn"
                        variant="outlined"
                        [useGradient]="false"
                        (action)="removeSection(selectedSectionIndex())"
                      >
                        Remove
                      </otui-button>
                      }
                    </div>
                  </div>

                  @if (selectedSectionUsesDedicatedPanel()) {
                  <div class="section-help selected-section-help">
                    <strong>{{ selectedSectionEditorPanelTitle() }}</strong>
                    <p>{{ selectedSectionEditorPanelDescription() }}</p>
                  </div>
                  } @else {
                  <app-schema-block-inspector
                    [block]="selectedSectionBlock()"
                    [definition]="selectedSectionDefinition()"
                    (fieldChanged)="
                      patchSelectedSectionField($event.key, $event.value)
                    "
                  ></app-schema-block-inspector>
                  } @if (composeEditorVisible()) {
                  <div class="media-editor custom-compose-editor">
                    <div class="media-editor-head">
                      <strong>Section composition</strong>
                      <small
                        >Use the shared compose runtime to author the public
                        marketing copy directly inside the live section
                        preview.</small
                      >
                    </div>
                    <lib-social-compose
                      [profileId]="ownerProfileId()"
                      [ngModel]="selectedSectionComposeValue()"
                      (ngModelChange)="updateSelectedSectionRichContent($event)"
                    ></lib-social-compose>
                  </div>
                  } @if (section.type === 'image' || section.type === 'contact')
                  {
                  <div class="media-editor">
                    <div class="media-editor-head">
                      <strong>
                        {{
                          section.type === 'contact'
                            ? 'Contact image'
                            : 'Image asset workflow'
                        }}
                      </strong>
                      <small>
                        {{
                          section.type === 'contact'
                            ? 'Upload or choose an existing owner asset for the optional contact-section image.'
                            : 'Upload or choose an existing owner asset for the selected image block.'
                        }}
                      </small>
                    </div>
                    <div class="media-actions">
                      <input
                        #imageUploadInput
                        type="file"
                        accept="image/*"
                        class="visually-hidden"
                        (change)="
                          onAssetFileSelected(
                            selectedSectionIndex(),
                            null,
                            $event
                          )
                        "
                      />
                      <otui-button
                        class="layout-btn"
                        variant="outlined"
                        [useGradient]="false"
                        (action)="imageUploadInput.click()"
                      >
                        {{
                          isUploading(assetTargetKey(selectedSectionIndex()))
                            ? 'Uploading…'
                            : 'Upload image'
                        }}
                      </otui-button>
                      <otui-button
                        class="layout-btn"
                        variant="outlined"
                        [useGradient]="false"
                        (action)="toggleAssetPicker(selectedSectionIndex())"
                      >
                        {{
                          isAssetPickerOpen(selectedSectionIndex())
                            ? 'Hide asset library'
                            : 'Choose existing asset'
                        }}
                      </otui-button>
                      <otui-button
                        class="layout-btn"
                        variant="outlined"
                        [useGradient]="false"
                        (action)="loadOwnerAssets(true)"
                      >
                        Refresh assets
                      </otui-button>
                    </div>
                    @if (isAssetPickerOpen(selectedSectionIndex())) {
                    <div class="asset-picker">
                      <div class="asset-picker-head">
                        <strong>Asset library</strong>
                        <small
                          >Choose from previously uploaded images tied to your
                          owner profile.</small
                        >
                      </div>
                      @if (assetsLoading()) {
                      <p class="section-help">Loading assets…</p>
                      } @else if (assetLibraryError()) {
                      <p class="status-msg error">{{ assetLibraryError() }}</p>
                      } @else if (assetLibrary().length) {
                      <div class="asset-grid">
                        @for (asset of assetLibrary(); track asset.id) {
                        <otui-button
                          class="asset-tile"
                          variant="text"
                          [useGradient]="false"
                          (action)="
                            selectAsset(selectedSectionIndex(), null, asset)
                          "
                        >
                          <img [src]="asset.url" [alt]="asset.name" />
                          <span>{{ asset.name }}</span>
                        </otui-button>
                        }
                      </div>
                      } @else {
                      <p class="section-help">No uploaded image assets yet.</p>
                      }
                    </div>
                    }
                  </div>
                  } @if (section.type === 'gallery') {
                  <div class="media-editor">
                    <div class="media-editor-head">
                      <strong>Gallery images</strong>
                      <small
                        >Manage the media items inside the selected gallery
                        block.</small
                      >
                    </div>
                    <div class="gallery-list">
                      @for (item of section.gallery?.items ?? []; track $index)
                      {
                      <div class="gallery-item-editor">
                        <div class="testimonial-header">
                          <span class="testimonial-number"
                            >Image #{{ $index + 1 }}</span
                          >
                          <otui-button
                            class="tag-remove"
                            variant="text"
                            [useGradient]="false"
                            (action)="
                              removeGalleryItem(selectedSectionIndex(), $index)
                            "
                          >
                            Remove
                          </otui-button>
                        </div>
                        <div class="field-grid">
                          <label>
                            Source Type
                            <lib-select
                              [ngModel]="
                                section.gallery!.items[$index].sourceType
                              "
                              [options]="mediaSourceOptions"
                              (ngModelChange)="
                                updateGalleryItemField(
                                  selectedSectionIndex(),
                                  $index,
                                  'sourceType',
                                  $event
                                )
                              "
                            ></lib-select>
                          </label>
                          <label class="full">
                            {{
                              section.gallery!.items[$index].sourceType ===
                              'asset'
                                ? 'Asset path'
                                : 'Image URL'
                            }}
                            <lib-text-input
                              [ngModel]="section.gallery!.items[$index].src"
                              (ngModelChange)="
                                updateGalleryItemField(
                                  selectedSectionIndex(),
                                  $index,
                                  'src',
                                  $event
                                )
                              "
                            ></lib-text-input>
                          </label>
                          <label>
                            Alt Text
                            <lib-text-input
                              [ngModel]="section.gallery!.items[$index].alt"
                              (ngModelChange)="
                                updateGalleryItemField(
                                  selectedSectionIndex(),
                                  $index,
                                  'alt',
                                  $event
                                )
                              "
                            ></lib-text-input>
                          </label>
                          <label>
                            Caption
                            <lib-text-input
                              [ngModel]="
                                section.gallery!.items[$index].caption || ''
                              "
                              (ngModelChange)="
                                updateGalleryItemField(
                                  selectedSectionIndex(),
                                  $index,
                                  'caption',
                                  $event
                                )
                              "
                            ></lib-text-input>
                          </label>
                        </div>
                        <div class="media-actions">
                          <input
                            #galleryUploadInput
                            type="file"
                            accept="image/*"
                            class="visually-hidden"
                            (change)="
                              onAssetFileSelected(
                                selectedSectionIndex(),
                                $index,
                                $event
                              )
                            "
                          />
                          <otui-button
                            class="layout-btn"
                            variant="outlined"
                            [useGradient]="false"
                            (action)="galleryUploadInput.click()"
                          >
                            {{
                              isUploading(
                                assetTargetKey(selectedSectionIndex(), $index)
                              )
                                ? 'Uploading…'
                                : 'Upload image'
                            }}
                          </otui-button>
                          <otui-button
                            class="layout-btn"
                            variant="outlined"
                            [useGradient]="false"
                            (action)="
                              toggleAssetPicker(selectedSectionIndex(), $index)
                            "
                          >
                            {{
                              isAssetPickerOpen(selectedSectionIndex(), $index)
                                ? 'Hide asset library'
                                : 'Choose existing asset'
                            }}
                          </otui-button>
                        </div>
                        @if (isAssetPickerOpen(selectedSectionIndex(), $index))
                        {
                        <div class="asset-picker">
                          <div class="asset-picker-head">
                            <strong>Asset library</strong>
                            <small
                              >Select an uploaded image for this gallery
                              slot.</small
                            >
                          </div>
                          @if (assetsLoading()) {
                          <p class="section-help">Loading assets…</p>
                          } @else if (assetLibraryError()) {
                          <p class="status-msg error">
                            {{ assetLibraryError() }}
                          </p>
                          } @else if (assetLibrary().length) {
                          <div class="asset-grid">
                            @for (asset of assetLibrary(); track asset.id) {
                            <otui-button
                              class="asset-tile"
                              variant="text"
                              [useGradient]="false"
                              (action)="
                                selectAsset(
                                  selectedSectionIndex(),
                                  $index,
                                  asset
                                )
                              "
                            >
                              <img [src]="asset.url" [alt]="asset.name" />
                              <span>{{ asset.name }}</span>
                            </otui-button>
                            }
                          </div>
                          } @else {
                          <p class="section-help">
                            No uploaded image assets yet.
                          </p>
                          }
                        </div>
                        }
                      </div>
                      }
                      <otui-button
                        class="tag-add"
                        variant="outlined"
                        [useGradient]="false"
                        (action)="addGalleryItem(selectedSectionIndex())"
                      >
                        + Add gallery image
                      </otui-button>
                    </div>
                  </div>
                  } } @else {
                  <p class="section-help">
                    Select a landing-page section to edit its content and
                    design.
                  </p>
                  }
                </div>
              </div>
            </div>
            <div class="layout-footer">
              <otui-button
                class="tag-add"
                variant="outlined"
                [useGradient]="false"
                (action)="addCustomSection()"
              >
                + Add custom section
              </otui-button>
              <otui-button
                class="tag-add"
                variant="outlined"
                [useGradient]="false"
                (action)="addImageSection()"
              >
                + Add image block
              </otui-button>
              <otui-button
                class="tag-add"
                variant="outlined"
                [useGradient]="false"
                (action)="addGallerySection()"
              >
                + Add gallery block
              </otui-button>
            </div>
            }
          </otui-card>

          <otui-card
            class="section-card entrance"
            [class.collapsed]="!isPanelExpanded('offers')"
            style="animation-delay: 0.235s"
          >
            <otui-button
              class="section-toggle-header"
              variant="text"
              [useGradient]="false"
              [attr.aria-expanded]="isPanelExpanded('offers')"
              (action)="togglePanel('offers')"
            >
              <h2 class="section-title">
                <span class="section-icon">◫</span>
                Offers
              </h2>
              <span class="section-toggle-indicator">{{
                isPanelExpanded('offers') ? 'Hide' : 'Show'
              }}</span>
            </otui-button>
            @if (isPanelExpanded('offers')) {
            <div class="service-list">
              <label class="full">
                Offer source
                <lib-select
                  [ngModel]="draft().serviceCatalog.source"
                  [options]="serviceCatalogSourceOptions"
                  (ngModelChange)="updateServiceCatalogSource($event)"
                ></lib-select>
              </label>

              @if (draft().serviceCatalog.source === 'store') {
              <p class="section-help">
                The public business site will use active store products with
                type
                <code>service</code>. Manage pricing and activation from the
                store workspace.
              </p>
              @if (storeProductsLoading()) {
              <p class="status-msg">Loading active store service products…</p>
              } @if (storeProductsError()) {
              <p class="status-msg error">{{ storeProductsError() }}</p>
              }
              <otui-button
                class="tag-add"
                variant="outlined"
                [useGradient]="false"
                (action)="loadStoreProducts()"
              >
                Refresh store services
              </otui-button>
              @for (product of storeServiceProducts(); track product.id) {
              <div class="service-card">
                <div class="testimonial-header">
                  <span class="testimonial-number">{{ product.name }}</span>
                  <span class="status-msg success">Store-backed</span>
                </div>
                <div class="field-grid">
                  <label>
                    Product type
                    <lib-text-input
                      [ngModel]="product.type"
                      [disabled]="true"
                    ></lib-text-input>
                  </label>
                  <label>
                    Price
                    <lib-text-input
                      [ngModel]="'' + product.price"
                      [disabled]="true"
                    ></lib-text-input>
                  </label>
                  <label class="full">
                    Description
                    <lib-text-area
                      [rows]="3"
                      [ngModel]="product.description || ''"
                      [disabled]="true"
                    ></lib-text-area>
                  </label>
                </div>
              </div>
              } @empty {
              <p class="status-msg">
                No active store service products found. Create one in the store
                product workspace to power this section.
              </p>
              } } @else { @if (draft().services.length) {
              <app-schema-collection-panel
                title="Manual Offers"
                description="Define the offers the public site should explain and optionally book."
                [items]="servicesCollectionItems()"
                [fields]="serviceFields"
                addLabel="+ Add offer"
                emptyText="No offers defined yet."
                [itemLabel]="serviceItemLabel"
                [trackBy]="trackCollectionItemById"
                (itemAdded)="addService()"
                (itemRemoved)="removeService($event)"
                (itemFieldChanged)="
                  patchServiceField($event.index, $event.key, $event.value)
                "
              ></app-schema-collection-panel>
              } @else {
              <p class="status-msg">
                No offers defined yet. Add at least one offer so the public site
                can describe what you sell.
              </p>
              }
              <otui-button
                class="tag-add"
                variant="outlined"
                [useGradient]="false"
                (action)="addService()"
              >
                + Add offer
              </otui-button>
              }
            </div>
            }
          </otui-card>

          <!-- Client Portal copy section -->
          <otui-card
            id="guided-review"
            class="section-card entrance"
            [class.collapsed]="!isPanelExpanded('review')"
            style="animation-delay: 0.24s"
          >
            <otui-button
              class="section-toggle-header"
              variant="text"
              [useGradient]="false"
              [attr.aria-expanded]="isPanelExpanded('review')"
              (action)="togglePanel('review')"
            >
              <h2 class="section-title">
                <span class="section-icon">◈</span>
                Client Portal Copy
              </h2>
              <span class="section-toggle-indicator">{{
                isPanelExpanded('review') ? 'Hide' : 'Show'
              }}</span>
            </otui-button>
            @if (isPanelExpanded('review')) {
            <app-schema-form-panel
              [model]="draft()"
              [fields]="clientPortalFields"
              (fieldChanged)="patchDraftField($event.key, $event.value)"
            ></app-schema-form-panel>
            <app-schema-string-list-panel
              title="Capabilities"
              description="List the things clients can do or access inside the portal."
              [items]="draft().clientPortal.capabilities"
              addLabel="+ Add capability"
              emptyText="No portal capabilities added yet."
              itemPlaceholder="Track billing"
              (itemAdded)="addCapability()"
              (itemRemoved)="removeCapability($event)"
              (itemChanged)="
                updateStringListItem(
                  'clientPortal.capabilities',
                  $event.index,
                  $event.value
                )
              "
            ></app-schema-string-list-panel>
            }
          </otui-card>

          <!-- Testimonials section -->
          <otui-card
            class="section-card entrance"
            [class.collapsed]="!isPanelExpanded('testimonials')"
            style="animation-delay: 0.3s"
          >
            <otui-button
              class="section-toggle-header"
              variant="text"
              [useGradient]="false"
              [attr.aria-expanded]="isPanelExpanded('testimonials')"
              (action)="togglePanel('testimonials')"
            >
              <h2 class="section-title">
                <span class="section-icon">❝</span>
                Testimonials
              </h2>
              <span class="section-toggle-indicator">{{
                isPanelExpanded('testimonials') ? 'Hide' : 'Show'
              }}</span>
            </otui-button>
            @if (isPanelExpanded('testimonials')) {
            <app-schema-collection-panel
              title="Client Testimonials"
              description="Shape the social proof that appears across the public business experience."
              [items]="testimonialCollectionItems()"
              [fields]="testimonialFields"
              addLabel="+ Add testimonial"
              emptyText="No testimonials added yet."
              [itemLabel]="testimonialItemLabel"
              [trackBy]="trackCollectionItemByIndex"
              (itemAdded)="addTestimonial()"
              (itemRemoved)="removeTestimonial($event)"
              (itemFieldChanged)="
                patchTestimonialField($event.index, $event.key, $event.value)
              "
            ></app-schema-collection-panel>
            }
          </otui-card>

          <!-- Actions -->
          @if (successMsg()) {
          <p class="status-msg success entrance">{{ successMsg() }}</p>
          } @if (errorMsg()) {
          <p class="status-msg error entrance">{{ errorMsg() }}</p>
          }

          <div class="actions entrance" style="animation-delay: 0.36s">
            <otui-button
              variant="primary"
              [disabled]="saving()"
              (action)="save()"
            >
              @if (saving()) { Saving… } @else { Save Changes }
            </otui-button>
            <otui-button
              variant="outlined"
              [useGradient]="false"
              (action)="reset()"
            >
              Reset to Defaults
            </otui-button>
          </div>
          }
        </div>

        <aside class="preview-pane" data-live-preview>
          <div class="preview-pane-header entrance">
            <p class="workspace-kicker">Rendered preview</p>
            <h2>Live landing page</h2>
            <p>
              The public page stays visible in guided and studio modes. Unsaved
              edits render here immediately.
            </p>
          </div>
          <div class="mobile-preview-actions">
            <otui-button
              class="mobile-preview-btn primary"
              variant="primary"
              (action)="
                openMobileSheet(selectedSection() ? 'inspector' : 'structure')
              "
            >
              {{
                selectedSection()
                  ? 'Edit Selected Section'
                  : 'Edit Page Structure'
              }}
            </otui-button>
            @if (selectedSection()) {
            <otui-button
              class="mobile-preview-btn"
              variant="outlined"
              [useGradient]="false"
              (action)="openMobileSheet('structure')"
            >
              Structure
            </otui-button>
            }
          </div>
          @if (loading()) {
          <p class="status-msg entrance">Preparing preview…</p>
          } @else {
          <business-landing-page
            [embeddedPreview]="true"
            [selectedSectionId]="selectedSectionId()"
            (sectionSelected)="selectSection($event)"
          ></business-landing-page>
          }
        </aside>
      </div>

      @if (mobileSheetOpen()) {
      <otui-button
        class="mobile-sheet-backdrop"
        variant="text"
        [useGradient]="false"
        aria-label="Close editor sheet"
        (action)="closeMobileSheet()"
      ></otui-button>
      }

      <div
        class="mobile-editor-sheet"
        [class.open]="mobileSheetOpen()"
        data-mobile-sheet
      >
        <div class="mobile-sheet-handle"></div>
        <div class="mobile-sheet-header">
          <div>
            <p class="mobile-sheet-kicker">
              {{
                mobileSheetMode() === 'inspector' ? 'Inspector' : 'Structure'
              }}
            </p>
            <h3>{{ mobileSheetTitle() }}</h3>
          </div>
          <otui-button
            class="mobile-sheet-close"
            variant="text"
            [useGradient]="false"
            (action)="closeMobileSheet()"
          >
            Close
          </otui-button>
        </div>

        <div class="mobile-sheet-tabs">
          <otui-button
            class="mobile-sheet-tab"
            variant="text"
            [useGradient]="false"
            [class.active]="mobileSheetMode() === 'structure'"
            (action)="openMobileSheet('structure')"
          >
            Structure
          </otui-button>
          @if (selectedSection()) {
          <otui-button
            class="mobile-sheet-tab"
            variant="text"
            [useGradient]="false"
            [class.active]="mobileSheetMode() === 'inspector'"
            (action)="openMobileSheet('inspector')"
          >
            Inspector
          </otui-button>
          }
        </div>

        <div class="mobile-sheet-body">
          @if (mobileSheetMode() === 'structure') {
          <div class="mobile-sheet-panel">
            <app-editor-block-tree
              [blocks]="landingPageBlocks()"
              [selectedBlockId]="selectedSectionId()"
              [fallbackTitle]="landingBlockFallbackTitle"
              (blockSelected)="selectSection($event)"
            ></app-editor-block-tree>
            <div class="mobile-sheet-structure-actions">
              <otui-button
                class="tag-add"
                variant="outlined"
                [useGradient]="false"
                (action)="addCustomSection()"
              >
                + Add custom section
              </otui-button>
              <otui-button
                class="tag-add"
                variant="outlined"
                [useGradient]="false"
                (action)="addImageSection()"
              >
                + Add image block
              </otui-button>
              <otui-button
                class="tag-add"
                variant="outlined"
                [useGradient]="false"
                (action)="addGallerySection()"
              >
                + Add gallery block
              </otui-button>
            </div>
          </div>
          } @else {
          <div class="mobile-sheet-panel">
            <app-schema-block-inspector
              [block]="selectedSectionBlock()"
              [definition]="selectedSectionDefinition()"
              (fieldChanged)="
                patchSelectedSectionField($event.key, $event.value)
              "
            ></app-schema-block-inspector>
          </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .editor-shell {
        display: grid;
        gap: 1.25rem;
        width: 100%;
        margin-inline: auto;
      }

      .workspace-layout {
        display: grid;
        grid-template-columns: minmax(280px, 1fr) minmax(0, 3fr);
        gap: 1.5rem;
        align-items: start;
      }

      .editor-pane {
        display: grid;
        gap: 1rem;
        min-width: 0;
        align-content: start;
      }

      .preview-pane {
        position: sticky;
        top: 1rem;
        display: grid;
        gap: 1rem;
        min-width: 0;
        padding: 1rem;
        border-radius: 1.5rem;
        border: 1px solid var(--border, #e2e8f0);
        background: linear-gradient(
          180deg,
          color-mix(
              in srgb,
              var(--primary, #1f7a63) 5%,
              var(--background, #fff)
            )
            0%,
          var(--background, #fff) 100%
        );
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
        align-content: start;
      }

      .mobile-preview-actions,
      .mobile-editor-sheet,
      .mobile-sheet-backdrop {
        display: none;
      }

      .preview-pane-header {
        display: grid;
        gap: 0.4rem;
      }

      .preview-pane-header h2,
      .preview-pane-header p {
        margin: 0;
      }

      .section-card {
        display: grid;
        gap: 1.2rem;
      }

      .section-toggle-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: pointer;
        text-align: left;
      }

      .section-toggle-indicator {
        flex-shrink: 0;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 4.25rem;
        padding: 0.38rem 0.75rem;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, var(--primary) 20%, var(--border));
        background: color-mix(in srgb, var(--surface, #fff) 90%, transparent);
        color: color-mix(in srgb, var(--foreground) 70%, transparent);
        font-size: 0.75rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .section-card.collapsed {
        gap: 0;
      }

      .section-title {
        margin: 0;
        font-size: 1rem;
        font-weight: 700;
        color: var(--foreground, #0f172a);
        padding-bottom: 0.75rem;
        border-bottom: 1px solid var(--border, #e2e8f0);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .section-icon {
        font-size: 1.1rem;
        opacity: 0.7;
      }

      .section-card.collapsed .section-title {
        border-bottom: 0;
        padding-bottom: 0;
      }

      .field-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }

      .field-grid label.full {
        grid-column: 1 / -1;
      }

      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.82rem;
        font-weight: 500;
        color: var(--foreground, #0f172a);
      }

      input,
      textarea,
      select {
        padding: 0.6rem 0.85rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--personality-border-radius, 0.5rem);
        background: var(--surface, #fff);
        color: var(--foreground, #0f172a);
        font-size: 0.9rem;
        font-family: inherit;
        resize: vertical;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
      }

      input:focus,
      textarea:focus,
      select:focus {
        outline: none;
        border-color: var(--primary, #1f7a63);
        box-shadow: 0 0 0 3px
          color-mix(in srgb, var(--primary, #1f7a63) 14%, transparent);
      }

      select {
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 0.7rem center;
        padding-right: 2rem;
      }

      .color-field {
        display: flex;
        gap: 0.5rem;
        align-items: center;
      }

      .color-field input[type='color'] {
        width: 3rem;
        height: 2.5rem;
        padding: 0.2rem;
        cursor: pointer;
      }

      .color-field input[type='text'] {
        flex: 1;
        font-family: monospace;
        text-transform: uppercase;
      }

      .personality-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.5rem;
      }

      .personality-chip {
        display: grid;
        gap: 0.15rem;
        padding: 0.65rem 0.8rem;
        border-radius: var(--personality-card-radius, 0.75rem);
        border: var(--personality-border-width, 1px) solid var(--border);
        background: var(--background);
        cursor: pointer;
        text-align: left;
        transition: border-color 0.2s ease, box-shadow 0.2s ease,
          transform 0.2s ease;
      }

      .personality-chip:hover {
        border-color: color-mix(in srgb, var(--primary) 40%, var(--border));
        transform: translateY(-2px);
        box-shadow: 0 6px 16px
          color-mix(in srgb, var(--primary) 6%, rgba(0, 0, 0, 0.04));
      }

      .personality-chip.selected {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, var(--background));
        box-shadow: 0 0 0 1px var(--primary);
      }

      .personality-name {
        font-size: 0.88rem;
        font-weight: 600;
        color: var(--foreground);
      }

      .personality-desc {
        font-size: 0.75rem;
        text-transform: capitalize;
        color: color-mix(in srgb, var(--foreground) 55%, transparent);
      }

      .tag-list {
        display: grid;
        gap: 0.4rem;
      }

      .tag-item {
        display: flex;
        gap: 0.4rem;
        align-items: center;
      }

      .tag-item input {
        flex: 1;
      }

      .tag-remove {
        padding: 0.4rem 0.6rem;
        border-radius: var(--personality-border-radius, 0.35rem);
        border: none;
        background: color-mix(in srgb, var(--danger, #ef4444) 10%, transparent);
        color: var(--danger, #ef4444);
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        transition: background 0.15s ease;
      }

      .tag-remove:hover {
        background: color-mix(in srgb, var(--danger) 18%, transparent);
      }

      .tag-add {
        padding: 0.55rem 0.85rem;
        border-radius: var(--personality-border-radius, 0.5rem);
        border: var(--personality-border-width, 1px) dashed var(--border);
        background: transparent;
        color: var(--primary);
        font-size: 0.85rem;
        font-weight: 600;
        cursor: pointer;
        transition: border-color 0.2s ease, background 0.2s ease;
        width: fit-content;
      }

      .tag-add:hover {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 6%, transparent);
      }

      .feature-row {
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: minmax(220px, 1fr);
        gap: 0.85rem;
        overflow-x: auto;
        padding-bottom: 0.25rem;
      }

      .toggle-card {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 0.85rem;
        align-items: start;
        min-height: 100%;
        padding: 1rem;
        border-radius: var(--personality-card-radius, 1rem);
        border: 1px solid var(--border, #e2e8f0);
        background: color-mix(in srgb, var(--background, #ffffff) 94%, white);
      }

      .toggle-card.dependent.disabled {
        opacity: 0.6;
      }

      .toggle-copy {
        display: grid;
        gap: 0.3rem;
      }

      .toggle-copy strong {
        font-size: 0.95rem;
        color: var(--foreground, #0f172a);
      }

      .toggle-copy small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .toggle-card input[type='checkbox'] {
        width: 1.1rem;
        height: 1.1rem;
        margin-top: 0.15rem;
      }

      .layout-option-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0.85rem;
      }

      .layout-option-card {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border-radius: var(--personality-card-radius, 1rem);
        border: 1px solid var(--border, #e2e8f0);
        background: color-mix(in srgb, var(--background, #ffffff) 96%, white);
        cursor: pointer;
        text-align: left;
        transition: transform 0.2s ease, border-color 0.2s ease,
          box-shadow 0.2s ease;
      }

      .layout-option-card:hover {
        transform: translateY(-2px);
        border-color: color-mix(in srgb, var(--primary) 45%, var(--border));
        box-shadow: 0 10px 24px
          color-mix(in srgb, var(--primary) 8%, rgba(0, 0, 0, 0.06));
      }

      .layout-option-card.selected {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 8%, var(--background));
        box-shadow: 0 0 0 1px var(--primary);
      }

      .layout-option-preview {
        display: grid;
        gap: 0.35rem;
        min-height: 4rem;
      }

      .layout-option-preview span {
        display: block;
        border-radius: 0.6rem;
        background: color-mix(
          in srgb,
          var(--primary) 16%,
          var(--surface, white)
        );
        border: 1px solid color-mix(in srgb, var(--primary) 16%, var(--border));
      }

      .preview-single-column span:nth-child(1) {
        min-height: 1.35rem;
      }

      .preview-single-column span:nth-child(2),
      .preview-single-column span:nth-child(3) {
        min-height: 0.8rem;
      }

      .preview-split {
        grid-template-columns: 1.35fr 0.9fr;
      }

      .preview-split span:first-child {
        grid-row: 1 / span 2;
      }

      .preview-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .preview-grid span:first-child {
        grid-column: 1 / -1;
      }

      .layout-option-copy {
        display: grid;
        gap: 0.2rem;
      }

      .layout-option-copy strong {
        color: var(--foreground);
        font-size: 0.92rem;
      }

      .layout-option-copy small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .layout-toolbar {
        display: flex;
        gap: 0.65rem;
        flex-wrap: wrap;
      }

      .layout-canvas-shell {
        display: grid;
        gap: 1rem;
      }

      .canvas-frame {
        display: grid;
        gap: 1rem;
        padding: 1rem;
        border-radius: var(--personality-card-radius, 1rem);
        border: 1px solid var(--border, #e2e8f0);
        background: radial-gradient(
            circle at top right,
            color-mix(in srgb, var(--primary) 9%, transparent),
            transparent 42%
          ),
          color-mix(in srgb, var(--background, #ffffff) 97%, white);
      }

      .canvas-heading {
        display: grid;
        gap: 0.2rem;
      }

      .canvas-heading strong {
        color: var(--foreground);
      }

      .canvas-heading small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .split-canvas {
        display: grid;
        grid-template-columns: minmax(0, 1.3fr) minmax(240px, 0.9fr);
        gap: 1rem;
      }

      .grid-canvas {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .grid-zone-hero-wide {
        grid-column: 1 / -1;
      }

      .canvas-lane {
        display: grid;
        gap: 0.7rem;
      }

      .canvas-lane-head {
        display: grid;
        gap: 0.2rem;
      }

      .canvas-lane-head strong {
        color: var(--foreground);
        font-size: 0.9rem;
      }

      .canvas-lane-head small {
        color: var(--muted, #6b7280);
        line-height: 1.4;
      }

      .layout-drop-zone {
        display: grid;
        gap: 0.75rem;
        min-height: 8rem;
        padding: 0.8rem;
        border-radius: var(--personality-card-radius, 1rem);
        border: 1px dashed color-mix(in srgb, var(--primary) 30%, var(--border));
        background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
      }

      .column-zone {
        min-height: 15rem;
      }

      .canvas-card {
        display: grid;
        gap: 0.55rem;
        padding: 0.85rem;
        border-radius: 0.9rem;
        border: 1px solid var(--border, #e2e8f0);
        background: var(--background, #fff);
        box-shadow: 0 10px 26px
          color-mix(in srgb, var(--primary) 5%, rgba(0, 0, 0, 0.04));
        cursor: move;
      }

      .canvas-card-media {
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border-radius: 0.75rem;
        border: 1px solid color-mix(in srgb, var(--primary) 10%, var(--border));
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--primary) 18%, transparent),
            transparent
          ),
          color-mix(in srgb, var(--surface, #fff) 88%, var(--background, #fff));
      }

      .canvas-card-media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .canvas-card-header {
        display: flex;
        justify-content: space-between;
        gap: 0.6rem;
        align-items: center;
      }

      .canvas-card-type,
      .canvas-card-order {
        font-size: 0.74rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .canvas-card-type {
        color: var(--primary);
      }

      .canvas-card-order {
        color: var(--muted, #6b7280);
      }

      .canvas-card-summary {
        margin: 0;
        color: color-mix(in srgb, var(--foreground) 72%, transparent);
        font-size: 0.82rem;
        line-height: 1.45;
      }

      .canvas-card-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .canvas-card-chip {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        padding: 0.28rem 0.6rem;
        border-radius: 999px;
        border: 1px solid var(--border, #e2e8f0);
        background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
        color: color-mix(in srgb, var(--foreground) 74%, transparent);
        font-size: 0.72rem;
        font-weight: 700;
      }

      .canvas-card-chip.accent {
        border-color: color-mix(in srgb, var(--primary) 35%, var(--border));
        color: var(--primary);
      }

      .layout-toolbar-btn,
      .layout-btn {
        padding: 0.55rem 0.8rem;
        border-radius: 999px;
        border: 1px solid var(--border, #e2e8f0);
        background: var(--surface, #fff);
        color: var(--foreground, #0f172a);
        cursor: pointer;
        font-size: 0.84rem;
        font-weight: 600;
        transition: border-color 0.2s ease, background 0.2s ease,
          transform 0.2s ease;
      }

      .layout-toolbar-btn:hover,
      .layout-btn:hover:not(:disabled) {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 6%, transparent);
        transform: translateY(-1px);
      }

      .layout-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .layout-list {
        display: grid;
        gap: 0.9rem;
      }

      .section-editor-grid {
        display: grid;
        grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
        gap: 1rem;
        align-items: start;
      }

      .section-side-panel,
      .selected-section-shell {
        display: grid;
        gap: 0.85rem;
        padding: 1rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--personality-card-radius, 1rem);
        background: color-mix(in srgb, var(--background, #ffffff) 96%, white);
      }

      .custom-compose-editor {
        overflow: hidden;
      }

      .custom-compose-editor lib-social-compose {
        display: block;
      }

      .selected-section-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .selected-section-head p {
        margin: 0.2rem 0 0;
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .layout-footer {
        display: flex;
        justify-content: flex-start;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .layout-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 1rem;
        padding: 1rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--personality-card-radius, 1rem);
        background: color-mix(in srgb, var(--background, #ffffff) 96%, white);
      }

      .layout-row-main {
        display: grid;
        gap: 0.7rem;
      }

      .media-editor,
      .motion-editor {
        display: grid;
        gap: 0.85rem;
        padding: 1rem;
        border-radius: 0.9rem;
        border: 1px solid color-mix(in srgb, var(--primary) 10%, var(--border));
        background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
      }

      .media-editor-head {
        display: grid;
        gap: 0.2rem;
      }

      .media-editor-head strong {
        color: var(--foreground);
        font-size: 0.9rem;
      }

      .media-editor-head small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .gallery-list {
        display: grid;
        gap: 0.8rem;
      }

      .media-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.6rem;
      }

      .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .asset-picker {
        display: grid;
        gap: 0.75rem;
        padding: 0.85rem;
        border-radius: 0.85rem;
        border: 1px solid color-mix(in srgb, var(--primary) 12%, var(--border));
        background: var(--background, #fff);
      }

      .asset-picker-head {
        display: grid;
        gap: 0.2rem;
      }

      .asset-picker-head strong {
        font-size: 0.88rem;
        color: var(--foreground);
      }

      .asset-picker-head small {
        color: var(--muted, #6b7280);
        line-height: 1.45;
      }

      .asset-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 0.7rem;
      }

      @media (max-width: 960px) {
        .section-editor-grid {
          grid-template-columns: 1fr;
        }
      }

      .asset-tile {
        display: grid;
        gap: 0.45rem;
        padding: 0.5rem;
        border-radius: 0.8rem;
        border: 1px solid var(--border, #e2e8f0);
        background: color-mix(in srgb, var(--surface, #fff) 92%, transparent);
        color: var(--foreground, #0f172a);
        cursor: pointer;
        text-align: left;
        transition: border-color 0.2s ease, transform 0.2s ease,
          box-shadow 0.2s ease;
      }

      .asset-tile:hover {
        border-color: var(--primary);
        transform: translateY(-1px);
        box-shadow: 0 10px 22px
          color-mix(in srgb, var(--primary) 7%, rgba(0, 0, 0, 0.05));
      }

      .asset-tile img {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        border-radius: 0.65rem;
        display: block;
      }

      .asset-tile span {
        font-size: 0.76rem;
        font-weight: 600;
        color: color-mix(in srgb, var(--foreground) 78%, transparent);
        word-break: break-word;
      }

      .gallery-item-editor {
        display: grid;
        gap: 0.7rem;
        padding: 0.85rem;
        border-radius: 0.85rem;
        border: 1px solid var(--border, #e2e8f0);
        background: var(--background, #fff);
      }

      .checkbox-line {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
      }

      .section-toggle {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        font-size: 0.95rem;
        font-weight: 700;
      }

      .section-help {
        margin: 0;
        color: var(--muted, #6b7280);
        font-size: 0.84rem;
        line-height: 1.45;
      }

      .layout-actions {
        display: flex;
        flex-direction: column;
        gap: 0.55rem;
        justify-content: flex-start;
      }

      .testimonial-list {
        display: grid;
        gap: 1rem;
      }

      .service-list {
        display: grid;
        gap: 1rem;
      }

      .service-card {
        display: grid;
        gap: 0.75rem;
        padding: 1rem;
        border: var(--personality-border-width, 1px) solid var(--border);
        border-radius: var(--personality-card-radius, 1rem);
        background: var(--background);
      }

      .testimonial-entry {
        display: grid;
        gap: 0.6rem;
        padding: 1rem;
        border: var(--personality-border-width, 1px) solid var(--border);
        border-radius: var(--personality-card-radius, 1rem);
        background: var(--background);
        transition: box-shadow 0.2s ease, transform 0.2s ease;
      }

      .testimonial-entry:hover {
        box-shadow: 0 8px 24px
          color-mix(in srgb, var(--primary) 6%, rgba(0, 0, 0, 0.04));
        transform: translateY(-2px);
      }

      .testimonial-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.25rem;
      }

      .testimonial-number {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--primary);
        letter-spacing: 0.05em;
      }

      .actions {
        display: flex;
        gap: 0.75rem;
        position: sticky;
        bottom: 1rem;
        padding: 1rem;
        background: color-mix(in srgb, var(--background) 92%, transparent);
        backdrop-filter: blur(12px);
        border-radius: var(--personality-card-radius, 1rem);
        border: var(--personality-border-width, 1px) solid var(--border);
        box-shadow: var(
          --personality-card-shadow,
          0 12px 32px rgba(0, 0, 0, 0.08)
        );
      }

      .otui-btn {
        padding: 0.75rem 1.6rem;
        border-radius: var(--personality-button-radius, 999px);
        cursor: pointer;
        font-size: 0.92rem;
        font-weight: 600;
        font-family: inherit;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1),
          box-shadow 0.2s ease, background 0.2s ease;
        will-change: transform;
      }

      .otui-btn:hover:not(:disabled) {
        transform: translateY(-2px);
      }

      .otui-btn.primary {
        background: var(--primary, #1f7a63);
        color: var(--primary-foreground, white);
        border: none;
        box-shadow: 0 6px 16px
          color-mix(in srgb, var(--primary) 24%, transparent);
      }

      .otui-btn.primary:hover:not(:disabled) {
        background: color-mix(in srgb, var(--primary, #1f7a63) 88%, black);
        box-shadow: 0 8px 22px
          color-mix(in srgb, var(--primary) 32%, transparent);
      }

      .otui-btn.ghost {
        background: transparent;
        border: 1px solid var(--border, #e2e8f0);
        color: var(--foreground, #0f172a);
      }

      .otui-btn.ghost:hover {
        border-color: var(--primary);
        background: color-mix(in srgb, var(--primary) 6%, transparent);
      }

      .otui-btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }

      .status-msg {
        font-size: 0.88rem;
        padding: 0.75rem 1rem;
        border-radius: var(--personality-border-radius, 0.5rem);
        margin: 0;
        font-weight: 500;
      }

      .status-msg.success {
        color: color-mix(in srgb, var(--success, #166534) 90%, black);
        background: color-mix(
          in srgb,
          var(--success, #dcfce7) 20%,
          transparent
        );
        border: var(--personality-border-width, 1px) solid
          color-mix(in srgb, var(--success) 30%, transparent);
      }

      .status-msg.error {
        color: color-mix(in srgb, var(--danger, #991b1b) 90%, black);
        background: color-mix(in srgb, var(--danger, #fee2e2) 20%, transparent);
        border: var(--personality-border-width, 1px) solid
          color-mix(in srgb, var(--danger) 30%, transparent);
      }

      @media (min-width: 641px) {
        .editor-pane,
        .preview-pane {
          max-height: calc(100vh - 6.5rem);
          overflow: auto;
          scrollbar-gutter: stable;
        }
      }

      @media (max-width: 640px) {
        .workspace-layout {
          grid-template-columns: 1fr;
        }

        .preview-pane {
          position: static;
          order: -1;
        }

        .mobile-preview-actions {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .mobile-preview-btn,
        .mobile-sheet-close,
        .mobile-sheet-tab {
          border: 1px solid var(--border, #e2e8f0);
          background: var(--surface, #fff);
          color: var(--foreground, #0f172a);
          border-radius: 999px;
          padding: 0.7rem 0.95rem;
          font-weight: 700;
          cursor: pointer;
        }

        .mobile-preview-btn.primary,
        .mobile-sheet-tab.active {
          background: var(--primary, #1f7a63);
          border-color: var(--primary, #1f7a63);
          color: white;
        }

        .mobile-sheet-backdrop {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 39;
          border: 0;
          background: rgba(15, 23, 42, 0.38);
        }

        .mobile-editor-sheet {
          display: grid;
          gap: 0.9rem;
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 40;
          max-height: 82vh;
          padding: 0.85rem 1rem 1rem;
          border-radius: 20px 20px 0 0;
          border: 1px solid var(--border, #e2e8f0);
          background: var(--background, #fff);
          box-shadow: 0 -18px 48px rgba(15, 23, 42, 0.18);
          transform: translateY(calc(100% + 2rem));
          transition: transform 0.24s ease;
        }

        .mobile-editor-sheet.open {
          transform: translateY(0);
        }

        .mobile-sheet-handle {
          width: 3rem;
          height: 0.32rem;
          margin: 0 auto;
          border-radius: 999px;
          background: color-mix(
            in srgb,
            var(--foreground, #0f172a) 16%,
            transparent
          );
        }

        .mobile-sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
        }

        .mobile-sheet-header h3,
        .mobile-sheet-kicker {
          margin: 0;
        }

        .mobile-sheet-kicker {
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-size: 0.72rem;
          color: var(--primary, #1f7a63);
          font-weight: 700;
        }

        .mobile-sheet-tabs {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
        }

        .mobile-sheet-body {
          overflow: auto;
          min-height: 0;
          padding-bottom: 0.25rem;
        }

        .mobile-sheet-panel,
        .mobile-sheet-structure-actions {
          display: grid;
          gap: 0.9rem;
        }

        .field-grid {
          grid-template-columns: 1fr;
        }

        .layout-option-grid,
        .layout-row,
        .split-canvas,
        .grid-canvas {
          grid-template-columns: 1fr;
        }

        .layout-actions {
          flex-direction: row;
          flex-wrap: wrap;
        }

        .personality-grid {
          grid-template-columns: repeat(2, 1fr);
        }

        .feature-row {
          grid-auto-flow: row;
          grid-auto-columns: auto;
        }
      }
    `,
  ],
})
export class BusinessSiteEditorPageComponent {
  private readonly api = inject(BusinessApiService);
  private readonly auth = inject(BusinessAuthService);
  private readonly http = inject(HttpClient);
  private readonly siteConfig = inject(BusinessSiteConfigStore);
  private readonly themeService = inject(ThemeService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly siteSlug = this.route?.snapshot.paramMap.get('siteSlug');

  loading = signal(true);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');
  assetsLoading = signal(false);
  assetLibraryError = signal('');
  assetLibrary = signal<BusinessAssetLibraryItem[]>([]);
  storeProductsLoading = signal(false);
  storeProductsError = signal('');
  storeServiceProducts = signal<BusinessStoreProduct[]>([]);
  activeAssetPicker = signal<string | null>(null);
  uploadingTargets = signal<Record<string, boolean>>({});
  private configId: string | null = null;
  private pendingDraftRefresh = false;
  private lastAppliedThemeSignature: string | null = null;
  private readonly draftPreviewReady = signal(false);
  readonly editorMode = signal<EditorMode>('studio');
  readonly onboardingMode = signal(false);
  readonly richTextEditorOpen = signal(false);
  readonly guidedStep = signal(0);
  readonly personalities = PREDEFINED_PERSONALITIES;
  readonly guidedSteps: GuidedStepDefinition[] = [
    {
      id: 'business-info',
      label: 'Business Info',
      summary:
        'Set your business identity, contact details, and the public voice visitors see first.',
      anchorId: 'guided-business-info',
    },
    {
      id: 'features',
      label: 'Features',
      summary:
        'Enable the capabilities clients can book, access, and use across the public site and portal.',
      anchorId: 'guided-features',
    },
    {
      id: 'services',
      label: 'Offers',
      summary:
        'Shape the services and proof blocks that make the WYSIWYG site commercially useful.',
      anchorId: 'guided-services',
    },
    {
      id: 'design',
      label: 'Design',
      summary:
        'Tune theme, personality, layout, and landing-page composition with the live canvas nearby.',
      anchorId: 'guided-design',
    },
    {
      id: 'review',
      label: 'Review',
      summary:
        'Check portal messaging, testimonials, and final polish before saving or switching fully into studio mode.',
      anchorId: 'guided-review',
    },
  ];
  readonly splitZones: Array<{
    id: SplitLayoutSlot;
    label: string;
    description: string;
  }> = [
    {
      id: 'primary',
      label: 'Primary column',
      description:
        'Main narrative area for hero, about, and core selling sections.',
    },
    {
      id: 'secondary',
      label: 'Secondary column',
      description: 'Supporting proof, contact, and CTA sections.',
    },
  ];
  readonly gridZones: Array<{
    id: GridLayoutSlot;
    label: string;
    description: string;
  }> = [
    {
      id: 'hero-wide',
      label: 'Hero wide',
      description: 'A full-width lead slot across the top of the grid.',
    },
    {
      id: 'top-left',
      label: 'Top left',
      description: 'First supporting slot below the hero band.',
    },
    {
      id: 'top-right',
      label: 'Top right',
      description: 'Second supporting slot below the hero band.',
    },
    {
      id: 'bottom-left',
      label: 'Bottom left',
      description: 'Lower-left supporting slot.',
    },
    {
      id: 'bottom-right',
      label: 'Bottom right',
      description: 'Lower-right supporting slot.',
    },
  ];
  readonly layoutOptions = [
    {
      value: 'single-column' as const,
      label: 'Single column',
      description: 'A linear editorial flow for narrative-heavy landing pages.',
    },
    {
      value: 'split' as const,
      label: 'Split layout',
      description:
        'Keeps the hero dominant while supporting content sits alongside it.',
    },
    {
      value: 'grid' as const,
      label: 'Grid layout',
      description:
        'A denser modular presentation for services, proof, and calls to action.',
    },
  ];
  readonly motionOptions: Array<{
    value: LandingSectionMotionKind;
    label: string;
  }> = [
    { value: 'none', label: 'None' },
    { value: 'particle-veil', label: 'Particle Veil' },
    { value: 'parallax-grid-warp', label: 'Parallax Grid Warp' },
    { value: 'aurora-ribbon', label: 'Aurora Ribbon' },
    { value: 'glass-fog', label: 'Glass Fog' },
    { value: 'pulse-rings', label: 'Pulse Rings' },
    { value: 'signal-mesh', label: 'Signal Mesh' },
    { value: 'topographic-drift', label: 'Topographic Drift' },
    { value: 'shimmer-beam', label: 'Shimmer Beam' },
  ];
  readonly mediaSourceOptions = [
    { value: 'url', label: 'External URL' },
    { value: 'asset', label: 'Asset path' },
  ];
  readonly serviceCatalogSourceOptions = [
    { value: 'manual', label: 'Manual business-site offers' },
    { value: 'store', label: 'Store service catalog' },
  ];
  readonly brandIdentityFields = BRAND_IDENTITY_FIELDS;
  readonly contactFields = CONTACT_FIELDS;
  readonly clientPortalFields = CLIENT_PORTAL_FIELDS;
  readonly serviceFields = SERVICE_FIELDS;
  readonly testimonialFields = TESTIMONIAL_FIELDS;
  draft = signal<BusinessSiteConfig>(cloneBusinessSiteConfig(), {
    equal: () => false,
  });
  readonly selectedSectionId = signal<string | null>(
    this.draft().landingPage.sections[0]?.id ?? null
  );
  private readonly selectedSectionComposeModel = signal<PostData>({
    title: '',
    content: '',
    links: [],
    attachments: [],
    injectedComponentsNew: [],
    themeConfig: {
      theme: 'light',
      accentColor: '#000000',
    },
  });
  readonly expandedPanels = signal<Record<EditorPanelId, boolean>>({
    design: true,
    'business-info': true,
    contact: false,
    features: false,
    layout: true,
    offers: false,
    review: false,
    testimonials: false,
  });
  readonly mobileSheetOpen = signal(false);
  readonly mobileSheetView = signal<'auto' | 'structure' | 'inspector'>('auto');
  readonly landingBlockFallbackTitle = (block: BlockInstance, index: number) =>
    this.blockFallbackTitle(block, index);
  private selectedSectionComposeSignature = '';

  private applyDraftTheme(): void {
    const theme = this.draft().theme;
    const signature = JSON.stringify(theme);
    if (signature === this.lastAppliedThemeSignature) {
      return;
    }

    this.lastAppliedThemeSignature = signature;
    this.themeService.setTheme(theme.mode);
    this.themeService.setPrimaryColor(theme.primaryColor);
    void this.themeService.setPersonality(theme.personalityId);
  }

  currentPersonalityLabel(): string {
    return (
      this.personalities.find(
        (personality) => personality.id === this.draft().theme.personalityId
      )?.name ?? this.draft().theme.personalityId
    );
  }

  updateDraftThemeField(key: keyof EditorThemeDraftValue, value: string): void {
    if (!this.isSupportedThemeFieldKey(key)) {
      return;
    }

    this.draft.update((draft) => {
      switch (key) {
        case 'mode':
          if (value === 'light' || value === 'dark') {
            draft.theme.mode = value;
          }
          break;
        case 'personalityId':
          draft.theme.personalityId = value;
          break;
        case 'primaryColor':
          draft.theme.primaryColor = value;
          break;
      }
      return draft;
    });
  }

  private isSupportedThemeFieldKey(
    key: keyof EditorThemeDraftValue
  ): key is SupportedThemeFieldKey {
    return key === 'mode' || key === 'personalityId' || key === 'primaryColor';
  }

  selectPersonality(personalityId: string): void {
    this.draft.update((draft) => {
      draft.theme.personalityId = personalityId;
      return draft;
    });
  }

  ownerProfileId(): string | undefined {
    return this.auth.user()?.profileId;
  }

  constructor() {
    effect(() => {
      if (!this.draftPreviewReady()) {
        return;
      }

      this.siteConfig.setSite(
        cloneBusinessSiteConfig(this.draft()),
        this.configId
      );
      this.applyDraftTheme();
    });

    effect(() => {
      this.selectedSectionId();
      this.draft();
      this.syncSelectedSectionComposeModel();
    });

    const initialMode = this.route?.snapshot.data['editorMode'];
    if (initialMode === 'guided' || initialMode === 'studio') {
      this.editorMode.set(initialMode);
      this.syncPanelsForEditorMode();
    }
    this.onboardingMode.set(!!this.route?.snapshot.data['onboardingMode']);

    this.siteConfig.fetch(false, this.siteSlug).subscribe({
      next: (site) => {
        this.loading.set(false);
        this.configId = this.siteConfig.configId();
        this.draft.set(cloneBusinessSiteConfig(site));
        this.selectedSectionId.set(
          this.draft().landingPage.sections[0]?.id ?? null
        );
        this.syncPanelsForEditorMode();
        this.draftPreviewReady.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.draftPreviewReady.set(true);
      },
    });
    void this.loadStoreProducts();
  }

  refreshDraftSignalFromTemplate(): void {
    if (!this.draftPreviewReady() || this.pendingDraftRefresh) {
      return;
    }

    this.pendingDraftRefresh = true;
    queueMicrotask(() => {
      this.pendingDraftRefresh = false;
      this.draft.set(cloneBusinessSiteConfig(this.draft()));
    });
  }

  landingPageBlocks(): BlockInstance[] {
    return businessSiteConfigToConfigDocument(this.draft()).blocks;
  }

  selectedSection(): LandingSection | null {
    return (
      this.draft().landingPage.sections.find(
        (section) => section.id === this.selectedSectionId()
      ) ?? null
    );
  }

  selectedSectionIndex(): number {
    const index = this.draft().landingPage.sections.findIndex(
      (section) => section.id === this.selectedSectionId()
    );
    return index === -1 ? 0 : index;
  }

  selectedSectionBlock(): BlockInstance | null {
    return (
      this.landingPageBlocks().find(
        (block) => block.id === this.selectedSectionId()
      ) ?? null
    );
  }

  selectedSectionDefinition(): BlockDefinition | null {
    const type = this.selectedSection()?.type;
    return type ? BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS[type] : null;
  }

  selectSection(sectionId: string): void {
    this.selectedSectionId.set(sectionId);
    const nextSection = this.draft().landingPage.sections.find(
      (section) => section.id === sectionId
    );
    this.richTextEditorOpen.set(nextSection?.type === 'custom');
    this.expandPanel('layout');
    this.syncDedicatedEditorPanelForSelection(nextSection ?? null);
    if (this.isMobileViewport()) {
      this.openMobileSheet('inspector');
    }
  }

  patchSelectedSectionField(
    fieldKey: string,
    rawValue: string | number | boolean
  ): void {
    const section = this.selectedSection();
    const definition = this.selectedSectionDefinition();
    if (!section || !definition) {
      return;
    }

    const field = definition.fields?.find(
      (candidate) => candidate.key === fieldKey
    );
    const nextValue = this.coerceInspectorValue(field?.type, rawValue);
    const sectionId = section.id;

    this.draft.update((draft) => {
      const target = draft.landingPage.sections.find(
        (candidate) => candidate.id === sectionId
      );
      if (!target) {
        return draft;
      }

      this.writeSectionPath(target, fieldKey, nextValue);
      return draft;
    });
  }

  patchDraftField(fieldKey: string, rawValue: string | number | boolean): void {
    const nextValue = this.coerceInspectorValue(
      this.rootFieldType(fieldKey),
      rawValue
    );

    this.draft.update((draft) => {
      this.writeRootPath(draft, fieldKey, nextValue);
      return draft;
    });
  }

  updateFeatureFlag(path: string, enabled: boolean): void {
    this.patchDraftField(`features.${path}`, enabled);
  }

  updateServiceCatalogSource(value: string): void {
    if (value !== 'manual' && value !== 'store') {
      return;
    }

    this.draft.update((draft) => {
      draft.serviceCatalog.source = value;
      return draft;
    });
  }

  servicesCollectionItems(): Array<Record<string, unknown>> {
    return this.draft().services as unknown as Array<Record<string, unknown>>;
  }

  testimonialCollectionItems(): Array<Record<string, unknown>> {
    return this.draft().testimonials as unknown as Array<
      Record<string, unknown>
    >;
  }

  readonly serviceItemLabel = (
    index: number,
    item: Record<string, unknown>
  ): string =>
    typeof item['name'] === 'string' && item['name'].trim().length > 0
      ? String(item['name'])
      : `Offer #${index + 1}`;

  readonly testimonialItemLabel = (
    index: number,
    item: Record<string, unknown>
  ): string =>
    typeof item['clientName'] === 'string' &&
    item['clientName'].trim().length > 0
      ? String(item['clientName'])
      : `Testimonial #${index + 1}`;

  readonly trackCollectionItemById = (
    item: Record<string, unknown>,
    index: number
  ) => (typeof item['id'] === 'string' ? item['id'] : index);

  readonly trackCollectionItemByIndex = (
    _item: Record<string, unknown>,
    index: number
  ) => index;

  updateStringListItem(path: string, index: number, value: string): void {
    this.draft.update((draft) => {
      const list = this.readRootPath(draft, path);
      if (Array.isArray(list) && typeof list[index] === 'string') {
        list[index] = value;
      }
      return draft;
    });
  }

  patchServiceField(
    index: number,
    fieldKey: string,
    rawValue: string | boolean
  ): void {
    const fieldType = this.serviceFields.find(
      (field) => field.key === fieldKey
    )?.type;
    const nextValue =
      typeof rawValue === 'boolean'
        ? rawValue
        : this.coerceInspectorValue(fieldType, rawValue);

    this.draft.update((draft) => {
      const service = draft.services[index];
      if (service) {
        this.writeRootPath(
          service as unknown as Record<string, unknown>,
          fieldKey,
          nextValue
        );
      }
      return draft;
    });
  }

  patchTestimonialField(
    index: number,
    fieldKey: string,
    rawValue: string | boolean
  ): void {
    const fieldType = this.testimonialFields.find(
      (field) => field.key === fieldKey
    )?.type;
    const nextValue =
      typeof rawValue === 'boolean'
        ? rawValue
        : this.coerceInspectorValue(fieldType, rawValue);

    this.draft.update((draft) => {
      const testimonial = draft.testimonials[index];
      if (testimonial) {
        this.writeRootPath(
          testimonial as unknown as Record<string, unknown>,
          fieldKey,
          nextValue
        );
      }
      return draft;
    });
  }

  openMobileSheet(view: 'auto' | 'structure' | 'inspector' = 'auto'): void {
    this.mobileSheetView.set(view);
    this.mobileSheetOpen.set(true);
  }

  closeMobileSheet(): void {
    this.mobileSheetOpen.set(false);
  }

  mobileSheetMode(): 'structure' | 'inspector' {
    if (this.mobileSheetView() === 'structure') {
      return 'structure';
    }

    if (this.mobileSheetView() === 'inspector' && this.selectedSection()) {
      return 'inspector';
    }

    return this.selectedSection() ? 'inspector' : 'structure';
  }

  mobileSheetTitle(): string {
    return this.mobileSheetMode() === 'inspector'
      ? this.selectedSection()?.title || 'Selected Section'
      : 'Landing Page Structure';
  }

  setEditorMode(mode: EditorMode): void {
    this.editorMode.set(mode);
    this.syncPanelsForEditorMode();
    if (mode === 'guided') {
      this.focusGuidedStep();
    }
  }

  setGuidedStep(index: number): void {
    this.guidedStep.set(index);
    this.expandPanel(this.panelIdForGuidedStep(index));
    this.focusGuidedStep();
  }

  nextGuidedStep(): void {
    if (this.guidedStep() >= this.guidedSteps.length - 1) {
      return;
    }
    this.guidedStep.update((step) => step + 1);
    this.expandPanel(this.panelIdForGuidedStep(this.guidedStep()));
    this.focusGuidedStep();
  }

  prevGuidedStep(): void {
    if (this.guidedStep() === 0) {
      return;
    }
    this.guidedStep.update((step) => step - 1);
    this.expandPanel(this.panelIdForGuidedStep(this.guidedStep()));
    this.focusGuidedStep();
  }

  isPanelExpanded(panelId: EditorPanelId): boolean {
    return this.expandedPanels()[panelId];
  }

  togglePanel(panelId: EditorPanelId): void {
    if (this.editorMode() === 'guided') {
      this.expandPanel(panelId);
      return;
    }

    this.expandedPanels.update((panels) => ({
      ...panels,
      [panelId]: !panels[panelId],
    }));
  }

  selectedSectionSupportsCompose(): boolean {
    const type = this.selectedSection()?.type;

    return (
      type === 'hero' ||
      type === 'about' ||
      type === 'services' ||
      type === 'testimonials' ||
      type === 'contact' ||
      type === 'booking' ||
      type === 'custom'
    );
  }

  composeEditorVisible(): boolean {
    return (
      this.selectedSection()?.type === 'custom' || this.richTextEditorOpen()
    );
  }

  selectedSectionUsesDedicatedPanel(): boolean {
    const type = this.selectedSection()?.type;
    return !!type && this.panelIdForSectionType(type) !== null;
  }

  selectedSectionEditorPanelTitle(): string {
    const panelId = this.panelIdForSectionType(this.selectedSection()?.type);
    switch (panelId) {
      case 'business-info':
        return 'Brand & Identity';
      case 'contact':
        return 'Contact Details';
      case 'offers':
        return 'Offers';
      case 'testimonials':
        return 'Testimonials';
      default:
        return 'Section Editor';
    }
  }

  selectedSectionEditorPanelDescription(): string {
    const type = this.selectedSection()?.type;
    switch (type) {
      case 'hero':
      case 'about':
        return 'This section uses the Brand & Identity panel on the left so preview copy stays in sync with the business profile fields.';
      case 'services':
      case 'booking':
        return 'This section uses the Offers panel on the left so service and call-to-action changes update the live preview from the primary data source.';
      case 'testimonials':
        return 'This section uses the Testimonials panel on the left so social proof stays aligned with the published testimonials collection.';
      case 'contact':
        return 'This section uses the Contact Details panel on the left for business contact info, with image and section styling controls kept here.';
      default:
        return 'Use the dedicated editor panel on the left for this section.';
    }
  }

  toggleRichTextEditor(): void {
    this.richTextEditorOpen.update((open) => !open);
  }

  selectedSectionComposeValue(): PostData {
    return this.selectedSectionComposeModel();
  }

  updateSelectedSectionRichContent(value: PostData): void {
    const section = this.selectedSection();
    if (!section || !this.selectedSectionSupportsCompose()) {
      return;
    }

    this.draft.update((draft) => {
      const target = draft.landingPage.sections.find(
        (candidate) => candidate.id === section.id
      );
      if (!target) {
        return draft;
      }

      target.richContent = {
        title: value.title?.trim() || target.title,
        content: value.content ?? '',
        injectedComponents: value.injectedComponentsNew ?? [],
        themeConfig: {
          theme: value.themeConfig?.theme,
          accentColor: value.themeConfig?.accentColor,
        },
      } satisfies LandingSectionRichContent;
      target.body = this.plainTextFromHtml(value.content ?? '');
      return draft;
    });
  }

  updateGalleryItemField(
    sectionIndex: number,
    itemIndex: number,
    field: keyof LandingSectionMediaItem,
    value: string
  ): void {
    this.draft.update((draft) => {
      const item =
        draft.landingPage.sections[sectionIndex].gallery?.items[itemIndex];
      if (!item) {
        return draft;
      }

      if (field === 'sourceType') {
        item.sourceType = value === 'asset' ? 'asset' : 'url';
      } else if (field === 'src' || field === 'alt' || field === 'caption') {
        item[field] = value;
      }
      return draft;
    });
  }

  selectedCustomSectionComposeValue(): PostData {
    return this.selectedSectionComposeValue();
  }

  private syncSelectedSectionComposeModel(): void {
    const nextValue = this.buildSelectedSectionComposeValue();
    const nextSignature = JSON.stringify(nextValue);
    if (nextSignature === this.selectedSectionComposeSignature) {
      return;
    }

    this.selectedSectionComposeSignature = nextSignature;
    this.selectedSectionComposeModel.set(nextValue);
  }

  private buildSelectedSectionComposeValue(): PostData {
    const section = this.selectedSection();
    const richContent = section?.richContent;

    return {
      title: richContent?.title ?? section?.title ?? '',
      content: richContent?.content ?? this.defaultComposeContent(section),
      links: [],
      attachments: [],
      injectedComponentsNew: richContent?.injectedComponents ?? [],
      themeConfig: {
        theme: richContent?.themeConfig?.theme ?? this.draft().theme.mode,
        accentColor:
          richContent?.themeConfig?.accentColor ??
          this.draft().theme.primaryColor,
      },
    };
  }

  updateSelectedCustomSectionRichContent(value: PostData): void {
    this.updateSelectedSectionRichContent(value);
  }

  private defaultComposeContent(
    section: LandingSection | null | undefined
  ): string {
    if (!section) {
      return '';
    }

    if (section.body?.trim()) {
      return this.composeHtmlFromText(section.body);
    }

    switch (section.type) {
      case 'hero':
        return [
          `<h1>${this.escapeHtml(this.draft().brand.tagline)}</h1>`,
          `<p>${this.escapeHtml(this.draft().brand.intro)}</p>`,
          `<p>${this.escapeHtml(this.draft().brand.longBio)}</p>`,
        ].join('');
      case 'about':
        return [
          `<p>${this.escapeHtml(this.ownerNamePreview())}</p>`,
          `<p>${this.escapeHtml(this.draft().brand.longBio)}</p>`,
        ].join('');
      case 'services':
        return '<p>Choose a starting point, then build the right engagement from there.</p>';
      case 'testimonials':
        return '<p>Services that fit real schedules and still move the needle.</p>';
      case 'contact':
        return '<p>Reach out when you are ready to talk goals, schedule, and fit.</p>';
      case 'booking':
        return '<p>Book the right starting point when you are ready.</p>';
      case 'custom':
        return section.body ? this.composeHtmlFromText(section.body) : '';
      default:
        return '';
    }
  }

  private ownerNamePreview(): string {
    return (
      this.draft().brand.ownerName ||
      this.draft().brand.trainerName ||
      'Business Owner'
    );
  }

  private escapeHtml(value: string | undefined): string {
    return (value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private composeHtmlFromText(value: string): string {
    return value
      .replace(/\r\n?/g, '\n')
      .split(/\n{2,}/)
      .filter((paragraph) => paragraph.trim().length > 0)
      .map(
        (paragraph) =>
          `<p>${this.escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`
      )
      .join('');
  }

  private focusGuidedStep(): void {
    if (typeof document === 'undefined') {
      return;
    }

    const step = this.guidedSteps[this.guidedStep()];
    const element = document.getElementById(step.anchorId);
    if (typeof element?.scrollIntoView !== 'function') {
      return;
    }

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }

  async loadStoreProducts(): Promise<void> {
    this.storeProductsLoading.set(true);
    this.storeProductsError.set('');

    try {
      const products = await firstValueFrom(this.api.getStoreProducts());
      this.storeServiceProducts.set(
        products.filter(
          (product) => product.active !== false && product.type === 'service'
        )
      );
    } catch (error: any) {
      this.storeProductsError.set(
        error?.error?.message ||
          error?.message ||
          'Failed to load store service products.'
      );
    } finally {
      this.storeProductsLoading.set(false);
    }
  }

  private syncDedicatedEditorPanelForSelection(
    section: LandingSection | null
  ): void {
    const panelId = this.panelIdForSectionType(section?.type);
    if (panelId) {
      this.expandPanel(panelId);
    }
  }

  private panelIdForSectionType(
    type: LandingSection['type'] | undefined
  ): EditorPanelId | null {
    switch (type) {
      case 'hero':
      case 'about':
        return 'business-info';
      case 'contact':
        return 'contact';
      case 'services':
      case 'booking':
        return 'offers';
      case 'testimonials':
        return 'testimonials';
      default:
        return null;
    }
  }

  addCredential(): void {
    this.draft.update((d) => {
      d.brand.credentials.push('');
      return d;
    });
  }

  removeCredential(index: number): void {
    this.draft.update((d) => {
      d.brand.credentials.splice(index, 1);
      return d;
    });
  }

  addSpecialization(): void {
    this.draft.update((d) => {
      d.brand.specializations.push('');
      return d;
    });
  }

  removeSpecialization(index: number): void {
    this.draft.update((d) => {
      d.brand.specializations.splice(index, 1);
      return d;
    });
  }

  addTestimonial(): void {
    this.draft.update((d) => {
      d.testimonials.push({ quote: '', clientName: '', clientDetail: '' });
      return d;
    });
  }

  removeTestimonial(index: number): void {
    this.draft.update((d) => {
      d.testimonials.splice(index, 1);
      return d;
    });
  }

  addService(): void {
    this.draft.update((d) => {
      d.services.push({
        id: `service-${Date.now()}-${d.services.length + 1}`,
        name: '',
        description: '',
        duration: 60,
        price: 0,
        allowOnlineBooking: true,
      });
      return d;
    });
  }

  removeService(index: number): void {
    this.draft.update((d) => {
      d.services.splice(index, 1);
      return d;
    });
  }

  addCapability(): void {
    this.draft.update((d) => {
      d.clientPortal.capabilities.push('');
      return d;
    });
  }

  removeCapability(index: number): void {
    this.draft.update((d) => {
      d.clientPortal.capabilities.splice(index, 1);
      return d;
    });
  }

  addCustomSection(): void {
    let nextSectionId = '';
    this.draft.update((draft) => {
      nextSectionId = `custom-${Date.now()}-${
        draft.landingPage.sections.length + 1
      }`;
      draft.landingPage.sections.push({
        id: nextSectionId,
        type: 'custom',
        title: 'Custom section',
        enabled: true,
        order: draft.landingPage.sections.length,
        body: '',
        ctaLabel: '',
        ctaHref: '',
        motion: this.createDefaultMotion(),
        richContent: {
          title: 'Custom section',
          content: '',
          injectedComponents: [],
          themeConfig: {
            theme: draft.theme.mode,
            accentColor: draft.theme.primaryColor,
          },
        },
      });
      draft.landingPage.sections = normalizeLandingSections(
        draft.landingPage.sections
      );
      return draft;
    });
    this.selectedSectionId.set(nextSectionId);
  }

  addImageSection(): void {
    let nextSectionId = '';
    this.draft.update((draft) => {
      nextSectionId = `image-${Date.now()}-${
        draft.landingPage.sections.length + 1
      }`;
      draft.landingPage.sections.push({
        id: nextSectionId,
        type: 'image',
        title: 'Image block',
        enabled: true,
        order: draft.landingPage.sections.length,
        image: this.createDefaultImage(),
        motion: this.createDefaultMotion(),
      });
      draft.landingPage.sections = normalizeLandingSections(
        draft.landingPage.sections
      );
      return draft;
    });
    this.selectedSectionId.set(nextSectionId);
  }

  addGallerySection(): void {
    let nextSectionId = '';
    this.draft.update((draft) => {
      nextSectionId = `gallery-${Date.now()}-${
        draft.landingPage.sections.length + 1
      }`;
      draft.landingPage.sections.push({
        id: nextSectionId,
        type: 'gallery',
        title: 'Gallery block',
        enabled: true,
        order: draft.landingPage.sections.length,
        gallery: {
          style: 'grid',
          columns: 3,
          items: [this.createDefaultImage()],
        },
        motion: this.createDefaultMotion(),
      });
      draft.landingPage.sections = normalizeLandingSections(
        draft.landingPage.sections
      );
      return draft;
    });
    this.selectedSectionId.set(nextSectionId);
  }

  addGalleryItem(sectionIndex: number): void {
    this.draft.update((draft) => {
      draft.landingPage.sections[sectionIndex].gallery?.items.push(
        this.createDefaultImage()
      );
      return draft;
    });
  }

  removeGalleryItem(sectionIndex: number, itemIndex: number): void {
    this.draft.update((draft) => {
      draft.landingPage.sections[sectionIndex].gallery?.items.splice(
        itemIndex,
        1
      );
      return draft;
    });
  }

  assetTargetKey(sectionIndex: number, itemIndex?: number | null): string {
    return itemIndex === null || itemIndex === undefined
      ? `section-${sectionIndex}`
      : `section-${sectionIndex}-item-${itemIndex}`;
  }

  isAssetPickerOpen(sectionIndex: number, itemIndex?: number | null): boolean {
    return (
      this.activeAssetPicker() === this.assetTargetKey(sectionIndex, itemIndex)
    );
  }

  isUploading(targetKey: string): boolean {
    return !!this.uploadingTargets()[targetKey];
  }

  toggleAssetPicker(sectionIndex: number, itemIndex?: number | null): void {
    const key = this.assetTargetKey(sectionIndex, itemIndex);
    if (this.activeAssetPicker() === key) {
      this.activeAssetPicker.set(null);
      return;
    }

    this.activeAssetPicker.set(key);
    void this.loadOwnerAssets();
  }

  async loadOwnerAssets(force = false): Promise<void> {
    if (!force && (this.assetsLoading() || this.assetLibrary().length)) {
      return;
    }

    const profileId = this.auth.user()?.profileId;
    if (!profileId) {
      this.assetLibraryError.set(
        'Owner profile is not available for asset browsing.'
      );
      return;
    }

    this.assetsLoading.set(true);
    this.assetLibraryError.set('');
    this.api.listAssets(profileId).subscribe({
      next: (assets) => {
        this.assetsLoading.set(false);
        this.assetLibrary.set(assets);
      },
      error: (err) => {
        this.assetsLoading.set(false);
        this.assetLibraryError.set(
          err?.error?.message || err?.message || 'Failed to load assets.'
        );
      },
    });
  }

  selectAsset(
    sectionIndex: number,
    itemIndex: number | null,
    asset: BusinessAssetLibraryItem
  ): void {
    this.draft.update((draft) => {
      if (itemIndex === null || itemIndex === undefined) {
        const section = draft.landingPage.sections[sectionIndex];
        if (!section.image && section.type === 'contact') {
          section.image = this.createDefaultImage();
          section.image.aspect = 'portrait';
        }
        const image = section.image;
        if (image) {
          image.sourceType = 'asset';
          image.src = asset.url;
          image.alt = image.alt || asset.name;
        }
      } else {
        const image =
          draft.landingPage.sections[sectionIndex].gallery?.items[itemIndex];
        if (image) {
          image.sourceType = 'asset';
          image.src = asset.url;
          image.alt = image.alt || asset.name;
        }
      }
      return draft;
    });
    this.activeAssetPicker.set(null);
  }

  async onAssetFileSelected(
    sectionIndex: number,
    itemIndex: number | null,
    event: Event
  ): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    const profileId = this.auth.user()?.profileId;
    const targetKey = this.assetTargetKey(sectionIndex, itemIndex);
    if (!file || !profileId) {
      return;
    }

    if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
      this.assetLibraryError.set(
        'Images must be 20MB or smaller before uploading.'
      );
      if (input) {
        input.value = '';
      }
      return;
    }

    this.uploadingTargets.update((state) => ({ ...state, [targetKey]: true }));
    this.assetLibraryError.set('');

    try {
      const assetUrl = await this.uploadAsset(file, profileId);
      this.draft.update((draft) => {
        if (itemIndex === null || itemIndex === undefined) {
          const section = draft.landingPage.sections[sectionIndex];
          if (!section.image && section.type === 'contact') {
            section.image = this.createDefaultImage();
            section.image.aspect = 'portrait';
          }
          const image = section.image;
          if (image) {
            image.sourceType = 'asset';
            image.src = assetUrl;
            image.alt = image.alt || file.name.replace(/\.[^/.]+$/, '');
          }
        } else {
          const image =
            draft.landingPage.sections[sectionIndex].gallery?.items[itemIndex];
          if (image) {
            image.sourceType = 'asset';
            image.src = assetUrl;
            image.alt = image.alt || file.name.replace(/\.[^/.]+$/, '');
          }
        }
        return draft;
      });
      await this.loadOwnerAssets(true);
      this.activeAssetPicker.set(null);
    } catch (error: any) {
      this.assetLibraryError.set(
        error?.error?.message || error?.message || 'Asset upload failed.'
      );
    } finally {
      if (input) {
        input.value = '';
      }
      this.uploadingTargets.update((state) => ({
        ...state,
        [targetKey]: false,
      }));
    }
  }

  setLandingLayout(layout: BusinessSiteConfig['landingPage']['layout']): void {
    this.draft.update((draft) => {
      draft.landingPage.layout = layout;
      return draft;
    });
  }

  resetSectionOrder(): void {
    this.draft.update((draft) => {
      draft.landingPage.sections = normalizeLandingSections([
        ...draft.landingPage.sections,
      ]);
      return draft;
    });
  }

  setAllSectionsEnabled(enabled: boolean): void {
    this.draft.update((draft) => {
      draft.landingPage.sections = draft.landingPage.sections.map(
        (section) => ({
          ...section,
          enabled,
        })
      );
      return draft;
    });
  }

  restoreRecommendedSectionState(): void {
    const recommendedOrder = [
      'hero',
      'about',
      'services',
      'testimonials',
      'contact',
      'booking',
    ];
    this.draft.update((draft) => {
      const ordered = [...draft.landingPage.sections].sort((a, b) => {
        const indexA = recommendedOrder.indexOf(a.id);
        const indexB = recommendedOrder.indexOf(b.id);
        return (
          (indexA === -1 ? Number.MAX_SAFE_INTEGER : indexA) -
          (indexB === -1 ? Number.MAX_SAFE_INTEGER : indexB)
        );
      });
      draft.landingPage.sections = normalizeLandingSections(
        ordered.map((section) => ({
          ...section,
          enabled: recommendedOrder.includes(section.id)
            ? true
            : section.enabled,
        }))
      );
      return draft;
    });
  }

  connectedDropLists(): string[] {
    return [
      this.dropListId('single-column', 'main'),
      ...this.splitZones.map((zone) => this.dropListId('split', zone.id)),
      ...this.gridZones.map((zone) => this.dropListId('grid', zone.id)),
    ];
  }

  dropListId(
    layout: 'single-column' | 'split' | 'grid',
    zoneId: string
  ): string {
    return `landing-${layout}-${zoneId}`;
  }

  sectionIdsForZone(
    layout: 'single-column' | 'split' | 'grid',
    zoneId: string
  ): string[] {
    return this.sectionsForZone(layout, zoneId).map((section) => section.id);
  }

  sectionsForZone(layout: 'single-column' | 'split' | 'grid', zoneId: string) {
    const sections = [...this.draft().landingPage.sections];
    if (layout === 'single-column') {
      return sections.sort((a, b) => a.order - b.order);
    }

    return sections
      .filter((section) =>
        layout === 'split'
          ? (section.layoutPlacement?.split ??
              this.defaultSplitSlot(section.id)) === zoneId
          : (section.layoutPlacement?.grid ??
              this.defaultGridSlot(section.id)) === zoneId
      )
      .sort((a, b) => a.order - b.order);
  }

  moveSectionToLayoutZone(
    sectionId: string,
    layout: 'split' | 'grid',
    zoneId: SplitLayoutSlot | GridLayoutSlot
  ): void {
    const sections = [...this.draft().landingPage.sections];
    const target = sections.find((section) => section.id === sectionId);
    if (!target) {
      return;
    }

    if (layout === 'split') {
      target.layoutPlacement = {
        ...(target.layoutPlacement ?? {}),
        split: zoneId as SplitLayoutSlot,
      };
    } else {
      target.layoutPlacement = {
        ...(target.layoutPlacement ?? {}),
        grid: zoneId as GridLayoutSlot,
      };
    }

    this.draft.update((draft) => {
      draft.landingPage.sections = normalizeLandingSections(sections);
      return draft;
    });
  }

  dropSection(
    event: CdkDragDrop<string[]>,
    layout: 'single-column' | 'split' | 'grid',
    zoneId: string
  ): void {
    const zoneMap = this.buildZoneSectionMap(layout);
    const previousZoneId = this.zoneIdFromDropListId(
      event.previousContainer.id
    );
    const targetZoneId =
      this.zoneIdFromDropListId(event.container.id) ?? zoneId;
    if (!previousZoneId || !targetZoneId) {
      return;
    }

    const previousItems = [...(zoneMap.get(previousZoneId) ?? [])];
    const targetItems =
      previousZoneId === targetZoneId
        ? previousItems
        : [...(zoneMap.get(targetZoneId) ?? [])];

    if (event.previousContainer === event.container) {
      moveItemInArray(targetItems, event.previousIndex, event.currentIndex);
      zoneMap.set(targetZoneId, targetItems);
    } else {
      transferArrayItem(
        previousItems,
        targetItems,
        event.previousIndex,
        event.currentIndex
      );
      zoneMap.set(previousZoneId, previousItems);
      zoneMap.set(targetZoneId, targetItems);
    }

    this.applyZoneSectionMap(layout, zoneMap);
  }

  toggleSectionEnabled(sectionId: string, enabled: boolean): void {
    this.draft.update((draft) => {
      draft.landingPage.sections = draft.landingPage.sections.map((section) =>
        section.id === sectionId ? { ...section, enabled } : section
      );
      return draft;
    });
  }

  removeSection(index: number): void {
    this.draft.update((draft) => {
      const removedId = draft.landingPage.sections[index]?.id;
      draft.landingPage.sections.splice(index, 1);
      draft.landingPage.sections = normalizeLandingSections(
        draft.landingPage.sections
      );
      if (removedId && this.selectedSectionId() === removedId) {
        this.selectedSectionId.set(
          draft.landingPage.sections[index]?.id ??
            draft.landingPage.sections[index - 1]?.id ??
            null
        );
        this.mobileSheetView.set('structure');
      }
      return draft;
    });
  }

  moveSectionUp(index: number): void {
    if (index <= 0) {
      return;
    }

    this.draft.update((draft) => {
      const sections = [...draft.landingPage.sections];
      [sections[index - 1], sections[index]] = [
        sections[index],
        sections[index - 1],
      ];
      draft.landingPage.sections = normalizeLandingSections(sections);
      return draft;
    });
  }

  moveSectionDown(index: number): void {
    if (index >= this.draft().landingPage.sections.length - 1) {
      return;
    }

    this.draft.update((draft) => {
      const sections = [...draft.landingPage.sections];
      [sections[index], sections[index + 1]] = [
        sections[index + 1],
        sections[index],
      ];
      draft.landingPage.sections = normalizeLandingSections(sections);
      return draft;
    });
  }

  sectionDescription(sectionType: string): string {
    switch (sectionType) {
      case 'hero':
        return 'Lead with brand positioning, owner identity, and the first call to action.';
      case 'about':
        return 'Expand on the owner voice and give visitors more confidence about fit.';
      case 'services':
        return 'Surface core offers and explain how each engagement starts.';
      case 'testimonials':
        return 'Add social proof and credibility without interrupting the main flow.';
      case 'contact':
        return 'Make direct contact details and next steps easy to find.';
      case 'booking':
        return 'Keep a dedicated conversion block for booking-ready visitors.';
      case 'custom':
        return 'Insert a flexible proof, FAQ, process, or CTA section anywhere in the sequence.';
      case 'image':
        return 'Drop in a single image block with captioning, aspect control, and optional motion.';
      case 'gallery':
        return 'Use a multi-image block for proof, behind-the-scenes visuals, or portfolio snapshots.';
      default:
        return 'Control whether this section appears and where it sits in the public narrative.';
    }
  }

  sectionSummary(section: LandingSection): string {
    if (section.type === 'custom') {
      if (section.richContent?.content?.trim()) {
        return (
          this.plainTextFromHtml(section.richContent.content) ||
          'Compose richer editorial content, callouts, and visual blocks.'
        );
      }

      return section.body?.trim() || 'Add supporting copy and an optional CTA.';
    }

    if (section.type === 'image') {
      return section.image?.src?.trim()
        ? `${
            section.image.sourceType === 'asset' ? 'Asset' : 'URL'
          } image with ${section.image.aspect ?? 'landscape'} framing.`
        : 'No image source selected yet.';
    }

    if (section.type === 'gallery') {
      const count =
        section.gallery?.items?.filter((item) => item.src.trim()).length ?? 0;
      return count
        ? `${count} gallery image${count === 1 ? '' : 's'} in a ${
            section.gallery?.style ?? 'grid'
          } layout.`
        : 'No gallery images selected yet.';
    }

    return this.sectionDescription(section.type);
  }

  sectionPreviewImage(section: LandingSection): LandingSectionMediaItem | null {
    if (section.type === 'image' && section.image?.src?.trim()) {
      return section.image;
    }

    if (section.type === 'gallery') {
      return section.gallery?.items.find((item) => item.src.trim()) ?? null;
    }

    return null;
  }

  motionLabel(kind: LandingSectionMotionKind): string {
    return (
      this.motionOptions.find((option) => option.value === kind)?.label ??
      'Motion'
    );
  }

  private buildZoneSectionMap(
    layout: 'single-column' | 'split' | 'grid'
  ): Map<string, string[]> {
    const zones =
      layout === 'single-column'
        ? ['main']
        : layout === 'split'
        ? this.splitZones.map((zone) => zone.id)
        : this.gridZones.map((zone) => zone.id);
    return new Map(
      zones.map((zoneId) => [zoneId, this.sectionIdsForZone(layout, zoneId)])
    );
  }

  private applyZoneSectionMap(
    layout: 'single-column' | 'split' | 'grid',
    zoneMap: Map<string, string[]>
  ): void {
    const sectionsById = new Map(
      this.draft().landingPage.sections.map((section) => [
        section.id,
        { ...section },
      ])
    );
    const zoneOrder =
      layout === 'single-column'
        ? ['main']
        : layout === 'split'
        ? this.splitZones.map((zone) => zone.id)
        : this.gridZones.map((zone) => zone.id);

    const nextSections = zoneOrder.flatMap((zoneId) =>
      (zoneMap.get(zoneId) ?? [])
        .map((sectionId) => {
          const section = sectionsById.get(sectionId);
          if (!section) {
            return null;
          }

          if (layout === 'split') {
            section.layoutPlacement = {
              ...(section.layoutPlacement ?? {}),
              split: zoneId as SplitLayoutSlot,
            };
          } else if (layout === 'grid') {
            section.layoutPlacement = {
              ...(section.layoutPlacement ?? {}),
              grid: zoneId as GridLayoutSlot,
            };
          }

          return section;
        })
        .filter((section): section is NonNullable<typeof section> => !!section)
    );

    this.draft.update((draft) => {
      draft.landingPage.sections = normalizeLandingSections(nextSections);
      return draft;
    });
  }

  private zoneIdFromDropListId(dropListId: string): string | null {
    return dropListId.split('-').slice(2).join('-') || null;
  }

  private defaultSplitSlot(sectionId: string): SplitLayoutSlot {
    return (
      this.draft().landingPage.sections.find(
        (section) => section.id === sectionId
      )?.layoutPlacement?.split ??
      (['hero', 'about', 'services'].includes(sectionId)
        ? 'primary'
        : 'secondary')
    );
  }

  private defaultGridSlot(sectionId: string): GridLayoutSlot {
    return (
      this.draft().landingPage.sections.find(
        (section) => section.id === sectionId
      )?.layoutPlacement?.grid ??
      (
        {
          hero: 'hero-wide',
          about: 'top-left',
          services: 'top-right',
          testimonials: 'bottom-left',
          contact: 'bottom-right',
          booking: 'bottom-right',
        } as Record<string, GridLayoutSlot>
      )[sectionId] ??
      'bottom-right'
    );
  }

  private createDefaultImage(): LandingSectionMediaItem {
    return {
      sourceType: 'url',
      src: '',
      alt: '',
      caption: '',
      aspect: 'landscape',
      fit: 'cover',
      focalPoint: 'center',
    };
  }

  private createDefaultMotion() {
    return {
      kind: 'none' as LandingSectionMotionKind,
      density: 18,
      speed: 1,
      intensity: 0.65,
      height: '100%',
      reducedMotion: false,
      direction: 'diagonal' as const,
      ringCount: 4,
    };
  }

  private syncPanelsForEditorMode(): void {
    if (this.editorMode() === 'guided') {
      this.expandPanel(this.panelIdForGuidedStep(this.guidedStep()));
      return;
    }

    this.expandedPanels.update((panels) => ({
      ...panels,
      design: true,
      'business-info': true,
      layout: true,
    }));
  }

  private expandPanel(panelId: EditorPanelId): void {
    if (this.editorMode() === 'guided') {
      this.expandedPanels.set({
        design: false,
        'business-info': false,
        contact: false,
        features: false,
        layout: false,
        offers: false,
        review: false,
        testimonials: false,
        [panelId]: true,
      });
      return;
    }

    this.expandedPanels.update((panels) => ({
      ...panels,
      [panelId]: true,
    }));
  }

  private panelIdForGuidedStep(index: number): EditorPanelId {
    switch (this.guidedSteps[index]?.id) {
      case 'business-info':
        return 'business-info';
      case 'features':
        return 'features';
      case 'services':
        return 'offers';
      case 'design':
        return 'design';
      case 'review':
        return 'review';
      default:
        return 'business-info';
    }
  }

  private blockFallbackTitle(block: BlockInstance, index: number): string {
    return (
      this.selectedSectionDefinitionForType(block.type)?.name ??
      `Section ${index + 1}`
    );
  }

  private selectedSectionDefinitionForType(
    sectionType: string
  ): BlockDefinition | null {
    return (
      BUSINESS_LANDING_PAGE_BLOCK_DEFINITIONS[
        sectionType as LandingSection['type']
      ] ?? null
    );
  }

  private coerceInspectorValue(
    fieldType:
      | 'string'
      | 'number'
      | 'boolean'
      | 'array'
      | 'object'
      | 'url'
      | 'select'
      | undefined,
    rawValue: string | number | boolean
  ): unknown {
    if (typeof rawValue === 'number' || typeof rawValue === 'boolean') {
      return rawValue;
    }

    if (fieldType === 'number') {
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    if (fieldType === 'boolean') {
      return rawValue === 'true';
    }

    return rawValue;
  }

  private rootFieldType(
    fieldKey: string
  ): BlockFieldDefinition['type'] | undefined {
    return [
      ...this.brandIdentityFields,
      ...this.contactFields,
      ...this.clientPortalFields,
    ].find((field) => field.key === fieldKey)?.type;
  }

  private writeSectionPath(
    section: LandingSection,
    path: string,
    value: unknown
  ): void {
    const segments = path.split('.');
    const last = segments.pop();
    if (!last) {
      return;
    }

    let current = section as unknown as Record<string, unknown>;
    for (const segment of segments) {
      const next = current[segment];
      if (!next || typeof next !== 'object') {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }

    current[last] = value;
  }

  private readRootPath(model: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }
      return (current as Record<string, unknown>)[segment];
    }, model);
  }

  private writeRootPath(
    draft: Record<string, unknown> | BusinessSiteConfig,
    path: string,
    value: unknown
  ): void {
    const segments = path.split('.');
    const last = segments.pop();
    if (!last) {
      return;
    }

    let current = draft as unknown as Record<string, unknown>;
    for (const segment of segments) {
      const next = current[segment];
      if (!next || typeof next !== 'object') {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }

    current[last] = value;
  }

  private isMobileViewport(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 768px)').matches
    );
  }

  private async uploadAsset(file: File, profileId: string): Promise<string> {
    const content = await this.fileToBase64(file);
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
    const payload: AssetUploadPayload = {
      name: file.name,
      profileId,
      type: 'image',
      content,
      fileExtension,
    };
    const asset = await firstValueFrom(
      this.http.post<{ id: string }>('/api/asset', payload, {
        headers: this.auth.getAuthHeaders(),
      })
    );
    return `/api/asset/${asset.id}`;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private plainTextFromHtml(value: string): string {
    if (!value.trim()) {
      return '';
    }

    const htmlWithLineBreaks = value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|blockquote|li|h[1-6])>/gi, '\n')
      .replace(/<(li)\b[^>]*>/gi, '\n');

    if (typeof DOMParser === 'undefined') {
      return htmlWithLineBreaks
        .replace(/<[^>]+>/g, ' ')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    const parsed = new DOMParser().parseFromString(
      htmlWithLineBreaks,
      'text/html'
    );
    return (
      parsed.body.textContent
        ?.replace(/\u00a0/g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n[ \t]+/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim() ?? ''
    );
  }

  private sanitizedDraft(): BusinessSiteConfig {
    const draft = cloneBusinessSiteConfig(this.draft());

    draft.brand.ownerName =
      draft.brand.ownerName?.trim() ||
      draft.brand.trainerName ||
      'Business Owner';
    draft.brand.trainerName =
      draft.brand.trainerName?.trim() || draft.brand.ownerName;
    draft.serviceCatalog.source =
      draft.serviceCatalog.source === 'store' ? 'store' : 'manual';

    if (!draft.features.booking.enabled) {
      draft.features.booking.allowOnlinePayment = false;
    }

    if (!draft.features.clientTasks.enabled) {
      draft.features.clientTasks.allowClientCompletion = false;
    }

    draft.services =
      draft.serviceCatalog.source === 'store'
        ? []
        : draft.services.map((service) => ({
            ...service,
            name: service.name.trim(),
            description: service.description.trim(),
          }));

    draft.landingPage.sections = normalizeLandingSections(
      [...draft.landingPage.sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => ({
          ...section,
          title: section.title.trim() || 'Untitled section',
          body: section.body?.trim(),
          ctaLabel: section.ctaLabel?.trim(),
          ctaHref: section.ctaHref?.trim(),
          image: section.image
            ? {
                ...section.image,
                src: section.image.src.trim(),
                alt: section.image.alt.trim(),
                caption: section.image.caption?.trim(),
              }
            : undefined,
          gallery: section.gallery
            ? {
                ...section.gallery,
                items: section.gallery.items.map((item) => ({
                  ...item,
                  src: item.src.trim(),
                  alt: item.alt.trim(),
                  caption: item.caption?.trim(),
                })),
              }
            : undefined,
          richContent: section.richContent
            ? {
                ...section.richContent,
                title:
                  section.richContent.title?.trim() || section.title.trim(),
                content: section.richContent.content?.trim() ?? '',
                injectedComponents:
                  section.richContent.injectedComponents?.map((component) => ({
                    ...component,
                    componentData: { ...component.componentData },
                  })) ?? [],
                themeConfig: section.richContent.themeConfig
                  ? { ...section.richContent.themeConfig }
                  : undefined,
              }
            : undefined,
        }))
    );

    return configDocumentToBusinessSiteConfig(
      businessSiteConfigToConfigDocument(draft)
    );
  }

  save(): void {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');
    const payload = this.sanitizedDraft();
    if (this.onboardingMode()) {
      payload.site.onboardingCompletedAt = new Date().toISOString();
    }

    this.api.updateSiteConfig(this.configId, payload, this.siteSlug).subscribe({
      next: (saved: any) => {
        this.saving.set(false);
        if (saved?.id && this.configId === null) {
          this.configId = saved.id;
        }
        this.draft.set(payload);
        this.successMsg.set('Site content saved successfully.');
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(
          err?.error?.message ||
            err?.message ||
            'Save failed. Please try again.'
        );
      },
    });
  }

  reset(): void {
    this.draftPreviewReady.set(false);
    this.draft.set(cloneBusinessSiteConfig());
    this.selectedSectionId.set(
      this.draft().landingPage.sections[0]?.id ?? null
    );
    this.successMsg.set('');
    this.errorMsg.set('');
    this.draftPreviewReady.set(true);
  }
}
