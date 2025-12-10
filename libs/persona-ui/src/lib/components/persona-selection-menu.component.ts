import { Component, Output, EventEmitter, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersonaService } from '../services/persona.service';
import { PersonaTelosDto } from '@optimistic-tanuki/models';

/**
 * Default persona name to recommend to users
 */
const DEFAULT_PERSONA_NAME = 'project management';

@Component({
  selector: 'lib-persona-selection-menu',
  imports: [CommonModule],
  templateUrl: './persona-selection-menu.component.html',
  styleUrl: './persona-selection-menu.component.scss',
})
export class PersonaSelectionMenuComponent implements OnInit {
  @Output() personaSelected = new EventEmitter<PersonaTelosDto>();
  @Output() menuClose = new EventEmitter<void>();

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
      }
    });
  }

  onPersonaSelect(persona: PersonaTelosDto) {
    this.personaSelected.emit(persona);
  }

  onClose() {
    this.menuClose.emit();
  }

  getDefaultPersona(): PersonaTelosDto | undefined {
    return this.personas().find(p => p.name.toLowerCase().includes(DEFAULT_PERSONA_NAME));
  }

  isDefaultPersona(persona: PersonaTelosDto): boolean {
    const defaultPersona = this.getDefaultPersona();
    return defaultPersona ? defaultPersona.id === persona.id : false;
  }
}

