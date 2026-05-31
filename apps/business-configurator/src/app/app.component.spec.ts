import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AppComponent } from './app.component';

const PERSONALITY_STORAGE_KEY = 'optimistic-tanuki-personality-theme';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();
  });

  it('renders the router shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('bootstraps the professional personality on first load', () => {
    const getItemSpy = jest
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation((key) =>
        key === PERSONALITY_STORAGE_KEY ? null : null
      );
    const themeService = TestBed.inject(ThemeService);
    const setPersonalitySpy = jest.spyOn(themeService, 'setPersonality');

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(setPersonalitySpy).toHaveBeenCalledWith('professional');
    getItemSpy.mockRestore();
    setPersonalitySpy.mockRestore();
  });
});
