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
import { MatIconModule } from '@angular/material/icon';

import { InjectedComponentInstance, InjectableComponent } from '../interfaces/component-injection.interface';
import { PropertyDefinition } from './property-editor.component';
import { COMPONENT_PROPERTY_DEFINITIONS } from '../configs/component-properties.config';

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
  imports: [CommonModule, FormsModule, MatIconModule],
  template: `
    <div 
      class="component-editor-wrapper"
      [class.selected]="isSelected"
      [class.hovered]="isHovered"
      [class.editing]="isEditing"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (click)="onClick($event)">
      
      <!-- Top Control Bar -->
      <div class="control-bar" [class.visible]="isHovered || isSelected">
        <div class="component-label">
          <mat-icon *ngIf="componentDef?.icon">{{ componentDef?.icon }}</mat-icon>
          <span class="label-text">{{ componentDef?.name || 'Component' }}</span>
        </div>
        <div class="control-buttons">
          <button 
            class="control-btn config-btn" 
            (click)="onConfigClick($event)" 
            title="Configure Component">
            <mat-icon>settings</mat-icon>
          </button>
          <button 
            class="control-btn edit-btn" 
            (click)="onEditClick($event)" 
            title="Edit Properties">
            <mat-icon>edit</mat-icon>
          </button>
          <button 
            class="control-btn duplicate-btn" 
            (click)="onDuplicateClick($event)" 
            title="Duplicate Component">
            <mat-icon>content_copy</mat-icon>
          </button>
          <button 
            class="control-btn delete-btn" 
            (click)="onDeleteClick($event)" 
            title="Delete Component">
            <mat-icon>delete</mat-icon>
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
            <mat-icon *ngIf="componentDef?.icon">{{ componentDef?.icon }}</mat-icon>
            <h4>{{ componentDef?.name || 'Component' }}</h4>
          </div>
          <p class="preview-description">{{ componentDef?.description || 'Click to configure this component' }}</p>
          <div class="preview-data" *ngIf="componentData && hasVisibleProperties()">
            <div class="data-item" *ngFor="let prop of getPreviewProperties()">
              <span class="data-label">{{ prop.label }}:</span>
              <span class="data-value">{{ formatPropertyValue(prop.key) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Edit Overlay (inline editing) -->
      <div class="quick-edit-overlay" *ngIf="isEditing" (click)="$event.stopPropagation()">
        <div class="quick-edit-header">
          <h4>Quick Edit: {{ componentDef?.name }}</h4>
          <button class="close-btn" (click)="closeQuickEdit()">
            <mat-icon>close</mat-icon>
          </button>
        </div>
        <div class="quick-edit-form">
          <div class="form-field" *ngFor="let prop of editableProperties">
            <label [for]="'quick-' + prop.key">{{ prop.label }}</label>
            
            <!-- String input -->
            <input 
              *ngIf="prop.type === 'string' || prop.type === 'url'"
              [id]="'quick-' + prop.key"
              type="text"
              [(ngModel)]="editingData[prop.key]"
              [placeholder]="prop.defaultValue || ''"
              class="form-input"
            />
            
            <!-- Number input -->
            <input 
              *ngIf="prop.type === 'number'"
              [id]="'quick-' + prop.key"
              type="number"
              [(ngModel)]="editingData[prop.key]"
              [placeholder]="prop.defaultValue || 0"
              class="form-input"
            />
            
            <!-- Boolean checkbox -->
            <div class="checkbox-field" *ngIf="prop.type === 'boolean'">
              <input 
                [id]="'quick-' + prop.key"
                type="checkbox"
                [(ngModel)]="editingData[prop.key]"
              />
              <span>{{ prop.description || prop.label }}</span>
            </div>
          </div>
        </div>
        <div class="quick-edit-actions">
          <button class="action-btn cancel-btn" (click)="cancelQuickEdit()">Cancel</button>
          <button class="action-btn save-btn" (click)="saveQuickEdit()">Apply Changes</button>
        </div>
      </div>

      <!-- Resize Handles (for future resizable components) -->
      <div class="resize-handle resize-handle-se" *ngIf="isSelected && isResizable"></div>
    </div>
  `,
  styles: [`
    .component-editor-wrapper {
      position: relative;
      border: 2px solid transparent;
      border-radius: 8px;
      margin: 0.5rem 0;
      transition: all 0.2s ease;
      background: var(--wrapper-background, transparent);
    }

    .component-editor-wrapper.hovered {
      border-color: var(--accent, #007acc);
      background-color: rgba(0, 122, 204, 0.03);
    }

    .component-editor-wrapper.selected {
      border-color: var(--accent, #007acc);
      background-color: rgba(0, 122, 204, 0.08);
      box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.15);
    }

    .component-editor-wrapper.editing {
      border-color: var(--accent, #007acc);
      z-index: 100;
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
      font-size: 0.85rem;
      font-weight: 500;
    }

    .component-label mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
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
    }

    .control-btn:hover {
      background: rgba(255, 255, 255, 0.35);
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
      max-height: 400px;
      overflow-y: auto;
    }

    .quick-edit-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--background-secondary, #f8f9fa);
      border-bottom: 1px solid var(--border-color, #dee2e6);
    }

    .quick-edit-header h4 {
      margin: 0;
      font-size: 0.95rem;
      color: var(--foreground, #333);
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
    }

    .close-btn:hover {
      background: var(--accent, rgba(0, 0, 0, 0.05));
    }

    .quick-edit-form {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .form-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .form-field label {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--foreground, #333);
    }

    .form-input {
      padding: 8px 12px;
      border: 1px solid var(--border-color, #dee2e6);
      border-radius: 4px;
      font-size: 0.9rem;
      transition: border-color 0.15s ease;
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
    }

    .checkbox-field input {
      width: 16px;
      height: 16px;
    }

    .quick-edit-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 12px 16px;
      border-top: 1px solid var(--border-color, #dee2e6);
      background: var(--background-secondary, #f8f9fa);
    }

    .action-btn {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 0.85rem;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .cancel-btn {
      background: white;
      border: 1px solid var(--border-color, #dee2e6);
      color: var(--foreground, #333);
    }

    .cancel-btn:hover {
      background: var(--background-secondary, #f8f9fa);
    }

    .save-btn {
      background: var(--accent, #007acc);
      border: none;
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
  `]
})
export class ComponentEditorWrapperComponent implements OnInit, OnDestroy, OnChanges, AfterViewInit {
  @ViewChild('componentHost', { read: ViewContainerRef }) componentHost!: ViewContainerRef;

  @Input() componentInstance!: InjectedComponentInstance;
  @Input() componentDef!: InjectableComponent;
  @Input() componentData: Record<string, any> = {};
  @Input() isSelected = false;
  @Input() isResizable = false;

  @Output() editRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() deleteRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() duplicateRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() configRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() selectionChanged = new EventEmitter<InjectedComponentInstance>();
  @Output() propertiesChanged = new EventEmitter<{ instance: InjectedComponentInstance; data: Record<string, any> }>();

  isHovered = false;
  isEditing = false;
  editingData: Record<string, any> = {};
  dynamicComponentRef: ComponentRef<any> | null = null;

  get editableProperties(): PropertyDefinition[] {
    if (!this.componentDef?.id) return [];
    const props = COMPONENT_PROPERTY_DEFINITIONS[this.componentDef.id] || [];
    // Filter out output properties and complex types for quick edit
    return props.filter(p => !p.isOutput && (p.type === 'string' || p.type === 'number' || p.type === 'boolean' || p.type === 'url'));
  }

  ngOnInit(): void {
    this.editingData = { ...this.componentData };
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['componentData'] && !changes['componentData'].firstChange) {
      this.editingData = { ...this.componentData };
      this.updateDynamicComponent();
    }
    if (changes['componentDef'] && this.componentHost) {
      this.renderDynamicComponent();
    }
  }

  ngAfterViewInit(): void {
    if (this.componentDef?.component) {
      setTimeout(() => this.renderDynamicComponent());
    }
  }

  ngOnDestroy(): void {
    this.destroyDynamicComponent();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    // Close quick edit if clicking outside
    if (this.isEditing) {
      const target = event.target as HTMLElement;
      if (!target.closest('.component-editor-wrapper')) {
        this.closeQuickEdit();
      }
    }
  }

  onMouseEnter(): void {
    this.isHovered = true;
  }

  onMouseLeave(): void {
    this.isHovered = false;
  }

  onClick(event: Event): void {
    event.stopPropagation();
    this.selectionChanged.emit(this.componentInstance);
  }

  onConfigClick(event: Event): void {
    event.stopPropagation();
    this.configRequested.emit(this.componentInstance);
  }

  onEditClick(event: Event): void {
    event.stopPropagation();
    this.isEditing = true;
    this.editingData = { ...this.componentData };
  }

  onDuplicateClick(event: Event): void {
    event.stopPropagation();
    this.duplicateRequested.emit(this.componentInstance);
  }

  onDeleteClick(event: Event): void {
    event.stopPropagation();
    this.deleteRequested.emit(this.componentInstance);
  }

  closeQuickEdit(): void {
    this.isEditing = false;
  }

  cancelQuickEdit(): void {
    this.editingData = { ...this.componentData };
    this.isEditing = false;
  }

  saveQuickEdit(): void {
    this.propertiesChanged.emit({
      instance: this.componentInstance,
      data: { ...this.editingData }
    });
    this.isEditing = false;
    this.updateDynamicComponent();
  }

  hasVisibleProperties(): boolean {
    return this.getPreviewProperties().length > 0;
  }

  getPreviewProperties(): PropertyDefinition[] {
    if (!this.componentDef?.id) return [];
    const props = COMPONENT_PROPERTY_DEFINITIONS[this.componentDef.id] || [];
    // Show only simple properties in preview
    return props.filter(p => 
      !p.isOutput && 
      (p.type === 'string' || p.type === 'number' || p.type === 'boolean') &&
      this.componentData[p.key] !== undefined &&
      this.componentData[p.key] !== ''
    ).slice(0, 4); // Limit to 4 properties for preview
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
      return;
    }

    this.destroyDynamicComponent();

    try {
      this.dynamicComponentRef = this.componentHost.createComponent(this.componentDef.component);
      this.updateDynamicComponent();
    } catch (error) {
      console.error('Error rendering dynamic component:', error);
      this.dynamicComponentRef = null;
    }
  }

  private updateDynamicComponent(): void {
    if (!this.dynamicComponentRef) return;

    const data = { ...this.componentDef.data, ...this.componentData, ...this.editingData };
    Object.keys(data).forEach(key => {
      if (this.dynamicComponentRef!.instance[key] !== undefined) {
        this.dynamicComponentRef!.instance[key] = data[key];
      }
    });

    this.dynamicComponentRef.changeDetectorRef.detectChanges();
  }

  private destroyDynamicComponent(): void {
    if (this.dynamicComponentRef) {
      this.dynamicComponentRef.destroy();
      this.dynamicComponentRef = null;
    }
  }
}
