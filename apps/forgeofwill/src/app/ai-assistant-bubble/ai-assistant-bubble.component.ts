import { Component, EventEmitter, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersonaSelectionMenuComponent } from '@optimistic-tanuki/persona-ui';
import { PersonaTelosDto } from '@optimistic-tanuki/ui-models';

/**
 * AI Assistant chat bubble button component.
 * Displays a floating button in the bottom-right corner to open AI assistant chat.
 */
@Component({
  selector: 'app-ai-assistant-bubble',
  standalone: true,
  imports: [CommonModule, PersonaSelectionMenuComponent],
  templateUrl: './ai-assistant-bubble.component.html',
  styleUrl: './ai-assistant-bubble.component.scss',
})
export class AiAssistantBubbleComponent {
  /**
   * Event emitted when a persona is selected
   */
  @Output() personaSelected = new EventEmitter<PersonaTelosDto>();

  /**
   * Badge count for unread messages
   */
  unreadCount = signal<number>(0);

  /**
   * Whether the persona selection menu is visible
   */
  showMenu = signal<boolean>(false);

  /**
   * Handle click on the bubble
   */
  onClick() {
    this.showMenu.set(true);
  }

  /**
   * Handle persona selection
   */
  onPersonaSelected(persona: PersonaTelosDto) {
    this.showMenu.set(false);
    this.personaSelected.emit(persona);
  }

  /**
   * Handle menu close
   */
  onMenuClose() {
    this.showMenu.set(false);
  }
}
