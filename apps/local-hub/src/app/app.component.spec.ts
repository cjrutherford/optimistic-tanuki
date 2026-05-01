import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { AuthStateService } from './services/auth-state.service';
import { of } from 'rxjs';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

const authStateMock = {
  isAuthenticated$: of(false),
  isAuthenticated: false,
  logout: jest.fn(),
};

const themeServiceMock = {
  setPersonality: jest.fn(),
  setTheme: jest.fn(),
  setPrimaryColor: jest.fn(),
  getTheme: jest.fn().mockReturnValue('light'),
  getAccentColor: jest.fn().mockReturnValue('#0055ff'),
  getCurrentPersonality: jest.fn().mockReturnValue({
    id: 'bold',
    name: 'Bold',
    animations: {
      easing: 'ease',
      duration: {
        fast: '150ms',
        normal: '300ms',
      },
    },
  }),
  themeColors$: of({
    background: '#ffffff',
    foreground: '#111111',
    accent: '#0055ff',
  }),
  generatedTheme$: of(undefined),
  personality$: of(undefined),
};

describe('AppComponent', () => {
  let fixture: ComponentFixture<AppComponent>;
  let app: AppComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        RouterTestingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: AuthStateService, useValue: authStateMock },
        { provide: ThemeService, useValue: themeServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    app = fixture.componentInstance;
  });

  it('should create the app', () => {
    expect(app).toBeTruthy();
  });

  it('should have title "Towne Square"', () => {
    expect(app.title).toEqual('Towne Square');
  });

  it('renders the particle veil motion background shell', () => {
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.motion-background')).toBeTruthy();
    expect(compiled.querySelector('otui-particle-veil')).toBeTruthy();
    expect(compiled.querySelector('.app-content')).toBeTruthy();
  });

  it('does not overwrite the saved personality on startup', () => {
    fixture.detectChanges();

    expect(themeServiceMock.setPersonality).not.toHaveBeenCalled();
  });
});
