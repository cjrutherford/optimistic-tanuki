import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CardComponent } from '@optimistic-tanuki/common-ui';

@Component({
  selector: 'lib-callout-box',
  standalone: true,
  imports: [CommonModule, CardComponent],
  template: `
    <otui-card class="callout-box" [ngClass]="'callout-' + type">
      <div class="callout-content">
        @if (title) {
        <div class="callout-title">{{ title }}</div>
        }
        <div class="callout-text">{{ content }}</div>
      </div>
    </otui-card>
  `,
  styles: [
    `
      .callout-box {
        margin: 1rem 0;
        border-left: 4px solid;
      }

      .callout-info {
        border-left-color: var(--info);
        background-color: color-mix(in srgb, var(--info) 12%, var(--surface));
      }

      .callout-warning {
        border-left-color: var(--warning);
        background-color: color-mix(
          in srgb,
          var(--warning) 12%,
          var(--surface)
        );
      }

      .callout-success {
        border-left-color: var(--success);
        background-color: color-mix(
          in srgb,
          var(--success) 12%,
          var(--surface)
        );
      }

      .callout-error {
        border-left-color: var(--danger);
        background-color: color-mix(in srgb, var(--danger) 12%, var(--surface));
      }

      .callout-content {
        padding: 1rem;
      }

      .callout-title {
        font-weight: bold;
        margin-bottom: 0.5rem;
      }

      .callout-text {
        line-height: 1.5;
      }
    `,
  ],
})
export class CalloutBoxComponent {
  @Input() type: 'info' | 'warning' | 'success' | 'error' = 'info';
  @Input() title = '';
  @Input() content = 'This is a callout box component.';
}
