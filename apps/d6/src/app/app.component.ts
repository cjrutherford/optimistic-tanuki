import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavigationComponent } from './components/navigation/navigation.component';
import { MessageService, MessageType } from './services/message.service';
import { DevInfoComponent } from '@optimistic-tanuki/common-ui';
import { HaiAboutTagComponent } from '@optimistic-tanuki/hai-ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavigationComponent, CommonModule, DevInfoComponent, HaiAboutTagComponent],
  template: `
    <app-navigation></app-navigation>

    <!-- Toast Messages -->
    <div class="message-container" *ngIf="messages().length > 0">
      @for (message of messages(); track message.id) {
      <div
        class="message"
        [ngClass]="message.type"
        (click)="dismiss(message.id!)"
      >
        <span class="message-text">{{ message.content }}</span>
        <button class="close-button" [attr.aria-label]="'Close message'">
          <span class="icon">×</span>
        </button>
      </div>
      }
    </div>

    <main class="main-content">
      <router-outlet></router-outlet>
    </main>

    <hai-about-tag [config]="haiAboutConfig"></hai-about-tag>
    <otui-dev-info />
  `,
  styles: [
    `
      :host {
        display: block;
        min-height: 100vh;
      }

      .main-content {
        padding-top: 64px; /* Space for fixed navigation */
        min-height: calc(100vh - 64px);
      }

      .message-container {
        position: fixed;
        top: 80px;
        right: 24px;
        z-index: 1100;
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 400px;
      }

      .message {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideIn 0.3s ease-out;
        cursor: pointer;
        transition: transform 0.2s, opacity 0.2s;

        &:hover {
          transform: translateX(-4px);
        }
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(100%);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      .message.info {
        background: #e0f2fe;
        border-left: 4px solid #0ea5e9;
        color: #0369a1;
      }

      .message.success {
        background: #dcfce7;
        border-left: 4px solid #22c55e;
        color: #15803d;
      }

      .message.error {
        background: #fee2e2;
        border-left: 4px solid #ef4444;
        color: #b91c1c;
      }

      .message-text {
        flex: 1;
        font-size: 0.95rem;
        line-height: 1.4;
      }

      .close-button {
        background: none;
        border: none;
        color: inherit;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0.6;
        transition: opacity 0.2s;

        &:hover {
          opacity: 1;
        }

        .icon {
          font-size: 1.25rem;
          line-height: 1;
        }
      }

      @media (max-width: 600px) {
        .message-container {
          left: 16px;
          right: 16px;
          top: 72px;
          max-width: none;
        }
      }
    `,
  ],
})
export class AppComponent {
  private readonly messageService = inject(MessageService);
  readonly haiAboutConfig = {
    appId: 'd6',
    appName: 'd6',
    appTagline: 'Personal daily practice and self-reflection tooling.',
    appDescription:
      'd6 is an HAI app for structured reflection, personal practice, and guided day-to-day self-management workflows.',
    appUrl: '/d6',
  };

  messages = this.messageService.messages;

  dismiss(id: number): void {
    this.messageService.removeMessage(id);
  }
}
