# persona-ui

A library for AI persona selection UI components in the Optimistic Tanuki platform.

## Components

### PersonaSelectionMenuComponent

A modal menu component that displays available AI personas and allows users to select one.

#### Features

- Fetches available personas from the gateway API
- Displays personas with their name, description, and skills
- Highlights the recommended "Project Management" persona
- Loading and error states
- Accessibility support (keyboard navigation, ARIA labels)
- Themed using CSS variables (no Angular Material dependency)

#### Usage

```typescript
import { PersonaSelectionMenuComponent } from '@optimistic-tanuki/persona-ui';

@Component({
  selector: 'app-my-component',
  imports: [PersonaSelectionMenuComponent],
  template: `
    @if (showMenu) {
      <lib-persona-selection-menu
        (personaSelected)="onPersonaSelected($event)"
        (menuClose)="onMenuClose()">
      </lib-persona-selection-menu>
    }
  `
})
export class MyComponent {
  showMenu = false;

  onPersonaSelected(persona: PersonaTelosDto) {
    console.log('Selected persona:', persona);
    this.showMenu = false;
    // Handle persona selection (e.g., open or create conversation)
  }

  onMenuClose() {
    this.showMenu = false;
  }
}
```

#### Events

- `personaSelected: EventEmitter<PersonaTelosDto>` - Emitted when a persona is selected
- `menuClose: EventEmitter<void>` - Emitted when the menu should close

## Services

### PersonaService

Service for fetching AI personas from the gateway API.

#### Methods

- `getAllPersonas(): Observable<PersonaTelosDto[]>` - Fetch all available personas
- `getPersona(id: string): Observable<PersonaTelosDto>` - Fetch a specific persona by ID

#### Usage

```typescript
import { PersonaService } from '@optimistic-tanuki/persona-ui';

export class MyComponent {
  private personaService = inject(PersonaService);

  loadPersonas() {
    this.personaService.getAllPersonas().subscribe(personas => {
      console.log('Available personas:', personas);
    });
  }
}
```

## Configuration

The library requires the `API_BASE_URL` injection token to be provided in your application config:

```typescript
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: API_BASE_URL, useValue: environment.apiBaseUrl },
    // ... other providers
  ]
};
```

## Theming

The persona selection menu uses CSS variables for theming:

- `--accent` - Primary accent color
- `--complement` - Complementary accent color
- `--background` - Background color
- `--foreground` - Foreground/text color
- `--accent-rgb`, `--complement-rgb`, `--foreground-rgb` - RGB values for transparency

These should be set at the root level of your application.

## Dependencies

- `@optimistic-tanuki/models` - For `PersonaTelosDto` type
- `@optimistic-tanuki/ui-models` - For `API_BASE_URL` injection token
- `@angular/common/http` - For HTTP client
