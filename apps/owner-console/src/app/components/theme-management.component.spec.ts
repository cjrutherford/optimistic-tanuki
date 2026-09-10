import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ThemeManagementComponent } from './theme-management.component';
import { AppConfigService } from '../services/app-config.service';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('ThemeManagementComponent', () => {
  const appConfigService = {
    getConfigurations: jest.fn(),
    getConfiguration: jest.fn(),
    updateConfiguration: jest.fn(),
    publishConfiguration: jest.fn(),
    rollbackConfiguration: jest.fn(),
  };

  const themeService = {
    setPrimaryColor: jest.fn(),
    setTheme: jest.fn(),
    setPersonality: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    appConfigService.getConfigurations.mockReturnValue(
      of([
        {
          id: 'cfg-1',
          name: 'trainer-site',
          domain: 'trainer.test',
          active: true,
          landingPage: { sections: [], layout: 'single-column' },
          routes: [],
          features: {},
          theme: {
            mode: 'light',
            personalityId: 'professional',
            primaryColor: '#123456',
            secondaryColor: '#654321',
            backgroundColor: '#ffffff',
            textColor: '#111111',
            fontFamily: 'Arial, sans-serif',
            customCss: '',
          },
        },
        {
          id: 'cfg-2',
          name: 'christopherrutherford-net',
          domain: 'christopherrutherford.net',
          active: true,
          revision: 7,
          landingPage: { sections: [], layout: 'single-column' },
          routes: [],
          features: {},
          theme: {
            mode: 'light',
            personalityId: 'foundation',
            primaryColor: '#831843',
            secondaryColor: '#f472b6',
            backgroundColor: '#fff7fb',
            textColor: '#1f1721',
            fontFamily: 'IBM Plex Sans, sans-serif',
            customCss: '.hero { text-transform: uppercase; }',
          },
          release: {
            status: 'changes-pending',
            previewUrl: '/preview/christopherrutherford-net',
            publishedVersion: 2,
            publishedAt: new Date('2026-07-03T10:00:00.000Z'),
            releaseNotes: 'Theme baseline published.',
            changeSummary: 'Foundation theme refresh.',
            history: [
              {
                version: 2,
                status: 'published',
                publishedAt: new Date('2026-07-03T10:00:00.000Z'),
                releasedAt: new Date('2026-07-03T10:00:00.000Z'),
                releaseNotes: 'Theme baseline published.',
                changeSummary: 'Foundation theme refresh.',
                snapshot: {
                  theme: {
                    mode: 'light',
                    personalityId: 'foundation',
                    primaryColor: '#831843',
                    secondaryColor: '#f472b6',
                    backgroundColor: '#fff7fb',
                    textColor: '#1f1721',
                    fontFamily: 'IBM Plex Sans, sans-serif',
                    customCss: '.hero { text-transform: uppercase; }',
                  },
                },
              },
              {
                version: 1,
                status: 'published',
                publishedAt: new Date('2026-06-30T10:00:00.000Z'),
                releasedAt: new Date('2026-06-30T10:00:00.000Z'),
                releaseNotes: 'Initial theme release.',
                changeSummary: 'Professional launch palette.',
                snapshot: {
                  theme: {
                    mode: 'light',
                    personalityId: 'professional',
                    primaryColor: '#123456',
                    secondaryColor: '#654321',
                    backgroundColor: '#ffffff',
                    textColor: '#111111',
                    fontFamily: 'Arial, sans-serif',
                    customCss: '',
                  },
                },
              },
            ],
          },
        },
      ])
    );
    appConfigService.updateConfiguration.mockImplementation(
      (id: string, dto: { theme: unknown }) =>
        of({
          id,
          name: 'christopherrutherford-net',
          domain: 'christopherrutherford.net',
          active: true,
          landingPage: { sections: [], layout: 'single-column' },
          routes: [],
          features: {},
          theme: dto.theme,
        })
    );
    appConfigService.publishConfiguration.mockReturnValue(
      of({
        id: 'cfg-2',
        name: 'christopherrutherford-net',
        domain: 'christopherrutherford.net',
        active: true,
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {
          mode: 'dark',
          personalityId: 'control-center',
          primaryColor: '#0f766e',
          secondaryColor: '#14b8a6',
          backgroundColor: '#052e2b',
          textColor: '#ecfeff',
          fontFamily: 'Source Serif 4, serif',
          customCss: '.hero { letter-spacing: 0.08em; }',
        },
        release: {
          status: 'published',
          previewUrl: '/preview/christopherrutherford-net',
          publishedVersion: 3,
          publishedAt: new Date('2026-07-04T10:00:00.000Z'),
          releaseNotes: 'Dark theme published.',
          changeSummary: 'Control center palette.',
          history: [],
        },
      })
    );
    appConfigService.rollbackConfiguration.mockReturnValue(
      of({
        id: 'cfg-2',
        name: 'christopherrutherford-net',
        domain: 'christopherrutherford.net',
        active: true,
        landingPage: { sections: [], layout: 'single-column' },
        routes: [],
        features: {},
        theme: {
          mode: 'light',
          personalityId: 'foundation',
          primaryColor: '#831843',
          secondaryColor: '#f472b6',
          backgroundColor: '#fff7fb',
          textColor: '#1f1721',
          fontFamily: 'IBM Plex Sans, sans-serif',
          customCss: '.hero { text-transform: uppercase; }',
        },
        release: {
          status: 'published',
          previewUrl: '/preview/christopherrutherford-net',
          publishedVersion: 2,
          publishedAt: new Date('2026-07-03T10:00:00.000Z'),
          releaseNotes: 'Theme baseline published.',
          changeSummary: 'Foundation theme refresh.',
          history: [],
        },
      })
    );

    await TestBed.configureTestingModule({
      imports: [ThemeManagementComponent],
      providers: [
        { provide: AppConfigService, useValue: appConfigService },
        { provide: ThemeService, useValue: themeService },
      ],
    }).compileComponents();
  });

  it('loads configurations and prefers the christopherrutherford-net target', () => {
    const fixture = TestBed.createComponent(ThemeManagementComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(appConfigService.getConfigurations).toHaveBeenCalled();
    expect(component.selectedConfigId).toBe('cfg-2');
    expect(component.selectedConfiguration?.name).toBe(
      'christopherrutherford-net'
    );
    expect(themeService.setPrimaryColor).toHaveBeenCalledWith('#831843');
  });

  it('persists the edited theme through the app configuration service', () => {
    const fixture = TestBed.createComponent(ThemeManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.updateThemeField('mode', 'dark');
    component.updateThemeField('personalityId', 'control-center');
    component.updateThemeField('primaryColor', '#0f766e');
    component.updateThemeField('fontFamily', 'Source Serif 4, serif');
    component.saveTheme();

    expect(appConfigService.updateConfiguration).toHaveBeenCalledWith('cfg-2', {
      expectedRevision: 7,
      theme: expect.objectContaining({
        mode: 'dark',
        personalityId: 'control-center',
        primaryColor: '#0f766e',
        fontFamily: 'Source Serif 4, serif',
      }),
    });
    expect(component.successMessage).toContain('Saved theme');
  });

  it('restores the persisted theme values when reset is triggered', () => {
    const fixture = TestBed.createComponent(ThemeManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.updateThemeField('primaryColor', '#0f766e');
    component.resetDraft();

    expect(component.themeDraft.primaryColor).toBe('#831843');
    expect(component.themeDraft.customCss).toBe(
      '.hero { text-transform: uppercase; }'
    );
  });

  it('publishes the current theme configuration with release notes', () => {
    const fixture = TestBed.createComponent(ThemeManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.updateThemeField('mode', 'dark');
    component.updateThemeField('personalityId', 'control-center');
    component.updateThemeField('primaryColor', '#0f766e');
    component.updateThemeField('secondaryColor', '#14b8a6');
    component.updateThemeField('backgroundColor', '#052e2b');
    component.updateThemeField('textColor', '#ecfeff');
    component.updateThemeField('fontFamily', 'Source Serif 4, serif');
    component.updateThemeField(
      'customCss',
      '.hero { letter-spacing: 0.08em; }'
    );
    component.releaseNotes = 'Dark theme published.';
    component.changeSummary = 'Control center palette.';

    component.publishTheme();

    expect(appConfigService.publishConfiguration).toHaveBeenCalledWith(
      'cfg-2',
      {
        expectedRevision: 7,
        releaseNotes: 'Dark theme published.',
        changeSummary: 'Control center palette.',
      }
    );
    expect(component.successMessage).toContain('published');
    expect(component.selectedConfiguration?.release?.publishedVersion).toBe(3);
  });

  it('rolls back the theme to a selected published revision', () => {
    const fixture = TestBed.createComponent(ThemeManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.rollbackTheme(2);

    expect(appConfigService.rollbackConfiguration).toHaveBeenCalledWith(
      'cfg-2',
      {
        expectedRevision: 7,
        version: 2,
        releaseNotes: 'Rollback from theme management',
      }
    );
    expect(component.successMessage).toContain('rolled back');
    expect(component.themeDraft.primaryColor).toBe('#831843');
  });

  it.each(['save', 'publish', 'rollback'] as const)(
    'preserves revision 0 for %s mutations',
    (action) => {
      const fixture = TestBed.createComponent(ThemeManagementComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.selectedConfiguration = {
        ...component.selectedConfiguration!,
        revision: 0,
      };

      if (action === 'save') {
        component.saveTheme();
        expect(appConfigService.updateConfiguration).toHaveBeenCalledWith(
          'cfg-2',
          expect.objectContaining({ expectedRevision: 0 })
        );
      } else if (action === 'publish') {
        component.releaseNotes = 'Launch ready';
        component.publishTheme();
        expect(appConfigService.publishConfiguration).toHaveBeenCalledWith(
          'cfg-2',
          expect.objectContaining({ expectedRevision: 0 })
        );
      } else {
        component.rollbackTheme(2);
        expect(appConfigService.rollbackConfiguration).toHaveBeenCalledWith(
          'cfg-2',
          expect.objectContaining({ expectedRevision: 0 })
        );
      }
    }
  );

  it.each([
    ['save', undefined],
    ['publish', -1],
    ['rollback', 1.5],
  ] as const)(
    'blocks %s when the loaded revision is invalid',
    (action, revision) => {
      const fixture = TestBed.createComponent(ThemeManagementComponent);
      fixture.detectChanges();
      const component = fixture.componentInstance;
      component.selectedConfiguration = {
        ...component.selectedConfiguration!,
        revision,
      };

      if (action === 'save') {
        component.saveTheme();
      } else if (action === 'publish') {
        component.releaseNotes = 'Launch ready';
        component.publishTheme();
      } else {
        component.rollbackTheme(2);
      }

      expect(appConfigService.updateConfiguration).not.toHaveBeenCalled();
      expect(appConfigService.publishConfiguration).not.toHaveBeenCalled();
      expect(appConfigService.rollbackConfiguration).not.toHaveBeenCalled();
      expect(component.error).toContain('valid nonnegative integer revision');
      expect(component.error).toContain(
        'Reload the latest theme configuration'
      );
    }
  );

  it('preserves the local theme draft and offers the latest reload after a revision conflict', () => {
    const fixture = TestBed.createComponent(ThemeManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.updateThemeField('primaryColor', '#0f766e');
    appConfigService.updateConfiguration.mockReturnValueOnce(
      throwError(() => ({ status: 409, statusText: 'Conflict' }))
    );

    component.saveTheme();
    fixture.detectChanges();

    expect(component.themeDraft.primaryColor).toBe('#0f766e');
    expect(component.error).toContain('reload the latest theme configuration');
    expect(
      fixture.nativeElement.querySelector('[data-reload-latest]')
    ).toBeTruthy();
  });

  it('reloads the current selected configuration when requested after a conflict', () => {
    const fixture = TestBed.createComponent(ThemeManagementComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const latestConfiguration = {
      ...component.selectedConfiguration!,
      revision: 8,
      theme: {
        ...component.selectedConfiguration!.theme,
        primaryColor: '#2563eb',
      },
    };
    appConfigService.getConfiguration.mockReturnValueOnce(
      of(latestConfiguration)
    );

    component.reloadLatestConfiguration();

    expect(appConfigService.getConfiguration).toHaveBeenCalledWith('cfg-2');
    expect(component.selectedConfiguration?.revision).toBe(8);
    expect(component.themeDraft.primaryColor).toBe('#2563eb');
  });
});
