import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AppConfiguration } from '@optimistic-tanuki/app-config-models';

import { AppConfigService } from '../../services/app-config.service';
import { AppConfigListComponent } from './app-config-list.component';

describe('AppConfigListComponent', () => {
  const getConfigurations = jest.fn();
  const createConfiguration = jest.fn();
  const deleteConfiguration = jest.fn();
  const navigate = jest.fn();

  const configuration: AppConfiguration = {
    id: 'cfg-1',
    name: 'Primary Config',
    description: 'Main app configuration',
    domain: 'example.com',
    landingPage: {
      layout: 'single-column',
      sections: [],
    },
    routes: [],
    features: {
      social: { enabled: false },
      tasks: { enabled: false },
      blogging: {
        enabled: false,
        allowComments: false,
        moderateComments: false,
      },
      projectPlanning: {
        enabled: false,
        showGantt: false,
        showKanban: false,
        allowRisks: false,
      },
    },
    theme: {
      mode: 'light',
      personalityId: 'foundation',
      primaryColor: '#112233',
      secondaryColor: '#445566',
      backgroundColor: '#ffffff',
      textColor: '#000000',
      fontFamily: 'Roboto, sans-serif',
      customCss: '',
    },
    active: true,
    release: {
      status: 'changes-pending',
      publishedVersion: 2,
      publishedSnapshot: null,
      previewUrl: 'https://example.com',
      history: [],
    },
  };

  function createComponent() {
    TestBed.configureTestingModule({
      imports: [AppConfigListComponent],
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            getConfigurations,
            createConfiguration,
            deleteConfiguration,
          },
        },
        {
          provide: Router,
          useValue: {
            navigate,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(AppConfigListComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    getConfigurations.mockReturnValue(of([configuration]));
    createConfiguration.mockReturnValue(of({ ...configuration, id: 'cfg-2' }));
    deleteConfiguration.mockReturnValue(of(undefined));
  });

  it('shows an inline success message after duplicating a configuration', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    const { component } = createComponent();

    component.duplicateConfiguration(configuration);

    expect(createConfiguration).toHaveBeenCalled();
    expect(component.statusMessage).toBe(
      'Configuration duplicated. The new draft is ready in the list.'
    );
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('shows an inline error message instead of alert when duplication fails', () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    createConfiguration.mockReturnValue(
      throwError(() => new Error('Duplicate failed'))
    );
    const { component } = createComponent();

    component.duplicateConfiguration(configuration);

    expect(component.error).toBe(
      'Failed to duplicate configuration: Duplicate failed'
    );
    expect(alertSpy).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('describes release status for pending and published configurations', () => {
    const { component } = createComponent();

    expect(component.releaseStatusLabel(configuration)).toBe('Changes Pending');
    expect(
      component.releaseStatusLabel({
        ...configuration,
        release: { ...configuration.release!, status: 'published' },
      })
    ).toBe('Published');
  });
});
