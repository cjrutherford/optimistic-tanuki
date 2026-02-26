import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ViewContainerRef,
  ComponentRef,
  OnInit,
  OnDestroy,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';

import {
  InjectedComponentInstance,
  InjectableComponent,
} from './interfaces/component-injection.interface';
import { PropertyDefinition } from './components/property-editor.component';

/**
 * Enhanced Component Wrapper with Inline Editing
 *
 * Features:
 * - Hover detection with control bar
 * - Click-to-lock mechanism
 * - Inline quick-edit overlay
 * - Property editing without modal
 * - Event prevention for TipTap integration
 */
@Component({
  selector: 'lib-component-wrapper',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div
      class="component-wrapper"
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
    >
      <!-- Top Control Bar -->
      <div
        class="control-bar"
        [class.visible]="isHovered || isLocked || isSelected"
      >
        <div class="component-label">
          <mat-icon *ngIf="componentDef?.icon">{{
            componentDef?.icon
          }}</mat-icon>
          <span class="label-text">{{
            componentDef?.name || 'Component'
          }}</span>
          <span
            class="lock-indicator"
            *ngIf="isLocked"
            title="Locked - Click wrapper to unlock"
            >🔒</span
          >
        </div>
        <div class="control-buttons">
          <button
            class="control-btn edit-btn"
            (click)="onEditClick($event)"
            title="Edit Properties"
          >
            <mat-icon>edit</mat-icon>
          </button>
          <button
            class="control-btn duplicate-btn"
            (click)="onDuplicateClick($event)"
            title="Duplicate Component"
          >
            <mat-icon>content_copy</mat-icon>
          </button>
          <button
            class="control-btn move-up-btn"
            (click)="onMoveUpClick($event)"
            title="Move Up"
          >
            <mat-icon>keyboard_arrow_up</mat-icon>
          </button>
          <button
            class="control-btn move-down-btn"
            (click)="onMoveDownClick($event)"
            title="Move Down"
          >
            <mat-icon>keyboard_arrow_down</mat-icon>
          </button>
          <button
            class="control-btn delete-btn"
            (click)="onDeleteClick($event)"
            title="Delete Component"
          >
            <mat-icon>delete</mat-icon>
          </button>
        </div>
      </div>

      <!-- Component Content Area -->
      <div class="component-content">
        <ng-container #componentHost></ng-container>

        <!-- Fallback preview when component cannot be rendered -->
        <div class="component-preview" *ngIf="!dynamicComponentRef">
          <div class="preview-header">
            <mat-icon *ngIf="componentDef?.icon">{{
              componentDef?.icon
            }}</mat-icon>
            <h4>{{ componentDef?.name || 'Component' }}</h4>
          </div>
          <p class="preview-description">
            {{
              componentDef?.description || 'Click to configure this component'
            }}
          </p>
        </div>
      </div>

      <!-- Quick Edit Overlay (inline editing) -->
      <div
        class="quick-edit-overlay"
        *ngIf="isEditing"
        (click)="onOverlayClick($event)"
        contenteditable="false"
        tabindex="-1"
      >
        <div class="quick-edit-header">
          <div class="header-content">
            <mat-icon *ngIf="componentDef?.icon" class="component-icon">{{
              componentDef?.icon
            }}</mat-icon>
            <div>
              <h4>{{ componentDef?.name }}</h4>
              <p
                *ngIf="componentDef?.description"
                class="component-description"
              >
                {{ componentDef?.description }}
              </p>
            </div>
          </div>
          <button
            class="close-btn"
            (click)="closeQuickEdit(); $event.stopPropagation()"
            title="Close"
          >
            <mat-icon>close</mat-icon>
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
    </div>
  `,
  styles: [
    `
      .component-wrapper {
        position: relative;
        border: 2px solid transparent;
        border-radius: 4px;
        transition: all 0.2s ease;
        margin: 1rem 0;
        min-height: 60px;
      }

      .component-wrapper.hovered {
        border-color: var(--accent, #007acc);
        background-color: rgba(0, 122, 204, 0.05);
      }

      .component-wrapper.selected {
        border-color: var(--accent, #007acc);
        background-color: rgba(0, 122, 204, 0.1);
        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
      }

      .component-wrapper.locked {
        border-color: var(--accent, #007acc);
        border-style: dashed;
      }

      .component-wrapper.editing {
        border-color: var(--accent, #007acc);
        border-width: 3px;
        background-color: rgba(0, 122, 204, 0.15);
      }

      /* Control Bar */
      .control-bar {
        position: absolute;
        top: -12px;
        left: 8px;
        right: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--accent, #007acc);
        border-radius: 4px;
        padding: 4px 8px;
        opacity: 0;
        visibility: hidden;
        transition: all 0.2s ease;
        z-index: 100;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      }

      .control-bar.visible {
        opacity: 1;
        visibility: visible;
      }

      .component-label {
        display: flex;
        align-items: center;
        gap: 6px;
        color: white;
        font-size: 0.75rem;
        font-weight: 500;
      }

      .component-label mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .label-text {
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .lock-indicator {
        font-size: 12px;
        margin-left: 4px;
      }

      .control-buttons {
        display: flex;
        gap: 4px;
      }

      .control-btn {
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.2);
        color: white;
        transition: all 0.15s ease;
      }

      .control-btn:hover {
        background: rgba(255, 255, 255, 0.4);
      }

      .control-btn mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }

      .edit-btn:hover {
        background: rgba(255, 255, 255, 0.9);
        color: var(--accent, #007acc);
      }

      .duplicate-btn:hover {
        background: rgba(255, 255, 255, 0.9);
        color: var(--accent, #007acc);
      }

      .delete-btn:hover {
        background: #dc3545;
        color: white;
      }

      .move-up-btn:hover,
      .move-down-btn:hover {
        background: rgba(255, 255, 255, 0.9);
        color: var(--accent, #007acc);
      }

      /* Component Content */
      .component-content {
        padding: 2rem 1rem 1rem;
        min-height: 40px;
      }

      .component-preview {
        padding: 1rem;
        background: rgba(0, 0, 0, 0.03);
        border-radius: 4px;
        text-align: center;
      }

      .preview-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        margin-bottom: 0.5rem;
        color: var(--foreground-secondary, #666);
      }

      .preview-header mat-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      .preview-header h4 {
        margin: 0;
        font-size: 1rem;
      }

      .preview-description {
        margin: 0;
        color: var(--foreground-muted, #999);
        font-size: 0.875rem;
      }

      /* Quick Edit Overlay */
      .quick-edit-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        background: white;
        border: 2px solid var(--accent, #007acc);
        border-radius: 4px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 200;
        max-height: 400px;
        overflow-y: auto;
      }

      .quick-edit-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 12px 16px;
        background: var(--accent, #007acc);
        color: white;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      .header-content {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .header-content h4 {
        margin: 0 0 4px 0;
        font-size: 1rem;
      }

      .component-icon {
        font-size: 24px;
        width: 24px;
        height: 24px;
      }

      .component-description {
        margin: 0;
        font-size: 0.8rem;
        opacity: 0.9;
      }

      .close-btn {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        border-radius: 3px;
        color: white;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .close-btn:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      .close-btn mat-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      /* Quick Edit Form */
      .quick-edit-form {
        padding: 16px;
      }

      .form-field {
        margin-bottom: 16px;
      }

      .form-field:last-child {
        margin-bottom: 0;
      }

      .property-label {
        display: block;
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--foreground, #333);
        margin-bottom: 4px;
      }

      .output-indicator {
        font-size: 12px;
        margin-left: 4px;
      }

      .property-description {
        margin: 0 0 8px 0;
        font-size: 0.75rem;
        color: var(--foreground-muted, #666);
      }

      .form-input,
      .select-input,
      .json-input {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 4px;
        font-size: 0.875rem;
        background: white;
        transition: border-color 0.2s ease;
      }

      .form-input:focus,
      .select-input:focus,
      .json-input:focus {
        outline: none;
        border-color: var(--accent, #007acc);
        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
      }

      .json-input {
        min-height: 80px;
        font-family: monospace;
        resize: vertical;
      }

      .checkbox-field {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .checkbox-input {
        width: 18px;
        height: 18px;
        cursor: pointer;
      }

      .checkbox-label {
        font-size: 0.875rem;
        color: var(--foreground, #333);
      }

      /* Quick Edit Actions */
      .quick-edit-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 12px 16px;
        background: rgba(0, 0, 0, 0.03);
        border-top: 1px solid var(--border-color, #e0e0e0);
      }

      .action-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .cancel-btn {
        background: transparent;
        color: var(--foreground-muted, #666);
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .cancel-btn:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .save-btn {
        background: var(--accent, #007acc);
        color: white;
      }

      .save-btn:hover {
        background: var(--accent-dark, #005999);
      }
    `,
  ],
})
export class ComponentWrapperComponent
  implements OnInit, OnDestroy, OnChanges, AfterViewInit
{
  @Input() componentInstance!: InjectedComponentInstance;
  @Input() isSelected = false;
  @Input() properties: PropertyDefinition[] = [];

  @Output() editRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() deleteRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() duplicateRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() moveUpRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() moveDownRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() selectionChanged = new EventEmitter<InjectedComponentInstance>();
  @Output() propertiesChanged = new EventEmitter<{
    instance: InjectedComponentInstance;
    data: Record<string, unknown>;
  }>();

  @ViewChild('componentHost', { read: ViewContainerRef, static: true })
  componentHost!: ViewContainerRef;

  isHovered = false;
  isLocked = false;
  isEditing = false;

  // Dynamic component rendering
  dynamicComponentRef: ComponentRef<unknown> | null = null;

  // Quick edit data
  editingData: Record<string, unknown> = {};

  ngOnInit(): void {
    this.initializeEditingData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['componentInstance'] && this.componentInstance) {
      this.initializeEditingData();
      this.renderDynamicComponent();
    }
  }

  ngAfterViewInit(): void {
    this.renderDynamicComponent();
  }

  ngOnDestroy(): void {
    this.destroyDynamicComponent();
  }

  // Get component definition
  get componentDef(): InjectableComponent | undefined {
    return this.componentInstance?.componentDef;
  }

  // Get editable properties (exclude outputs unless configured)
  get editableProperties(): PropertyDefinition[] {
    return this.properties.filter((prop) => !prop.isOutput || prop.editable);
  }

  private initializeEditingData(): void {
    if (!this.componentInstance) return;

    this.editingData = { ...this.componentInstance.data };

    // Initialize JSON representations for array/object types
    this.properties.forEach((prop) => {
      if (prop.type === 'array' || prop.type === 'object') {
        const value = this.editingData[prop.key];
        this.editingData[`${prop.key}_json`] = JSON.stringify(value, null, 2);
      }
    });
  }

  private renderDynamicComponent(): void {
    if (!this.componentHost || !this.componentDef?.component) return;

    // Clear previous component
    this.destroyDynamicComponent();

    try {
      // Create the component dynamically
      this.dynamicComponentRef = this.componentHost.createComponent(
        this.componentDef.component
      );

      // Set input properties
      Object.keys(this.componentInstance.data || {}).forEach((key) => {
        if (this.dynamicComponentRef?.instance && this.componentInstance.data) {
          (this.dynamicComponentRef.instance as Record<string, unknown>)[key] =
            this.componentInstance.data[key];
        }
      });

      // Store reference for updates
      if (this.componentInstance) {
        (this.componentInstance.data as Record<string, unknown>)[
          '_dynamicComponentRef'
        ] = this.dynamicComponentRef;
      }

      // Trigger change detection
      this.dynamicComponentRef?.changeDetectorRef?.detectChanges();
    } catch (error) {
      console.error(
        '[ComponentWrapper] Failed to render dynamic component:',
        error
      );
    }
  }

  private destroyDynamicComponent(): void {
    if (this.dynamicComponentRef) {
      this.dynamicComponentRef.destroy();
      this.dynamicComponentRef = null;
    }
  }

  // Mouse event handlers
  onMouseEnter(): void {
    if (!this.isLocked) {
      this.isHovered = true;
    }
  }

  onMouseLeave(): void {
    if (!this.isLocked && !this.isEditing) {
      this.isHovered = false;
    }
  }

  onClick(event: Event): void {
    event.stopPropagation();

    if (this.isEditing) {
      // Don't change selection while editing
      return;
    }

    if (this.isSelected && !this.isLocked) {
      // Click when selected but not locked = lock it
      this.isLocked = true;
    } else if (this.isLocked) {
      // Click when locked = unlock
      this.isLocked = false;
      this.isHovered = false;
    } else {
      // Normal click = select
      this.selectionChanged.emit(this.componentInstance);
    }
  }

  // Control button handlers
  onEditClick(event: Event): void {
    event.stopPropagation();
    this.startQuickEdit();
  }

  onDuplicateClick(event: Event): void {
    event.stopPropagation();
    this.duplicateRequested.emit(this.componentInstance);
  }

  onDeleteClick(event: Event): void {
    event.stopPropagation();
    this.deleteRequested.emit(this.componentInstance);
  }

  onMoveUpClick(event: Event): void {
    event.stopPropagation();
    this.moveUpRequested.emit(this.componentInstance);
  }

  onMoveDownClick(event: Event): void {
    event.stopPropagation();
    this.moveDownRequested.emit(this.componentInstance);
  }

  onOverlayClick(event: Event): void {
    // Prevent clicks from propagating to the editor
    event.stopPropagation();
  }

  // Quick Edit functionality
  startQuickEdit(): void {
    this.isEditing = true;
    this.isLocked = true;
    this.initializeEditingData();
    this.editRequested.emit(this.componentInstance);
  }

  closeQuickEdit(): void {
    this.isEditing = false;
    this.isLocked = false;
    this.isHovered = false;
  }

  cancelQuickEdit(): void {
    this.closeQuickEdit();
  }

  saveQuickEdit(): void {
    // Prepare clean data (remove JSON helper fields)
    const cleanData: Record<string, unknown> = {};
    Object.keys(this.editingData).forEach((key) => {
      if (!key.endsWith('_json')) {
        cleanData[key] = this.editingData[key];
      }
    });

    // Update component instance
    this.componentInstance.data = {
      ...this.componentInstance.data,
      ...cleanData,
    };

    // Update dynamic component inputs
    if (this.dynamicComponentRef?.instance) {
      Object.keys(cleanData).forEach((key) => {
        (this.dynamicComponentRef?.instance as Record<string, unknown>)[key] =
          cleanData[key];
      });
      this.dynamicComponentRef.changeDetectorRef?.detectChanges();
    }

    // Emit change event
    this.propertiesChanged.emit({
      instance: this.componentInstance,
      data: cleanData,
    });

    this.closeQuickEdit();
  }

  // Helper methods for property editing
  getPlaceholder(prop: PropertyDefinition): string {
    if (prop.placeholder) return prop.placeholder;
    if (prop.defaultValue !== undefined) return String(prop.defaultValue);
    return `Enter ${prop.label.toLowerCase()}...`;
  }

  getArrayPlaceholder(prop: PropertyDefinition): string {
    return `Enter JSON array for ${prop.label}...\nExample: ["item1", "item2"]`;
  }

  getObjectPlaceholder(prop: PropertyDefinition): string {
    return `Enter JSON object for ${prop.label}...\nExample: {\n  "key": "value"\n}`;
  }

  updateArrayFromJson(key: string, jsonValue: string): void {
    try {
      const parsed = JSON.parse(jsonValue);
      if (Array.isArray(parsed)) {
        this.editingData[key] = parsed;
      }
    } catch (e) {
      // Invalid JSON, don't update
    }
  }

  updateObjectFromJson(key: string, jsonValue: string): void {
    try {
      const parsed = JSON.parse(jsonValue);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        this.editingData[key] = parsed;
      }
    } catch (e) {
      // Invalid JSON, don't update
    }
  }
}
