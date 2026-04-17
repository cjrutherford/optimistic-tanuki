import { Component, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ThemeService } from '@optimistic-tanuki/theme-lib';
import { of } from 'rxjs';
import { AppComponent } from './app.component';
import { ProfileContext } from './profile.context';
import { TitleBarComponent } from './components/title-bar/title-bar.component';
import { TenantContextService } from './tenant-context.service';

@Component({
  selector: 'fc-title-bar',
  standalone: true,
  template: '',
})
class StubTitleBarComponent {}

describe('AppComponent', () => {
  beforeEach(async () => {
    TestBed.overrideComponent(AppComponent, {
      remove: {
        imports: [TitleBarComponent],
      },
      add: {
        imports: [StubTitleBarComponent],
      },
    });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: PLATFORM_ID, useValue: 'browser' },
        {
          provide: ThemeService,
          useValue: {
            setTheme: jest.fn(),
            setPersonality: jest.fn(),
            setPrimaryColor: jest.fn(),
            getTheme: jest.fn().mockReturnValue('light'),
            themeColors$: of({
              background: '#f8fafc',
              foreground: '#0f172a',
              accent: '#2563eb',
            }),
            personality$: of(undefined),
          },
        },
        {
          provide: ProfileContext,
          useValue: {
            isAuthenticated: () => false,
            loadProfile: jest.fn(),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            loadTenantContext: jest.fn(),
          },
        },
      ],
    }).compileComponents();
  });

  it('renders the application shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.app-content')).not.toBeNull();
  });

  it('defaults Fin Commander to the shark personality when no theme is stored', () => {
    const themeService = TestBed.inject(ThemeService);
    const fixture = TestBed.createComponent(AppComponent);

    fixture.detectChanges();

    expect(themeService.setPersonality).toHaveBeenCalledWith(
      'fin-commander-shark'
    );
    expect(themeService.setPrimaryColor).toHaveBeenCalledWith('#0d5f73');
  });
});
