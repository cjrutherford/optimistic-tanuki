import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';
import { PREDEFINED_PERSONALITIES } from '@optimistic-tanuki/theme-models';

export interface EditorThemeDraftValue {
  mode?: 'light' | 'dark';
  personalityId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  customCss?: string;
}

export interface EditorThemeFieldChange {
  key: keyof EditorThemeDraftValue;
  value: string;
}

@Component({
  selector: 'app-editor-design-system-panel',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    SelectComponent,
    TextInputComponent,
    TextAreaComponent,
  ],
  template: `
    <div class="design-system-panel" data-design-system-panel>
      <div class="theme-grid">
        <div class="form-group">
          <label for="design-mode">Mode</label>
          <lib-select
            id="design-mode"
            [ngModel]="theme.mode || 'light'"
            (ngModelChange)="emitField('mode', $event)"
            [options]="modeOptions"
          ></lib-select>
        </div>

        <div class="form-group full-width">
          <label>Personality</label>
          <div class="theme-personality-grid">
            @for (personality of personalities; track personality.id) {
            <button
              type="button"
              class="theme-personality-chip"
              [class.selected]="theme.personalityId === personality.id"
              (click)="emitField('personalityId', personality.id)"
            >
              <span>{{ personality.name }}</span>
              <small>{{ personality.category }}</small>
            </button>
            }
          </div>
        </div>

        <div class="form-group">
          <label for="design-primary">Primary Color</label>
          <div class="color-input-group">
            <input
              type="color"
              id="design-primary"
              [ngModel]="theme.primaryColor || '#3f51b5'"
              (ngModelChange)="emitField('primaryColor', $event)"
              class="color-picker"
            />
            <lib-text-input
              [ngModel]="theme.primaryColor || ''"
              (ngModelChange)="emitField('primaryColor', $event)"
              placeholder="#3f51b5"
              type="text"
            ></lib-text-input>
          </div>
        </div>

        @if (showExtendedPalette) {
        <div class="form-group">
          <label for="design-secondary">Secondary Color</label>
          <div class="color-input-group">
            <input
              type="color"
              id="design-secondary"
              [ngModel]="theme.secondaryColor || '#ff4081'"
              (ngModelChange)="emitField('secondaryColor', $event)"
              class="color-picker"
            />
            <lib-text-input
              [ngModel]="theme.secondaryColor || ''"
              (ngModelChange)="emitField('secondaryColor', $event)"
              placeholder="#ff4081"
              type="text"
            ></lib-text-input>
          </div>
        </div>

        <div class="form-group">
          <label for="design-background">Background Color</label>
          <div class="color-input-group">
            <input
              type="color"
              id="design-background"
              [ngModel]="theme.backgroundColor || '#ffffff'"
              (ngModelChange)="emitField('backgroundColor', $event)"
              class="color-picker"
            />
            <lib-text-input
              [ngModel]="theme.backgroundColor || ''"
              (ngModelChange)="emitField('backgroundColor', $event)"
              placeholder="#ffffff"
              type="text"
            ></lib-text-input>
          </div>
        </div>

        <div class="form-group">
          <label for="design-text">Text Color</label>
          <div class="color-input-group">
            <input
              type="color"
              id="design-text"
              [ngModel]="theme.textColor || '#111827'"
              (ngModelChange)="emitField('textColor', $event)"
              class="color-picker"
            />
            <lib-text-input
              [ngModel]="theme.textColor || ''"
              (ngModelChange)="emitField('textColor', $event)"
              placeholder="#111827"
              type="text"
            ></lib-text-input>
          </div>
        </div>
        } @if (showTypographyFields) {
        <div class="form-group full-width">
          <label for="design-font">Font Family</label>
          <lib-text-input
            id="design-font"
            [ngModel]="theme.fontFamily || ''"
            (ngModelChange)="emitField('fontFamily', $event)"
            placeholder='"IBM Plex Sans", sans-serif'
            type="text"
          ></lib-text-input>
        </div>
        } @if (showCustomCssField) {
        <div class="form-group full-width">
          <label for="design-css">Custom CSS</label>
          <lib-text-area
            id="design-css"
            [rows]="8"
            [ngModel]="theme.customCss || ''"
            (ngModelChange)="emitField('customCss', $event)"
            placeholder="/* Add custom CSS here */"
          ></lib-text-area>
        </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      .theme-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 1.5rem;
      }

      .form-group {
        display: grid;
        gap: 0.5rem;
      }

      .form-group.full-width {
        grid-column: 1 / -1;
      }

      label {
        display: block;
        font-weight: 500;
        color: var(--foreground, #111827);
      }

      .theme-personality-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 0.65rem;
      }

      .theme-personality-chip {
        display: grid;
        gap: 0.2rem;
        padding: 0.8rem 0.9rem;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 14px;
        background: var(--surface, #ffffff);
        color: var(--foreground, #111827);
        text-align: left;
        cursor: pointer;
        transition: border-color 0.2s ease, transform 0.2s ease,
          box-shadow 0.2s ease;
      }

      .theme-personality-chip small {
        color: var(--foreground-secondary, #666);
        text-transform: capitalize;
      }

      .theme-personality-chip:hover {
        transform: translateY(-1px);
        border-color: var(--accent, #007acc);
      }

      .theme-personality-chip.selected {
        border-color: var(--accent, #007acc);
        box-shadow: 0 0 0 2px
          color-mix(in srgb, var(--accent, #007acc) 18%, transparent);
        background: color-mix(
          in srgb,
          var(--accent, #007acc) 8%,
          var(--surface, #ffffff)
        );
      }

      .color-input-group {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }

      .color-picker {
        width: 60px;
        height: 40px;
        border: 1px solid var(--border-color, #e0e0e0);
        border-radius: 4px;
        cursor: pointer;
        flex-shrink: 0;
      }

      .color-picker::-webkit-color-swatch-wrapper {
        padding: 2px;
      }

      .color-picker::-webkit-color-swatch,
      .color-picker::-moz-color-swatch {
        border: none;
        border-radius: 2px;
      }

      lib-text-input {
        flex: 1;
      }

      @media (max-width: 768px) {
        .theme-grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class EditorDesignSystemPanelComponent {
  @Input() theme: EditorThemeDraftValue = {};
  @Input() showExtendedPalette = false;
  @Input() showTypographyFields = false;
  @Input() showCustomCssField = false;

  @Output() themeFieldChange = new EventEmitter<EditorThemeFieldChange>();

  readonly personalities = PREDEFINED_PERSONALITIES;
  readonly modeOptions = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  emitField(key: keyof EditorThemeDraftValue, value: string): void {
    this.themeFieldChange.emit({ key, value });
  }
}
