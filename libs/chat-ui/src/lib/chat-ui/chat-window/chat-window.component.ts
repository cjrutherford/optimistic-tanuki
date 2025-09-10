import { Component, EventEmitter, Input, Output } from '@angular/core';

import { ChatContact } from '../chat-ui.component';
import { ChatConversation, ChatMessage } from '../../types/message';
import { CommonModule } from '@angular/common';
import { MessageListComponent } from './message-list/message-list.component';
import { ParticipantsComponent } from './participants/participants.component';
import { ComposeChatComponent } from '../compose-chat/compose-chat.component';

export declare type ChatWindowState = 'hidden' | 'popout' | 'fullscreen';

@Component({
  selector: 'lib-chat-window',
  standalone: true,
  imports: [CommonModule, MessageListComponent, ParticipantsComponent, ComposeChatComponent],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
/**
 * Represents a single chat window.
 */
export class ChatWindowComponent {
  /**
   * The contact or contacts in the chat.
   */
  @Input() contact: ChatContact[] | null = null;
  /**
   * The messages in the chat conversation.
   */
  @Input() messages: ChatConversation = {
    id: '',
    participants: [],
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  /**
   * The current state of the chat window.
   */
  @Input() windowState: ChatWindowState = 'popout';
  /**
   * Emits when the window state changes.
   */
  @Output() windowStateChange: EventEmitter<ChatWindowState> = new EventEmitter<ChatWindowState>();
  @Output() messageSubmitted: EventEmitter<string> = new EventEmitter<string>();

  /**
   * Handles changes to the window state.
   * @param newState The new window state.
   */
  onWindowStateChange(newState: ChatWindowState) {
    this.windowState = newState;
    this.windowStateChange.emit(newState);
  }

  onMessageSubmitted(message: string) {
    // Handle the submitted message
    this.messageSubmitted.emit(message);
  }

  /**
   * Handles closing the chat window.
   */
  onClose() {
    this.windowState = 'hidden';
    this.windowStateChange.emit(this.windowState);
  }
}
