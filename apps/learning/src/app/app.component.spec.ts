import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  function configure(platform: 'browser' | 'server') {
    TestBed.resetTestingModule();
    localStorage.removeItem('optimistic-tanuki-personality-theme');
    TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });
  }

  it('hosts route content', () => {
    configure('browser');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('router-outlet')).toBeTruthy();
  });

  it('leaves the personality to the app theme defaults', () => {
    configure('browser');
    const theme = TestBed.inject(ThemeService);
    const setPersonality = jest.spyOn(theme, 'setPersonality');

    TestBed.createComponent(AppComponent).detectChanges();

    expect(setPersonality).not.toHaveBeenCalled();
  });

  it('does not replace a persisted personality preference', () => {
    configure('browser');
    localStorage.setItem(
      'optimistic-tanuki-personality-theme',
      JSON.stringify({
        personalityId: 'minimal',
        primaryColor: '#3f51b5',
        mode: 'dark',
        version: '1.0.0',
      })
    );
    const theme = TestBed.inject(ThemeService);
    const setPersonality = jest.spyOn(theme, 'setPersonality');

    TestBed.createComponent(AppComponent).detectChanges();

    expect(setPersonality).not.toHaveBeenCalled();
    localStorage.removeItem('optimistic-tanuki-personality-theme');
  });

  it('keeps initializing when browser storage access is denied', () => {
    configure('browser');
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('Storage access denied', 'SecurityError');
      });
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    try {
      const theme = TestBed.inject(ThemeService);
      const setPersonality = jest.spyOn(theme, 'setPersonality');

      expect(() =>
        TestBed.createComponent(AppComponent).detectChanges()
      ).not.toThrow();
      expect(theme.getTheme()).toBe('light');
      expect(setPersonality).toHaveBeenCalledWith('architect');
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    } finally {
      getItemSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  // Touching the theme on the server would reach for document during SSR.
  it('leaves the theme alone when rendering on the server', () => {
    configure('server');
    const theme = TestBed.inject(ThemeService);
    const setPersonality = jest.spyOn(theme, 'setPersonality');

    TestBed.createComponent(AppComponent).detectChanges();

    expect(setPersonality).not.toHaveBeenCalled();
  });
});
