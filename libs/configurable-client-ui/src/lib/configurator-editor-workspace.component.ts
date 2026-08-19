import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import {
  type AppConfiguration,
  type BlockDefinition,
  type BlockInstance,
} from '@optimistic-tanuki/app-config-models';

import { ConfigurableLandingPageComponent } from './configurable-landing-page.component';
import { EditorBlockTreeComponent } from './editor-block-tree.component';
import { SchemaBlockInspectorComponent } from './schema-block-inspector.component';

/**
 * Shared, policy-free editing surface for configurable landing pages.
 * Persistence, release workflow, and tenant ownership remain with the host app.
 */
@Component({
  selector: 'app-configurator-editor-workspace',
  standalone: true,
  imports: [
    CommonModule,
    ConfigurableLandingPageComponent,
    EditorBlockTreeComponent,
    SchemaBlockInspectorComponent,
  ],
  template: `
    <div class="configurator-workspace" data-shared-canvas>
      <section class="workspace-pane" aria-label="Page structure">
        <div class="workspace-heading">
          <div>
            <h2>Page structure</h2>
            <p>Choose a block to edit its structured fields.</p>
          </div>
          <div class="workspace-actions">
            <button type="button" (click)="insertRequested.emit()">
              Insert block
            </button>
            @if (selectedBlock) {
            <button type="button" (click)="moveFirstRequested.emit()">
              Move first
            </button>
            <button type="button" (click)="removeRequested.emit()">
              Remove
            </button>
            }
          </div>
        </div>
        <app-editor-block-tree
          [blocks]="blocks"
          [selectedBlockId]="selectedBlockId"
          [fallbackTitle]="fallbackTitle"
          (blockSelected)="blockSelected.emit($event)"
        />
      </section>

      <section
        class="workspace-pane inspector-pane"
        aria-label="Block inspector"
      >
        <h2>Inspector</h2>
        @if (selectedBlock) {
        <app-schema-block-inspector
          [block]="selectedBlock"
          [definition]="selectedBlockDefinition"
          (fieldChanged)="fieldChanged.emit($event)"
          (collectionChanged)="collectionChanged.emit($event)"
        />
        } @else {
        <p>Select a block on the canvas to edit it.</p>
        }
      </section>

      <section
        class="workspace-pane preview-pane"
        data-rendered-preview
        aria-label="Rendered landing page preview"
      >
        <div class="workspace-heading">
          <div>
            <h2>Rendered preview</h2>
            <p>The editor and preview share one typed configuration.</p>
          </div>
          <button
            type="button"
            (click)="
              openResponsiveEditor(selectedBlock ? 'inspector' : 'structure')
            "
          >
            {{ selectedBlock ? 'Edit selected block' : 'Edit page structure' }}
          </button>
        </div>
        <app-landing-page
          [config]="config"
          [embeddedPreview]="true"
          [selectedSectionId]="selectedBlockId"
          (sectionSelected)="selectFromPreview($event)"
        />
      </section>
    </div>

    @if (mobileEditorOpen()) {
    <div
      class="mobile-editor-sheet"
      data-mobile-editor-sheet
      role="dialog"
      aria-modal="true"
      aria-label="Responsive editor"
    >
      <div class="workspace-heading">
        <h2>
          {{
            mobileEditorView() === 'inspector' ? 'Inspector' : 'Page structure'
          }}
        </h2>
        <button type="button" (click)="closeResponsiveEditor()">Close</button>
      </div>
      @if (mobileEditorView() === 'inspector' && selectedBlock) {
      <app-schema-block-inspector
        [block]="selectedBlock"
        [definition]="selectedBlockDefinition"
        (fieldChanged)="fieldChanged.emit($event)"
        (collectionChanged)="collectionChanged.emit($event)"
      />
      } @else {
      <app-editor-block-tree
        [blocks]="blocks"
        [selectedBlockId]="selectedBlockId"
        [fallbackTitle]="fallbackTitle"
        (blockSelected)="blockSelected.emit($event)"
      />
      }
    </div>
    }
  `,
  styles: [
    `
      .configurator-workspace {
        display: grid;
        grid-template-columns: minmax(14rem, 0.75fr) minmax(16rem, 1fr) minmax(
            20rem,
            1.5fr
          );
        gap: 1rem;
      }
      .workspace-pane,
      .mobile-editor-sheet {
        padding: 1rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--personality-card-radius, 1rem);
        background: var(--surface, #fff);
      }
      .workspace-heading {
        display: flex;
        align-items: start;
        justify-content: space-between;
        gap: 0.75rem;
        margin-bottom: 1rem;
      }
      .workspace-heading h2 {
        margin: 0;
        font-size: 1rem;
      }
      .workspace-heading p {
        margin: 0.25rem 0 0;
        color: var(--muted, #6b7280);
      }
      .workspace-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      button {
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 0.5rem;
        padding: 0.45rem 0.7rem;
        background: var(--background, #fff);
        color: var(--foreground, #111827);
        cursor: pointer;
      }
      button:focus-visible {
        outline: 2px solid var(--primary, #3f51b5);
        outline-offset: 2px;
      }
      .preview-pane app-landing-page {
        display: block;
        max-height: 70vh;
        overflow: auto;
      }
      .mobile-editor-sheet {
        position: fixed;
        inset: auto 1rem 1rem;
        z-index: 20;
        max-height: min(75vh, 44rem);
        overflow: auto;
        box-shadow: 0 1.5rem 3rem
          color-mix(in srgb, var(--foreground, #111827) 22%, transparent);
      }
      @media (max-width: 1100px) {
        .configurator-workspace {
          grid-template-columns: minmax(15rem, 1fr) minmax(20rem, 1.4fr);
        }
        .preview-pane {
          grid-column: 1 / -1;
        }
      }
      @media (max-width: 720px) {
        .configurator-workspace {
          grid-template-columns: 1fr;
        }
        .inspector-pane {
          display: none;
        }
        .workspace-actions {
          display: none;
        }
      }
    `,
  ],
})
export class ConfiguratorEditorWorkspaceComponent {
  @Input() config: AppConfiguration | null = null;
  @Input() blocks: BlockInstance[] = [];
  @Input() selectedBlockId: string | null = null;
  @Input() compactViewport = false;
  @Input() blockDefinitions: Record<string, BlockDefinition> = {};
  @Input() fallbackTitle: (block: BlockInstance, index: number) => string = (
    block
  ) => block.type;

  @Output() blockSelected = new EventEmitter<string>();
  @Output() fieldChanged = new EventEmitter<{
    key: string;
    value: string | number | boolean;
  }>();
  @Output() collectionChanged = new EventEmitter<{
    key: string;
    items: Array<Record<string, unknown>>;
  }>();
  @Output() insertRequested = new EventEmitter<void>();
  @Output() moveFirstRequested = new EventEmitter<void>();
  @Output() removeRequested = new EventEmitter<void>();

  readonly mobileEditorOpen = signal(false);
  readonly mobileEditorView = signal<'structure' | 'inspector'>('structure');

  get selectedBlock(): BlockInstance | null {
    return (
      this.blocks.find((block) => block.id === this.selectedBlockId) ?? null
    );
  }

  get selectedBlockDefinition(): BlockDefinition | null {
    const block = this.selectedBlock;
    return block ? this.blockDefinitions[block.type] ?? null : null;
  }

  selectFromPreview(blockId: string): void {
    this.blockSelected.emit(blockId);
    if (this.compactViewport) {
      this.openResponsiveEditor('inspector');
    }
  }

  openResponsiveEditor(view: 'structure' | 'inspector'): void {
    this.mobileEditorView.set(view);
    this.mobileEditorOpen.set(true);
  }

  closeResponsiveEditor(): void {
    this.mobileEditorOpen.set(false);
  }
}
