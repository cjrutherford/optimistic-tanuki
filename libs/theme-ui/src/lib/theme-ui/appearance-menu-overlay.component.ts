import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Personality } from '@optimistic-tanuki/theme-lib';

export interface AppearanceMenuOverlayContract {
  controlsId: string;
  personalityPickerId: string;
  theme: 'light' | 'dark';
  accentColor: string;
  currentPersonality: Personality | null;
  showPersonalityPicker: boolean;
  themeToggled: EventEmitter<void>;
  accentColorChanged: EventEmitter<string>;
  personalityPickerToggled: EventEmitter<void>;
  closed: EventEmitter<void>;
  focusFirstElement(): void;
}

@Component({
  selector: 'lib-appearance-menu-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section
      #menu
      class="toggle-container"
      [id]="controlsId"
      role="dialog"
      aria-label="Appearance controls"
      tabindex="-1"
      (keydown)="onKeydown($event)"
    >
      <div class="appearance-menu-heading">
        <span>Appearance</span>
        <button
          #closeButton
          type="button"
          class="appearance-close"
          (click)="$event.stopPropagation(); closed.emit()"
          aria-label="Close appearance controls"
        >
          ×
        </button>
      </div>
      <form>
        <fieldset>
          <legend>Theme settings</legend>
          <div class="personality-selector">
            <button
              class="personality-trigger"
              type="button"
              (click)="
                $event.stopPropagation(); personalityPickerToggled.emit()
              "
              [class.active]="showPersonalityPicker"
              aria-haspopup="dialog"
              [attr.aria-expanded]="showPersonalityPicker"
              [attr.aria-controls]="personalityPickerId"
              aria-label="Select personality"
            >
              <span class="personality-current">
                {{ currentPersonality?.name || 'Classic' }}
              </span>
              <span class="personality-icon">⚙</span>
            </button>
          </div>
          <div class="theme-switch">
            <div class="theme-label">
              <span aria-hidden="true">☀</span>
              <span>Light</span>
            </div>
            <label class="switch">
              <input
                type="checkbox"
                [checked]="theme === 'dark'"
                (change)="themeToggled.emit()"
                [attr.aria-label]="
                  theme === 'dark'
                    ? 'Dark theme selected; switch to light theme'
                    : 'Light theme selected; switch to dark theme'
                "
              />
              <span class="slider round">️</span>
            </label>
            <div class="theme-label">
              <span aria-hidden="true">🌙</span>
              <span>Dark</span>
            </div>
          </div>
          <div class="accent-picker">
            <input
              type="color"
              name="accent-color"
              [ngModel]="accentColor"
              (ngModelChange)="accentColorChanged.emit($event)"
              aria-label="Accent color"
            />
          </div>
        </fieldset>
      </form>
    </section>
  `,
  styleUrls: ['./theme.component.scss'],
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      :host .toggle-container {
        position: static;
        top: auto;
        right: auto;
        left: auto;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        overflow-y: auto;
      }
    `,
  ],
})
export class AppearanceMenuOverlayComponent
  implements AppearanceMenuOverlayContract
{
  @Input() controlsId = '';
  @Input() personalityPickerId = '';
  @Input() theme: 'light' | 'dark' = 'light';
  @Input() accentColor = '#ff4081';
  @Input() currentPersonality: Personality | null = null;
  @Input() showPersonalityPicker = false;

  @Output() themeToggled = new EventEmitter<void>();
  @Output() accentColorChanged = new EventEmitter<string>();
  @Output() personalityPickerToggled = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  @ViewChild('menu', { static: true })
  private menu?: ElementRef<HTMLElement>;
  @ViewChild('closeButton', { static: true })
  private closeButton?: ElementRef<HTMLButtonElement>;

  focusFirstElement(): void {
    this.closeButton?.nativeElement.focus();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closed.emit();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const menu = this.menu?.nativeElement;
    if (!menu) {
      return;
    }

    const focusable = this.getFocusableElements(menu);
    if (focusable.length === 0) {
      event.preventDefault();
      menu.focus();
      return;
    }

    const activeElement = document.activeElement;
    const firstElement = focusable[0];
    const lastElement = focusable[focusable.length - 1];

    if (
      event.shiftKey &&
      (activeElement === firstElement || !menu.contains(activeElement))
    ) {
      event.preventDefault();
      lastElement.focus();
    } else if (
      !event.shiftKey &&
      (activeElement === lastElement || !menu.contains(activeElement))
    ) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  private getFocusableElements(menu: HTMLElement): HTMLElement[] {
    return Array.from(
      menu.querySelectorAll<HTMLElement>(
        [
          'a[href]',
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(', ')
      )
    );
  }
}
