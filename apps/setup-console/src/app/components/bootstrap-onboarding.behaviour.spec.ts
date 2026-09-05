import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { BootstrapOnboardingComponent } from './bootstrap-onboarding.component';
import { SetupClientService } from '../services/setup-client.service';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import type {
  SetupSecretFieldDescriptor,
  SetupSettingFieldDescriptor,
  SetupSettingsTarget,
} from '../../shared/setup.models';

/**
 * The component renders a seven-step wizard built out of a dozen shared UI
 * components, so these drive it through `runInInjectionContext` and exercise
 * the class directly rather than standing up a fixture. That keeps the tests
 * about the wizard's logic -- value precedence, selection rules, deploy phase
 * bookkeeping -- instead of the template.
 */
describe('BootstrapOnboardingComponent', () => {
  /**
   * Named rather than an index signature: an index signature would force
   * bracket access under noPropertyAccessFromIndexSignature and stop the
   * compiler catching a typo in a method name.
   */
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
    saveOperator: jest.Mock;
  }

  let setup: SetupMock;
  let registry: { getAllApps: jest.Mock };

  const field = (
    key: string,
    overrides: Partial<SetupSettingFieldDescriptor> = {}
  ): SetupSettingFieldDescriptor =>
    ({
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

  /** Constructs the component; `platform` drives the isPlatformBrowser guard. */
  const build = (platform: 'browser' | 'server' = 'server') => {
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

  beforeEach(() => {
    setup = {
      getStatus: jest.fn().mockReturnValue(of({ configured: false })),
      getEnvironments: jest
        .fn()
        .mockReturnValue(
          of({ activeEnvironment: 'production', environments: ['production'] })
        ),
      getConfig: jest
        .fn()
        .mockReturnValue(of({ success: false, data: undefined })),
      getSecrets: jest.fn().mockReturnValue(of({ success: true, data: {} })),
      getEmailStatus: jest.fn().mockReturnValue(of({})),
      getOperatorSummary: jest
        .fn()
        .mockReturnValue(of({ saved: false, operator: null })),
      getDeployProgress: jest.fn().mockReturnValue(of({})),
      getSettingsCatalog: jest
        .fn()
        .mockReturnValue(of({ groups: [], targets: [] })),
      getOAuthProviders: jest.fn().mockReturnValue(of({ providers: [] })),
      getOAuthApps: jest.fn().mockReturnValue(of({ apps: [] })),
      saveConfig: jest.fn().mockReturnValue(of({ success: true })),
      saveSecrets: jest.fn().mockReturnValue(of({ success: true })),
      configureEmail: jest.fn().mockReturnValue(of({ success: true })),
      testEmail: jest.fn().mockReturnValue(of({ success: true })),
      createEnvironment: jest.fn().mockReturnValue(of({ success: true })),
      takeOverDeployment: jest.fn().mockReturnValue(of({ success: true })),
      browseHostPath: jest
        .fn()
        .mockReturnValue(of({ currentPath: '/srv', entries: [] })),
      saveOperator: jest.fn().mockReturnValue(of({ saved: true })),
    };

    registry = { getAllApps: jest.fn().mockReturnValue(of([])) };
  });

  afterEach(() => jest.useRealTimers());

  describe('construction', () => {
    it('starts from a complete default config', () => {
      const component = build();

      expect(component.config.version).toBe('v1alpha1');
      expect(component.config.environment.name).toBe('production');
      expect(component.currentStep).toBe(0);
      expect(component.deployPhase).toBe('idle');
    });

    it('builds the full set of deploy phases up front', () => {
      const component = build();

      expect(component.deployPhases.map((p) => p.id)).toEqual([
        'building',
        'infra',
        'db',
        'deploying',
        'activating',
        'rebooting',
      ]);
      // Every substep starts pending so the UI has something to render.
      for (const phase of component.deployPhases) {
        expect(phase.substeps.length).toBeGreaterThan(0);
        expect(phase.substeps.every((s) => s.status === 'pending')).toBe(true);
      }
    });
  });

  describe('ngOnInit', () => {
    it('does no I/O when rendering on the server', () => {
      const component = build('server');

      component.ngOnInit();

      expect(setup.getStatus).not.toHaveBeenCalled();
      expect(setup.getEnvironments).not.toHaveBeenCalled();
      expect(registry.getAllApps).not.toHaveBeenCalled();
    });

    it('loads everything and preselects client apps in the browser', () => {
      registry.getAllApps.mockReturnValue(
        of([
          { appId: 'client-a', appType: 'client' },
          { appId: 'admin-a', appType: 'admin' },
        ])
      );
      const component = build('browser');

      component.ngOnInit();

      expect(setup.getEnvironments).toHaveBeenCalled();
      expect(setup.getStatus).toHaveBeenCalled();
      // Backends default to all-on; apps default to the client ones only.
      expect(component.selectedBackendIds).toEqual(component.backendServiceIds);
      expect(component.selectedAppIds).toEqual(['client-a']);

      component.ngOnDestroy();
    });

    it('clears its timers on destroy', () => {
      jest.useFakeTimers();
      const clear = jest.spyOn(global, 'clearInterval');
      const component = build('browser');
      component.ngOnInit();

      component.ngOnDestroy();

      expect(clear).toHaveBeenCalled();
    });
  });

  describe('loadStatus', () => {
    it('records the status and marks the api online', () => {
      const component = build();
      setup.getStatus.mockReturnValue(
        of({ configured: false, phase: 'setup', checks: [] })
      );

      component.loadStatus();

      expect(component.status).toMatchObject({ phase: 'setup' });
      expect(component.apiOnline).toBe(true);
    });

    it('marks the api offline when the request fails', () => {
      const component = build();
      setup.getStatus.mockReturnValue(throwError(() => new Error('down')));

      component.loadStatus();

      expect(component.apiOnline).toBe(false);
    });
  });

  describe('loadEnvironments', () => {
    it('adopts the reported environments', () => {
      const component = build();
      setup.getEnvironments.mockReturnValue(
        of({
          activeEnvironment: 'staging',
          environments: ['production', 'staging'],
        })
      );

      component.loadEnvironments();

      expect(component.activeEnvironment).toBe('staging');
      expect(component.availableEnvironments).toEqual([
        'production',
        'staging',
      ]);
    });

    it('falls back to production when the request fails', () => {
      const component = build();
      setup.getEnvironments.mockReturnValue(
        throwError(() => new Error('down'))
      );

      component.loadEnvironments();

      expect(component.activeEnvironment).toBe('production');
      expect(component.availableEnvironments).toEqual(['production']);
    });
  });

  describe('step navigation', () => {
    it('advances but stops at the last step', () => {
      const component = build();

      for (let i = 0; i < 10; i++) component.nextStep();

      expect(component.currentStep).toBe(6);
    });

    it('goes back but never below zero', () => {
      const component = build();
      component.currentStep = 1;

      component.prevStep();
      component.prevStep();

      expect(component.currentStep).toBe(0);
    });

    it('gives a distinct guide for every step', () => {
      const component = build();
      const titles = new Set<string>();

      for (let step = 0; step <= 6; step++) {
        component.currentStep = step;
        const guide = component.currentStepGuide;
        expect(guide.checklist.length).toBeGreaterThan(0);
        titles.add(guide.title);
      }

      expect(titles.size).toBe(7);
    });
  });

  describe('routing derivation', () => {
    it('derives the ui base url and domain by stripping /api', () => {
      const component = build();
      const app = {
        appId: 'a',
        appType: 'client',
        domain: '',
        uiBaseUrl: '',
        apiBaseUrl: '',
      };

      component.syncRoutingFromApiBaseUrl(app, 'https://app.example.test/api');

      expect(app.uiBaseUrl).toBe('https://app.example.test');
      expect(app.domain).toBe('app.example.test');
    });

    it('handles a trailing slash after /api', () => {
      const component = build();
      const app = {
        appId: 'a',
        appType: 'client',
        domain: '',
        uiBaseUrl: '',
        apiBaseUrl: '',
      };

      component.syncRoutingFromApiBaseUrl(app, 'https://app.example.test/api/');

      expect(app.uiBaseUrl).toBe('https://app.example.test');
    });

    it('falls back to string trimming when the value is not a url', () => {
      const component = build();
      const app = {
        appId: 'a',
        appType: 'client',
        domain: 'kept.example.test',
        uiBaseUrl: '',
        apiBaseUrl: '',
      };

      component.syncRoutingFromApiBaseUrl(app, 'not-a-url/api');

      expect(app.uiBaseUrl).toBe('not-a-url');
      // No hostname can be extracted, so the existing domain survives.
      expect(app.domain).toBe('kept.example.test');
    });

    it('leaves an empty api base url alone', () => {
      const component = build();
      const app = {
        appId: 'a',
        appType: 'client',
        domain: '',
        uiBaseUrl: 'https://ui.example.test',
        apiBaseUrl: '',
      };

      component.syncRoutingFromApiBaseUrl(app, '');

      expect(app.uiBaseUrl).toBe('https://ui.example.test');
      expect(app.domain).toBe('ui.example.test');
    });
  });

  describe('secrets', () => {
    it('reports a secret that has not been loaded', () => {
      const component = build();

      expect(component.maskedSecretValue('MISSING')).toBe('Not loaded');
      expect(component.hasLoadedSecret('MISSING')).toBe(false);
    });

    it('does not reveal the shape of a short secret', () => {
      const component = build();
      component.secretEntries = [{ key: 'SHORT', value: '123456' }];

      expect(component.maskedSecretValue('SHORT')).toBe('Loaded');
    });

    it('masks the middle of a long secret', () => {
      const component = build();
      component.secretEntries = [{ key: 'LONG', value: 'abcdefghij' }];

      expect(component.maskedSecretValue('LONG')).toBe('ab…ghij');
      expect(component.hasLoadedSecret('LONG')).toBe(true);
    });

    it('adds and removes entries by position', () => {
      const component = build();
      component.secretEntries = [
        { key: 'A', value: '1' },
        { key: 'B', value: '2' },
      ];

      component.addSecretEntry();
      expect(component.secretEntries).toHaveLength(3);

      component.removeSecretEntry(0);
      expect(component.secretEntries.map((e) => e.key)).toEqual(['B', '']);
    });

    it('updates an existing secret in place rather than duplicating it', () => {
      const component = build();
      const secret = { envKey: 'API_KEY' } as SetupSecretFieldDescriptor;
      component.secretEntries = [{ key: 'API_KEY', value: 'old' }];

      component.updateSecretValue(secret, 'new');

      expect(component.secretEntries).toHaveLength(1);
      expect(component.secretValue(secret)).toBe('new');
    });

    it('appends a secret that is not present yet', () => {
      const component = build();
      const secret = { envKey: 'NEW_KEY' } as SetupSecretFieldDescriptor;

      component.updateSecretValue(secret, 'value');

      expect(component.secretValue(secret)).toBe('value');
    });
  });

  describe('oauth redirect suggestion', () => {
    it('is empty until the bridge base url is known', () => {
      const component = build();

      expect(component.oauthSuggestedRedirectUri('github')).toBe('');
    });

    it('builds a per-provider callback and strips a trailing slash', () => {
      const component = build();
      component.oauthBridgeAppBaseUrl = 'https://app.example.test/';

      expect(component.oauthSuggestedRedirectUri('github')).toBe(
        'https://app.example.test/oauth/callback/github'
      );
    });

    it('applies the suggestion to the provider values', () => {
      const component = build();
      component.oauthBridgeAppBaseUrl = 'https://app.example.test';

      component.applyOAuthSuggestedRedirectUri('google');

      expect(component.oauthProviderValues['google'].redirectUri).toBe(
        'https://app.example.test/oauth/callback/google'
      );
    });

    it('leaves the provider untouched when there is nothing to suggest', () => {
      const component = build();

      component.applyOAuthSuggestedRedirectUri('google');

      expect(component.oauthProviderValues['google'].redirectUri).toBe('');
    });
  });

  describe('backend and app selection', () => {
    it('treats core services as always selected and refuses to deselect them', () => {
      const component = build();

      component.setBackendSelection('gateway', false);

      expect(component.isBackendSelected('gateway')).toBe(true);
    });

    it('adds and removes a non-core backend', () => {
      const component = build();
      component.selectedBackendIds = [];

      component.setBackendSelection('forum', true);
      expect(component.isBackendSelected('forum')).toBe(true);

      component.setBackendSelection('forum', false);
      expect(component.isBackendSelected('forum')).toBe(false);
    });

    it('toggling on selects every non-core backend', () => {
      const component = build();
      component.selectedBackendIds = [];

      component.toggleAllBackends();

      expect(component.allBackendsSelected).toBe(true);
    });

    it('toggling off keeps only the core services', () => {
      const component = build();
      component.selectedBackendIds = [...component.backendServiceIds];

      component.toggleAllBackends();

      expect(component.selectedBackendIds).toEqual(component.coreServiceIds);
    });

    it('toggles client apps as a group without touching admin apps', () => {
      const component = build();
      component.registryApps = [
        { appId: 'client-a', appType: 'client' },
        { appId: 'admin-a', appType: 'admin' },
      ] as never;
      component.selectedAppIds = [];

      component.toggleAllClientApps();

      expect(component.isAppSelected('client-a')).toBe(true);
      expect(component.isAppSelected('admin-a')).toBe(false);
      expect(component.allClientAppsSelected).toBe(true);

      component.toggleAllClientApps();
      expect(component.isAppSelected('client-a')).toBe(false);
    });

    it('toggles admin apps as a group', () => {
      const component = build();
      component.registryApps = [
        { appId: 'admin-a', appType: 'admin' },
      ] as never;
      component.selectedAppIds = [];

      component.toggleAllAdminApps();
      expect(component.allAdminAppsSelected).toBe(true);

      component.toggleAllAdminApps();
      expect(component.isAppSelected('admin-a')).toBe(false);
    });

    it('reports no group selected when there are no apps of that kind', () => {
      const component = build();
      component.registryApps = [];

      expect(component.allClientAppsSelected).toBe(false);
      expect(component.allAdminAppsSelected).toBe(false);
    });
  });

  describe('settings field classification', () => {
    it('recognises the path-like value types', () => {
      const component = build();

      expect(component.isPathLikeField(field('a', { valueType: 'path' }))).toBe(
        true
      );
      expect(
        component.isPathLikeField(field('b', { valueType: 'directory' }))
      ).toBe(true);
      expect(component.isPathLikeField(field('c', { valueType: 'file' }))).toBe(
        true
      );
      expect(
        component.isPathLikeField(field('d', { valueType: 'string' }))
      ).toBe(false);
    });

    it('allows a managed upload for everything path-like except a directory', () => {
      const component = build();

      expect(
        component.supportsManagedUpload(field('a', { valueType: 'file' }))
      ).toBe(true);
      expect(
        component.supportsManagedUpload(field('b', { valueType: 'directory' }))
      ).toBe(false);
      expect(
        component.supportsManagedUpload(field('c', { valueType: 'string' }))
      ).toBe(false);
    });

    it('maps the value type onto a browser mode', () => {
      const component = build();

      expect(
        component.hostBrowseModeForField(field('a', { valueType: 'directory' }))
      ).toBe('directory');
      expect(
        component.hostBrowseModeForField(field('b', { valueType: 'file' }))
      ).toBe('file');
      expect(
        component.hostBrowseModeForField(field('c', { valueType: 'path' }))
      ).toBe('path');
    });
  });

  describe('field collection', () => {
    it('dedupes by key across targets and sorts by label', () => {
      const component = build();
      component.settingsCatalog = {
        groups: [],
        targets: [
          target('t1', {
            fields: [
              field('z', { label: 'Zebra' }),
              field('a', { label: 'Apple' }),
            ],
          }),
          target('t2', {
            // Same key as t1's -- should not appear twice.
            fields: [field('a', { label: 'Apple duplicate' })],
          }),
        ],
      };

      const fields = component.getGlobalFields();

      expect(fields.map((f) => f.key)).toEqual(['a', 'z']);
      expect(fields[0].label).toBe('Apple');
    });

    it('scopes group fields to that group', () => {
      const component = build();
      component.settingsCatalog = {
        groups: [],
        targets: [
          target('t1', { groupId: 'clients', fields: [field('client-key')] }),
          target('t2', { groupId: 'services', fields: [field('service-key')] }),
        ],
      };

      expect(component.getGroupFields('clients').map((f) => f.key)).toEqual([
        'client-key',
      ]);
    });

    it('flattens secrets across every target', () => {
      const component = build();
      component.settingsCatalog = {
        groups: [],
        targets: [
          target('t1', { secrets: [{ envKey: 'A' }] as never }),
          target('t2', { secrets: [{ envKey: 'B' }] as never }),
        ],
      };

      expect(component.discoveredSecrets.map((s) => s.envKey)).toEqual([
        'A',
        'B',
      ]);
    });
  });

  describe('setting value precedence', () => {
    it('prefers a target override over the group and global values', () => {
      const component = build();
      const t = target('svc-1', { groupId: 'services' });
      const f = field('LOG_LEVEL');

      component.updateGlobalValue(f, 'global');
      component.updateGroupValue('services', f, 'group');
      component.updateTargetValue(t, f, 'target');

      expect(component.targetValue(t, f)).toBe('target');
    });

    it('falls back to the group value when the target has none', () => {
      const component = build();
      const t = target('svc-1', { groupId: 'services' });
      const f = field('LOG_LEVEL');

      component.updateGlobalValue(f, 'global');
      component.updateGroupValue('services', f, 'group');

      expect(component.targetValue(t, f)).toBe('group');
    });

    it('falls back to the global value when neither is set', () => {
      const component = build();
      const t = target('svc-1', { groupId: 'services' });
      const f = field('LOG_LEVEL');

      component.updateGlobalValue(f, 'global');

      expect(component.targetValue(t, f)).toBe('global');
    });

    it('falls back to the app registration for a routing key', () => {
      const component = build();
      const t = target('app-1', { targetKind: 'app', groupId: 'clients' });
      component.config.apps = [
        {
          appId: 'app-1',
          appType: 'client',
          domain: 'app.example.test',
          uiBaseUrl: 'https://app.example.test',
          apiBaseUrl: 'https://app.example.test/api',
        },
      ] as never;

      expect(component.targetValue(t, field('domain'))).toBe(
        'app.example.test'
      );
      expect(component.targetValue(t, field('uiBaseUrl'))).toBe(
        'https://app.example.test'
      );
      expect(component.targetValue(t, field('apiBaseUrl'))).toBe(
        'https://app.example.test/api'
      );
    });

    it('is empty for an unknown app or a non-routing key', () => {
      const component = build();
      const t = target('missing', { targetKind: 'app', groupId: 'clients' });
      component.config.apps = [];

      expect(component.targetValue(t, field('domain'))).toBe('');
      expect(
        component.targetValue(
          target('svc', { targetKind: 'service' }),
          field('anything')
        )
      ).toBe('');
    });

    it('clearing an override falls back down the chain again', () => {
      const component = build();
      const t = target('svc-1', { groupId: 'services' });
      const f = field('LOG_LEVEL');
      component.updateGroupValue('services', f, 'group');
      component.updateTargetValue(t, f, 'target');

      component.clearTargetOverride(t, f);

      expect(component.targetOwnValue(t, f)).toBe('');
      expect(component.targetValue(t, f)).toBe('group');
    });
  });

  describe('connection slots', () => {
    // The default config already ships a postgres-primary and a redis-primary
    // slot, so the first slot added by hand is numbered 2.
    const slotById = (component: BootstrapOnboardingComponent, id: string) =>
      component.connectionSlots.find((slot) => slot.id === id);

    it('creates a postgres slot with postgres defaults', () => {
      const component = build();

      component.addConnectionSlot('postgres');

      expect(slotById(component, 'postgres-2')).toMatchObject({
        infra: 'postgres',
        host: 'postgres',
        port: 5432,
        databaseName: 'postgres',
        username: 'postgres',
        passwordKey: 'POSTGRES_PASSWORD',
        create: true,
        migrate: true,
      });
    });

    it('creates a redis slot with redis defaults and no migration', () => {
      const component = build();

      component.addConnectionSlot('redis');

      expect(slotById(component, 'redis-2')).toMatchObject({
        infra: 'redis',
        host: 'redis',
        port: 6379,
        databaseName: '0',
        username: 'default',
        passwordKey: 'REDIS_PASSWORD',
        create: false,
        migrate: false,
      });
    });

    it('numbers new slots per infra kind, counting the defaults', () => {
      const component = build();

      component.addConnectionSlot('postgres');
      component.addConnectionSlot('postgres');
      component.addConnectionSlot('redis');

      expect(component.connectionOptions('postgres').map((s) => s.id)).toEqual([
        'postgres-2',
        'postgres-3',
        'postgres-primary',
      ]);
      expect(component.connectionOptions('redis').map((s) => s.id)).toEqual([
        'redis-2',
        'redis-primary',
      ]);
    });

    it('numbers from one when the environment has no slots yet', () => {
      const component = build();
      component.config.databases = [];

      component.addConnectionSlot('postgres');

      expect(component.connectionSlots.map((s) => s.id)).toEqual([
        'postgres-1',
      ]);
    });

    it('detaches services from a slot that is removed', () => {
      const component = build();
      component.config.services = [
        {
          serviceId: 'finance',
          database: {
            slotId: 'postgres-primary',
            databaseName: '',
            username: '',
            passwordKey: '',
          },
        },
      ] as never;

      component.removeConnectionSlot('postgres-primary');

      expect(slotById(component, 'postgres-primary')).toBeUndefined();
      expect(component.config.services[0].database?.slotId).toBe('');
    });

    it('leaves services bound to other slots alone', () => {
      const component = build();
      component.config.services = [
        {
          serviceId: 'finance',
          database: {
            slotId: 'redis-primary',
            databaseName: '',
            username: '',
            passwordKey: '',
          },
        },
      ] as never;

      component.removeConnectionSlot('postgres-primary');

      expect(component.config.services[0].database?.slotId).toBe(
        'redis-primary'
      );
    });

    it('binds a postgres slot onto the matching service', () => {
      const component = build();
      component.config.services = [{ serviceId: 'finance' }] as never;
      const t = target('finance');

      component.updateConnectionSelection(t, 'postgres', 'postgres-primary');

      expect(component.selectedConnectionId(t, 'postgres')).toBe(
        'postgres-primary'
      );
      // Unset fields inherit from the slot rather than staying blank.
      expect(component.config.services[0].database).toMatchObject({
        databaseName: 'postgres',
        username: 'postgres',
        passwordKey: 'POSTGRES_PASSWORD',
      });
    });

    it('keeps a value the service already carries when rebinding', () => {
      const component = build();
      component.config.services = [
        {
          serviceId: 'finance',
          database: {
            slotId: 'postgres-primary',
            databaseName: 'finance_db',
            username: '',
            passwordKey: '',
          },
        },
      ] as never;

      component.updateConnectionSelection(
        target('finance'),
        'postgres',
        'postgres-primary'
      );

      expect(component.config.services[0].database?.databaseName).toBe(
        'finance_db'
      );
    });

    it('ignores a postgres binding for a service that does not exist', () => {
      const component = build();
      component.config.services = [];

      component.updateConnectionSelection(
        target('missing'),
        'postgres',
        'postgres-1'
      );

      expect(
        component.selectedConnectionId(target('missing'), 'postgres')
      ).toBe('');
    });

    it('stores a redis binding as a target setting instead', () => {
      const component = build();
      const t = target('finance');

      component.updateConnectionSelection(t, 'redis', 'redis-1');

      expect(component.selectedConnectionId(t, 'redis')).toBe('redis-1');
    });

    it('sorts slots by id', () => {
      const component = build();
      component.config.databases = [
        { id: 'postgres-2', infra: 'postgres' },
        { id: 'postgres-1', infra: 'postgres' },
      ] as never;

      expect(component.connectionSlots.map((s) => s.id)).toEqual([
        'postgres-1',
        'postgres-2',
      ]);
    });
  });

  describe('deploy phase presentation', () => {
    it('maps each substep status to an icon', () => {
      const component = build();

      expect(component.deploySubstepIcon('done')).toBe('✓');
      expect(component.deploySubstepIcon('running')).toBe('⟳');
      expect(component.deploySubstepIcon('error')).toBe('!');
      expect(component.deploySubstepIcon('pending')).toBe('○');
    });

    it('treats phases before the current one as done', () => {
      const component = build();
      component.deployPhase = 'db';

      expect(component.deployPhaseDone('building')).toBe(true);
      expect(component.deployPhaseDone('db')).toBe(false);
      expect(component.deployPhaseDone('deploying')).toBe(false);
    });

    it('treats every phase as done once the deploy finishes', () => {
      const component = build();
      component.deployPhase = 'done';

      expect(component.deployPhaseDone('building')).toBe(true);
      expect(component.deployPhaseDone('rebooting')).toBe(true);
    });

    it('labels the running phase, and calls out the reboot redirect', () => {
      const component = build();

      component.deployPhase = 'building';
      expect(component.deployPhaseStatusLabel('building')).toBe('running...');

      component.deployPhase = 'rebooting';
      expect(component.deployPhaseStatusLabel('rebooting')).toBe(
        'redirecting...'
      );
    });

    it('labels completed phases done and leaves upcoming ones blank', () => {
      const component = build();
      component.deployPhase = 'db';

      expect(component.deployPhaseStatusLabel('building')).toBe('done');
      expect(component.deployPhaseStatusLabel('deploying')).toBe('');
    });

    it('picks an icon per phase position', () => {
      const component = build();
      component.deployPhase = 'db';

      expect(component.deployPhaseIcon('building')).toBe('✓');
      expect(component.deployPhaseIcon('db')).toBe('⟳');
      expect(component.deployPhaseIcon('deploying')).toBe('○');
    });

    it('exposes a phase by id and null for one it does not know', () => {
      const component = build();

      expect(component.deployPhaseState('building')?.id).toBe('building');
      expect(component.deployPhaseState('nope' as never)).toBeNull();
    });
  });

  describe('deploy progress snapshots', () => {
    const snapshot = (overrides: Record<string, unknown> = {}) =>
      ({
        activePhase: 'building',
        message: 'working',
        error: null,
        logs: ['line'],
        phases: [
          {
            id: 'building',
            label: 'Building',
            substeps: [{ id: 's1', label: 'One', status: 'idle' }],
          },
        ],
        ...overrides,
      } as never);

    it('adopts the reported phase, message and logs', () => {
      const component = build();

      component['applyDeployProgressSnapshot'](snapshot());

      expect(component.deployPhase).toBe('building');
      expect(component.deployStep).toBe('building');
      expect(component.deployMessage).toBe('working');
      expect(component.deployLogs).toEqual(['line']);
    });

    it('normalises an idle substep to pending for the UI', () => {
      const component = build();

      component['applyDeployProgressSnapshot'](snapshot());

      expect(component.deployPhases[0].substeps[0].status).toBe('pending');
    });

    it('keeps the last message when the snapshot carries none', () => {
      const component = build();
      component.deployMessage = 'previous';

      component['applyDeployProgressSnapshot'](snapshot({ message: '' }));

      expect(component.deployMessage).toBe('previous');
    });

    it('records an error from the snapshot', () => {
      const component = build();

      component['applyDeployProgressSnapshot'](
        snapshot({ activePhase: 'error', error: 'it broke' })
      );

      expect(component.deployPhase).toBe('error');
      expect(component.deployError).toBe('it broke');
    });

    it('resets the step when the deploy goes back to idle', () => {
      const component = build();
      component.deployStep = 'building';

      component['applyDeployProgressSnapshot'](
        snapshot({ activePhase: 'idle' })
      );

      expect(component.deployStep).toBe('idle');
    });

    it('holds the last step once the deploy is done', () => {
      const component = build();
      component.deployStep = 'rebooting';

      component['applyDeployProgressSnapshot'](
        snapshot({ activePhase: 'done' })
      );

      expect(component.deployPhase).toBe('done');
      expect(component.deployStep).toBe('rebooting');
    });
  });

  describe('saved operator', () => {
    it('prefills the form from the saved operator and clears the passwords', () => {
      const component = build();
      component.savedOperator = {
        name: 'Ada',
        email: 'ada@example.test',
      } as never;
      component.operatorPassword = 'stale';
      component.operatorPasswordConfirm = 'stale';

      component.editSavedOperator();

      expect(component.replaceSavedOperator).toBe(true);
      expect(component.operatorName).toBe('Ada');
      expect(component.operatorEmail).toBe('ada@example.test');
      expect(component.operatorPassword).toBe('');
      expect(component.operatorPasswordConfirm).toBe('');
    });

    it('just opens the form when nothing is saved', () => {
      const component = build();

      component.editSavedOperator();

      expect(component.replaceSavedOperator).toBe(true);
      expect(component.operatorName).toBe('');
    });
  });

  describe('settings navigation', () => {
    it('remembers the selected section, group and target', () => {
      const component = build();

      component.setSettingsSection('secrets');
      component.selectSettingsGroup('admins');
      component.selectSettingsTarget('svc-1');

      expect(component.settingsSection).toBe('secrets');
      expect(component.selectedSettingsGroupId).toBe('admins');
      expect(component.selectedSettingsTargetId).toBe('svc-1');
    });

    it('gives every section a title and description', () => {
      const component = build();
      const sections = [
        'overview',
        'connections',
        'global',
        'groups',
        'targets',
        'secrets',
      ] as const;

      const titles = new Set<string>();
      for (const section of sections) {
        component.setSettingsSection(section);
        titles.add(component.settingsSectionTitle);
        expect(component.settingsSectionDescription.length).toBeGreaterThan(0);
      }

      expect(titles.size).toBe(sections.length);
    });

    it('resolves the selected group and target, or null', () => {
      const component = build();
      component.settingsCatalog = {
        groups: [{ id: 'clients', label: 'Clients' }] as never,
        targets: [target('svc-1')],
      };

      component.selectSettingsGroup('clients');
      component.selectSettingsTarget('svc-1');
      expect(component.selectedSettingsGroup?.id).toBe('clients');
      expect(component.selectedSettingsTarget?.id).toBe('svc-1');

      component.selectSettingsTarget('missing');
      expect(component.selectedSettingsTarget).toBeNull();
    });
  });

  describe('deployment strategy summary', () => {
    it('describes building from the workspace', () => {
      const component = build();
      component.config.environment.composeMode = 'build';

      expect(component.deploymentStrategyLabel).toContain('Build images');
      expect(component.deploymentPreparationLabel).toBe(
        'Build images & artifacts'
      );
      expect(component.deploymentStrategyNotes[0]).toContain('Local artifacts');
    });

    it('describes pulling tagged images', () => {
      const component = build();
      component.config.environment.composeMode = 'image';

      expect(component.deploymentStrategyLabel).toContain('Pull tagged images');
      expect(component.deploymentPreparationLabel).toBe(
        'Prepare rollout assets'
      );
      expect(component.deploymentStrategyNotes[0]).toContain('pull');
    });
  });

  describe('app routing readiness', () => {
    it('is not ready while an app is missing its domain or ui base url', () => {
      const component = build();
      component.config.oauth.bridgeAppId = 'client-interface';
      component.appRoutingDrafts = [
        {
          appId: 'a',
          appType: 'client',
          domain: '',
          uiBaseUrl: '',
          apiBaseUrl: '',
        },
      ];

      expect(component.appRoutingReady).toBe(false);
    });

    it('is not ready without a bridge app', () => {
      const component = build();
      component.config.oauth.bridgeAppId = '';
      component.appRoutingDrafts = [
        {
          appId: 'a',
          appType: 'client',
          domain: 'a.example.test',
          uiBaseUrl: 'https://a.example.test',
          apiBaseUrl: '',
        },
      ];

      expect(component.appRoutingReady).toBe(false);
    });

    it('is ready once every configurable app is fully addressed', () => {
      const component = build();
      component.config.oauth.bridgeAppId = 'client-interface';
      component.appRoutingDrafts = [
        {
          appId: 'a',
          appType: 'client',
          domain: 'a.example.test',
          uiBaseUrl: 'https://a.example.test',
          apiBaseUrl: '',
        },
      ];

      expect(component.appRoutingReady).toBe(true);
    });

    it('ignores apps that are neither client nor admin', () => {
      const component = build();
      component.appRoutingDrafts = [
        {
          appId: 'svc',
          appType: 'service',
          domain: '',
          uiBaseUrl: '',
          apiBaseUrl: '',
        },
      ];

      expect(component.oauthConfigurableApps).toHaveLength(0);
      // No configurable apps at all means not ready.
      expect(component.appRoutingReady).toBe(false);
    });
  });

  describe('oauth eligible apps', () => {
    it('keeps only the apps the backend marked eligible', () => {
      const component = build();
      component.oauthApps = [
        { appId: 'a', oauthEligible: true },
        { appId: 'b', oauthEligible: false },
      ] as never;

      expect(component.oauthEligibleApps.map((a) => a.appId)).toEqual(['a']);
    });
  });

  describe('service groupings', () => {
    it('excludes the core services from the toggleable list', () => {
      const component = build();

      expect(component.nonCoreBackendServiceIds).not.toContain('gateway');
      expect(component.nonCoreBackendServiceIds).not.toContain(
        'authentication'
      );
      expect(component.nonCoreBackendServiceIds).toContain('forum');
    });

    it('splits registry apps by type', () => {
      const component = build();
      component.registryApps = [
        { appId: 'c', appType: 'client' },
        { appId: 'a', appType: 'admin' },
        { appId: 's', appType: 'service' },
      ] as never;

      expect(component.clientApps.map((a) => a.appId)).toEqual(['c']);
      expect(component.adminApps.map((a) => a.appId)).toEqual(['a']);
    });
  });
});
