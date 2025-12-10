import {
  Component,
  EventEmitter,
  Input,
  Output,
  OnInit,
  OnChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { ButtonComponent, CardComponent } from '@optimistic-tanuki/common-ui';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';
import { InjectedComponentInstance } from '../interfaces/component-injection.interface';

export interface PropertyDefinition {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'url' | 'select';
  label: string;
  description?: string;
  defaultValue?: unknown;
  options?: { label: string; value: unknown }[];
  isOutput?: boolean;
  outputSchema?: unknown;
}

@Component({
  selector: 'lib-property-editor',
  standalone: true,
  imports: [
    FormsModule,
    MatIconModule,
    ButtonComponent,
    CardComponent,
    TextInputComponent,
  ],
  template: `
    @if (isVisible) {
    <otui-card class="property-editor">
      <div class="editor-header">
        <h3>Edit Component Properties</h3>
        <button (click)="onClose()" class="close-btn">
          <mat-icon>close</mat-icon>
        </button>
      </div>
      @if (componentInstance) {
      <div class="component-info">
        <h4>{{ componentInstance.componentDef.name }}</h4>
        @if (componentInstance.componentDef.description) {
        <p>
          {{ componentInstance.componentDef.description }}
        </p>
        }
      </div>
      } @if (propertyDefinitions.length > 0) {
      <div class="properties-form">
        @for (prop of propertyDefinitions; track prop) {
        <div class="property-group">
          <label [for]="prop.key" class="property-label">
            {{ prop.label }}
          </label>
          @if (prop.description) {
          <p class="property-description">
            {{ prop.description }}
          </p>
          }
          <div>
            @switch (prop.type) {
            <!-- String input -->
            @case ('string') {
            <lib-text-input
              [id]="prop.key"
              [type]="'text'"
              [(ngModel)]="editedData[prop.key]"
              [placeholder]="getPlaceholder(prop)"
            ></lib-text-input>
            }
            <!-- Number input -->
            @case ('number') {
            <lib-text-input
              [id]="prop.key"
              [type]="'text'"
              [(ngModel)]="editedData[prop.key]"
              [placeholder]="getPlaceholder(prop)"
            ></lib-text-input>
            }
            <!-- Boolean input -->
            @case ('boolean') {
            <div class="checkbox-container">
              <input
                type="checkbox"
                [id]="prop.key"
                [(ngModel)]="editedData[prop.key]"
                class="checkbox-input"
              />
              <label [for]="prop.key" class="checkbox-label">
                {{ prop.label }}
              </label>
            </div>
            }
            <!-- URL input -->
            @case ('url') {
            <lib-text-input
              [id]="prop.key"
              [type]="'text'"
              [(ngModel)]="editedData[prop.key]"
              [placeholder]="getPlaceholder(prop)"
            ></lib-text-input>
            }
            <!-- Select input -->
            @case ('select') {
            <select
              [id]="prop.key"
              [(ngModel)]="editedData[prop.key]"
              class="select-input"
            >
              @for (option of prop.options; track option.value) {
              <option [value]="option.value">{{ option.label }}</option>
              }
            </select>
            }
            <!-- Array input (simplified as JSON string for now) -->
            @case ('array') {
            <textarea
              [id]="prop.key"
              [(ngModel)]="editedData[prop.key + '_json']"
              (ngModelChange)="updateArrayFromJson(prop.key, $event)"
              class="json-input"
              [placeholder]="getArrayPlaceholder(prop)"
            ></textarea>
            }
            <!-- Object input (JSON) -->
            @case ('object') {
            <textarea
              [id]="prop.key"
              [(ngModel)]="editedData[prop.key + '_json']"
              (ngModelChange)="updateObjectFromJson(prop.key, $event)"
              class="json-input"
              [placeholder]="getObjectPlaceholder(prop)"
            ></textarea>
            } }
          </div>
        </div>
        }
      </div>
      }
      <div class="editor-actions">
        <otui-button variant="secondary" (action)="onClose()"
          >Cancel</otui-button
        >
        <otui-button (action)="onSave()">Save Changes</otui-button>
      </div>
    </otui-card>
    }
  `,
  styles: [
    `
      .property-editor {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 500px;
        max-height: 80vh;
        z-index: 1000;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }

      .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }

      .editor-header h3 {
        margin: 0;
        font-size: 1.2rem;
      }

      .close-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        border-radius: 4px;
      }

      .close-btn:hover {
        background-color: var(--accent, #f0f0f0);
      }

      .component-info {
        padding: 1rem;
        background-color: var(--background-secondary, #f8f9fa);
        border-bottom: 1px solid var(--border-color, #e0e0e0);
      }

      .component-info h4 {
        margin: 0 0 0.5rem 0;
        font-size: 1rem;
      }

      .component-info p {
        margin: 0;
        font-size: 0.875rem;
        color: var(--foreground-secondary, #666);
      }

      .properties-form {
        flex: 1;
        padding: 1rem;
        overflow-y: auto;
        max-height: 400px;
      }

      .property-group {
        margin-bottom: 1.5rem;
      }

      .property-label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-weight: 500;
        margin-bottom: 0.25rem;
        font-size: 0.9rem;
      }

      .property-description {
        margin: 0 0 0.5rem 0;
        font-size: 0.8rem;
        color: var(--foreground-secondary, #666);
      }

      .checkbox-container {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      .checkbox-input {
        width: 16px;
        height: 16px;
      }

      .checkbox-label {
        font-size: 0.9rem;
      }

      .select-input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid var(--local-border-color);
        border-radius: 4px;
        background: var(--local-background);
        color: var(--local-foreground);
      }

      .json-input {
        width: 100%;
        min-height: 80px;
        padding: 0.75rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.85rem;
        resize: vertical;
      }

      .editor-actions {
        padding: 1rem;
        border-top: 1px solid var(--border-color, #e0e0e0);
        display: flex;
        justify-content: flex-end;
        gap: 0.5rem;
      }
    `,
  ],
})
export class PropertyEditorComponent implements OnInit, OnChanges {
  @Input() isVisible = false;
  @Input() componentInstance: InjectedComponentInstance | null = null;
  @Input() propertyDefinitions: PropertyDefinition[] = [];
  @Output() propertiesUpdated = new EventEmitter<Record<string, unknown>>();
  @Output() closed = new EventEmitter<void>();

  editedData: Record<string, unknown> = {};

  ngOnInit(): void {
    this.initializeEditedData();
  }

  ngOnChanges(): void {
    this.initializeEditedData();
  }

  private initializeEditedData(): void {
    if (this.componentInstance && this.propertyDefinitions.length > 0) {
      this.editedData = { ...(this.componentInstance.data || {}) };

      // Initialize JSON strings for complex types
      this.propertyDefinitions.forEach((prop) => {
        if (prop.type === 'array' || prop.type === 'object') {
          const value = this.editedData[prop.key];
          this.editedData[prop.key + '_json'] = value
            ? JSON.stringify(value, null, 2)
            : '';
        }
      });
    }
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
        this.editedData[key] = parsed;
      }
    } catch {
      // Invalid JSON, keep original value
    }
  }

  updateObjectFromJson(key: string, jsonString: string): void {
    try {
      const parsed = JSON.parse(jsonString);
      if (typeof parsed === 'object' && parsed !== null) {
        this.editedData[key] = parsed;
      }
    } catch {
      // Invalid JSON, keep original value
    }
  }

  onSave(): void {
    // Clean up temporary JSON strings
    const cleanedData = { ...this.editedData };
    this.propertyDefinitions.forEach((prop) => {
      if (prop.type === 'array' || prop.type === 'object') {
        delete cleanedData[prop.key + '_json'];
      }
    });

    this.propertiesUpdated.emit(cleanedData);
  }

  onClose(): void {
    this.closed.emit();
  }
}
