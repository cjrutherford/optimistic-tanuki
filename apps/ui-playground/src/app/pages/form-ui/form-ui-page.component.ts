import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CheckboxComponent,
  ImageUploadComponent,
  RadioButtonComponent,
  SelectComponent,
  TextAreaComponent,
  TextInputComponent,
} from '@optimistic-tanuki/form-ui';
import {
  ElementCardComponent,
  type ElementConfig,
  IndexChipComponent,
  PageShellComponent,
  type PlaygroundElement,
} from '../../shared';

@Component({
  selector: 'pg-form-ui-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PageShellComponent,
    ElementCardComponent,
    IndexChipComponent,
    TextInputComponent,
    TextAreaComponent,
    CheckboxComponent,
    RadioButtonComponent,
    SelectComponent,
    ImageUploadComponent,
  ],
  template: `
    <pg-page-shell
      packageName="@optimistic-tanuki/form-ui"
      title="Form UI"
      description="Form input components for building accessible, consistent forms."
      [importSnippet]="importSnippet"
    >
      <ng-container slot="index">
        @for (el of elements; track el.id) {
        <pg-index-chip [id]="el.id" [label]="el.selector" />
        }
      </ng-container>

      @for (el of elements; track el.id) {
      <pg-element-card
        [element]="el"
        [config]="configs[el.id]"
        (configChange)="configs[el.id] = $event"
        (reset)="resetConfig(el.id)"
      >
        @switch (el.id) { @case ('text-input') {
        <div class="preview-padded">
          <lib-text-input
            [label]="$any(configs['text-input']['label'])"
            [placeholder]="$any(configs['text-input']['placeholder'])"
            [disabled]="$any(configs['text-input']['disabled'])"
            [(ngModel)]="textInputValue"
          />
        </div>
        } @case ('text-area') {
        <div class="preview-padded">
          <lib-text-area
            [label]="$any(configs['text-area']['label'])"
            [placeholder]="$any(configs['text-area']['placeholder'])"
            [disabled]="$any(configs['text-area']['disabled'])"
            [(ngModel)]="textAreaValue"
          />
        </div>
        } @case ('checkbox') {
        <div class="preview-padded">
          <lib-checkbox
            [label]="$any(configs['checkbox']['label'])"
            [disabled]="$any(configs['checkbox']['disabled'])"
            [(ngModel)]="checkboxValue"
          />
        </div>
        } @case ('radio-button') {
        <div class="preview-padded">
          <lib-radio-button
            [label]="$any(configs['radio-button']['label'])"
            [layout]="$any(configs['radio-button']['layout'])"
            [disabled]="$any(configs['radio-button']['disabled'])"
            [options]="radioOptions"
            [selected]="radioValue"
            (selectedValue)="radioValue = $event"
          />
        </div>
        } @case ('select') {
        <div class="preview-padded">
          <lib-select
            [options]="selectOptions"
            [disabled]="$any(configs['select']['disabled'])"
            [(ngModel)]="selectValue"
          />
        </div>
        } @case ('image-upload') {
        <div class="preview-padded">
          <lib-image-upload
            [currentImage]="$any(configs['image-upload']['currentImage'])"
            (imageUpload)="uploadedImage = $event"
          />
          @if (uploadedImage) {
          <p class="meta-copy">Upload event captured and preview updated.</p>
          }
        </div>
        } }
      </pg-element-card>
      }
    </pg-page-shell>
  `,
  styles: [
    `
      .preview-padded {
        padding: 1.5rem;
        min-height: 200px;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .meta-copy {
        margin: 0;
        color: var(--muted);
        font-size: 0.85rem;
      }
    `,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormUiPageComponent {
  readonly importSnippet = `import { TextInputComponent, TextAreaComponent, CheckboxComponent, RadioButtonComponent, SelectComponent, ImageUploadComponent } from '@optimistic-tanuki/form-ui';`;
  configs: Record<string, ElementConfig> = {};

  textInputValue = '';
  textAreaValue = '';
  checkboxValue = false;
  radioValue: string | number = 'email';
  selectValue = 'option1';
  uploadedImage: string | null = null;

  readonly radioOptions = [
    { label: 'Email', value: 'email' },
    { label: 'SMS', value: 'sms' },
    { label: 'Push', value: 'push' },
  ];
  readonly selectOptions = [
    { value: '', label: 'Choose a personality' },
    { value: 'option1', label: 'Classic' },
    { value: 'option2', label: 'Bold' },
    { value: 'option3', label: 'Soft Touch' },
  ];

  readonly elements: PlaygroundElement[] = [
    {
      id: 'text-input',
      title: 'Text Input',
      headline: 'Single-line text field',
      importName: 'TextInputComponent',
      selector: 'lib-text-input',
      summary: 'Text input field with label and validation support.',
      props: [
        { name: 'label', type: 'string', defaultValue: "'Label'", description: 'Input label text.' },
        { name: 'placeholder', type: 'string', defaultValue: "'Enter text...'", description: 'Placeholder text.' },
        { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Disables the input.' },
      ],
    },
    {
      id: 'text-area',
      title: 'Text Area',
      headline: 'Multi-line text field',
      importName: 'TextAreaComponent',
      selector: 'lib-text-area',
      summary: 'Multi-line textarea for longer content.',
      props: [
        { name: 'label', type: 'string', defaultValue: "'Label'", description: 'Textarea label.' },
        { name: 'placeholder', type: 'string', defaultValue: "'Enter text...'", description: 'Placeholder text.' },
        { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Disables the textarea.' },
      ],
    },
    {
      id: 'checkbox',
      title: 'Checkbox',
      headline: 'Boolean toggle input',
      importName: 'CheckboxComponent',
      selector: 'lib-checkbox',
      summary: 'Checkbox for boolean values.',
      props: [
        { name: 'label', type: 'string', defaultValue: "'Check me'", description: 'Checkbox label.' },
        { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Disables the checkbox.' },
      ],
    },
    {
      id: 'radio-button',
      title: 'Radio Button',
      headline: 'Single-choice selection group',
      importName: 'RadioButtonComponent',
      selector: 'lib-radio-button',
      summary: 'Selectable option group with layout variants.',
      props: [
        { name: 'label', type: 'string', defaultValue: "'Preferred channel'", description: 'Field label.' },
        { name: 'layout', type: 'string', defaultValue: "'vertical'", description: 'Layout variant.', options: ['vertical', 'horizontal', 'grid'] },
        { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Disables the radio group.' },
      ],
    },
    {
      id: 'select',
      title: 'Select',
      headline: 'Single-value dropdown input',
      importName: 'SelectComponent',
      selector: 'lib-select',
      summary: 'Dropdown selector for compact option lists.',
      props: [
        { name: 'disabled', type: 'boolean', defaultValue: 'false', description: 'Disables the select input.' },
      ],
    },
    {
      id: 'image-upload',
      title: 'Image Upload',
      headline: 'Drag-and-drop media input',
      importName: 'ImageUploadComponent',
      selector: 'lib-image-upload',
      summary: 'Dropzone with preview support for avatars, covers, and attachments.',
      props: [
        { name: 'currentImage', type: 'string', defaultValue: "''", description: 'Optional initial image preview.' },
      ],
    },
  ];

  constructor() {
    this.initConfigs();
  }

  private initConfigs(): void {
    for (const el of this.elements) {
      const cfg: ElementConfig = {};
      for (const prop of el.props) {
        cfg[prop.name] = this.parseDefault(prop);
      }
      this.configs[el.id] = cfg;
    }
  }

  private parseDefault(prop: { type: string; defaultValue: string }): number | string | boolean {
    const value = prop.defaultValue;
    if (prop.type === 'boolean') return value === 'true';
    if (prop.type === 'number') return parseFloat(value) || 0;
    if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1);
    return value;
  }

  resetConfig(id: string): void {
    const element = this.elements.find((entry) => entry.id === id);
    if (!element) return;

    const cfg: ElementConfig = {};
    for (const prop of element.props) {
      cfg[prop.name] = this.parseDefault(prop);
    }
    this.configs[id] = cfg;
  }
}
