import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PREDEFINED_PERSONALITIES } from '@optimistic-tanuki/theme-models';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { PersonalitySelectorComponent } from './personality-selector.component';
import { PERSONALITY_ICONS } from './personality-card-preview';

describe('PersonalitySelectorComponent', () => {
  let fixture: ComponentFixture<PersonalitySelectorComponent>;
  let component: PersonalitySelectorComponent;
  let themeService: ThemeService;

  const cards = (): HTMLButtonElement[] =>
    Array.from(
      fixture.nativeElement.querySelectorAll('.personality-option')
    ) as HTMLButtonElement[];

  const card = (id: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(`[data-personality="${id}"]`);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PersonalitySelectorComponent],
    }).compileComponents();
    themeService = TestBed.inject(ThemeService);
    fixture = TestBed.createComponent(PersonalitySelectorComponent);
    component = fixture.componentInstance;
    component.personalities = PREDEFINED_PERSONALITIES;
    fixture.detectChanges();
  });

  it('renders every personality as a radio with its own preview variables', () => {
    expect(cards()).toHaveLength(PREDEFINED_PERSONALITIES.length);
    expect(cards().every((c) => c.getAttribute('role') === 'radio')).toBe(true);
    const grounds = new Set(
      PREDEFINED_PERSONALITIES.map(
        (p) =>
          component.previewVars(p)['--pv-font-heading'] +
          component.previewVars(p)['--pv-bg']
      )
    );
    expect(grounds.size).toBeGreaterThan(8);
  });

  it('gives every personality a distinct icon', () => {
    const icons = PREDEFINED_PERSONALITIES.map((p) => PERSONALITY_ICONS[p.id]);
    expect(icons.every(Boolean)).toBe(true);
    expect(new Set(icons).size).toBe(icons.length);
  });

  it('marks the selection with aria-checked and a visible label', () => {
    component.currentPersonality = PREDEFINED_PERSONALITIES[1];
    fixture.detectChanges();
    const checked = cards().filter(
      (c) => c.getAttribute('aria-checked') === 'true'
    );
    expect(checked).toHaveLength(1);
    expect(checked[0].textContent).toContain('Current');
    expect(checked[0].getAttribute('tabindex')).toBe('0');
  });

  it('applies the selection and emits when applyOnSelect is true', () => {
    const spy = jest
      .spyOn(themeService, 'setPersonality')
      .mockResolvedValue(undefined as never);
    const emitted = jest.fn();
    component.personalitySelected.subscribe(emitted);
    card(PREDEFINED_PERSONALITIES[2].id).click();
    expect(spy).toHaveBeenCalledWith(PREDEFINED_PERSONALITIES[2].id);
    expect(emitted).toHaveBeenCalledWith(PREDEFINED_PERSONALITIES[2]);
  });

  it('only emits when applyOnSelect is false', () => {
    const spy = jest.spyOn(themeService, 'setPersonality');
    component.applyOnSelect = false;
    const emitted = jest.fn();
    component.personalitySelected.subscribe(emitted);
    card(PREDEFINED_PERSONALITIES[3].id).click();
    expect(spy).not.toHaveBeenCalled();
    expect(emitted).toHaveBeenCalled();
  });

  it('moves focus with arrow keys and Home/End', () => {
    cards()[0].focus();
    cards()[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
    );
    expect(document.activeElement).toBe(cards()[1]);
    cards()[1].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true })
    );
    expect(document.activeElement).toBe(cards()[cards().length - 1]);
  });
});
