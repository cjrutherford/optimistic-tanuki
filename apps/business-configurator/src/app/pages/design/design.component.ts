import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BusinessConfigStateService } from '../../state/business-config-state.service';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-design',
  template: `
    <div class="step-container">
      <header class="step-header">
        <h1>Design</h1>
        <p>Customize the look and feel</p>
      </header>

      <section class="design-section">
        <h2>Theme</h2>
        <div class="theme-options">
          <button
            class="theme-btn"
            [class.active]="theme.mode === 'light'"
            (click)="setThemeMode('light')"
          >
            <span class="theme-icon">☀️</span>
            Light
          </button>
          <button
            class="theme-btn"
            [class.active]="theme.mode === 'dark'"
            (click)="setThemeMode('dark')"
          >
            <span class="theme-icon">🌙</span>
            Dark
          </button>
        </div>
      </section>

      <section class="design-section">
        <h2>Primary Color</h2>
        <div class="color-options">
          @for (color of colorPresets; track color) {
          <button
            class="color-btn"
            [style.background]="color"
            [class.active]="theme.primaryColor === color"
            (click)="setPrimaryColor(color)"
          ></button>
          }
        </div>
        <div class="custom-color">
          <label>Custom:</label>
          <input
            type="color"
            [value]="theme.primaryColor"
            (input)="setPrimaryColor($any($event.target).value)"
          />
        </div>
      </section>

      <section class="design-section">
        <h2>Personality</h2>
        <select
          [value]="theme.personalityId"
          (change)="setPersonality($any($event.target).value)"
        >
          <option value="professional">Professional</option>
          <option value="friendly">Friendly</option>
          <option value="bold">Bold</option>
          <option value="minimal">Minimal</option>
          <option value="creative">Creative</option>
        </select>
      </section>

      <section class="design-section">
        <h2>Landing Page Layout</h2>
        <div class="layout-options">
          <button
            class="layout-btn"
            [class.active]="landingLayout === 'single-column'"
            (click)="setLandingLayout('single-column')"
          >
            <div class="layout-preview single"></div>
            Single Column
          </button>
          <button
            class="layout-btn"
            [class.active]="landingLayout === 'split'"
            (click)="setLandingLayout('split')"
          >
            <div class="layout-preview split"></div>
            Split
          </button>
          <button
            class="layout-btn"
            [class.active]="landingLayout === 'grid'"
            (click)="setLandingLayout('grid')"
          >
            <div class="layout-preview grid"></div>
            Grid
          </button>
        </div>
      </section>

      <section class="design-section">
        <h2>Landing Page Sections</h2>
        <p class="section-hint">Toggle sections and drag to reorder</p>
        <div class="sections-list">
          @for (section of sections; track section.id) {
          <div class="section-item" [class.disabled]="!section.enabled">
            <input
              type="checkbox"
              [checked]="section.enabled"
              (change)="toggleSection(section.id)"
            />
            <span>{{ section.title }}</span>
          </div>
          }
        </div>
      </section>

      <div class="form-actions">
        <button class="secondary" (click)="goBack()">Back</button>
        <button (click)="continue()">Continue</button>
      </div>
    </div>
  `,
  styles: [
    `
      .step-container {
        max-width: 700px;
        margin: 0 auto;
        padding: 2rem;
      }
      .step-header {
        margin-bottom: 2rem;
      }
      .step-header h1 {
        font-size: 1.75rem;
        font-weight: 600;
      }
      .step-header p {
        color: var(--muted-foreground);
      }
      .design-section {
        margin-bottom: 2rem;
      }
      .design-section h2 {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 0.75rem;
      }
      .theme-options {
        display: flex;
        gap: 0.75rem;
      }
      .theme-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--background);
        cursor: pointer;
      }
      .theme-btn.active {
        border-color: var(--primary);
        background: var(--primary / 10%);
      }
      .color-options {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
      }
      .color-btn {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50%;
        border: 2px solid transparent;
        cursor: pointer;
      }
      .color-btn.active {
        border-color: var(--foreground);
        box-shadow: 0 0 0 2px var(--background), 0 0 0 4px var(--foreground);
      }
      .custom-color {
        margin-top: 0.75rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .custom-color input {
        width: 3rem;
        height: 2rem;
        border: none;
        cursor: pointer;
      }
      .design-section select {
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        background: var(--background);
        width: 100%;
        max-width: 300px;
      }
      .layout-options {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
      }
      .layout-btn {
        padding: 1rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        background: var(--background);
        cursor: pointer;
      }
      .layout-btn.active {
        border-color: var(--primary);
      }
      .layout-preview {
        height: 3rem;
        background: var(--border);
        border-radius: 4px;
        margin-bottom: 0.5rem;
      }
      .layout-preview.single {
        background: linear-gradient(
          90deg,
          var(--border) 0%,
          var(--border) 30%,
          var(--border) 0%,
          var(--border) 30%
        );
      }
      .layout-preview.split {
        background: linear-gradient(90deg, var(--border) 50%, transparent 50%);
      }
      .layout-preview.grid {
        background: repeating-linear-gradient(
          90deg,
          var(--border) 0,
          var(--border) 30%,
          transparent 30%,
          transparent 60%
        );
      }
      .section-hint {
        font-size: 0.8125rem;
        color: var(--muted-foreground);
        margin-bottom: 0.75rem;
      }
      .sections-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .section-item {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.625rem 0.875rem;
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
      }
      .section-item.disabled {
        opacity: 0.5;
      }
      .form-actions {
        margin-top: 2rem;
        display: flex;
        gap: 0.75rem;
        justify-content: flex-end;
      }
      .form-actions button {
        padding: 0.75rem 1.5rem;
        border-radius: var(--radius-md);
        font-weight: 500;
        cursor: pointer;
        border: 1px solid var(--border);
        background: var(--background);
      }
      .form-actions button:not(.secondary) {
        background: var(--primary);
        color: var(--primary-foreground);
        border: none;
      }
    `,
  ],
})
export class DesignComponent {
  private readonly state = inject(BusinessConfigStateService);

  readonly colorPresets = [
    '#1f7a63',
    '#2563eb',
    '#7c3aed',
    '#dc2626',
    '#ea580c',
    '#16a34a',
    '#0891b2',
    '#475569',
  ];

  get theme() {
    return this.state.config().theme;
  }

  get landingLayout() {
    return this.state.config().landingPage.layout;
  }

  get sections() {
    return this.state.config().landingPage.sections;
  }

  setThemeMode(mode: 'light' | 'dark'): void {
    this.state.updateTheme({ mode });
  }

  setPrimaryColor(color: string): void {
    this.state.updateTheme({ primaryColor: color });
  }

  setPersonality(personalityId: string): void {
    this.state.updateTheme({ personalityId });
  }

  setLandingLayout(layout: 'single-column' | 'split' | 'grid'): void {
    this.state.updateLandingLayout(layout);
  }

  toggleSection(sectionId: string): void {
    this.state.toggleSection(sectionId);
  }

  goBack(): void {
    this.state.prevStep();
  }

  continue(): void {
    this.state.nextStep();
  }
}
