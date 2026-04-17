import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="loading-container" [class.overlay]="overlay()">
      <div
        class="spinner"
        [style.width.px]="diameter()"
        [style.height.px]="diameter()"
      ></div>
      @if (message()) {
      <p class="loading-message">{{ message() }}</p>
      }
    </div>
  `,
  styles: [
    `
      .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        &.overlay {
          position: absolute;
          inset: 0;
          background: rgba(255, 255, 255, 0.8);
          z-index: 10;
        }
      }
      .spinner {
        border: 3px solid var(--border);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
      .loading-message {
        margin-top: 16px;
        color: var(--muted);
        font-size: 14px;
      }
    `,
  ],
})
export class LoadingStateComponent {
  @Input() diameter = signal(40);
  @Input() message = signal('');
  @Input() overlay = signal(false);
}
