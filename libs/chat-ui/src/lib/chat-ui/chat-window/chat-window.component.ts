import { Component, EventEmitter, Input, Output } from '@angular/core';

import { ChatContact } from '../chat-ui.component';
import { ChatConversation, ChatMessage } from '../../types/message';
import { CommonModule } from '@angular/common';
import { MessageListComponent } from './message-list/message-list.component';
import { ParticipantsComponent } from './participants/participants.component';

export declare type ChatWindowState = 'hidden' | 'popout' | 'fullscreen';

@Component({
  selector: 'lib-chat-window',
  standalone: true,
  imports: [CommonModule, MessageListComponent, ParticipantsComponent],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
})
export class ChatWindowComponent {
  @Input() contact: ChatContact[] | null = null;
  @Input() messages: ChatConversation[] = [];
  @Input() windowState: ChatWindowState = 'popout';
  @Output() windowStateChange: EventEmitter<ChatWindowState> = new EventEmitter<ChatWindowState>();

  onWindowStateChange(newState: ChatWindowState) {
    this.windowState = newState;
    this.windowStateChange.emit(newState);
  }
  onClose() {
    this.windowState = 'hidden';
    this.windowStateChange.emit(this.windowState);
  }
}
