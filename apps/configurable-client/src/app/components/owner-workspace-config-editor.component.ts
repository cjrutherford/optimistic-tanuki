import { CommonModule } from '@angular/common';
import {
  Component,
  ChangeDetectorRef,
  DestroyRef,
  HostListener,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ActivatedRoute,
  ParamMap,
  Router,
  RouterModule,
} from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS,
  appConfigToConfigDocument,
  configDocumentToAppConfig,
  updateBlockInWorkspace,
  createEditorWorkspace,
  insertBlockInWorkspace,
  moveBlockInWorkspace,
  removeBlockFromWorkspace,
  type AppConfiguration,
  type BlockInstance,
  type BlockDefinition,
  type ConfigDocument,
  type EditorWorkspaceState,
  type FeaturesConfig,
  type LayoutType,
  type RouteConfig,
  type ThemeConfig,
  type UpdateAppConfigDto,
} from '@optimistic-tanuki/app-config-models';
import {
  AppConfigStore,
  WorkspaceDiscoveryStore,
  type DiscoveredWorkspace,
} from '@optimistic-tanuki/app-config-data-access';
import {
  ConfiguratorEditorWorkspaceComponent,
  EditorDesignSystemPanelComponent,
} from '@optimistic-tanuki/configurable-client-ui';
import { ModalComponent } from '@optimistic-tanuki/common-ui';
import { SelectComponent } from '@optimistic-tanuki/form-ui';
import {
  hexToRgb,
  isValidPersonalityId,
} from '@optimistic-tanuki/theme-models';
import { NavigationConfirmationService } from '../services/navigation-confirmation.service';

type EditorState = 'loading' | 'ready' | 'unavailable' | 'error';
type FeatureKey = 'social' | 'tasks' | 'blogging' | 'projectPlanning';
type FeatureField = { key: string; label: string };
type ConflictDifference = { field: string; local: string; latest: string };

const FEATURE_KEYS: FeatureKey[] = [
  'social',
  'tasks',
  'blogging',
  'projectPlanning',
];

const FEATURE_FIELDS: Record<FeatureKey, FeatureField[]> = {
  social: [
    { key: 'enabled', label: 'Enable social' },
    { key: 'showPosts', label: 'Show posts' },
    { key: 'showFollowing', label: 'Show following' },
    { key: 'showComments', label: 'Show comments' },
    { key: 'allowAttachments', label: 'Allow attachments' },
  ],
  tasks: [
    { key: 'enabled', label: 'Enable tasks' },
    { key: 'showCalendar', label: 'Show calendar' },
    { key: 'allowRecurring', label: 'Allow recurring tasks' },
    { key: 'enableTimers', label: 'Enable timers' },
  ],
  blogging: [
    { key: 'enabled', label: 'Enable blogging' },
    { key: 'allowComments', label: 'Allow comments' },
    { key: 'moderateComments', label: 'Moderate comments' },
  ],
  projectPlanning: [
    { key: 'enabled', label: 'Enable project planning' },
    { key: 'showGantt', label: 'Show Gantt chart' },
    { key: 'showKanban', label: 'Show Kanban board' },
    { key: 'allowRisks', label: 'Track risks' },
  ],
};

@Component({
  selector: 'app-owner-workspace-config-editor',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ConfiguratorEditorWorkspaceComponent,
    EditorDesignSystemPanelComponent,
    SelectComponent,
    ModalComponent,
  ],
  template: `
    <main class="config-editor" aria-labelledby="config-editor-title">
      <header class="editor-header">
        <a
          class="back-link"
          [href]="dashboardHref"
          (click)="onBackLinkClick($event)"
          >← Back to owner desk</a
        >
        <div class="identity-line">
          <span class="eyebrow">OWNER CONFIGURATION / {{ workspaceSlug }}</span>
          @if (currentConfig; as config) {
          <span class="revision-chip"
            >Revision {{ config.revision || '—' }}</span
          >
          }
        </div>
        <h1 id="config-editor-title">Shape the doorway.</h1>
        <p class="editor-lede">
          Edit the same typed configuration that powers the public experience,
          then save it as the next owner revision.
        </p>
      </header>

      @if (state === 'loading') {
      <section class="state-card" aria-live="polite">
        <span class="loader" aria-hidden="true"></span>
        <h2>Verifying workspace access</h2>
        <p>Loading the owner-scoped configuration.</p>
      </section>
      } @else if (state === 'unavailable') {
      <section class="state-card" role="alert">
        <p class="eyebrow">ACCESS CHECK</p>
        <h2>Configuration unavailable</h2>
        <p>
          {{
            errorMessage ||
              'This configuration is not available to your owner workspace.'
          }}
        </p>
        <a [routerLink]="dashboardHref">Return to owner desk</a>
      </section>
      } @else if (state === 'error') {
      <section class="state-card" role="alert">
        <p class="eyebrow">LOAD FAILED</p>
        <h2>Configuration could not be loaded.</h2>
        <p>{{ errorMessage }}</p>
        <div class="state-actions">
          <button class="retry-button" type="button" (click)="retryLoad()">
            Retry</button
          ><a [routerLink]="dashboardHref">Return to owner desk</a>
        </div>
      </section>
      } @else if (currentConfig; as config) {
      <div class="context-strip" aria-label="Configuration identity">
        <div>
          <span class="context-label">WORKSPACE</span
          ><strong>{{ workspace?.displayName || workspaceSlug }}</strong
          ><small>{{ workspaceSlug }}</small>
        </div>
        <div>
          <span class="context-label">APPLICATION</span
          ><strong>{{ config.name }}</strong
          ><small>{{ config.id }}</small>
        </div>
        <div>
          <span class="context-label">SCOPE</span
          ><strong>{{
            workspace?.appScope || config.appScope || 'configurable-client'
          }}</strong
          ><small>Owner editing</small>
        </div>
      </div>

      <form
        class="editor-form"
        novalidate
        (submit)="save(); $event.preventDefault()"
      >
        <section
          class="editor-section editor-section--landing"
          aria-labelledby="landing-heading"
        >
          <div class="section-heading">
            <div>
              <p class="eyebrow">01 / COMPOSITION</p>
              <h2 id="landing-heading">Landing page</h2>
              <p>
                Choose a section, edit its supported fields, and see the public
                renderer update from the same model.
              </p>
            </div>
            <div class="layout-control">
              <label for="page-layout">Layout</label
              ><lib-select
                id="page-layout"
                [ngModel]="config.landingPage.layout"
                name="page-layout"
                [options]="layoutOptions"
                (ngModelChange)="onLayoutChanged($event)"
              ></lib-select>
            </div>
          </div>
          <app-configurator-editor-workspace
            [config]="config"
            [blocks]="blocks"
            [selectedBlockId]="selectedBlockId"
            [blockDefinitions]="blockDefinitions"
            [compactViewport]="true"
            (blockSelected)="onBlockSelected($event)"
            (fieldChanged)="onFieldChanged($event)"
            (collectionChanged)="onCollectionChanged($event)"
            (insertRequested)="onInsertRequested()"
            (moveFirstRequested)="onMoveFirstRequested()"
            (removeRequested)="onRemoveRequested()"
          />
        </section>

        <section class="editor-section" aria-labelledby="theme-heading">
          <div class="section-heading">
            <div>
              <p class="eyebrow">02 / PERSONALITY</p>
              <h2 id="theme-heading">Theme &amp; personality</h2>
              <p>
                These values are the tenant theme contract used by the public
                shell.
              </p>
            </div>
          </div>
          <app-editor-design-system-panel
            [theme]="config.theme"
            [showExtendedPalette]="true"
            [showTypographyFields]="true"
            [showCustomCssField]="true"
            (themeFieldChange)="onThemeChanged($event)"
          ></app-editor-design-system-panel>
        </section>

        <section class="editor-section" aria-labelledby="features-heading">
          <div class="section-heading">
            <div>
              <p class="eyebrow">03 / CAPABILITIES</p>
              <h2 id="features-heading">Enabled features</h2>
              <p>
                Turn on only the platform modules this workspace intends to
                expose.
              </p>
            </div>
          </div>
          <div class="feature-grid">
            @for (feature of featureKeys; track feature) {
            <fieldset class="feature-card">
              <legend>{{ featureLabel(feature) }}</legend>
              <p class="feature-description">
                {{ featureDescription(feature) }}
              </p>
              @for (field of featureFields(feature); track field.key) {
              <label class="check-row"
                ><input
                  type="checkbox"
                  [checked]="featureValue(feature, field.key)"
                  (change)="
                    onFeatureChanged(
                      feature,
                      field.key,
                      $any($event.target).checked
                    )
                  "
                /><span>{{ field.label }}</span></label
              >
              }
            </fieldset>
            }
          </div>
        </section>

        <section class="editor-section" aria-labelledby="routes-heading">
          <div class="section-heading">
            <div>
              <p class="eyebrow">04 / WAYFINDING</p>
              <h2 id="routes-heading">Navigation</h2>
              <p>
                Keep configured routes discoverable in the public navigation
                without changing the route contract.
              </p>
            </div>
          </div>
          @if (!config.routes.length) {
          <p class="empty-note">No routes are configured for this app yet.</p>
          }
          <div class="route-list">
            @for (route of config.routes; track route.id; let index = $index) {
            <div class="route-card">
              <div class="route-number">{{ index + 1 | number : '2.0' }}</div>
              <div class="route-fields">
                <div class="route-summary">
                  <strong>{{ route.name || 'Unnamed route' }}</strong
                  ><span>{{ route.path || 'No path configured' }}</span>
                </div>
                <label
                  >Label<input
                    [value]="route.name"
                    (input)="
                      onRouteChanged(index, 'name', $any($event.target).value)
                    " /></label
                ><label
                  >Path<input
                    [value]="route.path"
                    (input)="
                      onRouteChanged(index, 'path', $any($event.target).value)
                    " /></label
                ><label class="check-row route-toggle"
                  ><input
                    type="checkbox"
                    [checked]="route.showInNav"
                    (change)="
                      onRouteChanged(
                        index,
                        'showInNav',
                        $any($event.target).checked
                      )
                    "
                  /><span>Show in navigation</span></label
                >
              </div>
            </div>
            }
          </div>
        </section>

        @if (validationErrorEntries.length) {
        <section
          class="validation-panel"
          role="alert"
          aria-labelledby="validation-heading"
        >
          <h2 id="validation-heading">Fix these fields before saving</h2>
          <ul>
            @for (entry of validationErrorEntries; track entry[0]) {
            <li>
              <strong>{{ entry[0] }}</strong
              ><span>{{ entry[1] }}</span>
            </li>
            }
          </ul>
        </section>
        } @if (store.saveError() || store.saveConflict()) {
        <div class="save-notice save-notice--error" role="alert">
          <span>{{
            store.saveError() ||
              'Configuration changed elsewhere. Reload the latest revision before retrying.'
          }}</span>
          @if (store.saveConflict()) {
          <button
            class="retry-button"
            data-action="reopen-conflict"
            type="button"
            (click)="reopenConflict()"
          >
            Reopen conflict
          </button>
          } @else {
          <button
            class="retry-button"
            data-action="retry-save"
            type="button"
            (click)="retrySave()"
            [disabled]="store.saving()"
            aria-label="Retry save"
          >
            Retry save
          </button>
          }
        </div>
        }
        <footer class="save-bar">
          <div>
            <span class="save-status" [class.save-status--dirty]="isDirty">{{
              isDirty ? 'Unsaved local changes' : 'All changes saved'
            }}</span
            ><small>Saving uses the loaded revision and workspace scope.</small>
          </div>
          <button class="save-button" type="submit" [disabled]="store.saving()">
            {{ store.saving() ? 'Saving…' : 'Save draft' }}
          </button>
        </footer>
      </form>
      } @if (conflictModalOpen) {
      <otui-modal
        [visible]="conflictModalOpen"
        heading="Resolve a save conflict"
        size="lg"
        [closable]="true"
        [closeOnBackdrop]="true"
        [closeOnEscape]="true"
        ariaLabelledBy="conflict-modal-title"
        ariaDescribedBy="conflict-modal-description"
        (close)="onConflictDismissed()"
      >
        <div modal-title id="conflict-modal-title" class="sr-only">
          Resolve a save conflict
        </div>
        <div class="conflict-copy">
          <p>
            Someone else saved this configuration while you were editing. Your
            local draft is still safe.
          </p>
          @if (store.latestLoading()) {
          <p class="conflict-status" aria-live="polite">
            Loading the latest revision…
          </p>
          } @else if (store.latestError(); as latestError) {
          <div class="conflict-fetch-error" role="alert">
            <p>Could not load the latest revision: {{ latestError }}</p>
            <button
              class="retry-button"
              data-action="retry-latest"
              type="button"
              (click)="retryLatest()"
            >
              Retry latest
            </button>
          </div>
          } @else if (store.latest()) {
          <p class="conflict-status" aria-live="polite">
            Latest revision {{ store.latest()?.revision || '—' }} is ready to
            review.
          </p>
          }
        </div>

        @if (showConflictComparison) {
        <section
          class="conflict-comparison"
          aria-labelledby="conflict-comparison-heading"
        >
          <h3 id="conflict-comparison-heading">Changed fields</h3>
          @if (conflictDifferences.length) {
          <div class="conflict-diff-list">
            @for (difference of conflictDifferences; track difference.field) {
            <div class="conflict-diff-row">
              <strong>{{ difference.field }}</strong
              ><span><b>Local</b> {{ difference.local }}</span
              ><span><b>Latest</b> {{ difference.latest }}</span>
            </div>
            }
          </div>
          } @else {
          <p>No differences were found in the supported editor fields.</p>
          }
        </section>
        }

        <div modal-footer class="conflict-actions">
          <button
            type="button"
            data-action="cancel-conflict"
            (click)="onConflictDismissed()"
          >
            Cancel
          </button>
          <button
            type="button"
            data-action="compare-conflict"
            (click)="compareConflict()"
            [disabled]="
              !store.latest() || store.latestLoading() || !!store.latestError()
            "
          >
            Compare
          </button>
          <button
            type="button"
            data-action="keep-local"
            (click)="keepLocal()"
            [disabled]="
              !store.latest() || store.latestLoading() || !!store.latestError()
            "
          >
            Keep local
          </button>
          <button
            class="conflict-primary"
            type="button"
            data-action="reload-latest"
            (click)="reloadLatest()"
            [disabled]="
              !store.latest() || store.latestLoading() || !!store.latestError()
            "
          >
            Reload latest
          </button>
        </div>
      </otui-modal>
      }
      <otui-modal
        [visible]="navigationConfirmation.isPending()"
        heading="Leave this configuration?"
        [closable]="true"
        [backdrop]="true"
        [closeOnBackdrop]="true"
        [closeOnEscape]="true"
        ariaLabelledBy="navigation-confirmation-title"
        ariaDescribedBy="navigation-confirmation-description"
        (close)="stayOnConfiguration()"
      >
        <span modal-title id="navigation-confirmation-title" class="sr-only">
          Leave this configuration?
        </span>
        <p id="navigation-confirmation-description">
          You have unsaved changes. Stay here to keep editing, or leave and
          discard this local draft.
        </p>
        <div modal-footer class="conflict-actions">
          <button
            type="button"
            data-action="stay-unsaved-navigation"
            (click)="stayOnConfiguration()"
          >
            Stay
          </button>
          <button
            class="conflict-primary"
            type="button"
            data-action="leave-unsaved-navigation"
            (click)="leaveConfiguration()"
          >
            Leave without saving
          </button>
        </div>
      </otui-modal>
    </main>
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
        background: var(--background, #f3f0e9);
        color: var(--foreground, #1b1d1a);
      }
      .config-editor {
        width: min(1440px, calc(100% - 3rem));
        margin: 0 auto;
        padding: 2rem 0 5rem;
      }
      .editor-header {
        padding: 1rem 0 3rem;
      }
      .back-link {
        color: var(--primary, #5b690e);
        font-weight: 800;
        text-decoration: none;
      }
      .identity-line {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-top: 4rem;
      }
      .eyebrow,
      .context-label {
        color: var(--muted-foreground, #6e6b63);
        font: 700 0.68rem ui-monospace, monospace;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .editor-header h1 {
        max-width: 11ch;
        margin: 0.7rem 0 1rem;
        font: 800 clamp(3.2rem, 8vw, 7.4rem) / 0.84 Georgia, serif;
        letter-spacing: -0.075em;
      }
      .editor-lede {
        max-width: 42rem;
        color: var(--muted-foreground, #6e6b63);
        font-size: 1.08rem;
        line-height: 1.65;
      }
      .revision-chip {
        padding: 0.35rem 0.7rem;
        border: 1px solid var(--border, #c8c2b8);
        border-radius: 999px;
        background: var(--surface, #f8f6f1);
        font: 700 0.72rem ui-monospace, monospace;
      }
      .context-strip {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1px;
        margin-bottom: 1.25rem;
        border: 1px solid var(--border, #c8c2b8);
        background: var(--border, #c8c2b8);
      }
      .context-strip > div {
        display: grid;
        gap: 0.25rem;
        padding: 1.2rem;
        background: var(--surface, #f8f6f1);
      }
      .context-strip strong {
        font: 1.25rem Georgia, serif;
        overflow-wrap: anywhere;
      }
      .context-strip small {
        color: var(--muted-foreground, #6e6b63);
        font: 0.7rem ui-monospace, monospace;
        overflow-wrap: anywhere;
      }
      .editor-form {
        display: grid;
        gap: 1.25rem;
      }
      .editor-section {
        display: grid;
        gap: 1.5rem;
        padding: clamp(1.2rem, 3vw, 2.25rem);
        border: 1px solid var(--border, #c8c2b8);
        background: var(--surface, #f8f6f1);
        box-shadow: 10px 10px 0
          color-mix(in srgb, var(--primary, #5b690e) 12%, transparent);
      }
      .section-heading {
        display: flex;
        justify-content: space-between;
        align-items: start;
        gap: 2rem;
      }
      .section-heading h2 {
        margin: 0.3rem 0 0.4rem;
        font: 700 clamp(2rem, 4vw, 3.2rem) / 0.95 Georgia, serif;
        letter-spacing: -0.045em;
      }
      .section-heading p:last-child {
        max-width: 42rem;
        margin: 0;
        color: var(--muted-foreground, #6e6b63);
        line-height: 1.55;
      }
      .layout-control {
        min-width: 13rem;
        display: grid;
        gap: 0.45rem;
      }
      .layout-control label,
      .route-fields label {
        display: grid;
        gap: 0.4rem;
        font-weight: 750;
      }
      .feature-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0.8rem;
      }
      .feature-card {
        min-width: 0;
        display: grid;
        gap: 0.55rem;
        margin: 0;
        padding: 1rem;
        border: 1px solid var(--border, #c8c2b8);
      }
      .feature-card legend {
        padding: 0 0.35rem;
        font: 700 1.1rem Georgia, serif;
      }
      .feature-description {
        min-height: 2.7rem;
        margin: 0 0 0.35rem;
        color: var(--muted-foreground, #6e6b63);
        font-size: 0.82rem;
        line-height: 1.4;
      }
      .check-row {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        min-height: 2rem;
        font-size: 0.88rem;
        cursor: pointer;
      }
      .check-row input {
        width: 1rem;
        height: 1rem;
        accent-color: var(--primary, #5b690e);
      }
      .route-list {
        display: grid;
        gap: 0.75rem;
      }
      .route-card {
        display: grid;
        grid-template-columns: 3rem minmax(0, 1fr);
        gap: 1rem;
        align-items: start;
        padding: 1rem;
        border: 1px solid var(--border, #c8c2b8);
      }
      .route-number {
        display: grid;
        place-items: center;
        width: 2.4rem;
        height: 2.4rem;
        border-radius: 50%;
        background: var(--foreground, #1b1d1a);
        color: var(--background, #f3f0e9);
        font: 700 0.75rem ui-monospace, monospace;
      }
      .route-fields {
        display: grid;
        grid-template-columns: 1fr 1fr auto;
        gap: 1rem;
        align-items: end;
      }
      .route-summary {
        grid-column: 1 / -1;
        display: flex;
        align-items: baseline;
        gap: 0.75rem;
      }
      .route-summary strong {
        font: 700 1.15rem Georgia, serif;
      }
      .route-summary span {
        color: var(--muted-foreground, #6e6b63);
        font: 0.75rem ui-monospace, monospace;
      }
      .route-fields input:not([type='checkbox']) {
        width: 100%;
        box-sizing: border-box;
        min-height: 2.7rem;
        padding: 0.55rem 0.7rem;
        border: 1px solid var(--border, #c8c2b8);
        border-radius: 0.35rem;
        background: var(--background, #fff);
        color: inherit;
        font: inherit;
      }
      .route-toggle {
        padding-bottom: 0.4rem;
        white-space: nowrap;
      }
      .empty-note {
        margin: 0;
        padding: 1rem;
        border: 1px dashed var(--border, #c8c2b8);
        color: var(--muted-foreground, #6e6b63);
      }
      .validation-panel,
      .save-notice {
        padding: 1rem 1.2rem;
        border: 1px solid #b6422d;
        background: color-mix(in srgb, #b6422d 8%, var(--surface, #f8f6f1));
      }
      .validation-panel h2 {
        margin: 0 0 0.75rem;
        font: 700 1.35rem Georgia, serif;
      }
      .validation-panel ul {
        display: grid;
        gap: 0.5rem;
        margin: 0;
        padding-left: 1.2rem;
      }
      .validation-panel li {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .validation-panel li strong {
        color: #8d2e1d;
      }
      .validation-panel li span {
        color: var(--muted-foreground, #6e6b63);
      }
      .save-notice {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .save-bar {
        position: sticky;
        bottom: 1rem;
        z-index: 5;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem 1.2rem;
        border: 1px solid var(--foreground, #1b1d1a);
        background: color-mix(
          in srgb,
          var(--surface, #f8f6f1) 94%,
          transparent
        );
        box-shadow: 0 1rem 2rem
          color-mix(in srgb, var(--foreground, #1b1d1a) 14%, transparent);
        backdrop-filter: blur(14px);
      }
      .save-bar > div {
        display: grid;
        gap: 0.25rem;
      }
      .save-bar small {
        color: var(--muted-foreground, #6e6b63);
      }
      .save-status {
        font-weight: 800;
      }
      .save-status--dirty {
        color: var(--primary, #5b690e);
      }
      .save-button {
        min-height: 2.8rem;
        padding: 0.7rem 1.2rem;
        border: 1px solid var(--foreground, #1b1d1a);
        background: var(--accent, #d4f34a);
        color: var(--foreground, #1b1d1a);
        font: 800 0.9rem ui-monospace, monospace;
        cursor: pointer;
      }
      .save-button:disabled {
        cursor: wait;
        opacity: 0.6;
      }
      .save-button:focus-visible,
      .retry-button:focus-visible,
      .back-link:focus-visible,
      input:focus-visible {
        outline: 3px solid var(--primary, #5b690e);
        outline-offset: 3px;
      }
      .conflict-copy,
      .conflict-comparison {
        display: grid;
        gap: 0.7rem;
      }
      .conflict-copy p,
      .conflict-comparison p {
        margin: 0;
        line-height: 1.55;
      }
      .conflict-status {
        color: var(--muted-foreground, #6e6b63);
      }
      .conflict-fetch-error {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
        padding: 0.8rem;
        border: 1px solid #b6422d;
        background: color-mix(in srgb, #b6422d 8%, var(--surface, #f8f6f1));
      }
      .conflict-comparison {
        margin-top: 1rem;
        padding: 1rem;
        border: 1px solid var(--border, #c8c2b8);
        background: color-mix(
          in srgb,
          var(--primary, #5b690e) 5%,
          var(--surface, #f8f6f1)
        );
      }
      .conflict-comparison h3 {
        margin: 0;
        font: 700 1.25rem Georgia, serif;
      }
      .conflict-diff-list {
        display: grid;
        gap: 0.6rem;
      }
      .conflict-diff-row {
        display: grid;
        gap: 0.25rem;
        padding: 0.65rem 0;
        border-top: 1px solid var(--border, #c8c2b8);
      }
      .conflict-diff-row strong {
        font-size: 0.9rem;
      }
      .conflict-diff-row span {
        color: var(--muted-foreground, #6e6b63);
        font-size: 0.82rem;
      }
      .conflict-diff-row b {
        color: var(--foreground, #1b1d1a);
      }
      .conflict-actions {
        display: flex;
        justify-content: flex-end;
        gap: 0.6rem;
        flex-wrap: wrap;
      }
      .conflict-actions button {
        min-height: 2.6rem;
        padding: 0.55rem 0.9rem;
        border: 1px solid var(--border, #c8c2b8);
        background: var(--surface, #f8f6f1);
        color: var(--foreground, #1b1d1a);
        font: 700 0.82rem ui-monospace, monospace;
        cursor: pointer;
      }
      .conflict-actions .conflict-primary {
        border-color: var(--foreground, #1b1d1a);
        background: var(--accent, #d4f34a);
      }
      .conflict-actions button:disabled {
        cursor: wait;
        opacity: 0.55;
      }
      .sr-only {
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
      .state-card {
        display: grid;
        gap: 0.6rem;
        max-width: 44rem;
        padding: 2.5rem;
        border: 1px solid var(--border, #c8c2b8);
        background: var(--surface, #f8f6f1);
      }
      .state-card h2 {
        margin: 0;
        font: 700 2.5rem Georgia, serif;
      }
      .state-card p {
        margin: 0;
        color: var(--muted-foreground, #6e6b63);
        line-height: 1.6;
      }
      .state-actions {
        display: flex;
        align-items: center;
        gap: 1rem;
        flex-wrap: wrap;
      }
      .state-card a {
        color: var(--primary, #5b690e);
        font-weight: 800;
      }
      .retry-button {
        min-height: 2.8rem;
        padding: 0.7rem 1.2rem;
        border: 1px solid var(--foreground, #1b1d1a);
        background: var(--accent, #d4f34a);
        color: var(--foreground, #1b1d1a);
        font: 800 0.9rem ui-monospace, monospace;
        cursor: pointer;
      }
      .retry-button:focus-visible {
        outline: 3px solid var(--primary, #5b690e);
        outline-offset: 3px;
      }
      .loader {
        width: 1rem;
        height: 1rem;
        border: 2px solid currentColor;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      @media (max-width: 980px) {
        .feature-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .route-fields {
          grid-template-columns: 1fr 1fr;
        }
        .route-toggle {
          grid-column: 1 / -1;
        }
      }
      @media (max-width: 700px) {
        .config-editor {
          width: min(100% - 1.5rem, 1440px);
        }
        .context-strip,
        .feature-grid {
          grid-template-columns: 1fr;
        }
        .section-heading,
        .save-bar {
          display: grid;
        }
        .layout-control {
          min-width: 0;
        }
        .route-card {
          grid-template-columns: 2.4rem minmax(0, 1fr);
          gap: 0.7rem;
        }
        .route-fields {
          grid-template-columns: 1fr;
        }
        .route-toggle {
          grid-column: auto;
        }
        .save-button {
          width: 100%;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .loader {
          animation: none;
        }
      }
    `,
  ],
})
export class OwnerWorkspaceConfigEditorComponent implements OnInit, OnDestroy {
  readonly store = inject(AppConfigStore);
  private readonly discoveryStore = inject(WorkspaceDiscoveryStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly navigationConfirmation = inject(NavigationConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly scopeRequest = signal(0);

  readonly blockDefinitions: Record<string, BlockDefinition> =
    APP_CONFIG_LANDING_PAGE_BLOCK_DEFINITIONS;
  readonly layoutOptions = [
    { value: 'single-column', label: 'Single column' },
    { value: 'sidebar', label: 'Sidebar' },
    { value: 'wide', label: 'Wide' },
  ];
  readonly featureKeys = FEATURE_KEYS;
  readonly featureFields = (feature: FeatureKey): FeatureField[] =>
    FEATURE_FIELDS[feature];

  workspaceSlug = '';
  configId = '';
  workspace: DiscoveredWorkspace | null = null;
  selectedBlockId: string | null = null;
  errorMessage = '';
  isDirty = false;
  conflictModalOpen = false;
  showConflictComparison = false;
  private unavailable = false;
  private requestedScope = '';
  private editorConfig: AppConfiguration | null = null;
  private editorWorkspace: EditorWorkspaceState | null = null;
  private validationErrors: Record<string, string> = {};
  private localChangeVersion = 0;
  private pendingSaveChangeVersion = 0;
  private conflictDismissed = false;
  private preservedEditorRevision: number | null = null;
  private activeRouteUrl = '';

  constructor() {
    effect(() => {
      const request = this.scopeRequest();
      if (!request) return;
      const loading = this.discoveryStore.loading();
      const discoveryError = this.discoveryStore.error();
      if (loading) {
        this.workspace = null;
        this.unavailable = false;
        this.errorMessage = '';
        return;
      }
      if (discoveryError) {
        this.markUnavailable(discoveryError);
        return;
      }
      this.resolveWorkspace(this.discoveryStore.workspaces());
    });

    effect(() => {
      const selected = this.store.selected();
      const storeError = this.store.loadError();
      if (storeError) this.errorMessage = storeError;
      if (!selected || !this.workspace || selected.id !== this.configId) return;
      const scoped = selected as AppConfiguration & {
        workspaceId?: string;
        appInstanceId?: string;
      };
      if (
        scoped.workspaceId &&
        scoped.workspaceId !== this.workspace.workspaceId
      ) {
        this.markUnavailable(
          'This configuration is not available to your owner workspace.'
        );
        return;
      }
      if (
        scoped.appInstanceId &&
        this.workspace.appInstanceId &&
        scoped.appInstanceId !== this.workspace.appInstanceId
      ) {
        this.markUnavailable(
          'This configuration is not available to your owner workspace.'
        );
        return;
      }
      if (scoped.appScope !== 'configurable-client') {
        this.markUnavailable(
          'This configuration is not available to your owner workspace.'
        );
        return;
      }
      const selectedRevision = selected.revision ?? 0;
      const editorRevision = this.editorConfig?.revision ?? 0;
      const hasNewerLocalChanges =
        this.isDirty && this.localChangeVersion > this.pendingSaveChangeVersion;
      if (
        this.preservedEditorRevision === selectedRevision ||
        hasNewerLocalChanges
      )
        return;
      if (
        !this.editorConfig ||
        !this.isDirty ||
        selectedRevision > editorRevision
      ) {
        this.editorConfig = selected;
        this.editorWorkspace = createEditorWorkspace(
          appConfigToConfigDocument(selected)
        );
        this.selectedBlockId =
          this.editorWorkspace.document.blocks[0]?.id ?? null;
        this.isDirty = false;
        this.preservedEditorRevision = null;
        this.unavailable = false;
      }
    });

    effect(() => {
      const conflict = this.store.saveConflict();
      if (!conflict) {
        this.conflictModalOpen = false;
        this.showConflictComparison = false;
        this.conflictDismissed = false;
        return;
      }
      if (this.conflictDismissed || this.conflictModalOpen) return;
      this.conflictModalOpen = true;
      this.showConflictComparison = false;
      this.store.refreshLatest();
    });
  }

  ngOnInit(): void {
    const initialWorkspaceSlug =
      this.route.snapshot.paramMap.get('workspaceSlug');
    const initialConfigId = this.route.snapshot.paramMap.get('configId');
    this.activeRouteUrl = this.routeUrlForScope(
      initialWorkspaceSlug,
      initialConfigId
    );
    this.applyRouteContext(initialWorkspaceSlug, initialConfigId);
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => this.onRouteParamsChanged(params));
  }

  ngOnDestroy(): void {
    this.store.cancelPendingSave();
  }

  get currentConfig(): AppConfiguration | null {
    return this.editorConfig;
  }
  get blocks() {
    return this.editorWorkspace?.document.blocks ?? [];
  }
  get dashboardHref(): string {
    return `/owner/workspace/${encodeURIComponent(this.workspaceSlug)}`;
  }
  get state(): EditorState {
    if (this.unavailable) return 'unavailable';
    if (this.discoveryStore.loading()) return 'loading';
    if (this.discoveryStore.error()) return 'unavailable';
    if (this.store.loadError()) return 'error';
    if (this.currentConfig) return 'ready';
    return 'loading';
  }
  get validationErrorEntries(): [string, string][] {
    return Object.entries(this.validationErrors);
  }
  get conflictDifferences(): ConflictDifference[] {
    const local = this.currentConfig;
    const latest = this.store.latest();
    if (!local || !latest) return [];
    const differences: ConflictDifference[] = [];
    const add = (
      field: string,
      localValue: unknown,
      latestValue: unknown
    ): void => {
      if (
        this.stableSerialize(localValue) === this.stableSerialize(latestValue)
      )
        return;
      differences.push({
        field,
        local: this.formatConflictValue(localValue),
        latest: this.formatConflictValue(latestValue),
      });
    };

    const compare = (
      path: string,
      localValue: unknown,
      latestValue: unknown,
      formatPath: (relativePath: string[]) => string = (relativePath) =>
        `${path} / ${this.readableConflictPath(relativePath)}`,
      relativePath: string[] = []
    ): void => {
      if (
        this.stableSerialize(localValue) === this.stableSerialize(latestValue)
      )
        return;
      if (Array.isArray(localValue) || Array.isArray(latestValue)) {
        const localArray = Array.isArray(localValue) ? localValue : [];
        const latestArray = Array.isArray(latestValue) ? latestValue : [];
        const length = Math.max(localArray.length, latestArray.length);
        for (let index = 0; index < length; index += 1) {
          compare(path, localArray[index], latestArray[index], formatPath, [
            ...relativePath,
            `${index}`,
          ]);
        }
        if (!length) add(path, localValue, latestValue);
        return;
      }
      if (
        this.isConflictRecord(localValue) ||
        this.isConflictRecord(latestValue)
      ) {
        const localRecord = this.isConflictRecord(localValue) ? localValue : {};
        const latestRecord = this.isConflictRecord(latestValue)
          ? latestValue
          : {};
        const keys = new Set([
          ...Object.keys(localRecord),
          ...Object.keys(latestRecord),
        ]);
        for (const key of [...keys].sort()) {
          const nextRelativePath = [...relativePath, key];
          compare(
            path,
            localRecord[key],
            latestRecord[key],
            formatPath,
            nextRelativePath
          );
        }
        if (!keys.size) add(path, localValue, latestValue);
        return;
      }
      add(
        relativePath.length ? formatPath(relativePath) : path,
        localValue,
        latestValue
      );
    };

    add('Application / Name', local.name, latest.name);
    add('Application / Description', local.description, latest.description);
    add('Application / Domain', local.domain, latest.domain);
    add('Application / Active', local.active, latest.active);
    compare('Manifest', local.manifest, latest.manifest);
    add(
      'Landing page / Layout',
      local.landingPage.layout,
      latest.landingPage.layout
    );

    const localBlocks = new Map(
      local.landingPage.sections.map((section) => [section.id, section])
    );
    const latestBlocks = new Map(
      latest.landingPage.sections.map((section) => [section.id, section])
    );
    for (const blockId of [
      ...new Set([...localBlocks.keys(), ...latestBlocks.keys()]),
    ].sort()) {
      const localBlock = localBlocks.get(blockId);
      const latestBlock = latestBlocks.get(blockId);
      const localRecord = localBlock as unknown as
        | Record<string, unknown>
        | undefined;
      const latestRecord = latestBlock as unknown as
        | Record<string, unknown>
        | undefined;
      add(
        `Landing page / Blocks / ${blockId} / Present`,
        !!localBlock,
        !!latestBlock
      );
      add(
        `Landing page / Blocks / ${blockId} / Type`,
        localBlock?.type,
        latestBlock?.type
      );
      add(
        `Landing page / Blocks / ${blockId} / Order`,
        localBlock?.order,
        latestBlock?.order
      );
      add(
        `Landing page / Blocks / ${blockId} / Enabled`,
        localBlock?.visible,
        latestBlock?.visible
      );
      add(
        `Landing page / Blocks / ${blockId} / Render context`,
        localRecord?.['renderContext'] ?? 'landing-page',
        latestRecord?.['renderContext'] ?? 'landing-page'
      );
      const localData = this.blockData(localRecord);
      const latestData = this.blockData(latestRecord);
      const definition =
        this.blockDefinitions[localBlock?.type ?? latestBlock?.type ?? ''];
      const blockDataPath = (relativePath: string[]): string =>
        this.blockDataConflictPath(blockId, definition, relativePath);
      compare(
        `Landing page / Blocks / ${blockId} / Data`,
        localData,
        latestData,
        blockDataPath
      );
    }

    compare('Features', local.features, latest.features);
    compare('Theme', local.theme, latest.theme);
    compare(
      'Navigation',
      local.routes,
      latest.routes,
      (relativePath) =>
        `Navigation / ${this.readableConflictPath(relativePath)}`
    );
    return differences;
  }

  @HostListener('window:beforeunload', ['$event'])
  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.isDirty) return;

    event.preventDefault();
    event.returnValue = '';
  }

  retryLoad(): void {
    const workspaceSlug = this.workspaceSlug.trim();
    const configId = this.configId.trim();
    if (!workspaceSlug || !configId) return;
    this.errorMessage = '';
    this.store.load(configId, workspaceSlug);
  }

  retrySave(): void {
    if (!this.stageCurrentDraft()) return;
    this.pendingSaveChangeVersion = this.localChangeVersion;
    this.preservedEditorRevision = null;
    this.store.save();
  }

  retryLatest(): void {
    this.store.refreshLatest();
  }

  onConflictDismissed(): void {
    this.conflictDismissed = true;
    this.conflictModalOpen = false;
    this.showConflictComparison = false;
  }

  stayOnConfiguration(): void {
    this.navigationConfirmation.stay();
  }

  leaveConfiguration(): void {
    this.navigationConfirmation.leave();
  }

  requestNavigationConfirmation(targetUrl: string): void {
    this.navigationConfirmation.requestConfirmation(targetUrl);
    this.changeDetectorRef.detectChanges();
  }

  onBackLinkClick(event: Event): void {
    event.preventDefault();
    if (this.isDirty) {
      this.requestNavigationConfirmation(this.dashboardHref);
      return;
    }

    void this.router.navigateByUrl(this.dashboardHref);
  }

  reopenConflict(): void {
    if (!this.store.saveConflict()) return;
    this.conflictDismissed = false;
    this.conflictModalOpen = true;
    this.showConflictComparison = false;
    if (!this.store.latest() && !this.store.latestLoading()) {
      this.store.refreshLatest();
    }
  }

  compareConflict(): void {
    if (this.store.latest()) this.showConflictComparison = true;
  }

  reloadLatest(): void {
    const latest = this.store.latest();
    if (!latest) return;
    this.store.acceptLatest({ preserveDraft: false });
    this.applyAcceptedConfiguration(latest);
  }

  keepLocal(): void {
    const latest = this.store.latest();
    if (!latest) return;
    this.store.acceptLatest({ preserveDraft: true });
    this.preservedEditorRevision = latest.revision ?? null;
    this.onConflictDismissed();
  }

  onBlockSelected(blockId: string): void {
    this.selectedBlockId = blockId;
  }

  onInsertRequested(): void {
    if (!this.editorWorkspace) return;
    const type = 'hero';
    const definition = this.blockDefinitions[type];
    const block: BlockInstance = {
      id: this.nextBlockId(type),
      type,
      order: this.blocks.length,
      enabled: true,
      renderContext: 'landing-page',
      data: { ...(definition.defaultData ?? {}) },
    };
    const workspace = insertBlockInWorkspace(
      this.editorWorkspace,
      this.blockDefinitions,
      block,
      { renderContext: 'landing-page' }
    );
    this.selectedBlockId = workspace.selectedBlockId;
    this.updateDocument(workspace.document);
  }

  onMoveFirstRequested(): void {
    if (!this.editorWorkspace || !this.selectedBlockId) return;
    this.updateDocument(
      moveBlockInWorkspace(this.editorWorkspace, this.selectedBlockId, 0)
        .document
    );
  }

  onRemoveRequested(): void {
    if (!this.editorWorkspace || !this.selectedBlockId) return;
    const workspace = removeBlockFromWorkspace(
      this.editorWorkspace,
      this.selectedBlockId
    );
    this.selectedBlockId = workspace.document.blocks[0]?.id ?? null;
    this.updateDocument(workspace.document);
  }

  onFieldChanged(change: {
    key: string;
    value: string | number | boolean;
  }): void {
    const block = this.blocks.find(
      (candidate) => candidate.id === this.selectedBlockId
    );
    if (!block || !this.editorWorkspace) return;
    const definition = this.blockDefinitions[block.type];
    const field = definition?.fields?.find(
      (candidate) => candidate.key === change.key
    );
    const value =
      field?.type === 'number' &&
      typeof change.value === 'string' &&
      change.value.trim() !== ''
        ? Number(change.value)
        : change.value;
    this.updateDocument(
      updateBlockInWorkspace(this.editorWorkspace, block.id, {
        data: this.withPath(change.key, value),
      }).document
    );
  }

  onCollectionChanged(change: {
    key: string;
    items: Array<Record<string, unknown>>;
  }): void {
    const block = this.blocks.find(
      (candidate) => candidate.id === this.selectedBlockId
    );
    if (!block || !this.editorWorkspace) return;
    this.updateDocument(
      updateBlockInWorkspace(this.editorWorkspace, block.id, {
        data: this.withPath(change.key, change.items),
      }).document
    );
  }

  onLayoutChanged(layout: string): void {
    if (
      !this.currentConfig ||
      !this.layoutOptions.some((option) => option.value === layout)
    )
      return;
    this.updateConfig({
      landingPage: {
        ...this.currentConfig.landingPage,
        layout: layout as LayoutType,
      },
    });
  }

  onThemeChanged(change: { key: keyof ThemeConfig; value: string }): void {
    if (!this.currentConfig) return;
    this.updateConfig({
      theme: { ...this.currentConfig.theme, [change.key]: change.value },
    });
  }

  onFeatureChanged(feature: FeatureKey, key: string, value: boolean): void {
    if (!this.currentConfig) return;
    const features = { ...this.currentConfig.features } as Record<
      string,
      Record<string, unknown> | undefined
    >;
    features[feature] = { ...(features[feature] ?? {}), [key]: value };
    this.updateConfig({ features: features as FeaturesConfig });
  }

  onRouteChanged(
    index: number,
    key: 'name' | 'path' | 'showInNav',
    value: string | boolean
  ): void {
    if (!this.currentConfig || !this.currentConfig.routes[index]) return;
    const routes = this.currentConfig.routes.map((route, routeIndex) =>
      routeIndex === index ? { ...route, [key]: value } : route
    );
    this.updateConfig({ routes });
  }

  featureValue(feature: FeatureKey, key: string): boolean {
    const value = (
      this.currentConfig?.features as
        | Record<string, Record<string, unknown> | undefined>
        | undefined
    )?.[feature]?.[key];
    return value === true;
  }

  featureLabel(feature: FeatureKey): string {
    return {
      social: 'Social',
      tasks: 'Tasks',
      blogging: 'Blogging',
      projectPlanning: 'Project planning',
    }[feature];
  }
  featureDescription(feature: FeatureKey): string {
    return {
      social: 'Posts, comments, and following.',
      tasks: 'Calendars, recurring work, and timers.',
      blogging: 'Posts with moderated discussion.',
      projectPlanning: 'Gantt, Kanban, and risk tracking.',
    }[feature];
  }

  save(): void {
    if (!this.stageCurrentDraft()) return;
    this.pendingSaveChangeVersion = this.localChangeVersion;
    this.preservedEditorRevision = null;
    this.store.save();
  }

  private stageCurrentDraft(): boolean {
    const config = this.currentConfig;
    if (!config) return false;
    this.validationErrors = this.validate(config);
    if (Object.keys(this.validationErrors).length) return false;
    const patch: Partial<UpdateAppConfigDto> = {
      name: config.name,
      description: config.description,
      domain: config.domain,
      landingPage: config.landingPage,
      routes: config.routes,
      features: config.features,
      theme: config.theme,
      ...(config.manifest != null ? { manifest: config.manifest } : {}),
      active: config.active,
    };
    this.store.setDraft(patch);
    return true;
  }

  private applyRouteContext(
    workspaceSlug: string | null,
    configId: string | null
  ): void {
    this.workspaceSlug = workspaceSlug?.trim() ?? '';
    this.configId = configId?.trim() ?? '';
    this.requestedScope = `${this.workspaceSlug}/${this.configId}`;
    this.workspace = null;
    this.editorConfig = null;
    this.editorWorkspace = null;
    this.selectedBlockId = null;
    this.validationErrors = {};
    this.localChangeVersion = 0;
    this.pendingSaveChangeVersion = 0;
    this.isDirty = false;
    this.preservedEditorRevision = null;
    this.conflictModalOpen = false;
    this.showConflictComparison = false;
    this.conflictDismissed = false;
    this.errorMessage = '';
    this.unavailable = false;
    if (!this.workspaceSlug || !this.configId) {
      this.markUnavailable('A workspace and configuration are required.');
      return;
    }
    this.discoveryStore.load();
    this.scopeRequest.update((request) => request + 1);
  }

  private onRouteParamsChanged(params: ParamMap): void {
    const nextWorkspaceSlug = params.get('workspaceSlug')?.trim() ?? '';
    const nextConfigId = params.get('configId')?.trim() ?? '';
    const nextScope = `${nextWorkspaceSlug}/${nextConfigId}`;
    if (nextScope === this.requestedScope) return;

    const decision = this.isDirty
      ? this.navigationConfirmation.confirm()
      : true;
    if (typeof decision !== 'boolean') {
      void decision.then((allowed) =>
        this.completeRouteParamsChange(nextWorkspaceSlug, nextConfigId, allowed)
      );
      return;
    }
    this.completeRouteParamsChange(nextWorkspaceSlug, nextConfigId, decision);
  }

  private completeRouteParamsChange(
    nextWorkspaceSlug: string,
    nextConfigId: string,
    allowed: boolean
  ): void {
    if (!allowed) {
      this.router.navigateByUrl(this.activeRouteUrl, { replaceUrl: true });
      return;
    }

    this.store.cancelPendingSave();
    this.store.clearDraft();
    this.store.clearSaveRecovery();
    this.activeRouteUrl = this.routeUrlForScope(
      nextWorkspaceSlug,
      nextConfigId
    );
    this.applyRouteContext(nextWorkspaceSlug, nextConfigId);
  }

  private routeUrlForScope(
    workspaceSlug: string | null,
    configId: string | null
  ): string {
    const currentUrl = this.router.url;
    if (currentUrl && currentUrl !== '/') return currentUrl;
    return `/owner/workspace/${encodeURIComponent(
      workspaceSlug?.trim() ?? ''
    )}/config/${encodeURIComponent(configId?.trim() ?? '')}`;
  }

  private resolveWorkspace(workspaces: DiscoveredWorkspace[]): void {
    if (this.requestedScope !== `${this.workspaceSlug}/${this.configId}`)
      return;
    const candidate = workspaces.find(
      (workspace) =>
        workspace.slug === this.workspaceSlug &&
        workspace.configurationId === this.configId &&
        workspace.status === 'active' &&
        workspace.membershipStatus === 'active' &&
        workspace.membershipRole === 'owner'
    );
    if (!candidate) {
      this.markUnavailable(
        'That configuration is not available to your owner workspace.'
      );
      return;
    }
    this.workspace = candidate;
    this.unavailable = false;
    this.store.load(this.configId, this.workspaceSlug);
  }

  private markUnavailable(message: string): void {
    this.workspace = null;
    this.unavailable = true;
    this.errorMessage = message;
  }

  private updateDocument(document: ConfigDocument): void {
    const current = this.currentConfig;
    if (!current) return;
    const converted = configDocumentToAppConfig(document, {
      id: current.id,
      name: current.name,
      active: current.active,
      description: current.description,
      domain: current.domain,
      manifest: current.manifest,
      createdAt: current.createdAt,
      updatedAt: current.updatedAt,
    });
    this.editorConfig = {
      ...current,
      ...converted,
      revision: current.revision,
      release: current.release,
    };
    this.editorWorkspace = createEditorWorkspace(
      appConfigToConfigDocument(this.editorConfig),
      this.editorWorkspace?.mode ?? 'studio'
    );
    this.isDirty = true;
    this.localChangeVersion += 1;
    this.validationErrors = {};
  }

  private updateConfig(patch: Partial<AppConfiguration>): void {
    const current = this.currentConfig;
    if (!current) return;
    this.editorConfig = { ...current, ...patch };
    this.editorWorkspace = createEditorWorkspace(
      appConfigToConfigDocument(this.editorConfig),
      this.editorWorkspace?.mode ?? 'studio'
    );
    this.isDirty = true;
    this.localChangeVersion += 1;
    this.validationErrors = {};
  }

  private applyAcceptedConfiguration(configuration: AppConfiguration): void {
    this.editorConfig = configuration;
    this.editorWorkspace = createEditorWorkspace(
      appConfigToConfigDocument(configuration)
    );
    this.selectedBlockId = this.editorWorkspace.document.blocks[0]?.id ?? null;
    this.isDirty = false;
    this.localChangeVersion = 0;
    this.pendingSaveChangeVersion = 0;
    this.preservedEditorRevision = null;
    this.validationErrors = {};
    this.onConflictDismissed();
  }

  private isConflictRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private blockData(
    block: Record<string, unknown> | undefined
  ): Record<string, unknown> | undefined {
    if (!block) return undefined;
    const {
      id: _id,
      type: _type,
      order: _order,
      visible: _visible,
      renderContext: _renderContext,
      ...data
    } = block;
    return data;
  }

  private blockDataConflictPath(
    blockId: string,
    definition: BlockDefinition | undefined,
    relativePath: string[]
  ): string {
    const fieldPath = relativePath.join('.');
    const field = definition?.fields?.find(
      (candidate) =>
        candidate.key === fieldPath || fieldPath.startsWith(`${candidate.key}.`)
    );
    if (field && definition) {
      const remainder = fieldPath.slice(field.key.length).replace(/^\./, '');
      return [
        `Landing page / ${definition.name} / ${field.label} (${blockId})`,
        remainder ? this.readableConflictPath(remainder.split('.')) : '',
      ]
        .filter(Boolean)
        .join(' / ');
    }
    return [
      `Landing page / Blocks / ${blockId} / Data`,
      ...relativePath.map((segment) => this.readableConflictSegment(segment)),
    ].join(' / ');
  }

  private readableConflictPath(segments: string[]): string {
    return segments
      .map((segment) => this.readableConflictSegment(segment))
      .join(' / ');
  }

  private readableConflictSegment(segment: string): string {
    if (/^\d+$/.test(segment)) return `[${segment}]`;
    if (segment.includes('.')) return segment;
    return segment
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]/g, ' ')
      .toLowerCase()
      .replace(/^./, (character) => character.toUpperCase());
  }

  private stableSerialize(value: unknown): string {
    if (Array.isArray(value)) {
      return `[${value.map((entry) => this.stableSerialize(entry)).join(',')}]`;
    }
    if (this.isConflictRecord(value)) {
      return `{${Object.keys(value)
        .sort()
        .map(
          (key) => `${JSON.stringify(key)}:${this.stableSerialize(value[key])}`
        )
        .join(',')}}`;
    }
    return JSON.stringify(value);
  }

  private formatConflictValue(value: unknown): string {
    if (value === undefined || value === null || value === '') return '—';
    if (typeof value === 'string') return value;
    return this.stableSerialize(value);
  }

  private withPath(key: string, value: unknown): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    const segments = key.split('.');
    let cursor = result;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) cursor[segment] = value;
      else {
        cursor[segment] = {};
        cursor = cursor[segment] as Record<string, unknown>;
      }
    });
    return result;
  }

  private validate(config: AppConfiguration): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!config.name.trim())
      errors['Application name'] = 'Application name is required.';
    if (
      !this.layoutOptions.some(
        (option) => option.value === config.landingPage.layout
      )
    )
      errors['Landing page layout'] = 'Choose a supported layout.';
    config.landingPage.sections.forEach((section) => {
      const definition = this.blockDefinitions[section.type];
      if (!definition) {
        errors[`Landing page / ${section.id}`] =
          'This section type is not supported by the shared renderer.';
        return;
      }
      for (const field of definition.fields ?? []) {
        const value = field.key
          .split('.')
          .reduce<unknown>(
            (current, segment) =>
              current && typeof current === 'object'
                ? (current as Record<string, unknown>)[segment]
                : undefined,
            section
          );
        const path = `Landing page / ${definition.name} / ${field.label}`;
        const required = this.requiredField(section.type, field.key);
        if (
          required &&
          (value === undefined ||
            value === null ||
            (typeof value === 'string' && !value.trim()))
        )
          errors[path] = `${
            definition.name
          } ${field.label.toLowerCase()} is required.`;
        if (
          value !== undefined &&
          value !== null &&
          field.type === 'url' &&
          value !== '' &&
          !this.isUrlOrPath(value)
        )
          errors[path] = `${field.label} must be a valid URL or local path.`;
        if (
          value !== undefined &&
          field.type === 'number' &&
          (typeof value !== 'number' || !Number.isFinite(value))
        )
          errors[path] = `${field.label} must be a number.`;
        if (
          value !== undefined &&
          field.type === 'select' &&
          !field.options?.some((option) => option.value === value)
        )
          errors[
            path
          ] = `Choose a supported ${field.label.toLowerCase()} option.`;
      }
    });
    if (config.theme.mode && !['light', 'dark'].includes(config.theme.mode))
      errors['Theme mode'] = 'Choose Light or Dark.';
    if (
      config.theme.personalityId &&
      !isValidPersonalityId(config.theme.personalityId)
    ) {
      errors[
        'Theme personality'
      ] = `Choose a supported personality. "${config.theme.personalityId}" is not available.`;
    }
    const themeColors: Array<{ key: keyof ThemeConfig; label: string }> = [
      { key: 'primaryColor', label: 'Primary color' },
      { key: 'secondaryColor', label: 'Secondary color' },
      { key: 'backgroundColor', label: 'Background color' },
      { key: 'textColor', label: 'Text color' },
    ];
    for (const { key, label } of themeColors) {
      const value = config.theme[key];
      if (value !== undefined && value !== '' && !hexToRgb(value)) {
        errors[
          `Theme / ${label}`
        ] = `${label} must be a valid 6-digit hex color such as #3457d5.`;
      }
    }
    for (const [index, route] of config.routes.entries()) {
      if (!route.name.trim())
        errors[`Navigation / route ${index + 1} label`] =
          'Navigation label is required.';
      if (!this.isSupportedNavigationPath(route.path))
        errors[`Navigation / ${route.name || `route ${index + 1}`} path`] =
          'Use a supported local path or absolute URL.';
      if (typeof route.showInNav !== 'boolean')
        errors[
          `Navigation / ${route.name || `route ${index + 1}`} visibility`
        ] = 'Choose whether this route appears in navigation.';
    }
    return errors;
  }

  private requiredField(type: string, key: string): boolean {
    return (
      {
        hero: ['title'],
        features: ['title'],
        content: ['content'],
        cta: ['title', 'buttonText', 'buttonLink'],
        footer: ['content'],
        grid: [],
      }[type] ?? []
    ).includes(key);
  }

  private isUrlOrPath(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const path = value.trim();
    return (
      (path.startsWith('/') && !path.startsWith('//')) ||
      /^https?:\/\//i.test(path)
    );
  }

  private isSupportedNavigationPath(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const path = value.trim();
    if (path.startsWith('/') && !path.startsWith('//')) return true;
    try {
      return ['http:', 'https:', 'mailto:', 'tel:'].includes(
        new URL(path).protocol
      );
    } catch {
      return false;
    }
  }

  private nextBlockId(type: string): string {
    const ids = new Set(this.blocks.map((block) => block.id));
    let index = this.blocks.filter((block) => block.type === type).length + 1;
    let id = `${type}-${index}`;
    while (ids.has(id)) {
      index += 1;
      id = `${type}-${index}`;
    }
    return id;
  }
}
