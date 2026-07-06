import {
  OnInit,
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import { ChatContact } from '../chat-ui.component';
import { ChatConversation, ChatMessage } from '../../types/message';
import { CommonModule } from '@angular/common';
import { MessageListComponent } from './message-list/message-list.component';
import { ComposeChatComponent } from '../compose-chat/compose-chat.component';
import { ProfilePhotoComponent } from '@optimistic-tanuki/profile-ui';
import { Themeable, ThemeColors, hexToRgb } from '@optimistic-tanuki/theme-lib';
import { ButtonComponent } from '@optimistic-tanuki/common-ui';

export declare type ChatWindowState =
  | 'hidden'
  | 'popout'
  | 'fullscreen'
  | 'embedded';

@Component({
  selector: 'lib-chat-window',
  standalone: true,
  imports: [
    CommonModule,
    MessageListComponent,
    ComposeChatComponent,
    ProfilePhotoComponent,
    ButtonComponent,
  ],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  host: {
    class: 'chat-window-host',
    '[class.theme]': 'theme',
    // Using standardized local variables with fallbacks
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-accent-transparent]': 'accentTransparent',
    '[style.--local-complement]': 'complement',
    '[style.--local-complement-transparent]': 'complementTransparent',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-transition-duration]': 'transitionDuration',
  },
})
/**
 * Represents a single chat window.
 */
export class ChatWindowComponent
  extends Themeable
  implements OnInit, OnChanges, AfterViewInit
{
  isMobileViewport = false;
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
   * Indicates if AI is currently responding
   */
  @Input() aiIsResponding = false;

  /**
   * AI thinking message
   */
  @Input() aiThinkingMessage: string | null = null;

  /**
   * Current user ID for determining message ownership.
   */
  @Input() currentUserId: string = '';

  /**
   * IDs of users currently typing in this conversation.
   */
  @Input() typingUsers: string[] = [];

  /**
   * The current state of the chat window.
   */
  @Input() windowState: ChatWindowState = 'popout';
  @ViewChild('chatWindowContent')
  chatWindowContent?: ElementRef<HTMLDivElement>;
  /**
   * Emits when the window state changes.
   */
  @Output() windowStateChange: EventEmitter<ChatWindowState> =
    new EventEmitter<ChatWindowState>();
  @Output() messageSubmitted: EventEmitter<string> = new EventEmitter<string>();
  @Output() reactionAdded = new EventEmitter<{
    messageId: string;
    emoji: string;
  }>();
  @Output() reactionRemoved = new EventEmitter<{
    messageId: string;
    emoji: string;
  }>();
  accentTransparent = 'rgba(0, 123, 255, 0.1)';
  complementTransparent = 'rgba(108, 117, 125, 0.1)';
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

  onReactionAdded(event: { messageId: string; emoji: string }) {
    this.reactionAdded.emit(event);
  }

  onReactionRemoved(event: { messageId: string; emoji: string }) {
    this.reactionRemoved.emit(event);
  }

  override ngOnInit(): void {
    this.updateViewportState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages']) {
      this.scrollToBottom();
    }
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateViewportState();
  }
  override applyTheme(colors: ThemeColors): void {
    const accentRgb = hexToRgb(colors.accent);
    const complementRgb = hexToRgb(colors.complementary);
    // Use standardized color assignments with design tokens
    this.themeColors = colors;
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = `rgba(${accentRgb?.r || 0}, ${accentRgb?.g || 0}, ${
      accentRgb?.b || 0
    }, 0.18)`;
    this.accentTransparent = `rgba(${accentRgb?.r || 0}, ${
      accentRgb?.g || 0
    }, ${accentRgb?.b || 0}, 0.14)`;
    this.complementTransparent = `rgba(${complementRgb?.r || 0}, ${
      complementRgb?.g || 0
    }, ${complementRgb?.b || 0}, 0.12)`;
    this.transitionDuration = '0.15s';
  }
  /**
   * Handles closing the chat window.
   */
  onClose() {
    this.windowState = 'hidden';
    this.windowStateChange.emit(this.windowState);
  }

  trackById(index: number, contact: ChatContact): string {
    return contact.id;
  }

  private scrollToBottom() {
    if (this.chatWindowContent) {
      const element = this.chatWindowContent.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }

  private updateViewportState(): void {
    if (typeof window === 'undefined') {
      this.isMobileViewport = false;
      return;
    }

    this.isMobileViewport = window.innerWidth <= 640;
  }
}
