import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextInputComponent } from '@optimistic-tanuki/form-ui';

@Component({
  selector: 'app-schema-string-list-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, TextInputComponent],
  template: `
    <div class="string-list-panel" data-schema-string-list-panel>
      @if (title || description) {
      <div class="panel-meta">
        @if (title) {
        <strong>{{ title }}</strong>
        } @if (description) {
        <p>{{ description }}</p>
        }
      </div>
      }

      <div class="string-list">
        @for (item of items; track $index) {
        <div class="string-list-item">
          <lib-text-input
            [ngModel]="item"
            (ngModelChange)="itemChanged.emit({ index: $index, value: $event })"
            [placeholder]="itemPlaceholder"
            type="text"
          ></lib-text-input>
          <button
            type="button"
            class="tag-remove"
            (click)="itemRemoved.emit($index)"
          >
            Remove
          </button>
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
      .string-list-panel {
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

      .string-list {
        display: grid;
        gap: 0.75rem;
      }

      .string-list-item {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 0.75rem;
        align-items: center;
      }
    `,
  ],
})
export class SchemaStringListPanelComponent {
  @Input() title = '';
  @Input() description = '';
  @Input() items: string[] = [];
  @Input() addLabel = '+ Add item';
  @Input() emptyText = 'No items added yet.';
  @Input() itemPlaceholder = '';

  @Output() itemAdded = new EventEmitter<void>();
  @Output() itemRemoved = new EventEmitter<number>();
  @Output() itemChanged = new EventEmitter<{ index: number; value: string }>();
}
