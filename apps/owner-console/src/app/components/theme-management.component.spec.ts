import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ThemeManagementComponent } from './theme-management.component';
import { AppConfigService } from '../services/app-config.service';
import { ThemeService } from '@optimistic-tanuki/theme-lib';

describe('ThemeManagementComponent', () => {
  const appConfigService = {
    getConfigurations: jest.fn(),
    updateConfiguration: jest.fn(),
  };

  const themeService = {
    setPrimaryColor: jest.fn(),
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
          landingPage: { sections: [], layout: 'single-column' },
          routes: [],
          features: {},
          theme: {
            primaryColor: '#831843',
            secondaryColor: '#f472b6',
            backgroundColor: '#fff7fb',
            textColor: '#1f1721',
            fontFamily: 'IBM Plex Sans, sans-serif',
            customCss: '.hero { text-transform: uppercase; }',
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

    component.updateThemeField('primaryColor', '#0f766e');
    component.updateThemeField('fontFamily', 'Source Serif 4, serif');
    component.saveTheme();

    expect(appConfigService.updateConfiguration).toHaveBeenCalledWith('cfg-2', {
      theme: expect.objectContaining({
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
});
