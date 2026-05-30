import { TestBed } from '@angular/core/testing';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppComponent } from './app.component';

const PERSONALITY_STORAGE_KEY = 'optimistic-tanuki-personality-theme';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('bootstraps the foundation personality on first load', () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key) =>
        key === PERSONALITY_STORAGE_KEY ? null : null
      );
    const themeService = TestBed.inject(ThemeService);
    const setPersonalitySpy = jest.spyOn(themeService, 'setPersonality');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(setPersonalitySpy).toHaveBeenCalledWith('foundation');
    getItemSpy.mockRestore();
    setPersonalitySpy.mockRestore();
  });

  it('renders the developer portal hero copy', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain(
      'API docs, SDK onboarding, and usage visibility in one place.'
    );
    expect(compiled.textContent).toContain('Signal Foundry is the case study.');
  });

  it('renders the usage and getting started sections', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.textContent).toContain('MVP dashboard');
    expect(compiled.textContent).toContain('First integration checklist');
    expect(compiled.querySelectorAll('.content-card').length).toBeGreaterThan(
      2
    );
  });
});
