import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * AI Assistant chat bubble button component.
 * Displays a floating button in the bottom-right corner to open AI assistant chat.
 */
@Component({
  selector: 'app-ai-assistant-bubble',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ai-assistant-bubble.component.html',
  styleUrl: './ai-assistant-bubble.component.scss',
})
export class AiAssistantBubbleComponent {
  /**
   * Event emitted when the bubble is clicked
   */
  @Output() bubbleClicked = new EventEmitter<void>();

  /**
   * Badge count for unread messages
   */
  unreadCount = signal<number>(0);

  /**
   * Handle click on the bubble
   */
  onClick() {
    this.bubbleClicked.emit();
  }
}
