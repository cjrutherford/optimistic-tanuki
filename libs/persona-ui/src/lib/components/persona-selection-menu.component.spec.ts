import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { PersonaSelectionMenuComponent } from './persona-selection-menu.component';
import { API_BASE_URL, PersonaTelosDto } from '@optimistic-tanuki/ui-models';

/**
 * The menu that says who you can talk to.
 *
 * Its recommendation used to match a persona's name against "project
 * management". The persona is called "Patricia P. Project", so it matched
 * nothing and no persona was ever marked recommended, in a menu that told
 * every reader one was. Nothing failed and no test noticed, because the only
 * test here asked whether the component could be constructed.
 */
describe('PersonaSelectionMenuComponent', () => {
  let component: PersonaSelectionMenuComponent;
  let fixture: ComponentFixture<PersonaSelectionMenuComponent>;

  const patricia = {
    id: 'p1',
    name: 'Patricia P. Project',
    description: 'Project Manager: works on your projects with you.',
    coreObjective: 'Provide project management assistance',
  } as PersonaTelosDto;

  const percy = {
    id: 'p2',
    name: 'Percy Verse',
    description: 'Poet: assists with poetic and lyrical writing.',
    coreObjective: 'Assist with poetic and lyrical writing',
  } as PersonaTelosDto;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonaSelectionMenuComponent, HttpClientTestingModule],
      providers: [{ provide: API_BASE_URL, useValue: 'http://localhost:3000' }],
    }).compileComponents();

    fixture = TestBed.createComponent(PersonaSelectionMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Skips the request the component makes on init, which is not under test. */
  function offering(personas: PersonaTelosDto[]) {
    component.personas.set(personas);
    component.loading.set(false);
    fixture.detectChanges();
  }

  function text(): string {
    return fixture.nativeElement.textContent ?? '';
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('the one it recommends', () => {
    it('finds the persona whose job is running projects', () => {
      offering([percy, patricia]);

      expect(component.getDefaultPersona()?.id).toBe('p1');
    });

    it('recommends by the job rather than by the name', () => {
      // The whole defect: her name does not contain "project management" and
      // never will, so matching on it recommended nobody.
      offering([{ ...patricia, name: 'Somebody Else Entirely' }]);

      expect(component.getDefaultPersona()?.id).toBe('p1');
    });

    it('names the recommended persona rather than a hardcoded label', () => {
      offering([percy, patricia]);

      expect(text()).toContain('Patricia P. Project');
    });

    it('says nothing about a recommendation when none fits', () => {
      offering([percy]);

      expect(component.getDefaultPersona()).toBeUndefined();
      expect(text()).not.toContain('Not sure?');
    });
  });

  describe('what each one can do', () => {
    it('says a persona reads only, when that is all it can do', () => {
      offering([{ ...percy, capabilities: ['read'] }]);

      expect(component.canDo({ ...percy, capabilities: ['read'] })).toBe(
        'Reads only'
      );
      expect(text()).toContain('Reads only');
    });

    it('names what a persona can change', () => {
      const able = component.canDo({
        ...patricia,
        capabilities: ['read', 'tasks', 'risks'],
      });

      expect(able).toBe('Can change tasks, risks');
    });

    it('claims nothing for a record that predates the scope', () => {
      // No capabilities means every tool, which is not a claim worth making
      // on a card.
      expect(component.canDo(patricia)).toBeNull();
    });
  });

  describe('the one you are already talking to', () => {
    it('marks them, so choosing again is understood as going back', () => {
      component.chosenId = 'p2';
      offering([percy, patricia]);

      expect(component.isChosen(percy)).toBe(true);
      expect(text()).toContain('Talking to now');
    });

    it('marks nobody before a choice has been made', () => {
      offering([percy, patricia]);

      expect(text()).not.toContain('Talking to now');
    });
  });

  it('hands the whole persona to whoever asked, not just an id', () => {
    // The caller needs the name to show it without fetching again.
    const chosen: PersonaTelosDto[] = [];
    component.personaSelected.subscribe((p) => chosen.push(p));
    offering([patricia]);

    component.onPersonaSelect(patricia);

    expect(chosen).toEqual([patricia]);
  });
});
