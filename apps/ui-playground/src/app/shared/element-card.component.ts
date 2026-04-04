import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';

export type PlaygroundProp = {
  name: string;
  type: string;
  defaultValue: string;
  description: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
};

export type PlaygroundElement = {
  id: string;
  title: string;
  headline: string;
  importName: string;
  selector: string;
  summary: string;
  props: PlaygroundProp[];
};

export type ElementConfig = Record<string, number | string | boolean>;

@Component({
  selector: 'pg-element-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <article class="element-card" [id]="element.id">
      <header class="element-header">
        <div class="headline-group">
          <p class="element-kicker">{{ element.title }}</p>
          <h2>{{ element.headline }}</h2>
          <p>{{ element.summary }}</p>
        </div>

        <div class="signature">
          <span class="signature-label">Export</span>
          <strong>{{ element.importName }}</strong>
          <code>{{ element.selector }}</code>
        </div>
      </header>

      <div class="preview-grid">
        <section class="preview-pane">
          <div class="pane-heading">
            <span class="pane-kicker">Preview</span>
            <h3>Rendered State</h3>
          </div>
          <div class="preview-stage">
            <ng-content></ng-content>
          </div>
        </section>

        <section class="doc-pane">
          <div class="controls-panel">
            <header class="controls-header">
              <div>
                <span class="controls-title">Configure</span>
                <p class="controls-copy">
                  Adjust exposed inputs and inspect the generated usage.
                </p>
              </div>
              <button class="reset-btn" (click)="onReset()">Reset</button>
            </header>
            <div class="controls-grid">
              @for (prop of element.props; track prop.name) {
              <div class="control-row">
                <label class="control-label">{{ prop.name }}</label>
                @if (prop.type === 'boolean') {
                <label class="toggle">
                  <input
                    type="checkbox"
                    [checked]="$any(config[prop.name])"
                    (change)="
                      updateProp(prop.name, $any($event.target).checked)
                    "
                  />
                  <span class="toggle-slider"></span>
                </label>
                } @else if (prop.options) {
                <select
                  class="control-select"
                  [ngModel]="config[prop.name]"
                  (ngModelChange)="updateProp(prop.name, $event)"
                >
                  @for (opt of prop.options; track opt) {
                  <option [value]="opt">{{ opt }}</option>
                  }
                </select>
                } @else if (prop.type === 'number' && prop.min !== undefined) {
                <div class="slider-group">
                  <input
                    type="range"
                    class="control-slider"
                    [min]="prop.min"
                    [max]="prop.max"
                    [step]="prop.step"
                    [ngModel]="draftConfig[prop.name] ?? config[prop.name]"
                    (input)="
                      updateDraftProp(prop.name, +$any($event.target).value)
                    "
                    (change)="commitDraftProp(prop.name)"
                  />
                  <span class="slider-value">{{
                    draftConfig[prop.name] ?? config[prop.name]
                  }}</span>
                </div>
                } @else {
                <input
                  type="text"
                  class="control-input"
                  [ngModel]="config[prop.name]"
                  (ngModelChange)="updateProp(prop.name, $event)"
                />
                }
              </div>
              }
            </div>
          </div>

          <section class="snippet-panel">
            <div class="pane-heading">
              <span class="pane-kicker">Usage</span>
              <h3>Implementation Snippet</h3>
            </div>
            <pre class="usage-snippet"><code>{{ generateUsage() }}</code></pre>
          </section>

          <section class="inputs-panel">
            <div class="pane-heading">
              <span class="pane-kicker">Inputs</span>
              <h3>Reference Surface</h3>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Input</th>
                  <th>Type</th>
                  <th>Default</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                @for (prop of element.props; track prop.name) {
                <tr>
                  <td data-label="Input">
                    <code>{{ prop.name }}</code>
                  </td>
                  <td data-label="Type">
                    <code>{{ prop.type }}</code>
                  </td>
                  <td data-label="Default">
                    <code>{{ prop.defaultValue }}</code>
                  </td>
                  <td data-label="Notes">{{ prop.description }}</td>
                </tr>
                }
              </tbody>
            </table>
          </section>
        </section>
      </div>
    </article>
  `,
  styleUrl: './element-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ElementCardComponent implements OnChanges {
  @Input() element!: PlaygroundElement;
  @Input() config: ElementConfig = {};
  @Output() configChange = new EventEmitter<ElementConfig>();
  @Output() reset = new EventEmitter<void>();
  protected draftConfig: ElementConfig = {};

  ngOnChanges(): void {
    this.draftConfig = { ...this.config };
  }

  updateProp(name: string, value: number | string | boolean): void {
    this.config = { ...this.config, [name]: value };
    this.draftConfig = { ...this.config };
    this.configChange.emit(this.config);
  }

  updateDraftProp(name: string, value: number | string | boolean): void {
    this.draftConfig = { ...this.draftConfig, [name]: value };
  }

  commitDraftProp(name: string): void {
    this.updateProp(name, this.draftConfig[name]);
  }

  onReset(): void {
    this.reset.emit();
  }

  generateUsage(): string {
    const attrs: string[] = [];
    for (const prop of this.element.props) {
      const val = this.config[prop.name];
      const def = this.parseDefault(prop);
      if (val === def) continue;
      if (prop.type === 'boolean') {
        if (val) attrs.push(`[${prop.name}]="true"`);
      } else if (prop.type === 'number') {
        attrs.push(`[${prop.name}]="${val}"`);
      } else {
        attrs.push(`${prop.name}="${val}"`);
      }
    }
    const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';
    return `<${this.element.selector}${attrStr} />`;
  }

  private parseDefault(prop: PlaygroundProp): number | string | boolean {
    const v = prop.defaultValue;
    if (prop.type === 'boolean') return v === 'true';
    if (prop.type === 'number') return parseFloat(v) || 0;
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
    return v;
  }
}
