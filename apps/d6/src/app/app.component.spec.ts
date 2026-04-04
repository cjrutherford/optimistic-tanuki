import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { MessageService } from './services/message.service';

describe('AppComponent', () => {
  const themeServiceStub = {
    setPersonality: jest.fn(),
    setPrimaryColor: jest.fn(),
    setTheme: jest.fn(),
    themeColors$: of({
      background: '#f8fafc',
      foreground: '#1f2937',
      accent: '#6b8f8a',
      complementary: '#9bb7b0',
      tertiary: '#7c988f',
      success: '#22c55e',
      danger: '#ef4444',
      warning: '#f59e0b',
      complementaryGradients: {
        light: 'linear-gradient(#6b8f8a, #9bb7b0)',
        dark: 'linear-gradient(#1f2937, #6b8f8a)',
      },
    }),
    generatedTheme$: of(undefined),
    personality$: of(undefined),
    getTheme: jest.fn().mockReturnValue('light'),
    getAccentColor: jest.fn().mockReturnValue('#6b8f8a'),
    getCurrentPersonality: jest.fn().mockReturnValue(undefined),
  };

  const messageServiceStub = {
    messages: jest.fn().mockReturnValue([]),
    removeMessage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ThemeService, useValue: themeServiceStub },
        { provide: MessageService, useValue: messageServiceStub },
      ],
    }).compileComponents();
  });

  it('renders the shimmer beam motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-shimmer-beam')).toBeTruthy();
    expect(compiled.querySelector('.app-content')).toBeTruthy();
  });

  it('initializes a default reflective personality', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(themeServiceStub.setPersonality).toHaveBeenCalledWith('soft-touch');
    expect(themeServiceStub.setPrimaryColor).toHaveBeenCalledWith('#6b8f8a');
    expect(themeServiceStub.setTheme).toHaveBeenCalledWith('light');
  });
});
