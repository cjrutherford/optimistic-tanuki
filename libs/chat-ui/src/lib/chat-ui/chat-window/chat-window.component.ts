import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import { ChatContact } from '../chat-ui.component';
import { ChatConversation, ChatMessage } from '../../types/message';
import { CommonModule } from '@angular/common';
import { MessageListComponent } from './message-list/message-list.component';
import { ParticipantsComponent } from './participants/participants.component';
import { ComposeChatComponent } from '../compose-chat/compose-chat.component';
import { Themeable, ThemeColors } from '@optimistic-tanuki/theme-lib';
import { GradientBuilder } from 'libs/common-ui/src/lib/common-ui/gradient-builder';
import { hexToRgb } from 'libs/common-ui/src/lib/common-ui/glass-container.component';

export declare type ChatWindowState = 'hidden' | 'popout' | 'fullscreen';

@Component({
  selector: 'lib-chat-window',
  standalone: true,
  imports: [
    CommonModule,
    MessageListComponent,
    ParticipantsComponent,
    ComposeChatComponent,
  ],
  templateUrl: './chat-window.component.html',
  styleUrls: ['./chat-window.component.scss'],
  host: {
    '[class.theme]': 'theme',
    // Using standardized local variables with fallbacks
    '[style.--local-background]': 'background',
    '[style.--local-foreground]': 'foreground',
    '[style.--local-accent]': 'accent',
    '[style.--local-accent-transparent]': 'accentTransparent',
    '[style.--local-complement]': 'complement',
    '[style.--local-complement-transparent]': 'complementTransparent',
    '[style.--local-border-color]': 'borderColor',
    '[style.--local-border-gradient]': 'borderGradient',
    '[style.--local-transition-duration]': 'transitionDuration',
  },
})
/**
 * Represents a single chat window.
 */
export class ChatWindowComponent
  extends Themeable
  implements OnChanges, AfterViewInit
{
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
  @ViewChild('chatWindowContent')
  chatWindowContent!: ElementRef<HTMLDivElement>;
  /**
   * Emits when the window state changes.
   */
  @Output() windowStateChange: EventEmitter<ChatWindowState> =
    new EventEmitter<ChatWindowState>();
  @Output() messageSubmitted: EventEmitter<string> = new EventEmitter<string>();
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages']) {
      this.scrollToBottom();
    }
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }
  override applyTheme(colors: ThemeColors): void {
    // Use standardized color assignments with design tokens
    this.themeColors = colors;
    this.background = colors.background;
    this.foreground = colors.foreground;
    this.accent = colors.accent;
    this.complement = colors.complementary;
    this.borderColor = colors.accent;
    this.accentTransparent = `rgba(${hexToRgb(colors.accent)}, 0.5)`;
    this.complementTransparent = `rgba(${hexToRgb(colors.complementary)}, 0.5)`;
    this.borderGradient = new GradientBuilder()
      .setType('linear')
      .setOptions({
        colors: [
          colors.accent,
          colors.complementary,
          colors.tertiary,
          colors.accent,
        ],
        direction: 'to right',
      })
      .build();
    this.transitionDuration = '0.15s'; // Use standardized duration
  }
  /**
   * Handles closing the chat window.
   */
  onClose() {
    this.windowState = 'hidden';
    this.windowStateChange.emit(this.windowState);
  }
  private scrollToBottom() {
    if (this.chatWindowContent) {
      const element = this.chatWindowContent.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
}
