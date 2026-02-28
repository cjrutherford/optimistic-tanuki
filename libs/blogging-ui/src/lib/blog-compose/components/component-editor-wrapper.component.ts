import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ViewContainerRef,
  OnInit,
  OnDestroy,
  OnChanges,
  AfterViewInit,
  SimpleChanges,
  ComponentRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@optimistic-tanuki/common-ui';

import {
  InjectedComponentInstance,
  InjectableComponent,
  PropertyDefinition,
} from '../interfaces/component-injection.interface';

/**
 * ComponentEditorWrapperComponent
 *
 * This component wraps injected Angular components within the blog editor.
 * It provides:
 * - Dynamic component rendering
 * - Inline editing controls
 * - Property configuration overlay
 * - Selection and hover states
 *
 * The wrapper surfaces the configuration and editing capabilities for any
 * component from common-ui, form-ui, or blogging-ui libraries.
 */
@Component({
  selector: 'lib-component-editor-wrapper',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    <div
      class="component-editor-wrapper"
      [class.selected]="isSelected"
      [class.hovered]="isHovered && !isLocked"
      [class.locked]="isLocked"
      [class.editing]="isEditing"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (click)="onClick($event)"
      (keyup.enter)="onClick($event)"
      contenteditable="false"
      tabindex="0"
      [attr.data-component-id]="componentId"
    >
      <!-- Top Control Bar -->
      <div
        class="control-bar"
        [class.visible]="isHovered || isLocked || isSelected"
      >
        <div class="component-label">
          <otui-icon
            *ngIf="componentDef.icon"
            [name]="componentDef.icon"
          ></otui-icon>
          <span class="label-text">{{ componentDef.name || 'Component' }}</span>
          <span
            class="lock-indicator"
            *ngIf="isLocked"
            title="Locked - Click wrapper to unlock"
          >
            🔒
          </span>
        </div>
        <div class="control-buttons">
          <button
            class="control-btn edit-btn"
            (click)="onEditClick($event)"
            title="Edit Properties"
          >
            <otui-icon name="edit"></otui-icon>
          </button>
          <button
            class="control-btn duplicate-btn"
            (click)="onDuplicateClick($event)"
            title="Duplicate Component"
          >
            <otui-icon name="content-copy"></otui-icon>
          </button>
          <button
            class="control-btn delete-btn"
            (click)="onDeleteClick($event)"
            title="Delete Component"
          >
            <otui-icon name="delete"></otui-icon>
          </button>
        </div>
      </div>

      <!-- Component Content Area -->
      <div class="component-content">
        <!-- Dynamic component will be rendered here -->
        <ng-container #componentHost></ng-container>

        <!-- Fallback preview when component cannot be rendered -->
        <div class="component-preview" *ngIf="!dynamicComponentRef">
          <div class="preview-header">
            <otui-icon
              *ngIf="componentDef.icon"
              [name]="componentDef.icon"
            ></otui-icon>
            <h4>{{ componentDef.name || 'Component' }}</h4>
          </div>
          <p class="preview-description">
            {{
              componentDef.description || 'Click to configure this component'
            }}
          </p>
          <div
            class="preview-data"
            *ngIf="componentData && hasVisibleProperties()"
          >
            <div class="data-item" *ngFor="let prop of getPreviewProperties()">
              <span class="data-label">{{ prop.label }}:</span>
              <span class="data-value">{{
                formatPropertyValue(prop.key)
              }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Edit Overlay (inline editing) -->
      <div
        class="quick-edit-overlay"
        *ngIf="isEditing"
        (click)="onOverlayClick($event)"
        (mousedown)="onOverlayMouseDown($event)"
        (keydown)="onOverlayKeyDown($event)"
        (keyup)="onOverlayKeyUp($event)"
        (keypress)="onOverlayKeyPress($event)"
        (paste)="onOverlayPaste($event)"
        contenteditable="false"
        tabindex="-1"
      >
        <div class="quick-edit-header">
          <div class="header-content">
            <otui-icon
              *ngIf="componentDef.icon"
              class="component-icon"
              [name]="componentDef.icon"
            ></otui-icon>
            <div>
              <h4>{{ componentDef.name }}</h4>
              <p *ngIf="componentDef.description" class="component-description">
                {{ componentDef.description }}
              </p>
            </div>
          </div>
          <button
            class="close-btn"
            (click)="closeQuickEdit(); $event.stopPropagation()"
            title="Close"
          >
            <otui-icon name="close"></otui-icon>
          </button>
        </div>

        <div class="quick-edit-form">
          <div class="form-field" *ngFor="let prop of editableProperties">
            <label [for]="'quick-' + prop.key" class="property-label">
              {{ prop.label }}
              <span
                *ngIf="prop.isOutput"
                class="output-indicator"
                title="Output property"
                >📤</span
              >
            </label>
            <p *ngIf="prop.description" class="property-description">
              {{ prop.description }}
            </p>

            <!-- String/URL input -->
            <input
              *ngIf="prop.type === 'string' || prop.type === 'url'"
              [id]="'quick-' + prop.key"
              type="text"
              [(ngModel)]="editingData[prop.key]"
              [placeholder]="getPlaceholder(prop)"
              class="form-input"
              (keydown)="$event.stopPropagation()"
              (keyup)="$event.stopPropagation()"
              (keypress)="$event.stopPropagation()"
            />

            <!-- Number input -->
            <input
              *ngIf="prop.type === 'number'"
              [id]="'quick-' + prop.key"
              type="number"
              [(ngModel)]="editingData[prop.key]"
              [placeholder]="getPlaceholder(prop)"
              class="form-input"
              (keydown)="$event.stopPropagation()"
              (keyup)="$event.stopPropagation()"
              (keypress)="$event.stopPropagation()"
            />

            <!-- Boolean checkbox -->
            <div class="checkbox-field" *ngIf="prop.type === 'boolean'">
              <input
                [id]="'quick-' + prop.key"
                type="checkbox"
                [(ngModel)]="editingData[prop.key]"
                class="checkbox-input"
              />
              <span class="checkbox-label">{{
                prop.description || prop.label
              }}</span>
            </div>

            <!-- Select dropdown -->
            <select
              *ngIf="prop.type === 'select' && prop.options"
              [id]="'quick-' + prop.key"
              [(ngModel)]="editingData[prop.key]"
              class="select-input"
              (keydown)="$event.stopPropagation()"
              (keyup)="$event.stopPropagation()"
            >
              <option
                *ngFor="let option of prop.options"
                [value]="option.value"
              >
                {{ option.label }}
              </option>
            </select>

            <!-- Array input (JSON) -->
            <textarea
              *ngIf="prop.type === 'array'"
              [id]="'quick-' + prop.key"
              [(ngModel)]="editingData[prop.key + '_json']"
              (ngModelChange)="updateArrayFromJson(prop.key, $event)"
              class="json-input"
              [placeholder]="getArrayPlaceholder(prop)"
              (keydown)="$event.stopPropagation()"
              (keyup)="$event.stopPropagation()"
              (keypress)="$event.stopPropagation()"
            ></textarea>

            <!-- Object input (JSON) -->
            <textarea
              *ngIf="prop.type === 'object'"
              [id]="'quick-' + prop.key"
              [(ngModel)]="editingData[prop.key + '_json']"
              (ngModelChange)="updateObjectFromJson(prop.key, $event)"
              class="json-input"
              [placeholder]="getObjectPlaceholder(prop)"
              (keydown)="$event.stopPropagation()"
              (keyup)="$event.stopPropagation()"
              (keypress)="$event.stopPropagation()"
            ></textarea>
          </div>
        </div>

        <div class="quick-edit-actions">
          <button
            class="action-btn cancel-btn"
            (click)="cancelQuickEdit(); $event.stopPropagation()"
          >
            Cancel
          </button>
          <button
            class="action-btn save-btn"
            (click)="saveQuickEdit(); $event.stopPropagation()"
          >
            Save Changes
          </button>
        </div>
      </div>

      <!-- Resize Handles (for future resizable components) -->
      <div
        class="resize-handle resize-handle-se"
        *ngIf="isSelected && isResizable"
      ></div>
    </div>
  `,
  styles: [
    `
      .component-editor-wrapper {
        position: relative;
        border: 2px solid transparent;
        border-radius: 8px;
        margin: 0.5rem 0;
        transition: all 0.2s ease;
        background: var(--wrapper-background, transparent);
        isolation: isolate; /* Create new stacking context */
        cursor: pointer; /* Indicate clickability */
      }

      .component-editor-wrapper.hovered {
        border-color: var(--accent, #007acc);
        background-color: rgba(0, 122, 204, 0.03);
        z-index: 1; /* Ensure hovered wrapper is above siblings */
      }

      .component-editor-wrapper.locked {
        border-color: #2196f3;
        background-color: rgba(33, 150, 243, 0.08);
        box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.15);
        z-index: 3; /* Locked wrapper is above selected */
        cursor: default; /* No pointer cursor when locked */
      }

      .component-editor-wrapper.selected {
        border-color: var(--accent, #007acc);
        background-color: rgba(0, 122, 204, 0.08);
        box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.15);
        z-index: 2; /* Selected wrapper is above hovered */
      }

      .component-editor-wrapper.editing {
        border-color: var(--accent, #007acc);
        z-index: 100; /* Editing wrapper is above everything */
      }

      /* Control Bar */
      .control-bar {
        position: absolute;
        top: -36px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        background: var(--accent, #007acc);
        border-radius: 6px 6px 0 0;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        z-index: 10;
        pointer-events: auto; /* Ensure controls are always clickable */
      }

      .control-bar.visible {
        opacity: 1;
        visibility: visible;
        pointer-events: auto; /* Ensure controls remain clickable when visible */
      }

      .component-label {
        display: flex;
        align-items: center;
        gap: 6px;
        color: white;
        font-size: 0.85rem;
        font-weight: 500;
      }

      .component-label mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .lock-indicator {
        font-size: 14px;
        margin-left: 4px;
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.6;
        }
      }

      .control-buttons {
        display: flex;
        gap: 4px;
      }

      .control-btn {
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        pointer-events: auto; /* Ensure each button is clickable */
      }

      .control-btn:hover {
        background: rgba(255, 255, 255, 0.35);
        transform: scale(1.05); /* Subtle scale on hover for feedback */
      }

      .control-btn:active {
        transform: scale(0.95); /* Provide click feedback */
      }

      .control-btn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .delete-btn:hover {
        background: #dc3545;
      }

      /* Component Content */
      .component-content {
        padding: 12px;
        min-height: 60px;
        pointer-events: auto; /* Allow interaction with content */
        position: relative;
        z-index: 1;
      }

      .component-preview {
        padding: 16px;
        background: var(--background-secondary, #f8f9fa);
        border-radius: 6px;
        border: 1px dashed var(--border-color, #dee2e6);
      }

      .preview-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }

      .preview-header h4 {
        margin: 0;
        font-size: 1rem;
        color: var(--foreground, #333);
      }

      .preview-header mat-icon {
        color: var(--accent, #007acc);
      }

      .preview-description {
        margin: 0 0 12px 0;
        font-size: 0.875rem;
        color: var(--foreground-secondary, #666);
      }

      .preview-data {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .data-item {
        display: flex;
        gap: 4px;
        font-size: 0.8rem;
        padding: 4px 8px;
        background: white;
        border-radius: 4px;
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .data-label {
        font-weight: 500;
        color: var(--foreground, #333);
      }

      .data-value {
        color: var(--foreground-secondary, #666);
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* Quick Edit Overlay */
      .quick-edit-overlay {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid var(--border-color, #dee2e6);
        border-radius: 0 0 8px 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 20;
        max-height: 500px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .quick-edit-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 12px 16px;
        background: var(--background-secondary, #f8f9fa);
        border-bottom: 1px solid var(--border-color, #dee2e6);
        flex-shrink: 0;
      }

      .header-content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        flex: 1;
      }

      .component-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
        color: var(--accent, #007acc);
        flex-shrink: 0;
      }

      .quick-edit-header h4 {
        margin: 0 0 4px 0;
        font-size: 1rem;
        color: var(--foreground, #333);
        font-weight: 600;
      }

      .component-description {
        margin: 0;
        font-size: 0.85rem;
        color: var(--foreground-secondary, #666);
        line-height: 1.4;
      }

      .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--foreground-secondary, #666);
        flex-shrink: 0;
      }

      .close-btn:hover {
        background: rgba(0, 0, 0, 0.05);
        color: var(--foreground, #333);
      }

      .quick-edit-form {
        flex: 1;
        padding: 16px;
        overflow-y: auto;
        overflow-x: hidden;
        max-height: 350px;
        min-height: 100px;
        -webkit-overflow-scrolling: touch; /* Smooth scrolling on mobile */
      }

      .form-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 16px;
      }

      .property-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--foreground, #333);
      }

      .output-indicator {
        font-size: 0.75rem;
      }

      .property-description {
        margin: 0;
        font-size: 0.8rem;
        color: var(--foreground-secondary, #666);
        line-height: 1.4;
      }

      .form-input {
        padding: 8px 12px;
        border: 1px solid var(--border-color, #dee2e6);
        border-radius: 4px;
        font-size: 0.9rem;
        transition: border-color 0.15s ease;
        background: var(--background, white);
        color: var(--foreground, #333);
      }

      .form-input:focus {
        outline: none;
        border-color: var(--accent, #007acc);
        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
      }

      .checkbox-field {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 0;
      }

      .checkbox-input {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }

      .checkbox-label {
        font-size: 0.9rem;
        color: var(--foreground, #333);
        cursor: pointer;
      }

      .select-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-color, #dee2e6);
        border-radius: 4px;
        background: var(--background, white);
        color: var(--foreground, #333);
        font-size: 0.9rem;
        cursor: pointer;
      }

      .select-input:focus {
        outline: none;
        border-color: var(--accent, #007acc);
        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
      }

      .json-input {
        width: 100%;
        min-height: 100px;
        padding: 10px 12px;
        border: 1px solid var(--border-color, #dee2e6);
        border-radius: 4px;
        font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
        font-size: 0.85rem;
        line-height: 1.5;
        resize: vertical;
        background: var(--background, white);
        color: var(--foreground, #333);
      }

      .json-input:focus {
        outline: none;
        border-color: var(--accent, #007acc);
        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
      }

      .quick-edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        border-top: 1px solid var(--border-color, #dee2e6);
        background: var(--background-secondary, #f8f9fa);
        flex-shrink: 0;
      }

      .action-btn {
        padding: 8px 20px;
        border-radius: 4px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        border: none;
      }

      .cancel-btn {
        background: white;
        border: 1px solid var(--border-color, #dee2e6);
        color: var(--foreground, #333);
      }

      .cancel-btn:hover {
        background: var(--background-secondary, #f8f9fa);
        border-color: var(--foreground-secondary, #999);
      }

      .save-btn {
        background: var(--accent, #007acc);
        color: white;
      }

      .save-btn:hover {
        background: var(--accent-dark, #005999);
      }

      /* Resize Handle */
      .resize-handle {
        position: absolute;
        width: 12px;
        height: 12px;
        background: var(--accent, #007acc);
        border: 2px solid white;
        border-radius: 2px;
      }

      .resize-handle-se {
        bottom: -6px;
        right: -6px;
        cursor: se-resize;
      }
    `,
  ],
})
export class ComponentEditorWrapperComponent
  implements OnInit, OnDestroy, OnChanges, AfterViewInit
{
  @ViewChild('componentHost', { read: ViewContainerRef })
  componentHost!: ViewContainerRef;

  @Input() componentInstance!: InjectedComponentInstance;
  @Input() componentDef!: InjectableComponent;
  @Input() componentData: Record<string, unknown> = {};
  @Input() isSelected = false;
  @Input() isResizable = false;

  @Output() deleteRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() duplicateRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() selectionChanged = new EventEmitter<InjectedComponentInstance>();
  @Output() propertiesChanged = new EventEmitter<{
    instance: InjectedComponentInstance;
    data: Record<string, unknown>;
  }>();

  isHovered = false;
  isLocked = false; // New: Click-to-lock state
  isEditing = false;
  editingData: Record<string, unknown> = {};
  dynamicComponentRef: ComponentRef<unknown> | null = null;
  componentId: string; // New: Unique identifier for logging

  get editableProperties(): PropertyDefinition[] {
    if (!this.componentDef?.id) return [];
    const props = this.componentDef.properties || [];
    // Include all non-output properties for editing
    return props.filter((p) => !p.isOutput);
  }

  constructor() {
    this.componentId = `component-${Math.random().toString(36).substr(2, 9)}`;
    console.log(
      `[ComponentLifecycle] Component wrapper created with ID: ${this.componentId}`
    );
  }

  ngOnInit(): void {
    console.log(`[ComponentLifecycle] ${this.componentId} - Initializing`, {
      componentDefId: this.componentDef?.id,
      componentData: this.componentData,
      instanceId: this.componentInstance?.instanceId,
    });
    this.initializeEditingData();
  }

  private initializeEditingData(): void {
    this.editingData = { ...this.componentData };

    // Initialize JSON strings for complex types
    const props = this.componentDef?.properties || [];
    props.forEach((prop) => {
      if (prop.type === 'array' || prop.type === 'object') {
        const value = this.editingData[prop.key];
        this.editingData[prop.key + '_json'] = value
          ? JSON.stringify(value, null, 2)
          : '';
      }
    });
  }

  getPlaceholder(prop: PropertyDefinition): string {
    if (prop.defaultValue !== undefined) {
      return String(prop.defaultValue);
    }
    switch (prop.type) {
      case 'string':
        return 'Enter text...';
      case 'number':
        return '0';
      case 'url':
        return 'https://example.com';
      default:
        return '';
    }
  }

  getArrayPlaceholder(prop: PropertyDefinition): string {
    const example = prop.defaultValue || ['item1', 'item2'];
    return JSON.stringify(example, null, 2);
  }

  getObjectPlaceholder(prop: PropertyDefinition): string {
    const example = prop.defaultValue || { key: 'value' };
    return JSON.stringify(example, null, 2);
  }

  updateArrayFromJson(key: string, jsonString: string): void {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        this.editingData[key] = parsed;
        console.log(
          `[ComponentLifecycle] ${this.componentId} - Array updated from JSON`,
          {
            key,
            value: parsed,
          }
        );
      }
    } catch (error) {
      console.warn(
        `[ComponentLifecycle] ${this.componentId} - Invalid JSON for array property ${key}`,
        error
      );
    }
  }

  updateObjectFromJson(key: string, jsonString: string): void {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed === 'object' && parsed !== null) {
        this.editingData[key] = parsed;
        console.log(
          `[ComponentLifecycle] ${this.componentId} - Object updated from JSON`,
          {
            key,
            value: parsed,
          }
        );
      }
    } catch (error) {
      console.warn(
        `[ComponentLifecycle] ${this.componentId} - Invalid JSON for object property ${key}`,
        error
      );
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['componentData']) {
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Component data changed`,
        {
          previousValue: changes['componentData'].previousValue,
          currentValue: changes['componentData'].currentValue,
          isEditing: this.isEditing,
        }
      );
      // Always update editingData when componentData changes from parent
      // This ensures the quick-edit form shows the latest data
      if (!this.isEditing) {
        // Only update if not currently editing to prevent overwriting user changes
        this.editingData = { ...this.componentData };
      }
      // Always update the dynamic component
      this.updateDynamicComponent();
    }
    if (changes['componentDef'] && this.componentHost) {
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Component definition changed`,
        {
          componentDefId: this.componentDef?.id,
        }
      );
      this.renderDynamicComponent();
    }
  }

  ngAfterViewInit(): void {
    console.log(`[ComponentLifecycle] ${this.componentId} - After view init`, {
      hasComponent: !!this.componentDef?.component,
    });
    if (this.componentDef?.component) {
      setTimeout(() => this.renderDynamicComponent());
    }
  }

  ngOnDestroy(): void {
    console.log(`[ComponentLifecycle] ${this.componentId} - Destroying`);
    this.destroyDynamicComponent();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close quick edit if clicking outside the overlay
    if (this.isEditing) {
      const target = event.target as HTMLElement;
      const clickedInOverlay = target.closest('.quick-edit-overlay');
      const clickedInWrapper = target.closest('.component-editor-wrapper');

      // Close if clicked outside the wrapper entirely
      if (!clickedInWrapper) {
        this.closeQuickEdit();
      }
      // Don't close if clicked in the overlay (allow form interaction)
      else if (clickedInOverlay) {
        // Do nothing - allow normal interaction
      }
      // Close if clicked in the wrapper but outside the overlay (e.g., control buttons)
      else {
        this.closeQuickEdit();
      }
    }
  }

  onMouseEnter(): void {
    // Only enable hover if not locked
    if (!this.isLocked) {
      this.isHovered = true;
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Mouse enter (hover enabled)`
      );
    }
  }

  onMouseLeave(): void {
    // Only disable hover if not locked
    if (!this.isLocked) {
      this.isHovered = false;
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Mouse leave (hover disabled)`
      );
    }
  }

  onClick(event: Event): void {
    event.stopPropagation();

    // Check if clicking on control buttons
    const target = event.target as HTMLElement;
    if (target.closest('.control-buttons')) {
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Click on control button, not toggling lock`
      );
      return;
    }

    // Toggle lock state
    this.isLocked = !this.isLocked;

    if (this.isLocked) {
      // When locking, force controls visible and disable hover
      this.isHovered = false;
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Locked (controls pinned, hover disabled)`,
        {
          instanceId: this.componentInstance?.instanceId,
        }
      );
    } else {
      // When unlocking, re-enable hover
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Unlocked (hover re-enabled)`
      );
    }

    this.selectionChanged.emit(this.componentInstance);
  }

  onOverlayClick(event: Event): void {
    // Stop clicks in the overlay from reaching the wrapper's onClick
    // This prevents focus loss when clicking on inputs
    event.stopPropagation();
  }

  onOverlayMouseDown(event: MouseEvent): void {
    // Prevent TipTap editor from capturing focus when clicking in the overlay
    // This is critical for maintaining focus in form inputs
    event.stopPropagation();
  }

  onOverlayKeyDown(event: KeyboardEvent): void {
    // Prevent TipTap from capturing keyboard events in the overlay
    // This allows typing in form inputs without replacing the component
    event.stopPropagation();
    console.log(
      `[ComponentLifecycle] ${this.componentId} - Keydown in overlay (stopped propagation)`,
      {
        key: event.key,
        target: (event.target as HTMLElement).tagName,
      }
    );
  }

  onOverlayKeyUp(event: KeyboardEvent): void {
    // Prevent TipTap from capturing keyboard events in the overlay
    event.stopPropagation();
  }

  onOverlayKeyPress(event: KeyboardEvent): void {
    // Prevent TipTap from capturing keyboard events in the overlay
    event.stopPropagation();
  }

  onOverlayPaste(event: ClipboardEvent): void {
    // Prevent TipTap from capturing paste events in the overlay
    event.stopPropagation();
    console.log(
      `[ComponentLifecycle] ${this.componentId} - Paste event stopped from propagating to TipTap`
    );
  }

  onEditClick(event: Event): void {
    event.stopPropagation();
    const wasEditing = this.isEditing;
    this.isEditing = !this.isEditing;

    console.log(
      `[ComponentLifecycle] ${this.componentId} - Edit button clicked`,
      {
        wasEditing,
        isNowEditing: this.isEditing,
        currentData: this.componentData,
      }
    );

    if (this.isEditing) {
      this.editingData = { ...this.componentData };
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Edit mode enabled, editing data initialized`
      );
    }
  }

  onDuplicateClick(event: Event): void {
    event.stopPropagation();
    console.log(
      `[ComponentLifecycle] ${this.componentId} - Duplicate button clicked`,
      {
        componentDefId: this.componentDef?.id,
        componentData: this.componentData,
      }
    );
    if (this.isEditing) {
      this.closeQuickEdit();
    }
    this.duplicateRequested.emit(this.componentInstance);
  }

  onDeleteClick(event: Event): void {
    event.stopPropagation();
    console.log(
      `[ComponentLifecycle] ${this.componentId} - Delete button clicked`,
      {
        componentDefId: this.componentDef?.id,
        instanceId: this.componentInstance?.instanceId,
      }
    );
    if (this.isEditing) {
      this.closeQuickEdit();
    }
    this.deleteRequested.emit(this.componentInstance);
  }

  closeQuickEdit(): void {
    console.log(
      `[ComponentLifecycle] ${this.componentId} - Closing quick edit`
    );
    this.isEditing = false;
  }

  cancelQuickEdit(): void {
    console.log(
      `[ComponentLifecycle] ${this.componentId} - Quick edit cancelled`,
      {
        discardedChanges: this.editingData,
        originalData: this.componentData,
      }
    );
    this.editingData = { ...this.componentData };
    this.isEditing = false;
  }

  saveQuickEdit(): void {
    console.log(
      `[ComponentLifecycle] ${this.componentId} - Saving quick edit`,
      {
        oldData: this.componentData,
        newData: this.editingData,
      }
    );

    // Clean up temporary JSON strings before saving
    const cleanedData = { ...this.editingData };
    const props = this.componentDef?.properties || [];
    props.forEach((prop) => {
      if (prop.type === 'array' || prop.type === 'object') {
        delete cleanedData[prop.key + '_json'];
      }
    });

    // Update the component data immediately
    this.componentData = { ...this.componentData, ...cleanedData };

    // Emit the changes to parent
    this.propertiesChanged.emit({
      instance: this.componentInstance,
      data: { ...cleanedData },
    });

    // Close the edit overlay
    this.isEditing = false;

    // Update the rendered component
    this.updateDynamicComponent();

    console.log(
      `[ComponentLifecycle] ${this.componentId} - Quick edit saved successfully, overlay closed`
    );
  }

  hasVisibleProperties(): boolean {
    return this.getPreviewProperties().length > 0;
  }

  getPreviewProperties(): PropertyDefinition[] {
    if (!this.componentDef?.id) return [];
    const props = this.componentDef.properties || [];
    // Show only simple properties in preview
    return props
      .filter(
        (p) =>
          !p.isOutput &&
          (p.type === 'string' ||
            p.type === 'number' ||
            p.type === 'boolean') &&
          this.componentData[p.key] !== undefined &&
          this.componentData[p.key] !== ''
      )
      .slice(0, 4); // Limit to 4 properties for preview
  }

  formatPropertyValue(key: string): string {
    const value = this.componentData[key];
    if (value === undefined || value === null) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'string' && value.length > 30) {
      return value.substring(0, 30) + '...';
    }
    return String(value);
  }

  private renderDynamicComponent(): void {
    if (!this.componentHost || !this.componentDef?.component) {
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Cannot render: missing host or component def`
      );
      return;
    }

    console.log(
      `[ComponentLifecycle] ${this.componentId} - Rendering dynamic component`,
      {
        componentDefId: this.componentDef?.id,
        componentType: this.componentDef?.component.name,
      }
    );

    this.destroyDynamicComponent();

    try {
      this.dynamicComponentRef = this.componentHost.createComponent(
        this.componentDef.component
      );
      this.updateDynamicComponent();
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Dynamic component rendered successfully`
      );
    } catch (error) {
      console.error(
        `[ComponentLifecycle] ${this.componentId} - Error rendering dynamic component:`,
        error
      );
      this.dynamicComponentRef = null;
    }
  }

  private updateDynamicComponent(): void {
    if (!this.dynamicComponentRef) {
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Skipping update: no component ref`
      );
      return;
    }

    const data = {
      ...this.componentDef.data,
      ...this.componentData,
    };

    console.log(
      `[ComponentLifecycle] ${this.componentId} - Updating dynamic component`,
      {
        mergedData: data,
      }
    );

    if (this.dynamicComponentRef) {
      const instance = this.dynamicComponentRef.instance as Record<
        string,
        unknown
      >;
      Object.keys(data).forEach((key) => {
        if (instance && instance[key] !== undefined) {
          instance[key] = data[key];
        }
      });
      this.dynamicComponentRef.changeDetectorRef.detectChanges();
    }

    console.log(
      `[ComponentLifecycle] ${this.componentId} - Dynamic component updated`
    );
  }

  /**
   * Public method to update component data from external sources
   * Used by the injection service when data changes
   */
  public updateComponentData(newData: Record<string, unknown>): void {
    console.log(
      `[ComponentLifecycle] ${this.componentId} - External data update requested`,
      {
        currentData: this.componentData,
        newData,
        isEditing: this.isEditing,
      }
    );

    this.componentData = { ...this.componentData, ...newData };
    if (!this.isEditing) {
      this.editingData = { ...this.componentData };
    }
    this.updateDynamicComponent();

    console.log(
      `[ComponentLifecycle] ${this.componentId} - External data update completed`
    );
  }

  private destroyDynamicComponent(): void {
    if (this.dynamicComponentRef) {
      console.log(
        `[ComponentLifecycle] ${this.componentId} - Destroying existing dynamic component`
      );
      this.dynamicComponentRef.destroy();
      this.dynamicComponentRef = null;
    }
  }
}
