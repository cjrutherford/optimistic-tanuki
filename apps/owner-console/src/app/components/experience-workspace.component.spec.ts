import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';
import { AppConfigService } from '../services/app-config.service';
import { RegistryManagementService } from '../services/registry-management.service';
import { ControlCenterService } from '../services/control-center.service';
import { ExperienceWorkspaceComponent } from './experience-workspace.component';

describe('ExperienceWorkspaceComponent', () => {
  const getConfigurations = jest.fn();
  const getRegistry = jest.fn();
  const getRolloutHistory = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    getConfigurations.mockReturnValue(
      of([
        {
          id: 'cfg-1',
          name: 'client-interface',
          domain: 'client.test',
          active: true,
          landingPage: {
            sections: [{ id: 'hero-1' }],
            layout: 'single-column',
          },
          routes: [{ path: '/' }],
          features: {},
          theme: {
            mode: 'light',
            personalityId: 'foundation',
            primaryColor: '#123456',
            secondaryColor: '#654321',
            backgroundColor: '#ffffff',
            textColor: '#111111',
            fontFamily: 'IBM Plex Sans, sans-serif',
            customCss: '',
          },
          release: {
            status: 'changes-pending',
            previewUrl: 'https://preview.client.test',
            publishedVersion: 3,
            releaseNotes: 'Ready for publish',
            changeSummary: 'Homepage tuned',
            history: [
              {
                version: 3,
                releaseNotes: 'Ready for publish',
                changeSummary: 'Homepage tuned',
                publishedAt: '2026-07-04T10:00:00.000Z',
              },
            ],
          },
        },
      ])
    );
    getRegistry.mockReturnValue(
      of({
        success: true,
        data: {
          version: '1.0.1',
          generatedAt: '2026-07-04T10:00:00.000Z',
          apps: [],
        },
        release: {
          status: 'published',
          previewUrl: 'https://preview.registry.test',
          publishedVersion: 4,
          releaseNotes: 'Registry published',
          changeSummary: 'Navigation consolidated',
          history: [
            {
              version: 4,
              releaseNotes: 'Registry published',
              changeSummary: 'Navigation consolidated',
              publishedAt: '2026-07-04T11:00:00.000Z',
            },
          ],
        },
      })
    );
    getRolloutHistory.mockReturnValue(
      of([
        {
          deploymentName: 'dev',
          targetTag: '2026.07.04',
          status: 'succeeded',
          startedAt: '2026-07-04T12:00:00.000Z',
          completedAt: '2026-07-04T12:10:00.000Z',
          services: ['client-interface', 'gateway'],
        },
      ])
    );

    await TestBed.configureTestingModule({
      imports: [ExperienceWorkspaceComponent, RouterTestingModule],
      providers: [
        { provide: AppConfigService, useValue: { getConfigurations } },
        { provide: RegistryManagementService, useValue: { getRegistry } },
        { provide: ControlCenterService, useValue: { getRolloutHistory } },
      ],
    }).compileComponents();
  });

  it('aggregates release readiness across config, theme, and registry surfaces', () => {
    const fixture = TestBed.createComponent(ExperienceWorkspaceComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.releaseStatusCards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'App configurations',
          status: 'Attention',
        }),
        expect.objectContaining({
          title: 'Theme releases',
          status: 'Attention',
        }),
        expect.objectContaining({
          title: 'Application registry',
          status: 'Healthy',
        }),
      ])
    );
  });

  it('builds a cross-surface release timeline for operator review', () => {
    const fixture = TestBed.createComponent(ExperienceWorkspaceComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.releaseTimelineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          surface: 'App Config',
          title: 'client-interface',
        }),
        expect.objectContaining({
          surface: 'Registry',
          title: 'Registry published',
        }),
        expect.objectContaining({
          surface: 'Rollout',
          title: 'Rollout 2026.07.04',
        }),
      ])
    );
  });
});
