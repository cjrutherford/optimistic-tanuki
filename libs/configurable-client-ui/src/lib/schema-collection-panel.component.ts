import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { type BlockFieldDefinition } from '@optimistic-tanuki/app-config-models';
import {
  CheckboxComponent,
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'app-schema-collection-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CheckboxComponent,
    SelectComponent,
    TextAreaComponent,
    TextInputComponent,
  ],
  template: `
    <div class="collection-panel" data-schema-collection-panel>
      @if (title || description) {
      <div class="panel-meta">
        @if (title) {
        <strong>{{ title }}</strong>
        } @if (description) {
        <p>{{ description }}</p>
        }
      </div>
      }

      <div class="collection-items">
        @for (item of items; track trackBy(item, $index); let i = $index) {
        <div class="collection-card">
          <div class="collection-card-head">
            <span class="item-label">{{ itemLabel(i, item) }}</span>
            <button
              type="button"
              class="tag-remove"
              (click)="itemRemoved.emit(i)"
            >
              Remove
            </button>
          </div>

          <div class="item-fields">
            @for (field of fields; track field.key) {
            <div
              class="form-group"
              [class.full-width]="field.editor === 'textarea'"
            >
              <label [for]="'item-' + i + '-' + field.key">{{
                field.label
              }}</label>
              @if (field.type === 'boolean') {
              <lib-checkbox
                [ngModel]="booleanValue(item, field.key)"
                (ngModelChange)="
                  itemFieldChanged.emit({
                    index: i,
                    key: field.key,
                    value: $event
                  })
                "
                [label]="field.description || ''"
              ></lib-checkbox>
              } @else { @switch (field.editor || field.type) { @case
              ('textarea') {
              <lib-text-area
                [id]="'item-' + i + '-' + field.key"
                [rows]="field.rows || 4"
                [placeholder]="field.placeholder || ''"
                [ngModel]="fieldValue(item, field.key)"
                (ngModelChange)="
                  itemFieldChanged.emit({
                    index: i,
                    key: field.key,
                    value: $event
                  })
                "
              ></lib-text-area>
              } @case ('select') {
              <lib-select
                [ngModel]="fieldValue(item, field.key)"
                (ngModelChange)="
                  itemFieldChanged.emit({
                    index: i,
                    key: field.key,
                    value: $event
                  })
                "
                [options]="fieldOptions(field)"
              ></lib-select>
              } @default {
              <lib-text-input
                [id]="'item-' + i + '-' + field.key"
                [placeholder]="field.placeholder || ''"
                [ngModel]="fieldValue(item, field.key)"
                (ngModelChange)="
                  itemFieldChanged.emit({
                    index: i,
                    key: field.key,
                    value: $event
                  })
                "
                type="text"
              ></lib-text-input>
              } } }
            </div>
            }
          </div>
        </div>
        } @empty {
        <p class="empty-state">{{ emptyText }}</p>
        }
      </div>

      <button type="button" class="tag-add" (click)="itemAdded.emit()">
        {{ addLabel }}
      </button>
    </div>
  `,
  styles: [
    `
      .collection-panel {
        display: grid;
        gap: 1rem;
      }

      .panel-meta {
        display: grid;
        gap: 0.25rem;
      }

      .panel-meta p,
      .empty-state {
        margin: 0;
        color: var(--muted, #6b7280);
        line-height: 1.5;
      }

      .collection-items {
        display: grid;
        gap: 0.85rem;
      }

      .collection-card {
        display: grid;
        gap: 0.85rem;
        padding: 1rem;
        border: 1px solid var(--border, #e2e8f0);
        border-radius: var(--personality-card-radius, 1rem);
        background: color-mix(in srgb, var(--background, #ffffff) 96%, white);
      }

      .collection-card-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 0.75rem;
      }

      .item-label {
        font-weight: 600;
        color: var(--foreground, #111827);
      }

      .item-fields {
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
        .item-fields {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class SchemaCollectionPanelComponent {
  private readonly optionCache = new Map<
    string,
    Array<{ value: string; label: string }>
  >();

  @Input() title = '';
  @Input() description = '';
  @Input() items: Array<Record<string, unknown>> = [];
  @Input() fields: BlockFieldDefinition[] = [];
  @Input() addLabel = '+ Add item';
  @Input() emptyText = 'No items added yet.';
  @Input() itemLabel: (index: number, item: Record<string, unknown>) => string =
    (index) => `Item #${index + 1}`;
  @Input() trackBy: (
    item: Record<string, unknown>,
    index: number
  ) => string | number = (_item, index) => index;

  @Output() itemAdded = new EventEmitter<void>();
  @Output() itemRemoved = new EventEmitter<number>();
  @Output() itemFieldChanged = new EventEmitter<{
    index: number;
    key: string;
    value: string | boolean;
  }>();

  fieldValue(item: Record<string, unknown>, fieldKey: string): string {
    const value = this.readPath(item, fieldKey);
    if (typeof value === 'string') {
      return value;
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return '';
  }

  booleanValue(item: Record<string, unknown>, fieldKey: string): boolean {
    return this.readPath(item, fieldKey) === true;
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

  private readPath(model: Record<string, unknown>, fieldKey: string): unknown {
    return fieldKey.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') {
        return undefined;
      }

      return (current as Record<string, unknown>)[segment];
    }, model);
  }
}
