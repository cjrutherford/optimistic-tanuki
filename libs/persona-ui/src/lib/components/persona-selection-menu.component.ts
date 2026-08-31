import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersonaService } from '../services/persona.service';
import { PersonaTelosDto } from '@optimistic-tanuki/ui-models';

/**
 * How the recommended persona is recognised.
 *
 * This used to test the persona's name for "project management". The persona
 * is called "Patricia P. Project", so it matched nothing and no persona was
 * ever marked as recommended. What is stable is the job rather than the name,
 * which is also how the orchestrator picks its default, so the menu and the
 * assistant agree on who the usual one is.
 */
const DOES_PROJECT_WORK = /project manage/i;

@Component({
  selector: 'lib-persona-selection-menu',
  imports: [CommonModule],
  templateUrl: './persona-selection-menu.component.html',
  styleUrl: './persona-selection-menu.component.scss',
})
export class PersonaSelectionMenuComponent implements OnInit {
  @Output() personaSelected = new EventEmitter<PersonaTelosDto>();
  @Output() menuClose = new EventEmitter<void>();

  /** Who the reader is talking to now, so the menu can say which one that is. */
  @Input() chosenId: string | null = null;

  personas = signal<PersonaTelosDto[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  private personaService = inject(PersonaService);

  ngOnInit() {
    this.loadPersonas();
  }

  loadPersonas() {
    this.loading.set(true);
    this.error.set(null);

    this.personaService.getAllPersonas().subscribe({
      next: (personas) => {
        this.personas.set(personas);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading personas:', err);
        this.error.set('Failed to load AI personas. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onPersonaSelect(persona: PersonaTelosDto) {
    this.personaSelected.emit(persona);
  }

  onClose() {
    this.menuClose.emit();
  }

  getDefaultPersona(): PersonaTelosDto | undefined {
    return this.personas().find(
      (p) =>
        DOES_PROJECT_WORK.test(p.coreObjective ?? '') ||
        DOES_PROJECT_WORK.test(p.description ?? '')
    );
  }

  /** True for the persona whose conversation is currently open. */
  isChosen(persona: PersonaTelosDto): boolean {
    return this.chosenId === persona.id;
  }

  isDefaultPersona(persona: PersonaTelosDto): boolean {
    const defaultPersona = this.getDefaultPersona();
    return defaultPersona ? defaultPersona.id === persona.id : false;
  }
}
