import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PersonaSelectionMenuComponent } from '@optimistic-tanuki/persona-ui';
import { PersonaTelosDto } from '@optimistic-tanuki/ui-models';
import {
  AiAssistantComponent,
  AssistantTurn,
} from '../ai-assistant/ai-assistant.component';

/**
 * The assistant, reachable from anywhere rather than from one page.
 *
 * What stood here before was a placeholder that always read "AI assistant
 * unavailable". It was replaced by a real assistant on the projects page,
 * which was honest but meant it appeared nowhere else, and somebody who
 * remembered the old bubble would reasonably think the feature had gone.
 *
 * A project is no longer required to open it. Listing projects needs no
 * project id, so away from one the assistant starts by finding out what there
 * is and asking which is meant. It says which project it is on when it knows,
 * because an assistant acting on something you did not name is worse than one
 * that asks.
 */
@Component({
  selector: 'lib-ai-assistant-bubble',
  standalone: true,
  imports: [CommonModule, AiAssistantComponent, PersonaSelectionMenuComponent],
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
