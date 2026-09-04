import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BootstrapOnboardingComponent } from './bootstrap-onboarding.component';
import { SetupClientService } from '../services/setup-client.service';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import type {
  SetupSettingFieldDescriptor,
  SetupSettingsTarget,
} from '../../shared/setup.models';

/**
 * The spec beside this one covers the wizard's pure logic. These drive the
 * flows that talk to SetupClientService: what each one sends, what it does
 * with the reply, and how it degrades when the request fails. Every load and
 * save here has an error path that the UI depends on, so both are exercised.
 */
describe('BootstrapOnboardingComponent flows', () => {
  interface SetupMock {
    getStatus: jest.Mock;
    getEnvironments: jest.Mock;
    getConfig: jest.Mock;
    getSecrets: jest.Mock;
    getEmailStatus: jest.Mock;
    getOperatorSummary: jest.Mock;
    getDeployProgress: jest.Mock;
    getSettingsCatalog: jest.Mock;
    getOAuthProviders: jest.Mock;
    getOAuthApps: jest.Mock;
    saveConfig: jest.Mock;
    saveSecrets: jest.Mock;
    configureEmail: jest.Mock;
    testEmail: jest.Mock;
    createEnvironment: jest.Mock;
    takeOverDeployment: jest.Mock;
    browseHostPath: jest.Mock;
    uploadManagedFile: jest.Mock;
    saveOperator: jest.Mock;
    testOAuthProvider: jest.Mock;
  }

  let setup: SetupMock;
  let registry: { getAllApps: jest.Mock };

  const field = (
    key: string,
    overrides: Partial<SetupSettingFieldDescriptor> = {}
  ): SetupSettingFieldDescriptor =>
    ({
      id: `field:${key}`,
      key,
      label: key,
      valueType: 'string',
      ...overrides,
    } as SetupSettingFieldDescriptor);

  const target = (
    id: string,
    overrides: Partial<SetupSettingsTarget> = {}
  ): SetupSettingsTarget =>
    ({
      id,
      label: id,
      groupId: 'services',
      targetKind: 'service',
      fields: [],
      secrets: [],
      ...overrides,
    } as SetupSettingsTarget);

  const build = (platform: 'browser' | 'server' = 'browser') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: SetupClientService, useValue: setup },
        { provide: AppRegistryService, useValue: registry },
        { provide: PLATFORM_ID, useValue: platform },
      ],
    });

    return TestBed.runInInjectionContext(
      () => new BootstrapOnboardingComponent()
    );
  };

  const fails = (message = 'boom') => throwError(() => new Error(message));

  beforeEach(() => {
    setup = {
      getStatus: jest.fn().mockReturnValue(of({ configured: false })),
      getEnvironments: jest
        .fn()
        .mockReturnValue(
          of({ activeEnvironment: 'production', environments: ['production'] })
        ),
      getConfig: jest.fn().mockReturnValue(of({ success: false })),
      getSecrets: jest.fn().mockReturnValue(of({ success: true, data: {} })),
      getEmailStatus: jest.fn().mockReturnValue(of({ host: 'mail.test' })),
      getOperatorSummary: jest
        .fn()
        .mockReturnValue(of({ saved: false, operator: null })),
      // A real snapshot always carries the phase list; the component maps it
      // unconditionally.
      getDeployProgress: jest
        .fn()
        .mockReturnValue(
          of({ activePhase: 'building', message: '', logs: [], phases: [] })
        ),
      getSettingsCatalog: jest
        .fn()
        .mockReturnValue(of({ groups: [], targets: [] })),
      getOAuthProviders: jest.fn().mockReturnValue(
        of({
          bridgeAppId: 'client-interface',
          bridgeAppDomain: 'app.test',
          bridgeAppBaseUrl: 'https://app.test',
          providers: [],
        })
      ),
      getOAuthApps: jest.fn().mockReturnValue(of({ apps: [] })),
      saveConfig: jest.fn().mockReturnValue(of({ success: true })),
      saveSecrets: jest.fn().mockReturnValue(of({ success: true })),
      configureEmail: jest.fn().mockReturnValue(of({ success: true })),
      testEmail: jest.fn().mockReturnValue(of({ success: true })),
      createEnvironment: jest.fn(),
      takeOverDeployment: jest.fn(),
      browseHostPath: jest
        .fn()
        .mockReturnValue(of({ currentPath: '/srv', entries: [] })),
      uploadManagedFile: jest
        .fn()
        .mockReturnValue(of({ success: true, path: '/managed/ca.pem' })),
      saveOperator: jest.fn().mockReturnValue(of({ saved: true })),
      testOAuthProvider: jest.fn().mockReturnValue(of({ reachable: true })),
    };

    registry = { getAllApps: jest.fn().mockReturnValue(of([])) };
  });

  describe('loadSecrets', () => {
    it('turns the secret map into sorted entries', () => {
      const component = build();
      setup.getSecrets.mockReturnValue(
        of({ success: true, data: { ZED: '1', ALPHA: '2' } })
      );

      component.loadSecrets();

      expect(component.secretEntries.map((e) => e.key)).toEqual([
        'ALPHA',
        'ZED',
      ]);
    });

    it('feeds loaded secrets into the oauth provider values', () => {
      const component = build();
      setup.getSecrets.mockReturnValue(
        of({
          success: true,
          data: { GITHUB_CLIENT_ID: 'cid', GITHUB_CLIENT_SECRET: 'sec' },
        })
      );

      component.loadSecrets();

      expect(component.oauthProviderValues['github']).toMatchObject({
        clientId: 'cid',
        clientSecret: 'sec',
      });
    });

    it('empties the list when the request fails', () => {
      const component = build();
      component.secretEntries = [{ key: 'STALE', value: 'x' }];
      setup.getSecrets.mockReturnValue(fails());

      component.loadSecrets();

      expect(component.secretEntries).toEqual([]);
    });
  });

  describe('loadSettingsCatalog', () => {
    it('adopts the catalog and selects the first group and target', () => {
      const component = build();
      setup.getSettingsCatalog.mockReturnValue(
        of({
          groups: [{ id: 'services', label: 'Services' }],
          targets: [target('svc-1'), target('svc-2')],
        })
      );

      component['loadSettingsCatalog']();

      expect(component.selectedSettingsGroupId).toBe('services');
      expect(component.selectedSettingsTargetId).toBe('svc-1');
    });

    it('replaces a selected target that the new catalog does not contain', () => {
      const component = build();
      component.selectSettingsTarget('gone');
      setup.getSettingsCatalog.mockReturnValue(
        of({ groups: [], targets: [target('svc-1')] })
      );

      component['loadSettingsCatalog']();

      expect(component.selectedSettingsTargetId).toBe('svc-1');
    });

    it('falls back to an empty catalog when the request fails', () => {
      const component = build();
      setup.getSettingsCatalog.mockReturnValue(fails());

      component['loadSettingsCatalog']();

      expect(component.settingsCatalog).toEqual({ groups: [], targets: [] });
    });
  });

  describe('loadOAuthGuidance', () => {
    it('records the bridge app and merges provider guidance', () => {
      const component = build();
      setup.getOAuthProviders.mockReturnValue(
        of({
          bridgeAppId: 'client-interface',
          bridgeAppDomain: 'app.test',
          bridgeAppBaseUrl: 'https://app.test',
          providers: [
            {
              name: 'github',
              enabled: true,
              clientIdKey: 'GITHUB_CLIENT_ID',
              clientSecretKey: 'GITHUB_CLIENT_SECRET',
              clientIdValue: 'from-server',
              clientSecretValue: 'secret-from-server',
              redirectUri: '',
            },
          ],
        })
      );
      setup.getOAuthApps.mockReturnValue(
        of({ apps: [{ appId: 'a', oauthEligible: true }] })
      );

      component['loadOAuthGuidance']();

      expect(component.oauthBridgeAppBaseUrl).toBe('https://app.test');
      expect(component.oauthApps).toHaveLength(1);
      expect(component.oauthProviderValues['github']).toMatchObject({
        enabled: true,
        clientId: 'from-server',
        clientSecret: 'secret-from-server',
        // No redirect from the server, so it falls back to the suggestion.
        redirectUri: 'https://app.test/oauth/callback/github',
      });
    });

    it('prefers an already loaded secret over the value the server echoes', () => {
      const component = build();
      component.secretEntries = [
        { key: 'GITHUB_CLIENT_ID', value: 'from-secrets' },
      ];
      setup.getOAuthProviders.mockReturnValue(
        of({
          bridgeAppId: '',
          bridgeAppDomain: '',
          bridgeAppBaseUrl: '',
          providers: [
            {
              name: 'github',
              enabled: false,
              clientIdKey: 'GITHUB_CLIENT_ID',
              clientSecretKey: 'GITHUB_CLIENT_SECRET',
              clientIdValue: 'from-server',
              clientSecretValue: '',
              redirectUri: '',
            },
          ],
        })
      );

      component['loadOAuthGuidance']();

      expect(component.oauthProviderValues['github'].clientId).toBe(
        'from-secrets'
      );
    });

    it('ignores a provider the component does not know about', () => {
      const component = build();
      setup.getOAuthProviders.mockReturnValue(
        of({
          bridgeAppId: '',
          bridgeAppDomain: '',
          bridgeAppBaseUrl: '',
          providers: [{ name: 'gitlab', enabled: true }],
        })
      );

      component['loadOAuthGuidance']();

      expect(component.oauthProviderValues['gitlab']).toBeUndefined();
    });

    it('derives the app list from local config when the request fails', () => {
      const component = build();
      component.config.apps = [
        {
          appId: 'a',
          appType: 'client',
          domain: 'a.test',
          uiBaseUrl: 'https://a.test',
          apiBaseUrl: '',
        },
        {
          appId: 'svc',
          appType: 'service',
          domain: '',
          uiBaseUrl: '',
          apiBaseUrl: '',
        },
      ] as never;
      component.config.oauth.providers = {
        github: { enabled: true },
        google: { enabled: false },
      } as never;
      setup.getOAuthProviders.mockReturnValue(fails());

      component['loadOAuthGuidance']();

      // Only client/admin apps become oauth targets, and only enabled
      // providers are offered for them.
      expect(component.oauthApps).toHaveLength(1);
      expect(component.oauthApps[0]).toMatchObject({
        appId: 'a',
        oauthEligible: true,
        allowedProviders: ['github'],
        returnToOrigin: 'https://a.test',
      });
    });
  });

  describe('restoreOAuthStateFromConfig', () => {
    it('adopts the stored provider state', () => {
      const component = build();
      component.config.oauth.providers = {
        github: {
          enabled: true,
          redirectUri: 'https://app.test/cb',
          clientIdKey: 'GH_ID',
          clientSecretKey: 'GH_SECRET',
        },
      } as never;

      component['restoreOAuthStateFromConfig']();

      expect(component.oauthProviderValues['github']).toMatchObject({
        enabled: true,
        redirectUri: 'https://app.test/cb',
      });
      const github = component.oauthProviders.find((p) => p.name === 'github');
      expect(github).toMatchObject({
        enabled: true,
        clientIdKey: 'GH_ID',
        clientSecretKey: 'GH_SECRET',
      });
    });

    it('leaves providers absent from the config alone', () => {
      const component = build();
      component.config.oauth.providers = {} as never;

      component['restoreOAuthStateFromConfig']();

      expect(component.oauthProviderValues['github'].enabled).toBe(false);
    });
  });

  describe('email setup', () => {
    it('adopts the reported status', () => {
      const component = build();
      setup.getEmailStatus.mockReturnValue(
        of({ host: 'smtp.test', port: 25, configured: true })
      );

      component.loadEmailSetup();

      expect(component.emailSetup).toMatchObject({ host: 'smtp.test' });
    });

    it('sends the password only when one was typed, then reloads', () => {
      const component = build();
      component.emailSetup = {
        host: 'smtp.test',
        port: 587,
        secure: false,
        user: 'postmaster',
        from: 'no-reply@test',
      } as never;
      component.emailPassword = 'hunter2';

      component.saveEmailSetup();

      expect(setup.configureEmail).toHaveBeenCalledWith(
        expect.objectContaining({ password: 'hunter2' }),
        'production'
      );
      // The typed password is cleared once it has been stored.
      expect(component.emailPassword).toBe('');
      expect(setup.getEmailStatus).toHaveBeenCalled();
      expect(component.loading).toBe(false);
    });

    it('omits the password when the field is empty', () => {
      const component = build();
      component.emailPassword = '';

      component.saveEmailSetup();

      expect(setup.configureEmail).toHaveBeenCalledWith(
        expect.objectContaining({ password: undefined }),
        'production'
      );
    });

    it('surfaces the server message when saving fails', () => {
      const component = build();
      setup.configureEmail.mockReturnValue(
        throwError(() => ({ error: { message: 'smtp rejected' } }))
      );

      component.saveEmailSetup();

      expect(component.error).toBe('smtp rejected');
      expect(component.loading).toBe(false);
    });

    it('falls back to the error message when there is no server message', () => {
      const component = build();
      setup.configureEmail.mockReturnValue(fails('network down'));

      component.saveEmailSetup();

      expect(component.error).toBe('network down');
    });

    it('tracks the test-send lifecycle', () => {
      const component = build();
      component.emailTestRecipient = 'to@test';

      component.testEmailConnection();

      expect(setup.testEmail).toHaveBeenCalledWith(
        'to@test',
        component.emailSetup.from,
        'production'
      );
      expect(component.emailTestState).toBe('sent');
    });

    it('records a failed test send', () => {
      const component = build();
      setup.testEmail.mockReturnValue(fails('no route'));

      component.testEmailConnection();

      expect(component.emailTestState).toBe('error');
      expect(component.error).toBe('no route');
    });
  });

  describe('operator summary', () => {
    it('prefills the form from a saved operator', () => {
      const component = build();
      setup.getOperatorSummary.mockReturnValue(
        of({ saved: true, operator: { name: 'Ada', email: 'ada@test' } })
      );

      component.loadOperatorSummary();

      expect(component.operatorName).toBe('Ada');
      expect(component.operatorEmail).toBe('ada@test');
    });

    it('does not overwrite the form while the operator is being replaced', () => {
      const component = build();
      component.replaceSavedOperator = true;
      component.operatorName = 'typing';
      setup.getOperatorSummary.mockReturnValue(
        of({ saved: true, operator: { name: 'Ada', email: 'ada@test' } })
      );

      component.loadOperatorSummary();

      expect(component.operatorName).toBe('typing');
    });

    it('holds no operator when none is saved or the request fails', () => {
      const component = build();

      component.loadOperatorSummary();
      expect(component.savedOperator).toBeNull();

      setup.getOperatorSummary.mockReturnValue(fails());
      component.loadOperatorSummary();
      expect(component.savedOperator).toBeNull();
    });

    it('normalises the email and advances after saving', () => {
      const component = build();
      component.operatorName = 'Ada';
      component.operatorEmail = '  Ada@Test.COM ';
      component.operatorPassword = 'pw';
      component.replaceSavedOperator = true;
      const step = component.currentStep;

      component.saveOperator();

      expect(setup.saveOperator).toHaveBeenCalledWith(
        'Ada',
        '  Ada@Test.COM ',
        'pw'
      );
      expect(component.savedOperator).toMatchObject({
        email: 'ada@test.com',
        passwordSaved: true,
        source: 'saved',
      });
      expect(component.replaceSavedOperator).toBe(false);
      expect(component.currentStep).toBe(step + 1);
    });

    it('stays on the step when saving the operator fails', () => {
      const component = build();
      setup.saveOperator.mockReturnValue(fails('rejected'));
      const step = component.currentStep;

      component.saveOperator();

      expect(component.error).toBe('rejected');
      expect(component.currentStep).toBe(step);
    });
  });

  describe('saveConfig', () => {
    it('always includes the core services, whatever is selected', () => {
      const component = build();
      component.selectedBackendIds = ['forum'];

      component.saveConfig();

      const [saved] = setup.saveConfig.mock.calls[0];
      expect(saved.environment.services).toEqual([
        'gateway',
        'authentication',
        'forum',
      ]);
      expect(saved.services.every((s: { enabled: boolean }) => s.enabled)).toBe(
        true
      );
    });

    it('does not list a core service twice when it is also selected', () => {
      const component = build();
      component.selectedBackendIds = ['gateway', 'forum'];

      component.saveConfig();

      const [saved] = setup.saveConfig.mock.calls[0];
      expect(
        saved.environment.services.filter((id: string) => id === 'gateway')
      ).toHaveLength(1);
    });

    it('carries an existing database binding onto the rebuilt service', () => {
      const component = build();
      component.selectedBackendIds = [];
      component.config.services = [
        {
          serviceId: 'gateway',
          database: {
            slotId: 'postgres-primary',
            databaseName: 'gw',
            username: '',
            passwordKey: '',
          },
        },
      ] as never;

      component.saveConfig();

      const [saved] = setup.saveConfig.mock.calls[0];
      const gateway = saved.services.find(
        (s: { serviceId: string }) => s.serviceId === 'gateway'
      );
      expect(gateway.database).toMatchObject({ databaseName: 'gw' });
    });

    it('prefers config routing over the registry defaults', () => {
      const component = build();
      component.registryApps = [
        {
          appId: 'a',
          appType: 'client',
          domain: 'registry.test',
          uiBaseUrl: 'https://registry.test',
          apiBaseUrl: '',
        },
      ] as never;
      component.config.apps = [
        {
          appId: 'a',
          domain: 'configured.test',
          uiBaseUrl: '',
          apiBaseUrl: '',
        },
      ] as never;

      component.saveConfig();

      const [saved] = setup.saveConfig.mock.calls[0];
      expect(saved.apps[0].domain).toBe('configured.test');
      // Nothing configured for the ui base url, so the registry wins there.
      expect(saved.apps[0].uiBaseUrl).toBe('https://registry.test');
    });

    it('stamps the wizard position and advances on success', () => {
      const component = build();
      component.currentStep = 2;

      component.saveConfig();

      const [saved] = setup.saveConfig.mock.calls[0];
      expect(saved.wizard.currentStep).toBe(3);
      expect(saved.wizard.updatedAt).toEqual(expect.any(String));
      expect(component.currentStep).toBe(3);
      expect(component.loading).toBe(false);
    });

    it('stays on the step and reports the error on failure', () => {
      const component = build();
      component.currentStep = 2;
      setup.saveConfig.mockReturnValue(fails('disk full'));

      component.saveConfig();

      expect(component.error).toBe('disk full');
      expect(component.currentStep).toBe(2);
      expect(component.loading).toBe(false);
    });
  });

  describe('selectEnvironment', () => {
    it('reloads everything for a different environment', () => {
      const component = build();

      component.selectEnvironment('staging');

      expect(component.activeEnvironment).toBe('staging');
      expect(setup.getConfig).toHaveBeenCalledWith('staging');
      expect(setup.getSecrets).toHaveBeenCalledWith('staging');
    });

    it('does nothing for the current environment or an empty name', () => {
      const component = build();

      component.selectEnvironment('production');
      component.selectEnvironment('');

      expect(setup.getConfig).not.toHaveBeenCalled();
    });
  });

  describe('createEnvironment', () => {
    it('refuses an empty name without calling the service', () => {
      const component = build();
      component.newEnvironmentName = '   ';

      component.createEnvironment();

      expect(component.error).toBe('Environment name is required');
      expect(setup.createEnvironment).not.toHaveBeenCalled();
    });

    it('adopts the new environment and loads it', () => {
      const component = build();
      component.newEnvironmentName = ' staging ';
      component.availableEnvironments = ['production'];
      setup.createEnvironment.mockReturnValue(
        of({ success: true, data: { ...component.config } })
      );

      component.createEnvironment();

      expect(setup.createEnvironment).toHaveBeenCalledWith('staging');
      expect(component.activeEnvironment).toBe('staging');
      expect(component.newEnvironmentName).toBe('');
      expect(component.availableEnvironments).toEqual([
        'production',
        'staging',
      ]);
      expect(setup.getSettingsCatalog).toHaveBeenCalled();
      expect(setup.getSecrets).toHaveBeenCalled();
    });

    it('does not duplicate an environment that is already listed', () => {
      const component = build();
      component.newEnvironmentName = 'production';
      component.availableEnvironments = ['production'];
      setup.createEnvironment.mockReturnValue(
        of({ success: true, data: { ...component.config } })
      );

      component.createEnvironment();

      expect(component.availableEnvironments).toEqual(['production']);
    });

    it('reports a failure', () => {
      const component = build();
      component.newEnvironmentName = 'staging';
      setup.createEnvironment.mockReturnValue(fails('exists'));

      component.createEnvironment();

      expect(component.error).toBe('exists');
      expect(component.loading).toBe(false);
    });
  });

  describe('takeOverDeployment', () => {
    it('refuses an empty deployment path', () => {
      const component = build();
      component.takeoverDeploymentPath = '  ';

      component.takeOverDeployment();

      expect(component.error).toBe('Deployment path is required');
      expect(setup.takeOverDeployment).not.toHaveBeenCalled();
    });

    it('sends the trimmed paths, omitting the optional ones when blank', () => {
      const component = build();
      component.takeoverDeploymentPath = ' /srv/app ';
      component.takeoverSecretsPath = '';
      component.takeoverEnvironmentName = '';
      setup.takeOverDeployment.mockReturnValue(
        of({
          success: true,
          data: { ...component.config },
          environment: 'imported',
        })
      );

      component.takeOverDeployment();

      expect(setup.takeOverDeployment).toHaveBeenCalledWith({
        deploymentPath: '/srv/app',
        secretsPath: undefined,
        environmentName: undefined,
      });
      expect(component.activeEnvironment).toBe('imported');
      expect(component.takeoverEnvironmentName).toBe('');
      expect(component.availableEnvironments).toContain('imported');
    });

    it('passes the optional paths through when they are set', () => {
      const component = build();
      component.takeoverDeploymentPath = '/srv/app';
      component.takeoverSecretsPath = ' /srv/.env ';
      component.takeoverEnvironmentName = ' legacy ';
      setup.takeOverDeployment.mockReturnValue(
        of({
          success: true,
          data: { ...component.config },
          environment: 'legacy',
        })
      );

      component.takeOverDeployment();

      expect(setup.takeOverDeployment).toHaveBeenCalledWith({
        deploymentPath: '/srv/app',
        secretsPath: '/srv/.env',
        environmentName: 'legacy',
      });
    });

    it('reports a failure', () => {
      const component = build();
      component.takeoverDeploymentPath = '/srv/app';
      setup.takeOverDeployment.mockReturnValue(fails('unreadable'));

      component.takeOverDeployment();

      expect(component.error).toBe('unreadable');
      expect(component.loading).toBe(false);
    });
  });

  describe('host browser', () => {
    it('opens against the current takeover path', () => {
      const component = build();
      component.takeoverDeploymentPath = '/srv/app';

      component.openTakeoverDeploymentBrowser();

      expect(component.hostBrowserOpen).toBe(true);
      expect(setup.browseHostPath).toHaveBeenCalledWith('/srv/app');
    });

    it('records the listing', () => {
      const component = build();
      setup.browseHostPath.mockReturnValue(
        of({
          currentPath: '/srv',
          entries: [{ name: 'app', path: '/srv/app' }],
        })
      );

      component.loadHostBrowser('/srv');

      expect(component.hostBrowserListing.entries).toHaveLength(1);
      expect(component.hostBrowserLoading).toBe(false);
    });

    it('reports a browse failure and stops the spinner', () => {
      const component = build();
      setup.browseHostPath.mockReturnValue(fails('permission denied'));

      component.loadHostBrowser('/root');

      expect(component.error).toBe('permission denied');
      expect(component.hostBrowserLoading).toBe(false);
    });

    it('walks up only when there is a parent', () => {
      const component = build();
      component.hostBrowserListing = {
        currentPath: '/srv/app',
        parentPath: '/srv',
        entries: [],
      } as never;

      component.browseHostParent();
      expect(setup.browseHostPath).toHaveBeenCalledWith('/srv');

      setup.browseHostPath.mockClear();
      component.hostBrowserListing = { currentPath: '/', entries: [] } as never;
      component.browseHostParent();
      expect(setup.browseHostPath).not.toHaveBeenCalled();
    });

    it('descends into a directory entry', () => {
      const component = build();

      component.browseHostEntry({
        name: 'app',
        path: '/srv/app',
        directory: true,
      } as never);

      expect(setup.browseHostPath).toHaveBeenCalledWith('/srv/app');
    });

    it('selects a file entry into the takeover path', () => {
      const component = build();
      component.hostBrowserMode = 'file';
      component.openTakeoverEnvBrowser();

      component.browseHostEntry({
        name: '.env',
        path: '/srv/.env',
        directory: false,
      } as never);

      expect(component.takeoverSecretsPath).toBe('/srv/.env');
      expect(component.hostBrowserOpen).toBe(false);
    });

    it('ignores a file entry while browsing for a directory', () => {
      const component = build();
      component.openTakeoverDeploymentBrowser();
      component.hostBrowserMode = 'directory';

      component.browseHostEntry({
        name: '.env',
        path: '/srv/.env',
        directory: false,
      } as never);

      expect(component.takeoverDeploymentPath).toBe('');
      expect(component.hostBrowserOpen).toBe(true);
    });

    it('takes the current directory unless browsing for a file', () => {
      const component = build();
      component.openTakeoverDeploymentBrowser();
      component.hostBrowserMode = 'directory';
      component.hostBrowserListing = {
        currentPath: '/srv/app',
        entries: [],
      } as never;

      component.useCurrentHostDirectory();

      expect(component.takeoverDeploymentPath).toBe('/srv/app');
    });

    it('refuses to take a directory when a file is required', () => {
      const component = build();
      component.openTakeoverDeploymentBrowser();
      component.hostBrowserMode = 'file';
      component.hostBrowserListing = {
        currentPath: '/srv/app',
        entries: [],
      } as never;

      component.useCurrentHostDirectory();

      expect(component.takeoverDeploymentPath).toBe('');
    });

    it('does nothing when no target is open', () => {
      const component = build();

      component['applyHostBrowserSelection']('/srv/app');

      expect(component.takeoverDeploymentPath).toBe('');
    });

    it('writes the selection into a global setting', () => {
      const component = build();
      const f = field('CA_BUNDLE', { valueType: 'file' });

      component.openGlobalHostBrowser(f);
      component['applyHostBrowserSelection']('/srv/ca.pem');

      expect(component.globalValue(f)).toBe('/srv/ca.pem');
      expect(component.hostBrowserMode).toBe('file');
    });

    it('writes the selection into a group setting', () => {
      const component = build();
      const f = field('CA_BUNDLE', { valueType: 'directory' });

      component.openGroupHostBrowser('services', f);
      component['applyHostBrowserSelection']('/srv/certs');

      expect(component.groupValue('services', f)).toBe('/srv/certs');
      expect(component.hostBrowserMode).toBe('directory');
    });

    it('writes the selection into a target override', () => {
      const component = build();
      const t = target('finance');
      const f = field('CA_BUNDLE', { valueType: 'path' });

      component.openTargetHostBrowser(t, f);
      component['applyHostBrowserSelection']('/srv/finance.pem');

      expect(component.targetOwnValue(t, f)).toBe('/srv/finance.pem');
    });

    it('closes and forgets its target', () => {
      const component = build();
      component.openTakeoverDeploymentBrowser();

      component.closeHostBrowser();
      component['applyHostBrowserSelection']('/ignored');

      expect(component.hostBrowserOpen).toBe(false);
      expect(component.takeoverDeploymentPath).toBe('');
    });
  });

  describe('managed file upload', () => {
    /** A FileReader stub whose result and callbacks the test drives. */
    class StubReader {
      static last: StubReader | null = null;
      result: string | ArrayBuffer | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL = jest.fn(() => {
        StubReader.last = this;
      });
      constructor() {
        StubReader.last = this;
      }
    }

    const changeEvent = (file: unknown) =>
      ({
        target: { files: file ? [file] : [], value: 'C:/fake/ca.pem' },
      } as unknown as Event);

    let original: typeof FileReader;

    beforeEach(() => {
      original = global.FileReader;
      (global as { FileReader: unknown }).FileReader = StubReader;
      StubReader.last = null;
    });

    afterEach(() => {
      (global as { FileReader: unknown }).FileReader = original;
    });

    it('does nothing without a file', () => {
      const component = build();

      component.uploadManagedFileForGlobal(changeEvent(null), field('CA'));

      expect(setup.uploadManagedFile).not.toHaveBeenCalled();
    });

    it('does nothing while rendering on the server', () => {
      const component = build('server');

      component.uploadManagedFileForGlobal(
        changeEvent({ name: 'ca.pem' }),
        field('CA')
      );

      expect(setup.uploadManagedFile).not.toHaveBeenCalled();
    });

    it('strips the data-url prefix before uploading, then stores the path', () => {
      const component = build();
      const f = field('CA');
      const event = changeEvent({ name: 'ca.pem' });

      component.uploadManagedFileForGlobal(event, f);
      expect(component.managedUploadInFlightFieldId).toBe(f.id);

      StubReader.last!.result = 'data:application/x-pem-file;base64,YWJj';
      StubReader.last!.onload!();

      expect(setup.uploadManagedFile).toHaveBeenCalledWith({
        environment: 'production',
        filename: 'ca.pem',
        contentBase64: 'YWJj',
      });
      expect(component.globalValue(f)).toBe('/managed/ca.pem');
      expect(component.managedUploadInFlightFieldId).toBeNull();
    });

    it('uploads a bare base64 result unchanged', () => {
      const component = build();

      component.uploadManagedFileForGlobal(
        changeEvent({ name: 'ca.pem' }),
        field('CA')
      );
      StubReader.last!.result = 'YWJj';
      StubReader.last!.onload!();

      expect(setup.uploadManagedFile).toHaveBeenCalledWith(
        expect.objectContaining({ contentBase64: 'YWJj' })
      );
    });

    it('stores the uploaded path against a group', () => {
      const component = build();
      const f = field('CA');

      component.uploadManagedFileForGroup(
        changeEvent({ name: 'ca.pem' }),
        'services',
        f
      );
      StubReader.last!.result = 'data:,YWJj';
      StubReader.last!.onload!();

      expect(component.groupValue('services', f)).toBe('/managed/ca.pem');
    });

    it('stores the uploaded path against a target', () => {
      const component = build();
      const t = target('finance');
      const f = field('CA');

      component.uploadManagedFileForTarget(
        changeEvent({ name: 'ca.pem' }),
        t,
        f
      );
      StubReader.last!.result = 'data:,YWJj';
      StubReader.last!.onload!();

      expect(component.targetOwnValue(t, f)).toBe('/managed/ca.pem');
    });

    it('reports an upload failure and clears the in-flight marker', () => {
      const component = build();
      setup.uploadManagedFile.mockReturnValue(fails('too large'));

      component.uploadManagedFileForGlobal(
        changeEvent({ name: 'ca.pem' }),
        field('CA')
      );
      StubReader.last!.result = 'data:,YWJj';
      StubReader.last!.onload!();

      expect(component.error).toBe('too large');
      expect(component.managedUploadInFlightFieldId).toBeNull();
    });

    it('reports a read failure without uploading', () => {
      const component = build();

      component.uploadManagedFileForGlobal(
        changeEvent({ name: 'ca.pem' }),
        field('CA')
      );
      StubReader.last!.onerror!();

      expect(component.error).toBe('Failed to read file for upload');
      expect(component.managedUploadInFlightFieldId).toBeNull();
      expect(setup.uploadManagedFile).not.toHaveBeenCalled();
    });
  });

  describe('provider connectivity test', () => {
    it('clears the in-flight marker on success and on failure alike', () => {
      const component = build();

      component.testProvider('github');
      expect(setup.testOAuthProvider).toHaveBeenCalledWith(
        'github',
        'production'
      );
      expect(component.testingProvider).toBeNull();

      setup.testOAuthProvider.mockReturnValue(fails());
      component.testProvider('google');
      expect(component.testingProvider).toBeNull();
    });
  });

  describe('service names', () => {
    it('gives a friendly name for a known service', () => {
      const component = build();

      expect(component.getServiceName('gateway')).toBe('Gateway');
      expect(component.getServiceName('chat-collector')).toBe('Chat Collector');
    });

    it('falls back to the id for an unknown service', () => {
      const component = build();

      expect(component.getServiceName('brand-new')).toBe('brand-new');
    });
  });

  describe('deploy progress polling', () => {
    it('polls immediately and then on an interval', () => {
      jest.useFakeTimers();
      const component = build();

      component['startDeployProgressPolling']();
      expect(setup.getDeployProgress).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(3000);
      expect(setup.getDeployProgress).toHaveBeenCalledTimes(4);

      component['stopDeployProgressPolling']();
      jest.advanceTimersByTime(3000);
      expect(setup.getDeployProgress).toHaveBeenCalledTimes(4);

      jest.useRealTimers();
    });

    it('replaces an existing poller rather than stacking two', () => {
      jest.useFakeTimers();
      const component = build();

      component['startDeployProgressPolling']();
      component['startDeployProgressPolling']();
      setup.getDeployProgress.mockClear();

      jest.advanceTimersByTime(1000);
      expect(setup.getDeployProgress).toHaveBeenCalledTimes(1);

      component['stopDeployProgressPolling']();
      jest.useRealTimers();
    });
  });

  describe('deploy phase bookkeeping', () => {
    it('marks earlier substeps done and the named one running', () => {
      const component = build();
      const building = component.deployPhaseState('building');
      const [first, second] = building!.substeps;

      component['startDeployPhase']('building', {
        completed: [first.id],
        running: second.id,
        message: 'building images',
      });

      expect(first.status).toBe('done');
      expect(second.status).toBe('running');
      expect(component.deployPhase).toBe('building');
      expect(component.deployMessage).toBe('building images');
      expect(component.deployError).toBeNull();
    });

    it('completes the listed substeps', () => {
      const component = build();
      const building = component.deployPhaseState('building');
      const ids = building!.substeps.map((s) => s.id);

      component['completeDeployPhase']('building', {
        completed: ids,
        message: 'built',
      });

      expect(building!.substeps.every((s) => s.status === 'done')).toBe(true);
      expect(component.deployMessage).toBe('built');
    });

    it('marks the failing substep and puts the deploy into error', () => {
      const component = build();
      const building = component.deployPhaseState('building');
      const [first] = building!.substeps;

      component['failDeployPhase']('building', first.id, 'compiler exploded');

      expect(first.status).toBe('error');
      expect(component.deployPhase).toBe('error');
      expect(component.deployStep).toBe('building');
      expect(component.deployError).toBe('compiler exploded');
      expect(component.deployMessage).toBe('');
    });

    it('ignores a substep id that does not belong to the phase', () => {
      const component = build();

      expect(() =>
        component['setSubstepStatus']('building', 'nonexistent', 'done')
      ).not.toThrow();
    });
  });
});
