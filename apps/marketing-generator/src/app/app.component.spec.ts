import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { signal } from '@angular/core';
import { MarketingStateService } from './services/marketing-state.service';
import { of } from 'rxjs';

const buildThemeServiceStub = () => ({
  setTheme: jest.fn(),
  setPersonality: jest.fn(),
  setPrimaryColor: jest.fn(),
  getTheme: jest.fn(() => 'dark'),
  getAccentColor: jest.fn(() => '#d97706'),
  getCurrentPersonality: jest.fn(() => ({
    id: 'control-center',
    name: 'Control Center',
  })),
  themeColors$: of({
    background: '#081018',
    foreground: '#f7f1e6',
    accent: '#d97706',
    primary: '#d97706',
    secondary: '#2563eb',
    tertiary: '#34d399',
    borderColor: 'rgba(255,255,255,0.12)',
    borderGradient: 'none',
    transitionDuration: '0.15s',
    complement: '#2563eb',
  }),
  generatedTheme$: of({
    colors: {
      background: '#081018',
      foreground: '#f7f1e6',
      primary: '#d97706',
      secondary: '#2563eb',
      border: 'rgba(255,255,255,0.12)',
    },
    fonts: {
      heading: { family: 'Instrument Serif' },
      body: { family: 'System UI' },
      mono: { family: 'monospace' },
    },
    personality: {
      animations: {
        easing: 'ease',
        duration: { fast: '150ms', normal: '300ms' },
      },
    },
  }),
  personality$: of({ id: 'control-center', name: 'Control Center' }),
});

describe('AppComponent', () => {
  it('initializes the shared personality theme in the browser', async () => {
    const themeServiceStub = buildThemeServiceStub();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ThemeService, useValue: themeServiceStub },
        {
          provide: MarketingStateService,
          useValue: {
            workspaceStatus: signal({
              storageLabel: 'Browser storage only',
              currentWorkspaceName: 'Launch Sprint',
              workspaceCount: 2,
              currentVersionCount: 4,
              conceptCount: 6,
              lastSavedAt: '2026-06-04T12:00:00.000Z',
            }),
          },
        },
      ],
    }).compileComponents();

    TestBed.createComponent(AppComponent);

    expect(themeServiceStub.setTheme).toHaveBeenCalled();
    expect(themeServiceStub.setPersonality).toHaveBeenCalled();
    expect(themeServiceStub.setPrimaryColor).toHaveBeenCalled();
  });

  it('renders operator status details for the active workspace', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ThemeService,
          useValue: buildThemeServiceStub(),
        },
        {
          provide: MarketingStateService,
          useValue: {
            workspaceStatus: signal({
              storageLabel: 'Browser storage only',
              currentWorkspaceName: 'Launch Sprint',
              workspaceCount: 2,
              currentVersionCount: 4,
              conceptCount: 6,
              lastSavedAt: '2026-06-04T12:00:00.000Z',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Launch Sprint');
    expect(fixture.nativeElement.textContent).toContain('Browser storage only');
    expect(fixture.nativeElement.textContent).toContain(
      'workspaces in circulation'
    );
  });

  it('renders shared platform chrome for navigation and theming', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ThemeService,
          useValue: buildThemeServiceStub(),
        },
        {
          provide: MarketingStateService,
          useValue: {
            workspaceStatus: signal({
              storageLabel: 'Browser storage only',
              currentWorkspaceName: 'Launch Sprint',
              workspaceCount: 2,
              currentVersionCount: 4,
              conceptCount: 6,
              lastSavedAt: '2026-06-04T12:00:00.000Z',
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('otui-app-bar')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('otui-nav-sidebar')
    ).not.toBeNull();
  });
});
