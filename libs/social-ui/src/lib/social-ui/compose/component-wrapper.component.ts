import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
} from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { InjectedComponentInstance } from './interfaces/component-injection.interface';

@Component({
  selector: 'lib-component-wrapper',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div
      class="component-wrapper"
      [class.selected]="isSelected"
      [class.hover]="isHovered"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()"
      (click)="onClick($event)"
    >
      @if (isHovered || isSelected) {
      <div class="component-controls">
        <button
          class="control-btn edit-btn"
          (click)="onEdit($event)"
          title="Edit Properties"
        >
          <mat-icon>edit</mat-icon>
        </button>
        <button
          class="control-btn delete-btn"
          (click)="onDelete($event)"
          title="Delete Component"
        >
          <mat-icon>delete</mat-icon>
        </button>
        <button
          class="control-btn move-up-btn"
          (click)="onMoveUp($event)"
          title="Move Up"
        >
          <mat-icon>keyboard_arrow_up</mat-icon>
        </button>
        <button
          class="control-btn move-down-btn"
          (click)="onMoveDown($event)"
          title="Move Down"
        >
          <mat-icon>keyboard_arrow_down</mat-icon>
        </button>
      </div>
      } @if (isSelected) {
      <div class="component-label">
        {{ componentInstance.componentDef.name }}
      </div>
      }

      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .component-wrapper {
        position: relative;
        border: 2px solid transparent;
        border-radius: 4px;
        transition: all 0.2s ease;
        margin: 0.5rem 0;
      }

      .component-wrapper.hover {
        border-color: var(--accent, #007acc);
        background-color: rgba(0, 122, 204, 0.05);
      }

      .component-wrapper.selected {
        border-color: var(--accent, #007acc);
        background-color: rgba(0, 122, 204, 0.1);
        box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
      }

      .component-controls {
        position: absolute;
        top: -12px;
        right: 8px;
        display: flex;
        gap: 4px;
        z-index: 10;
      }

      .control-btn {
        width: 24px;
        height: 24px;
        border: none;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        font-size: 16px;
        transition: all 0.2s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      }

      .edit-btn {
        background-color: var(--accent, #007acc);
        color: white;
      }

      .edit-btn:hover {
        background-color: var(--accent-dark, #005999);
      }

      .delete-btn {
        background-color: #dc3545;
        color: white;
      }

      .delete-btn:hover {
        background-color: #c82333;
      }

      .move-up-btn,
      .move-down-btn {
        background-color: var(--background, white);
        color: var(--foreground, #333);
        border: 1px solid var(--border-color, #e0e0e0);
      }

      .move-up-btn:hover,
      .move-down-btn:hover {
        background-color: var(--background-secondary, #f8f9fa);
      }

      .component-label {
        position: absolute;
        top: -8px;
        left: 8px;
        background-color: var(--accent, #007acc);
        color: white;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.75rem;
        font-weight: 500;
        z-index: 5;
      }

      .control-btn mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
    `,
  ],
})
export class ComponentWrapperComponent {
  @Input() componentInstance!: InjectedComponentInstance;
  @Input() isSelected = false;
  @Output() editRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() deleteRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() moveUpRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() moveDownRequested = new EventEmitter<InjectedComponentInstance>();
  @Output() selectionChanged = new EventEmitter<InjectedComponentInstance>();

  isHovered = false;

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

  onEdit(event: Event): void {
    event.stopPropagation();
    this.editRequested.emit(this.componentInstance);
  }

  onDelete(event: Event): void {
    event.stopPropagation();
    this.deleteRequested.emit(this.componentInstance);
  }

  onMoveUp(event: Event): void {
    event.stopPropagation();
    this.moveUpRequested.emit(this.componentInstance);
  }

  onMoveDown(event: Event): void {
    event.stopPropagation();
    this.moveDownRequested.emit(this.componentInstance);
  }
}
