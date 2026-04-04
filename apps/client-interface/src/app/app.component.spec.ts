import { TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA, PLATFORM_ID } from '@angular/core';
import { AppComponent } from './app.component';
import { RouterModule } from '@angular/router';
import { API_BASE_URL } from '@optimistic-tanuki/ui-models';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { AuthStateService } from './state/auth-state.service';
import { ProfileService } from './profile.service';
import { ProfileContext } from './profile.context';
import { TitleService } from './title.service';
import { ChatService } from './chat.service';
import { NotificationService } from '@optimistic-tanuki/notification-ui';
import { of } from 'rxjs';

const themeColors = {
  background: '#0b1020',
  foreground: '#f5f7fb',
  accent: '#4fd1c5',
  complementary: '#7dd3fc',
  tertiary: '#8b5cf6',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
  complementaryGradients: {
    light: 'linear-gradient(#7dd3fc, #4fd1c5)',
    dark: 'linear-gradient(#4fd1c5, #7dd3fc)',
  },
};

const generatedTheme = {
  colors: {
    background: '#0b1020',
    foreground: '#f5f7fb',
    primary: '#4fd1c5',
    secondary: '#7dd3fc',
    border: '#1f2a44',
  },
  fonts: {
    heading: { family: 'IBM Plex Sans' },
    body: { family: 'IBM Plex Sans' },
    mono: { family: 'IBM Plex Mono' },
  },
  personality: {
    animations: {
      easing: 'ease',
      duration: {
        fast: '150ms',
        normal: '300ms',
      },
    },
  },
};

const personality = { id: 'control-center', name: 'Control Center' };

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent, RouterModule.forRoot([])],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://localhost:3000' },
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ThemeService,
          useValue: {
            themeColors$: of(themeColors),
            generatedTheme$: of(generatedTheme),
            personality$: of(personality),
            getTheme: jest.fn().mockReturnValue('dark'),
            getAccentColor: jest.fn().mockReturnValue('#4fd1c5'),
            getCurrentPersonality: jest.fn().mockReturnValue(personality),
            setTheme: jest.fn(),
            setPrimaryColor: jest.fn(),
          },
        },
        {
          provide: AuthStateService,
          useValue: {
            isAuthenticated$: of(false),
            logout: jest.fn(),
          },
        },
        {
          provide: ProfileService,
          useValue: {
            getCurrentUserProfile: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: ProfileContext,
          useValue: {},
        },
        {
          provide: TitleService,
          useValue: {},
        },
        {
          provide: ChatService,
          useValue: {},
        },
        {
          provide: NotificationService,
          useValue: {
            notifications: jest.fn().mockReturnValue([]),
            unreadCount: jest.fn().mockReturnValue(0),
            loadNotifications: jest.fn(),
            markAsRead: jest.fn().mockReturnValue(of(void 0)),
            markAllAsRead: jest.fn().mockReturnValue(of(void 0)),
          },
        },
      ],
    }).compileComponents();
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled).toBeTruthy();
  });

  it(`should have as title 'client-interface'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('client-interface');
  });

  it('renders the murmuration motion background shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-murmuration-scene')).toBeTruthy();
  });
});
