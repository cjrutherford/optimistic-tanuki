import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BlockDefinition,
  BlockFieldDefinition,
  BlockInstance,
} from '@optimistic-tanuki/app-config-models';
import {
  CheckboxComponent,
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'app-schema-block-inspector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TextInputComponent,
    TextAreaComponent,
    CheckboxComponent,
    SelectComponent,
  ],
  template: `
    <div class="schema-block-inspector" data-schema-inspector>
      @if (block && definition) {
      <div class="inspector-meta">
        <strong>{{ definition.name || block.type }}</strong>
        <p>
          {{
            definition.description ||
              'Structured fields for the selected block.'
          }}
        </p>
      </div>
      <div class="inspector-fields">
        @for (field of definition.fields || []; track field.key) {
        <div class="form-group">
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
          } @case ('boolean') {
          <lib-checkbox
            [value]="booleanFieldValue(field.key)"
            (changeEvent)="fieldChanged.emit({ key: field.key, value: $event })"
          ></lib-checkbox>
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
      } @else {
      <p>Select a block on the canvas to edit it.</p>
      }
    </div>
  `,
})
export class SchemaBlockInspectorComponent {
  private readonly optionCache = new Map<
    string,
    Array<{ value: string; label: string }>
  >();

  @Input() block: BlockInstance | null = null;
  @Input() definition: BlockDefinition | null = null;

  @Output() fieldChanged = new EventEmitter<{
    key: string;
    value: string | number | boolean;
  }>();

  fieldValue(fieldKey: string): string {
    if (!this.block) {
      return '';
    }

    const value = this.readPath(fieldKey);
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    if (typeof value === 'boolean') {
      return String(value);
    }

    return '';
  }

  booleanFieldValue(fieldKey: string): boolean {
    const value = this.readPath(fieldKey);
    return typeof value === 'boolean' ? value : false;
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
    if (!this.block) {
      return undefined;
    }

    return fieldKey.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, this.block.data);
  }
}
