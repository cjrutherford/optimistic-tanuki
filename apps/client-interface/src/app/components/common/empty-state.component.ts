import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export type EmptyStateIcon = 'inbox' | 'search' | 'notification' | 'default';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="empty-container">
      <svg
        class="empty-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
      >
        @switch (icon()) { @case ('inbox') {
        <path d="M22 12h-6l-2 3h-4l-2-3H2"></path>
        <path
          d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"
        ></path>
        } @case ('search') {
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
        } @case ('notification') {
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        } @default {
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
        } }
      </svg>
      <h3>{{ title() }}</h3>
      @if (message()) {
      <p class="empty-message">{{ message() }}</p>
      } @if (actionLabel()) {
      <button class="action-button" (click)="action()">
        {{ actionLabel() }}
      </button>
      }
    </div>
  `,
  styles: [
    `
      .empty-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px;
        text-align: center;
      }
      .empty-icon {
        width: 64px;
        height: 64px;
        opacity: 0.5;
        color: var(--muted);
      }
      h3 {
        margin: 16px 0 8px;
        font-size: 18px;
        font-weight: 600;
        color: var(--foreground);
      }
      .empty-message {
        color: var(--muted);
        margin-bottom: 16px;
        max-width: 300px;
        font-size: 14px;
      }
      .action-button {
        padding: 10px 20px;
        background: var(--primary);
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
        &:hover {
          background: var(--primary-dark, var(--primary));
        }
      }
    `,
  ],
})
export class EmptyStateComponent {
  @Input() icon: () => EmptyStateIcon = signal('default');
  @Input() title: () => string = signal('Nothing here yet');
  @Input() message: () => string = signal('');
  @Input() actionLabel: () => string = signal('');
  @Input() action: () => void = () => {};
}
