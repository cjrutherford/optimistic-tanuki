import { Component, computed, inject } from '@angular/core';
import {
  NotificationComponent,
  type Notification,
} from '@optimistic-tanuki/common-ui';

import { MessageService } from '../message.service';

/**
 * App-level message stack. Messages come from `MessageService` (which also
 * handles auto-dismiss) and render as common-ui toasts, so they follow the
 * active personality's surface, feedback accent and icon set.
 */
@Component({
  selector: 'lib-message',
  standalone: true,
  imports: [NotificationComponent],
  templateUrl: './message.component.html',
  styleUrl: './message.component.scss',
})
export class MessageComponent {
  readonly messageService = inject(MessageService);

  /** Toast view of the current messages; recomputed only when they change. */
  readonly toasts = computed<Notification[]>(() =>
    this.messageService.messages().map((message, index) => ({
      id: index,
      type: message.type,
      message: message.content,
    }))
  );

  dismissMessage(index: number) {
    this.messageService.dismiss(index);
  }

  clearAll() {
    this.messageService.clearMessages();
  }
}
