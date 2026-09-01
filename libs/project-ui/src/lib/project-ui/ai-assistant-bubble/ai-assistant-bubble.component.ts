import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ChatContact,
  ChatConversation,
  ChatWindowComponent,
} from '@optimistic-tanuki/chat-ui';
import { PersonaSelectionMenuComponent } from '@optimistic-tanuki/persona-ui';
import { PersonaTelosDto } from '@optimistic-tanuki/ui-models';

import {
  AssistantTurn,
  NOBODY_IN_PARTICULAR,
  READER,
  asConversation,
  describeTool,
} from '../ai-assistant/assistant-conversation';

/**
 * The assistant, reachable from anywhere rather than from one page.
 *
 * What stood here before was a placeholder that always read "AI assistant
 * unavailable". It was replaced by a real assistant on the projects page,
 * which was honest but meant it appeared nowhere else, and somebody who
 * remembered the old bubble would reasonably think the feature had gone.
 *
 * The conversation itself is now the shared chat window rather than a second
 * implementation of one. That library already had a message list, a composer,
 * a popout state and an animated thinking indicator, and the panel built here
 * had reimplemented the first two and gone without the last. What stays here
 * is what is specific to this assistant: who is speaking, what project it is
 * on, and the handle, which shows work in progress and answers waiting behind
 * a closed bubble.
 */
@Component({
  selector: 'lib-ai-assistant-bubble',
  standalone: true,
  imports: [CommonModule, ChatWindowComponent, PersonaSelectionMenuComponent],
  templateUrl: './ai-assistant-bubble.component.html',
  styleUrl: './ai-assistant-bubble.component.scss',
})
export class AiAssistantBubbleComponent {
  @Input() turns: AssistantTurn[] = [];
  @Input() working = false;
  @Input() doing: string[] = [];
  @Input() unavailable: string | null = null;
  /** The project it is on, when a page has said which. */
  @Input() projectName: string | null = null;
  /** Who is answering now, shown in the panel and marked in the menu. */
  @Input() personaName: string | null = null;
  @Input() personaId: string | null = null;
  @Output() asked = new EventEmitter<string>();
  @Output() cleared = new EventEmitter<void>();
  /** Somebody else was chosen to talk to. */
  @Output() personaChosen = new EventEmitter<PersonaTelosDto>();

  open = false;

  /** Whether the persona menu is up. It covers the panel while it is. */
  choosing = false;

  readonly reader = READER;

  /**
   * Who the reader is talking to, for the window's own header.
   *
   * Without this the header read "No Participants", which is what a chat
   * window says when nobody is in the conversation. The name lives there
   * rather than being repeated in the chrome above it.
   *
   * There is no avatar because a persona telos has no image on it. The window
   * falls back to a placeholder, and giving personas a face is a schema change
   * of its own.
   */
  get speakingWith(): ChatContact[] {
    return [
      {
        id: this.personaId ?? NOBODY_IN_PARTICULAR,
        name: this.personaName ?? 'Assistant',
        presence: 'online',
      },
    ];
  }

  /** The thread as the chat window wants it. */
  get conversation(): ChatConversation {
    return asConversation(
      this.turns,
      this.personaId && this.personaName
        ? { id: this.personaId, name: this.personaName }
        : null
    );
  }

  /**
   * What to say while it works, given what it has done so far.
   *
   * A run takes a minute or more and the first stretch of it is genuinely
   * silent: the agent is deciding what to call before it calls anything. Once
   * tools start arriving there is something true to report, and reporting it
   * is the difference between waiting and watching.
   */
  get thinkingMessage(): string | null {
    if (!this.working) return null;
    if (!this.doing.length) return 'Working on it. This takes a minute.';
    return `Working on it. So far: ${this.doing.map(describeTool).join(', ')}.`;
  }

  showPersonas(): void {
    this.choosing = true;
  }

  hidePersonas(): void {
    this.choosing = false;
  }

  choosePersona(persona: PersonaTelosDto): void {
    this.choosing = false;
    this.personaChosen.emit(persona);
  }

  toggle(): void {
    this.open = !this.open;
  }

  /** Answers waiting behind a closed bubble, so the count is worth showing. */
  get unread(): number {
    if (this.open) return 0;
    return this.turns.filter((turn) => turn.role === 'assistant').length;
  }
}
