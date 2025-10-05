import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ThemeService, ColorPalette, PREDEFINED_PALETTES } from '@optimistic-tanuki/theme-lib';

@Component({
  selector: 'theme-palette-manager',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="palette-manager">
      <h3>Palette Manager</h3>
      
      <div class="manager-controls">
        <button class="action-btn" (click)="showCreateForm()">
          <span class="icon">+</span> Create New Palette
        </button>
      </div>

      @if (isCreating() || isEditing()) {
        <div class="palette-form-container">
          <h4>{{ isCreating() ? 'Create New Palette' : 'Edit Palette' }}</h4>
          <form [formGroup]="paletteForm" (ngSubmit)="savePalette()">
            <div class="form-grid">
              <div class="form-group">
                <label for="name">Palette Name *</label>
                <input 
                  id="name"
                  type="text" 
                  formControlName="name"
                  placeholder="My Custom Palette"
                  [class.error]="paletteForm.get('name')?.invalid && paletteForm.get('name')?.touched"
                />
                @if (paletteForm.get('name')?.hasError('required') && paletteForm.get('name')?.touched) {
                  <span class="error-msg">Name is required</span>
                }
              </div>

              <div class="form-group full-width">
                <label for="description">Description *</label>
                <textarea 
                  id="description"
                  formControlName="description"
                  placeholder="A brief description of the palette..."
                  rows="2"
                  [class.error]="paletteForm.get('description')?.invalid && paletteForm.get('description')?.touched"
                ></textarea>
                @if (paletteForm.get('description')?.hasError('required') && paletteForm.get('description')?.touched) {
                  <span class="error-msg">Description is required</span>
                }
              </div>

              <div class="form-group">
                <label for="accent">Accent Color *</label>
                <div class="color-input-group">
                  <input 
                    id="accent"
                    type="color" 
                    formControlName="accent"
                  />
                  <input 
                    type="text" 
                    [value]="paletteForm.get('accent')?.value"
                    (input)="updateColorFromText('accent', $event)"
                    placeholder="#3f51b5"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="complementary">Complementary Color *</label>
                <div class="color-input-group">
                  <input 
                    id="complementary"
                    type="color" 
                    formControlName="complementary"
                  />
                  <input 
                    type="text" 
                    [value]="paletteForm.get('complementary')?.value"
                    (input)="updateColorFromText('complementary', $event)"
                    placeholder="#c0af4b"
                  />
                </div>
              </div>

              <div class="form-group">
                <label for="tertiary">Tertiary Color (Optional)</label>
                <div class="color-input-group">
                  <input 
                    id="tertiary"
                    type="color" 
                    formControlName="tertiary"
                  />
                  <input 
                    type="text" 
                    [value]="paletteForm.get('tertiary')?.value"
                    (input)="updateColorFromText('tertiary', $event)"
                    placeholder="#7e57c2"
                  />
                </div>
              </div>

              <div class="form-group">
                <label>Background Colors</label>
                <div class="color-pair">
                  <div class="color-input-group">
                    <label for="bgLight">Light</label>
                    <input 
                      id="bgLight"
                      type="color" 
                      formControlName="backgroundLight"
                    />
                    <input 
                      type="text" 
                      [value]="paletteForm.get('backgroundLight')?.value"
                      (input)="updateColorFromText('backgroundLight', $event)"
                      placeholder="#ffffff"
                    />
                  </div>
                  <div class="color-input-group">
                    <label for="bgDark">Dark</label>
                    <input 
                      id="bgDark"
                      type="color" 
                      formControlName="backgroundDark"
                    />
                    <input 
                      type="text" 
                      [value]="paletteForm.get('backgroundDark')?.value"
                      (input)="updateColorFromText('backgroundDark', $event)"
                      placeholder="#1a1a2e"
                    />
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>Foreground Colors</label>
                <div class="color-pair">
                  <div class="color-input-group">
                    <label for="fgLight">Light</label>
                    <input 
                      id="fgLight"
                      type="color" 
                      formControlName="foregroundLight"
                    />
                    <input 
                      type="text" 
                      [value]="paletteForm.get('foregroundLight')?.value"
                      (input)="updateColorFromText('foregroundLight', $event)"
                      placeholder="#212121"
                    />
                  </div>
                  <div class="color-input-group">
                    <label for="fgDark">Dark</label>
                    <input 
                      id="fgDark"
                      type="color" 
                      formControlName="foregroundDark"
                    />
                    <input 
                      type="text" 
                      [value]="paletteForm.get('foregroundDark')?.value"
                      (input)="updateColorFromText('foregroundDark', $event)"
                      placeholder="#ffffff"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="preview-section">
              <h5>Preview</h5>
              <div class="palette-preview">
                <div class="color-swatch large" [style.background-color]="paletteForm.get('accent')?.value" title="Accent"></div>
                <div class="color-swatch large" [style.background-color]="paletteForm.get('complementary')?.value" title="Complementary"></div>
                @if (paletteForm.get('tertiary')?.value) {
                  <div class="color-swatch large" [style.background-color]="paletteForm.get('tertiary')?.value" title="Tertiary"></div>
                }
              </div>
            </div>

            <div class="form-actions">
              <button type="submit" class="save-btn" [disabled]="paletteForm.invalid">
                {{ isCreating() ? 'Create Palette' : 'Save Changes' }}
              </button>
              <button type="button" class="cancel-btn" (click)="cancelEdit()">
                Cancel
              </button>
            </div>
          </form>
        </div>
      }

      <div class="palettes-list">
        <h4>Existing Palettes</h4>
        <div class="palette-grid">
          @for (palette of customPalettes(); track palette.name) {
            <div class="palette-card">
              <div class="palette-colors">
                <div class="color-swatch" [style.background-color]="palette.accent" title="Accent"></div>
                <div class="color-swatch" [style.background-color]="palette.complementary" title="Complementary"></div>
                @if (palette.tertiary) {
                  <div class="color-swatch" [style.background-color]="palette.tertiary" title="Tertiary"></div>
                }
              </div>
              <div class="palette-info">
                <h5>{{ palette.name }}</h5>
                <p>{{ palette.description }}</p>
              </div>
              <div class="palette-actions">
                <button class="icon-btn" (click)="editPalette(palette)" title="Edit">
                  <span class="icon">✏️</span>
                </button>
                <button class="icon-btn" (click)="applyPalette(palette)" title="Apply">
                  <span class="icon">✓</span>
                </button>
                <button class="icon-btn danger" (click)="deletePalette(palette)" title="Delete">
                  <span class="icon">🗑️</span>
                </button>
              </div>
            </div>
          }
          @if (customPalettes().length === 0) {
            <p class="empty-state">No custom palettes yet. Create your first one!</p>
          }
        </div>
      </div>

      <div class="predefined-palettes">
        <h4>Predefined Palettes (View Only)</h4>
        <div class="palette-grid">
          @for (palette of predefinedPalettes; track palette.name) {
            <div class="palette-card readonly">
              <div class="palette-colors">
                <div class="color-swatch" [style.background-color]="palette.accent" title="Accent"></div>
                <div class="color-swatch" [style.background-color]="palette.complementary" title="Complementary"></div>
                @if (palette.tertiary) {
                  <div class="color-swatch" [style.background-color]="palette.tertiary" title="Tertiary"></div>
                }
              </div>
              <div class="palette-info">
                <h5>{{ palette.name }}</h5>
                <p>{{ palette.description }}</p>
              </div>
              <div class="palette-actions">
                <button class="icon-btn" (click)="applyPalette(palette)" title="Apply">
                  <span class="icon">✓</span>
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./palette-manager.component.scss']
})
export class PaletteManagerComponent {
  private fb = inject(FormBuilder);
  themeService = inject(ThemeService);
  
  predefinedPalettes = PREDEFINED_PALETTES;
  customPalettes = signal<ColorPalette[]>(this.loadCustomPalettes());
  
  isCreating = signal(false);
  isEditing = signal(false);
  editingPalette = signal<ColorPalette | null>(null);
  
  paletteForm: FormGroup;

  constructor() {
    this.paletteForm = this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      accent: ['#3f51b5', Validators.required],
      complementary: ['#c0af4b', Validators.required],
      tertiary: ['#7e57c2'],
      backgroundLight: ['#ffffff'],
      backgroundDark: ['#1a1a2e'],
      foregroundLight: ['#212121'],
      foregroundDark: ['#ffffff']
    });
  }

  showCreateForm() {
    this.isCreating.set(true);
    this.isEditing.set(false);
    this.editingPalette.set(null);
    this.paletteForm.reset({
      accent: '#3f51b5',
      complementary: '#c0af4b',
      tertiary: '#7e57c2',
      backgroundLight: '#ffffff',
      backgroundDark: '#1a1a2e',
      foregroundLight: '#212121',
      foregroundDark: '#ffffff'
    });
  }

  editPalette(palette: ColorPalette) {
    this.isCreating.set(false);
    this.isEditing.set(true);
    this.editingPalette.set(palette);
    
    this.paletteForm.patchValue({
      name: palette.name,
      description: palette.description,
      accent: palette.accent,
      complementary: palette.complementary,
      tertiary: palette.tertiary || '#7e57c2',
      backgroundLight: palette.background?.light || '#ffffff',
      backgroundDark: palette.background?.dark || '#1a1a2e',
      foregroundLight: palette.foreground?.light || '#212121',
      foregroundDark: palette.foreground?.dark || '#ffffff'
    });
  }

  cancelEdit() {
    this.isCreating.set(false);
    this.isEditing.set(false);
    this.editingPalette.set(null);
    this.paletteForm.reset();
  }

  savePalette() {
    if (this.paletteForm.invalid) {
      return;
    }

    const formValue = this.paletteForm.value;
    const newPalette: ColorPalette = {
      name: formValue.name,
      description: formValue.description,
      accent: formValue.accent,
      complementary: formValue.complementary,
      tertiary: formValue.tertiary || undefined,
      background: {
        light: formValue.backgroundLight,
        dark: formValue.backgroundDark
      },
      foreground: {
        light: formValue.foregroundLight,
        dark: formValue.foregroundDark
      }
    };

    const currentPalettes = this.customPalettes();
    
    if (this.isEditing()) {
      // Update existing palette
      const index = currentPalettes.findIndex(p => p.name === this.editingPalette()?.name);
      if (index !== -1) {
        currentPalettes[index] = newPalette;
      }
    } else {
      // Add new palette
      currentPalettes.push(newPalette);
    }

    this.saveCustomPalettes(currentPalettes);
    this.customPalettes.set([...currentPalettes]);
    this.cancelEdit();
  }

  deletePalette(palette: ColorPalette) {
    if (confirm(`Are you sure you want to delete "${palette.name}"?`)) {
      const currentPalettes = this.customPalettes().filter(p => p.name !== palette.name);
      this.saveCustomPalettes(currentPalettes);
      this.customPalettes.set(currentPalettes);
    }
  }

  applyPalette(palette: ColorPalette) {
    this.themeService.setPalette(palette.name);
  }

  updateColorFromText(fieldName: string, event: Event) {
    const input = event.target as HTMLInputElement;
    const color = input.value;
    if (color.match(/^#[0-9A-Fa-f]{6}$/)) {
      this.paletteForm.patchValue({ [fieldName]: color });
    }
  }

  private loadCustomPalettes(): ColorPalette[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    
    const saved = localStorage.getItem('customPalettes');
    return saved ? JSON.parse(saved) : [];
  }

  private saveCustomPalettes(palettes: ColorPalette[]) {
    if (typeof localStorage === 'undefined') {
      return;
    }
    
    localStorage.setItem('customPalettes', JSON.stringify(palettes));
  }
}
