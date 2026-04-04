import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { AppComponent } from './app.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';

describe('AppComponent', () => {
  const themeColors = {
    background: '#f5f7fb',
    foreground: '#1f2937',
    accent: '#356c91',
    complementary: '#7aa6c2',
    tertiary: '#5b7c99',
    success: '#22c55e',
    danger: '#ef4444',
    warning: '#f59e0b',
    complementaryGradients: {
      light: 'linear-gradient(#356c91, #7aa6c2)',
      dark: 'linear-gradient(#1f2937, #356c91)',
    },
  };

  const themeServiceStub = {
    setPersonality: jest.fn(),
    setPrimaryColor: jest.fn(),
    setTheme: jest.fn(),
    themeColors$: of(themeColors),
    generatedTheme$: of(undefined),
    personality$: of(undefined),
    getTheme: jest.fn().mockReturnValue('light'),
    getAccentColor: jest.fn().mockReturnValue('#356c91'),
    getCurrentPersonality: jest.fn().mockReturnValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ThemeService, useValue: themeServiceStub },
      ],
    }).compileComponents();
  });

  it('should render router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('renders the topographic drift motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-topographic-drift')).toBeTruthy();
    expect(compiled.querySelector('.app-content')).toBeTruthy();
  });

  it('initializes a default foundation personality', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(themeServiceStub.setPersonality).toHaveBeenCalledWith('foundation');
    expect(themeServiceStub.setPrimaryColor).toHaveBeenCalledWith('#356c91');
    expect(themeServiceStub.setTheme).toHaveBeenCalledWith('light');
  });
});
