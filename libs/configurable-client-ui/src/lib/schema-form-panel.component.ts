import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type BlockFieldDefinition } from '@optimistic-tanuki/app-config-models';
import {
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'app-schema-form-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TextInputComponent,
    TextAreaComponent,
    SelectComponent,
  ],
  template: `
    <div class="schema-form-panel" data-schema-form-panel>
      @if (title || description) {
      <div class="panel-meta">
        @if (title) {
        <strong>{{ title }}</strong>
        } @if (description) {
        <p>{{ description }}</p>
        }
      </div>
      }
      <div class="panel-fields">
        @for (field of fields; track field.key) {
        <div
          class="form-group"
          [class.full-width]="field.editor === 'textarea'"
        >
          <label [for]="'field-' + field.key">{{ field.label }}</label>
          @switch (field.editor || field.type) { @case ('textarea') {
          <lib-text-area
            [id]="'field-' + field.key"
            [rows]="field.rows || 4"
            [placeholder]="field.placeholder || ''"
            [ngModel]="fieldValue(field.key)"
            (ngModelChange)="
              fieldChanged.emit({ key: field.key, value: $event })
            "
          ></lib-text-area>
          } @case ('select') {
          <lib-select
            [ngModel]="fieldValue(field.key)"
            (ngModelChange)="
              fieldChanged.emit({ key: field.key, value: $event })
            "
            [options]="fieldOptions(field)"
          ></lib-select>
          } @default {
          <lib-text-input
            [id]="'field-' + field.key"
            [placeholder]="field.placeholder || ''"
            [ngModel]="fieldValue(field.key)"
            (ngModelChange)="
              fieldChanged.emit({ key: field.key, value: $event })
            "
            type="text"
          ></lib-text-input>
          } }
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .schema-form-panel {
        display: grid;
        gap: 1rem;
      }

      .panel-meta {
        display: grid;
        gap: 0.25rem;
      }

      .panel-meta p {
        margin: 0;
        color: var(--muted, #6b7280);
        line-height: 1.5;
      }

      .panel-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1rem;
      }

      .form-group {
        display: grid;
        gap: 0.5rem;
      }

      .form-group.full-width {
        grid-column: 1 / -1;
      }

      label {
        font-weight: 500;
        color: var(--foreground, #111827);
      }

      @media (max-width: 720px) {
        .panel-fields {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class SchemaFormPanelComponent {
  private readonly optionCache = new Map<
    string,
    Array<{ value: string; label: string }>
  >();

  @Input() title = '';
  @Input() description = '';
  @Input() model: object | null = null;
  @Input() fields: BlockFieldDefinition[] = [];

  @Output() fieldChanged = new EventEmitter<{ key: string; value: string }>();

  fieldValue(fieldKey: string): string {
    const value = this.readPath(fieldKey);
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return '';
  }

  fieldOptions(
    field: BlockFieldDefinition
  ): Array<{ value: string; label: string }> {
    const cached = this.optionCache.get(field.key);
    if (cached) {
      return cached;
    }

    const normalized = (field.options ?? []).map((option) => ({
      value: String(option.value),
      label: option.label,
    }));
    this.optionCache.set(field.key, normalized);
    return normalized;
  }

  private readPath(fieldKey: string): unknown {
    if (!this.model) {
      return undefined;
    }

    return fieldKey.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, this.model);
  }
}
