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

  it('renders the shared otui-app-bar with the portal title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    const appBar = compiled.querySelector('otui-app-bar');
    expect(appBar).toBeTruthy();
    expect(appBar?.textContent).toContain('Developer Portal');
  });

  it('scrolls to the usage dashboard anchor when the menu is toggled', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const target = fixture.nativeElement.querySelector(
      '#usage-dashboard'
    ) as HTMLElement;
    expect(target).toBeTruthy();
    // JSDOM does not implement scrollIntoView; install a stub before spying.
    (target as unknown as { scrollIntoView: () => void }).scrollIntoView = () =>
      undefined;
    const scrollSpy = jest
      .spyOn(target, 'scrollIntoView')
      .mockImplementation(() => undefined);

    (
      fixture.componentInstance as unknown as { onMenuToggle: () => void }
    ).onMenuToggle();

    expect(scrollSpy).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
    });
    scrollSpy.mockRestore();
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
