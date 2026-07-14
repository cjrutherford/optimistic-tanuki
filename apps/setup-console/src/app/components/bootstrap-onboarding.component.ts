import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import {
  SetupClientService,
  BootstrapStatus,
  OAuthAppsInfo,
  OAuthProviderInfo,
  EmailSetupStatus,
  SavedOperatorInfo,
} from '../services/setup-client.service';
import {
  ButtonComponent,
  HeadingComponent,
  CardComponent,
  SpinnerComponent,
  StateMessageComponent,
  BadgeComponent,
  ModalComponent,
} from '@optimistic-tanuki/common-ui';
import {
  TextInputComponent,
  CheckboxComponent,
} from '@optimistic-tanuki/form-ui';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { AppRegistration } from '@optimistic-tanuki/app-registry-backend';
import {
  BootstrapConfig,
  SetupDeployProgressSnapshot,
  SetupDatabaseSlot,
  SetupHostPathEntry,
  SetupHostPathListing,
  SetupInfraKind,
  SetupSecretFieldDescriptor,
  SetupSettingFieldDescriptor,
  SetupSettingsCatalog,
  SetupSettingsGroup,
  SetupSettingsTarget,
} from '../../shared/setup.models';

interface SecretEntry {
  key: string;
  value: string;
}

interface AppRoutingDraft {
  appId: string;
  appType: string;
  domain: string;
  uiBaseUrl: string;
  apiBaseUrl: string;
}

type DeployTrackedPhase =
  | 'building'
  | 'infra'
  | 'db'
  | 'deploying'
  | 'activating'
  | 'rebooting';

type DeploySubstepStatus = 'pending' | 'running' | 'done' | 'error';

interface DeploySubstepState {
  id: string;
  label: string;
  status: DeploySubstepStatus;
}

interface DeployPhaseState {
  id: DeployTrackedPhase;
  label: string;
  substeps: DeploySubstepState[];
}

interface StepGuide {
  eyebrow: string;
  title: string;
  detail: string;
  checklist: string[];
}

type HostBrowserMode = 'file' | 'directory' | 'path';

type HostBrowserTarget =
  | { kind: 'takeover-deployment' }
  | { kind: 'takeover-env' }
  | {
      kind: 'global';
      field: SetupSettingFieldDescriptor;
    }
  | {
      kind: 'group';
      groupId: string;
      field: SetupSettingFieldDescriptor;
    }
  | {
      kind: 'target';
      target: SetupSettingsTarget;
      field: SetupSettingFieldDescriptor;
    };

type SettingsSection =
  | 'overview'
  | 'connections'
  | 'global'
  | 'groups'
  | 'targets'
  | 'secrets';

@Component({
  selector: 'app-bootstrap-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonComponent,
    TextInputComponent,
    CheckboxComponent,
    HeadingComponent,
    CardComponent,
    SpinnerComponent,
    StateMessageComponent,
    BadgeComponent,
    ModalComponent,
  ],
  templateUrl: './bootstrap-onboarding.component.html',
  styleUrl: './bootstrap-onboarding.component.scss',
})
export class BootstrapOnboardingComponent implements OnInit, OnDestroy {
  private readonly setupService = inject(SetupClientService);
  private readonly registryService = inject(AppRegistryService);
  private readonly platformId = inject(PLATFORM_ID);

  currentStep = 0;
  loading = false;
  error: string | null = null;
  status: BootstrapStatus | null = null;
  apiOnline = true;
  private healthTimer?: ReturnType<typeof setInterval>;
  private deployProgressTimer?: ReturnType<typeof setInterval>;
  availableEnvironments: string[] = [];
  activeEnvironment = 'production';
  newEnvironmentName = '';
  takeoverDeploymentPath = '';
  takeoverSecretsPath = '';
  takeoverEnvironmentName = '';
  hostBrowserOpen = false;
  hostBrowserMode: HostBrowserMode = 'file';
  hostBrowserTitle = 'Browse Host';
  hostBrowserListing: SetupHostPathListing = {
    currentPath: '',
    entries: [],
  };
  hostBrowserLoading = false;
  managedUploadInFlightFieldId: string | null = null;
  private hostBrowserTarget: HostBrowserTarget | null = null;

  backendServiceIds = [
    'gateway',
    'authentication',
    'profile',
    'social',
    'permissions',
    'chat-collector',
    'assets',
    'prompt-proxy',
    'ai-orchestration',
    'telos-docs-service',
    'blogging',
    'project-planning',
    'forum',
    'finance',
    'wellness',
    'classifieds',
    'payments',
    'lead-tracker',
    'store',
    'app-configurator',
    'system-configurator-api',
    'videos',
    'video-transcoder-worker',
  ];
  coreServiceIds = ['gateway', 'authentication'];

  registryApps: AppRegistration[] = [];
  secretEntries: SecretEntry[] = [];
  settingsCatalog: SetupSettingsCatalog = { groups: [], targets: [] };
  settingsSection: SettingsSection = 'targets';
  selectedSettingsGroupId = 'clients';
  selectedSettingsTargetId = '';

  config: BootstrapConfig = this.createDefaultConfig();

  operatorName = '';
  operatorEmail = '';
  operatorPassword = '';
  operatorPasswordConfirm = '';
  savedOperator: SavedOperatorInfo | null = null;
  replaceSavedOperator = false;

  selectedAppIds: string[] = [];
  selectedBackendIds: string[] = [];
  appRoutingDrafts: AppRoutingDraft[] = [];

  oauthProviders: OAuthProviderInfo[] = [
    {
      name: 'google',
      enabled: false,
      status: 'pending',
      clientIdPresent: false,
      clientSecretPresent: false,
      clientIdValue: '',
      clientSecretValue: '',
      clientIdKey: 'GOOGLE_CLIENT_ID',
      clientSecretKey: 'GOOGLE_CLIENT_SECRET',
      redirectUri: '',
      authorizationEndpoint: '',
      tokenEndpoint: '',
      userInfoEndpoint: '',
      scopes: [],
      validationErrors: [],
      lastTested: null,
    },
    {
      name: 'github',
      enabled: false,
      status: 'pending',
      clientIdPresent: false,
      clientSecretPresent: false,
      clientIdValue: '',
      clientSecretValue: '',
      clientIdKey: 'GITHUB_CLIENT_ID',
      clientSecretKey: 'GITHUB_CLIENT_SECRET',
      redirectUri: '',
      authorizationEndpoint: '',
      tokenEndpoint: '',
      userInfoEndpoint: '',
      scopes: [],
      validationErrors: [],
      lastTested: null,
    },
    {
      name: 'microsoft',
      enabled: false,
      status: 'pending',
      clientIdPresent: false,
      clientSecretPresent: false,
      clientIdValue: '',
      clientSecretValue: '',
      clientIdKey: 'MICROSOFT_CLIENT_ID',
      clientSecretKey: 'MICROSOFT_CLIENT_SECRET',
      redirectUri: '',
      authorizationEndpoint: '',
      tokenEndpoint: '',
      userInfoEndpoint: '',
      scopes: [],
      validationErrors: [],
      lastTested: null,
    },
    {
      name: 'facebook',
      enabled: false,
      status: 'pending',
      clientIdPresent: false,
      clientSecretPresent: false,
      clientIdValue: '',
      clientSecretValue: '',
      clientIdKey: 'FACEBOOK_CLIENT_ID',
      clientSecretKey: 'FACEBOOK_CLIENT_SECRET',
      redirectUri: '',
      authorizationEndpoint: '',
      tokenEndpoint: '',
      userInfoEndpoint: '',
      scopes: [],
      validationErrors: [],
      lastTested: null,
    },
  ];
  oauthProviderValues: Record<
    string,
    {
      enabled: boolean;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  > = {
    google: { enabled: false, clientId: '', clientSecret: '', redirectUri: '' },
    github: { enabled: false, clientId: '', clientSecret: '', redirectUri: '' },
    microsoft: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      redirectUri: '',
    },
    facebook: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      redirectUri: '',
    },
  };
  oauthApps: OAuthAppsInfo['apps'] = [];
  oauthBridgeAppId = 'client-interface';
  oauthBridgeAppDomain = '';
  oauthBridgeAppBaseUrl = '';
  testingProvider: string | null = null;
  emailSetup: EmailSetupStatus = {
    host: 'mail.christopherrutherford.net',
    port: 465,
    secure: true,
    user: '',
    passwordPresent: false,
    from: '',
    configured: false,
  };
  emailPassword = '';
  emailTestRecipient = '';
  emailTestState: 'idle' | 'testing' | 'sent' | 'error' = 'idle';
  deployPhase:
    | 'idle'
    | 'building'
    | 'infra'
    | 'db'
    | 'deploying'
    | 'activating'
    | 'rebooting'
    | 'done'
    | 'error' = 'idle';
  deployStep:
    | 'idle'
    | 'building'
    | 'infra'
    | 'db'
    | 'deploying'
    | 'activating'
    | 'rebooting'
    | 'done'
    | 'error'
    | null = null;
  deployMessage = '';
  deployError: string | null = null;
  deployLogs: string[] = [];
  deployPhases: DeployPhaseState[] = this.createDeployPhases();

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadEnvironments();
      this.loadStatus();
      this.selectedBackendIds = [...this.backendServiceIds];
      this.registryService.getAllApps().subscribe((apps) => {
        this.registryApps = apps;
        this.selectedAppIds = apps
          .filter((app) => app.appType === 'client')
          .map((app) => app.appId);
      });
      this.startHealthCheck();
    }
  }

  ngOnDestroy() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    if (this.deployProgressTimer) clearInterval(this.deployProgressTimer);
  }

  private createDefaultConfig(): BootstrapConfig {
    return {
      version: 'v1alpha1',
      environment: {
        name: 'production',
        namespace: 'optimistic-tanuki',
        targets: ['compose'],
        composeMode: 'image',
        provider: 'local',
        imageOwner: 'cjrutherford',
        defaultTag: 'latest',
        infra: ['postgres', 'redis'],
        capabilities: [],
        services: ['gateway', 'authentication'],
      },
      gateway: {
        publicUrl: 'https://production.example.com/api',
        publicWsUrl: 'wss://production.example.com/ws',
        internalUrl: 'http://gateway:3000',
        internalWsUrl: 'http://gateway:3300',
      },
      services: [
        {
          serviceId: 'gateway',
          enabled: true,
          database: {
            slotId: 'postgres-primary',
            databaseName: 'ot_gateway',
            username: 'postgres',
            passwordKey: 'POSTGRES_PASSWORD',
          },
        },
        {
          serviceId: 'authentication',
          enabled: true,
          database: {
            slotId: 'postgres-primary',
            databaseName: 'ot_authentication',
            username: 'postgres',
            passwordKey: 'POSTGRES_PASSWORD',
          },
        },
      ],
      apps: [],
      oauth: { enabled: true, bridgeAppId: 'client-interface', providers: {} },
      databases: [
        {
          id: 'postgres-primary',
          infra: 'postgres',
          provisionMode: 'managed',
          host: 'postgres',
          port: 5432,
          databaseName: 'postgres',
          username: 'postgres',
          passwordKey: 'POSTGRES_PASSWORD',
          create: true,
          migrate: true,
        },
        {
          id: 'redis-primary',
          infra: 'redis',
          provisionMode: 'managed',
          host: 'redis',
          port: 6379,
          databaseName: '0',
          username: 'default',
          passwordKey: 'REDIS_PASSWORD',
        },
      ],
      settings: {
        global: {},
        groups: { clients: {}, admins: {}, services: {} },
        targets: {},
      },
    };
  }

  private ensureConfigState() {
    this.config.databases = this.config.databases || [];
    this.config.settings = this.config.settings || {
      global: {},
      groups: { clients: {}, admins: {}, services: {} },
      targets: {},
    };
    this.config.settings.groups = {
      clients: { ...(this.config.settings.groups['clients'] || {}) },
      admins: { ...(this.config.settings.groups['admins'] || {}) },
      services: { ...(this.config.settings.groups['services'] || {}) },
    };
    this.config.settings.targets = { ...(this.config.settings.targets || {}) };
  }

  private startHealthCheck() {
    this.healthTimer = setInterval(() => {
      this.setupService.getStatus().subscribe({
        next: (status) => {
          if (!status || typeof status.configured !== 'boolean') return;
          const wasOffline = !this.apiOnline;
          this.apiOnline = true;
          if (wasOffline && status.configured) {
            window.location.href = 'http://localhost:8084/dashboard';
          }
        },
        error: () => {
          this.apiOnline = false;
        },
      });
    }, 5000);
  }

  loadStatus() {
    this.setupService.getStatus().subscribe({
      next: (status) => {
        this.status = status;
        this.apiOnline = true;
        if (status.configured) {
          window.location.href = 'http://localhost:8084';
          return;
        }
      },
      error: () => {
        this.apiOnline = false;
      },
    });
  }

  loadEnvironments() {
    this.setupService.getEnvironments().subscribe({
      next: (state) => {
        this.availableEnvironments = state.environments;
        this.activeEnvironment = state.activeEnvironment;
        this.restoreFromConfig();
        this.loadSecrets();
        this.loadEmailSetup();
        this.loadOperatorSummary();
      },
      error: () => {
        this.availableEnvironments = ['production'];
        this.activeEnvironment = 'production';
      },
    });
  }

  private restoreFromConfig() {
    this.setupService.getConfig(this.activeEnvironment).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.config = res.data;
        this.ensureConfigState();
        this.resetDeployPhases();
        this.restoreOAuthStateFromConfig();
        this.selectedBackendIds = res.data.services
          .filter((service) => service.enabled)
          .map((service) => service.serviceId);
        this.selectedAppIds = res.data.apps
          .filter((app) => app.appType === 'client')
          .map((app) => app.appId);
        this.loadSettingsCatalog();
        this.loadOAuthGuidance();
        this.syncAppRoutingDrafts();
        this.loadOperatorSummary();
      },
    });
  }

  private restoreOAuthStateFromConfig() {
    for (const provider of this.oauthProviders) {
      const configured = this.config.oauth.providers[provider.name];
      if (!configured) {
        continue;
      }
      const currentValues = this.oauthProviderValues[provider.name];
      this.oauthProviderValues[provider.name] = {
        enabled: configured.enabled,
        clientId: currentValues?.clientId || '',
        clientSecret: currentValues?.clientSecret || '',
        redirectUri: configured.redirectUri || currentValues?.redirectUri || '',
      };
      provider.enabled = configured.enabled;
      provider.redirectUri = configured.redirectUri || '';
      provider.clientIdKey = configured.clientIdKey;
      provider.clientSecretKey = configured.clientSecretKey;
    }
  }

  private loadOAuthGuidance() {
    forkJoin({
      providers: this.setupService.getOAuthProviders(this.activeEnvironment),
      apps: this.setupService.getOAuthApps(this.activeEnvironment),
    }).subscribe({
      next: ({ providers, apps }) => {
        this.oauthBridgeAppId = providers.bridgeAppId;
        this.oauthBridgeAppDomain = providers.bridgeAppDomain;
        this.oauthBridgeAppBaseUrl = providers.bridgeAppBaseUrl;
        this.oauthApps = apps.apps;

        for (const provider of providers.providers) {
          const existing = this.oauthProviders.find(
            (entry) => entry.name === provider.name
          );
          if (!existing) {
            continue;
          }
          Object.assign(existing, provider);
          const currentValues = this.oauthProviderValues[provider.name];
          const loadedClientId =
            this.secretEntryValueByKey(provider.clientIdKey) ||
            provider.clientIdValue ||
            currentValues?.clientId ||
            '';
          const loadedClientSecret =
            this.secretEntryValueByKey(provider.clientSecretKey) ||
            provider.clientSecretValue ||
            currentValues?.clientSecret ||
            '';
          this.oauthProviderValues[provider.name] = {
            enabled: provider.enabled,
            clientId: loadedClientId,
            clientSecret: loadedClientSecret,
            redirectUri:
              provider.redirectUri ||
              currentValues?.redirectUri ||
              this.oauthSuggestedRedirectUri(provider.name),
          };
        }
        this.syncAppRoutingDrafts();
      },
      error: () => {
        this.oauthApps = this.config.apps
          .filter((app) => app.appType === 'client' || app.appType === 'admin')
          .map((app) => ({
            appId: app.appId,
            domain: app.domain,
            oauthEligible: true,
            allowedProviders: Object.entries(this.config.oauth.providers)
              .filter(([, provider]) => provider.enabled)
              .map(([name]) => name),
            returnToOrigin: app.uiBaseUrl,
          }));
        this.syncAppRoutingDrafts();
      },
    });
  }

  private loadSettingsCatalog() {
    this.setupService.getSettingsCatalog(this.activeEnvironment).subscribe({
      next: (catalog) => {
        this.settingsCatalog = catalog;
        this.selectedSettingsGroupId =
          this.settingsCatalog.groups[0]?.id || 'clients';
        this.selectedSettingsTargetId =
          this.selectedSettingsTargetId ||
          this.settingsCatalog.targets[0]?.id ||
          '';
        if (
          !this.settingsCatalog.targets.find(
            (target) => target.id === this.selectedSettingsTargetId
          )
        ) {
          this.selectedSettingsTargetId =
            this.settingsCatalog.targets[0]?.id || '';
        }
      },
      error: () => {
        this.settingsCatalog = { groups: [], targets: [] };
      },
    });
  }

  loadSecrets() {
    this.setupService.getSecrets(this.activeEnvironment).subscribe({
      next: (res) => {
        this.secretEntries = Object.entries(res.data)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => ({ key, value }));
        this.syncOAuthProviderValuesFromSecrets();
      },
      error: () => {
        this.secretEntries = [];
      },
    });
  }

  loadEmailSetup() {
    this.setupService.getEmailStatus(this.activeEnvironment).subscribe({
      next: (status) => (this.emailSetup = status),
    });
  }

  saveEmailSetup() {
    this.loading = true;
    this.error = null;
    this.setupService
      .configureEmail(
        {
          host: this.emailSetup.host,
          port: this.emailSetup.port,
          secure: this.emailSetup.secure,
          user: this.emailSetup.user,
          password: this.emailPassword || undefined,
          from: this.emailSetup.from,
        },
        this.activeEnvironment
      )
      .subscribe({
        next: () => {
          this.loading = false;
          this.emailPassword = '';
          this.loadEmailSetup();
        },
        error: (err) => {
          this.loading = false;
          this.error =
            err.error?.message ||
            err.message ||
            'Failed to save email settings';
        },
      });
  }

  testEmailConnection() {
    this.emailTestState = 'testing';
    this.setupService
      .testEmail(
        this.emailTestRecipient,
        this.emailSetup.from,
        this.activeEnvironment
      )
      .subscribe({
        next: () => (this.emailTestState = 'sent'),
        error: (err) => {
          this.emailTestState = 'error';
          this.error = err.error?.message || err.message || 'Email test failed';
        },
      });
  }

  loadOperatorSummary() {
    this.setupService.getOperatorSummary().subscribe({
      next: (res) => {
        this.savedOperator = res.saved ? res.operator : null;
        if (this.savedOperator && !this.replaceSavedOperator) {
          this.operatorName = this.savedOperator.name;
          this.operatorEmail = this.savedOperator.email;
          this.operatorPassword = '';
          this.operatorPasswordConfirm = '';
        }
      },
      error: () => {
        this.savedOperator = null;
      },
    });
  }

  nextStep() {
    if (this.currentStep < 6) this.currentStep++;
  }

  prevStep() {
    if (this.currentStep > 0) this.currentStep--;
  }

  get nonCoreBackendServiceIds(): string[] {
    return this.backendServiceIds.filter(
      (id) => !this.coreServiceIds.includes(id)
    );
  }

  get clientApps(): AppRegistration[] {
    return this.registryApps.filter((app) => app.appType === 'client');
  }

  get adminApps(): AppRegistration[] {
    return this.registryApps.filter((app) => app.appType === 'admin');
  }

  get connectionSlots(): SetupDatabaseSlot[] {
    return (this.config.databases || []).sort((left, right) =>
      left.id.localeCompare(right.id)
    );
  }

  get settingsGroups(): SetupSettingsGroup[] {
    return this.settingsCatalog.groups;
  }

  get selectedSettingsTarget(): SetupSettingsTarget | null {
    return (
      this.settingsCatalog.targets.find(
        (target) => target.id === this.selectedSettingsTargetId
      ) || null
    );
  }

  get selectedSettingsGroup(): SetupSettingsGroup | null {
    return (
      this.settingsGroups.find(
        (group) => group.id === this.selectedSettingsGroupId
      ) || null
    );
  }

  get discoveredSecrets(): SetupSecretFieldDescriptor[] {
    return this.settingsCatalog.targets.flatMap((target) => target.secrets);
  }

  get currentStepGuide(): StepGuide {
    switch (this.currentStep) {
      case 0:
        return {
          eyebrow: 'Step 1',
          title: 'Define the environment you are editing',
          detail:
            'Choose the stack definition, give it a deployment identity, and decide whether this environment launches through Compose or Kubernetes. If you already run a legacy deployment, import the deployment YAML and its env file here so the console can take over reconfiguration.',
          checklist: [
            'Select an existing environment or create a parallel one.',
            'Set the deployment name that operators will recognize later.',
            'Choose the runtime target before configuring services and images.',
          ],
        };
      case 1:
        return {
          eyebrow: 'Step 2',
          title: 'Select the platform surface area',
          detail:
            'Turn on the apps and services this environment actually needs so later steps only ask for relevant settings, secrets, and database bindings.',
          checklist: [
            'Core infrastructure stays enabled.',
            'Client and admin apps affect valid OAuth return origins.',
            'Backend selections determine the settings catalog and connections.',
          ],
        };
      case 2:
        return {
          eyebrow: 'Step 3',
          title: 'Set application hosts and return targets',
          detail:
            'Establish the public app hosts and exact return targets before configuring OAuth providers. The bridge app and provider callbacks depend on these values being correct first.',
          checklist: [
            'Confirm each OAuth-capable app has the right public domain.',
            'Set the exact UI base URL that should receive the OAuth returnTo redirect.',
            'Choose the bridge app that owns the shared callback route.',
          ],
        };
      case 3:
        return {
          eyebrow: 'Step 4',
          title: 'Prepare shared login and registration',
          detail:
            'Each provider must trust the bridge callback URL, while each app sends its own returnTo origin so users land back in the app that started login.',
          checklist: [
            'Register the exact callback URL shown for each provider.',
            'Store the client secret in this environment only.',
            'Confirm the apps below are valid return targets for OAuth flows.',
          ],
        };
      case 4:
        return {
          eyebrow: 'Step 5',
          title: 'Create the first operator account',
          detail:
            'This account is provisioned during deployment and becomes the first owner-console login for the environment.',
          checklist: [
            'Use a real operator email address.',
            'Choose a password that meets production expectations.',
            'This account should be unique per environment.',
          ],
        };
      case 5:
        return {
          eyebrow: 'Step 6',
          title: 'Layer runtime settings and secrets',
          detail:
            'Use reusable connections, shared defaults, and app or service overrides so the stack can be reconfigured without rewriting a single long form. Path-backed settings can either reference an existing host path or upload a managed file into this deployment.',
          checklist: [
            'Define shared defaults before adding target-specific overrides.',
            'Attach services to the right Postgres or Redis connection.',
            'Keep secret values in the secrets section, not plain settings.',
          ],
        };
      default:
        return {
          eyebrow: 'Step 7',
          title: 'Apply and activate the stack',
          detail:
            'The final step builds, provisions, deploys, creates the operator account, and marks setup complete so the owner console takes over.',
          checklist: [
            'Review the selected services and enabled providers.',
            'Expect a short reboot window after activation.',
            'The owner console becomes the post-setup control plane.',
          ],
        };
    }
  }

  get oauthEligibleApps(): OAuthAppsInfo['apps'] {
    return this.oauthApps.filter((app) => app.oauthEligible);
  }

  get oauthConfigurableApps(): AppRoutingDraft[] {
    return this.appRoutingDrafts.filter(
      (app) => app.appType === 'client' || app.appType === 'admin'
    );
  }

  private syncAppRoutingDrafts() {
    this.appRoutingDrafts = this.config.apps
      .filter((app) => app.appType === 'client' || app.appType === 'admin')
      .map((app) =>
        this.normalizeRoutingDraft({
          appId: app.appId,
          appType: app.appType,
          domain: app.domain || '',
          uiBaseUrl: app.uiBaseUrl || '',
          apiBaseUrl: app.apiBaseUrl || '',
        })
      )
      .sort((left, right) => left.appId.localeCompare(right.appId));
  }

  private normalizeRoutingDraft(app: AppRoutingDraft): AppRoutingDraft {
    const apiBaseUrl = (app.apiBaseUrl || '').trim();
    const inferredUiBaseUrl = this.deriveUiBaseUrlFromApiBaseUrl(apiBaseUrl);
    const uiBaseUrl = inferredUiBaseUrl || (app.uiBaseUrl || '').trim();
    const inferredDomain = this.extractHostname(uiBaseUrl || apiBaseUrl);

    return {
      ...app,
      domain: inferredDomain || (app.domain || '').trim(),
      uiBaseUrl,
      apiBaseUrl,
    };
  }

  private deriveUiBaseUrlFromApiBaseUrl(apiBaseUrl: string): string {
    const trimmed = apiBaseUrl.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const parsed = new URL(trimmed);
      parsed.pathname = parsed.pathname.replace(/\/api\/?$/, '') || '/';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      return trimmed.replace(/\/api\/?$/, '');
    }
  }

  private extractHostname(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    try {
      return new URL(trimmed).hostname;
    } catch {
      return '';
    }
  }

  syncRoutingFromApiBaseUrl(app: AppRoutingDraft, value: string) {
    app.apiBaseUrl = value;
    const normalized = this.normalizeRoutingDraft(app);
    app.domain = normalized.domain;
    app.uiBaseUrl = normalized.uiBaseUrl;
    app.apiBaseUrl = normalized.apiBaseUrl;
  }

  maskedSecretValue(key: string): string {
    const value = this.secretEntries.find((entry) => entry.key === key)?.value;
    if (!value) {
      return 'Not loaded';
    }
    if (value.length <= 6) {
      return 'Loaded';
    }
    return `${value.slice(0, 2)}…${value.slice(-4)}`;
  }

  hasLoadedSecret(key: string): boolean {
    return this.secretEntries.some(
      (entry) => entry.key === key && !!entry.value
    );
  }

  private secretEntryValueByKey(key: string): string {
    return this.secretEntries.find((entry) => entry.key === key)?.value || '';
  }

  private syncOAuthProviderValuesFromSecrets() {
    for (const provider of this.oauthProviders) {
      const values = this.oauthProviderValues[provider.name];
      if (!values) {
        continue;
      }
      const clientId = provider.clientIdKey
        ? this.secretEntryValueByKey(provider.clientIdKey)
        : '';
      const clientSecret = provider.clientSecretKey
        ? this.secretEntryValueByKey(provider.clientSecretKey)
        : '';
      if (clientId) {
        values.clientId = clientId;
      }
      if (clientSecret) {
        values.clientSecret = clientSecret;
      }
    }
  }

  get appRoutingReady(): boolean {
    return (
      this.oauthConfigurableApps.length > 0 &&
      !!this.config.oauth.bridgeAppId &&
      this.oauthConfigurableApps.every(
        (app) => !!(app.domain || '').trim() && !!(app.uiBaseUrl || '').trim()
      )
    );
  }

  oauthSuggestedRedirectUri(providerName: string): string {
    const baseUrl = this.oauthBridgeAppBaseUrl.trim().replace(/\/$/, '');
    return baseUrl ? `${baseUrl}/oauth/callback/${providerName}` : '';
  }

  applyOAuthSuggestedRedirectUri(providerName: string) {
    const suggested = this.oauthSuggestedRedirectUri(providerName);
    if (suggested) {
      this.oauthProviderValues[providerName].redirectUri = suggested;
    }
  }

  get deploymentStrategyLabel(): string {
    return this.config.environment.composeMode === 'build'
      ? 'Build images from this workspace'
      : 'Pull tagged images and recreate services';
  }

  get deploymentStrategyNotes(): string[] {
    if (this.config.environment.composeMode === 'build') {
      return [
        'Local artifacts are generated before the stack is applied.',
        'Use this when the deployment should build from the current workspace state.',
        'Service rollout still depends on the target runtime and selected services.',
      ];
    }

    return [
      'Compose image mode should pull the selected immutable tag before recreate.',
      'The production deploy script batches docker pulls, force-recreates services, then runs seed tasks.',
      'The configured default tag should match the image tag you intend to roll out.',
    ];
  }

  get deploymentPreparationLabel(): string {
    return this.config.environment.composeMode === 'build'
      ? 'Build images & artifacts'
      : 'Prepare rollout assets';
  }

  private createDeployPhases(): DeployPhaseState[] {
    return [
      {
        id: 'building',
        label: this.deploymentPreparationLabel,
        substeps: [
          this.createDeploySubstep(
            'resolve-strategy',
            'Determine deployment strategy'
          ),
          this.createDeploySubstep(
            'prepare-tag',
            'Prepare image tag and rollout inputs'
          ),
          this.createDeploySubstep(
            'build-or-pull',
            'Build or pull runtime artifacts'
          ),
          this.createDeploySubstep(
            'verify-artifacts',
            'Verify image availability'
          ),
        ],
      },
      {
        id: 'infra',
        label: 'Provision infrastructure',
        substeps: [
          this.createDeploySubstep(
            'validate-infra',
            'Validate infrastructure prerequisites'
          ),
          this.createDeploySubstep(
            'start-shared-services',
            'Start shared infrastructure services'
          ),
          this.createDeploySubstep(
            'wait-for-infra',
            'Wait for infrastructure health'
          ),
        ],
      },
      {
        id: 'db',
        label: 'Initialize databases',
        substeps: [
          this.createDeploySubstep(
            'prepare-db',
            'Prepare database bootstrap plan'
          ),
          this.createDeploySubstep(
            'run-migrations',
            'Run schema and migration tasks'
          ),
          this.createDeploySubstep('seed-data', 'Run seed and bootstrap tasks'),
        ],
      },
      {
        id: 'deploying',
        label: 'Deploy services',
        substeps: [
          this.createDeploySubstep(
            'resolve-services',
            'Resolve enabled services'
          ),
          this.createDeploySubstep('apply-services', 'Apply service rollout'),
          this.createDeploySubstep(
            'verify-startup',
            'Verify gateway and service startup'
          ),
        ],
      },
      {
        id: 'activating',
        label: 'Create owner account',
        substeps: [
          this.createDeploySubstep(
            'save-owner',
            'Create or confirm operator account'
          ),
          this.createDeploySubstep('mark-setup', 'Mark setup as complete'),
        ],
      },
      {
        id: 'rebooting',
        label: 'Finalize setup',
        substeps: [
          this.createDeploySubstep(
            'wait-for-console',
            'Wait for owner console handoff'
          ),
          this.createDeploySubstep('redirect', 'Redirect to owner console'),
        ],
      },
    ];
  }

  private createDeploySubstep(id: string, label: string): DeploySubstepState {
    return { id, label, status: 'pending' };
  }

  private resetDeployPhases() {
    this.deployPhases = this.createDeployPhases();
  }

  private startDeployProgressPolling() {
    this.stopDeployProgressPolling();
    this.refreshDeployProgress();
    this.deployProgressTimer = setInterval(() => {
      this.refreshDeployProgress();
    }, 1000);
  }

  private stopDeployProgressPolling() {
    if (this.deployProgressTimer) {
      clearInterval(this.deployProgressTimer);
      this.deployProgressTimer = undefined;
    }
  }

  private refreshDeployProgress() {
    this.setupService.getDeployProgress().subscribe({
      next: (snapshot) => this.applyDeployProgressSnapshot(snapshot),
    });
  }

  private applyDeployProgressSnapshot(snapshot: SetupDeployProgressSnapshot) {
    this.deployMessage = snapshot.message || this.deployMessage;
    this.deployError = snapshot.error || null;
    this.deployLogs = snapshot.logs || [];
    if (
      snapshot.activePhase === 'idle' ||
      snapshot.activePhase === 'done' ||
      snapshot.activePhase === 'error'
    ) {
      this.deployPhase = snapshot.activePhase;
      this.deployStep =
        snapshot.activePhase === 'idle' ? 'idle' : this.deployStep;
    } else {
      this.deployPhase = snapshot.activePhase;
      this.deployStep = snapshot.activePhase;
    }

    this.deployPhases = snapshot.phases.map((phase) => ({
      id: phase.id,
      label: phase.label,
      substeps: phase.substeps.map((substep) => ({
        id: substep.id,
        label: substep.label,
        status: substep.status === 'idle' ? 'pending' : substep.status,
      })),
    }));

    if (snapshot.activePhase === 'done' || snapshot.activePhase === 'error') {
      this.stopDeployProgressPolling();
    }
  }

  private phaseState(phase: DeployTrackedPhase): DeployPhaseState | undefined {
    return this.deployPhases.find((entry) => entry.id === phase);
  }

  private setSubstepStatus(
    phase: DeployTrackedPhase,
    substepId: string,
    status: DeploySubstepStatus
  ) {
    const target = this.phaseState(phase)?.substeps.find(
      (substep) => substep.id === substepId
    );
    if (target) {
      target.status = status;
    }
  }

  private markSubstepsDone(phase: DeployTrackedPhase, substepIds: string[]) {
    for (const substepId of substepIds) {
      this.setSubstepStatus(phase, substepId, 'done');
    }
  }

  private startDeployPhase(
    phase: DeployTrackedPhase,
    options: { completed?: string[]; running: string; message: string }
  ) {
    this.deployPhase = phase;
    this.deployStep = phase;
    this.deployError = null;
    this.deployMessage = options.message;
    this.markSubstepsDone(phase, options.completed || []);
    this.setSubstepStatus(phase, options.running, 'running');
  }

  private completeDeployPhase(
    phase: DeployTrackedPhase,
    options: { completed?: string[]; message: string }
  ) {
    this.markSubstepsDone(phase, options.completed || []);
    this.deployMessage = options.message;
  }

  private failDeployPhase(
    phase: DeployTrackedPhase,
    failedSubstepId: string,
    message: string
  ) {
    this.stopDeployProgressPolling();
    this.setSubstepStatus(phase, failedSubstepId, 'error');
    this.deployPhase = 'error';
    this.deployStep = phase;
    this.deployError = message;
    this.deployMessage = '';
  }

  deployPhaseState(phase: DeployTrackedPhase): DeployPhaseState | null {
    return this.phaseState(phase) || null;
  }

  deployPhaseStatusLabel(phase: DeployTrackedPhase): string {
    if (this.deployPhase === phase) {
      return phase === 'rebooting' ? 'redirecting...' : 'running...';
    }
    if (this.deployPhase === 'done') {
      return 'done';
    }
    return this.deployPhaseDone(phase) ? 'done' : '';
  }

  deployPhaseIcon(phase: DeployTrackedPhase): string {
    if (this.deployPhase === 'done' || this.deployPhaseDone(phase)) {
      return '✓';
    }
    if (this.deployPhase === phase) {
      return '⟳';
    }
    return '○';
  }

  deploySubstepIcon(status: DeploySubstepStatus): string {
    switch (status) {
      case 'done':
        return '✓';
      case 'running':
        return '⟳';
      case 'error':
        return '!';
      default:
        return '○';
    }
  }

  get allBackendsSelected(): boolean {
    return this.nonCoreBackendServiceIds.every((id) =>
      this.selectedBackendIds.includes(id)
    );
  }

  get allClientAppsSelected(): boolean {
    return (
      this.clientApps.length > 0 &&
      this.clientApps.every((app) => this.isAppSelected(app.appId))
    );
  }

  get allAdminAppsSelected(): boolean {
    return (
      this.adminApps.length > 0 &&
      this.adminApps.every((app) => this.isAppSelected(app.appId))
    );
  }

  editSavedOperator() {
    this.replaceSavedOperator = true;
    if (this.savedOperator) {
      this.operatorName = this.savedOperator.name;
      this.operatorEmail = this.savedOperator.email;
    }
    this.operatorPassword = '';
    this.operatorPasswordConfirm = '';
  }

  saveConfig() {
    this.loading = true;
    this.error = null;
    const allServiceIds = [
      ...this.coreServiceIds,
      ...this.selectedBackendIds.filter(
        (id) => !this.coreServiceIds.includes(id)
      ),
    ];
    this.config.environment.services = allServiceIds;
    this.config.services = allServiceIds.map((id) => {
      const existing = this.config.services.find(
        (service) => service.serviceId === id
      );
      return {
        serviceId: id,
        enabled: true,
        database: existing?.database ? { ...existing.database } : undefined,
      };
    });
    this.config.apps = this.registryApps.map((app) => {
      const existing = this.config.apps.find(
        (entry) => entry.appId === app.appId
      );
      return {
        appId: app.appId,
        domain: existing?.domain || app.domain,
        uiBaseUrl: existing?.uiBaseUrl || app.uiBaseUrl,
        apiBaseUrl: existing?.apiBaseUrl || app.apiBaseUrl,
        appType: app.appType,
        visibility: app.visibility,
      };
    });
    this.ensureConfigState();
    this.resetDeployPhases();
    this.config.wizard = {
      currentStep: this.currentStep + 1,
      updatedAt: new Date().toISOString(),
    };
    this.setupService
      .saveConfig(this.config, this.activeEnvironment)
      .subscribe({
        next: () => {
          this.loading = false;
          this.nextStep();
        },
        error: (err) => {
          this.error = err.message || 'Failed to save config';
          this.loading = false;
        },
      });
  }

  selectEnvironment(environment: string) {
    if (!environment || environment === this.activeEnvironment) {
      return;
    }

    this.activeEnvironment = environment;
    this.restoreFromConfig();
    this.loadSecrets();
  }

  createEnvironment() {
    const name = this.newEnvironmentName.trim();
    if (!name) {
      this.error = 'Environment name is required';
      return;
    }

    this.loading = true;
    this.error = null;
    this.setupService.createEnvironment(name).subscribe({
      next: (res) => {
        this.loading = false;
        this.newEnvironmentName = '';
        this.activeEnvironment = name;
        this.config = res.data;
        this.ensureConfigState();
        this.resetDeployPhases();
        this.restoreOAuthStateFromConfig();
        if (!this.availableEnvironments.includes(name)) {
          this.availableEnvironments = [
            ...this.availableEnvironments,
            name,
          ].sort();
        }
        this.loadSettingsCatalog();
        this.loadSecrets();
        this.loadOAuthGuidance();
        this.loadOperatorSummary();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.message || 'Failed to create environment';
      },
    });
  }

  takeOverDeployment() {
    const deploymentPath = this.takeoverDeploymentPath.trim();
    if (!deploymentPath) {
      this.error = 'Deployment path is required';
      return;
    }

    this.loading = true;
    this.error = null;
    this.setupService
      .takeOverDeployment({
        deploymentPath,
        secretsPath: this.takeoverSecretsPath.trim() || undefined,
        environmentName: this.takeoverEnvironmentName.trim() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.activeEnvironment = res.environment;
          this.config = res.data;
          this.ensureConfigState();
          this.resetDeployPhases();
          this.restoreOAuthStateFromConfig();
          this.takeoverEnvironmentName = '';
          if (!this.availableEnvironments.includes(res.environment)) {
            this.availableEnvironments = [
              ...this.availableEnvironments,
              res.environment,
            ].sort();
          }
          this.loadSettingsCatalog();
          this.loadSecrets();
          this.loadOAuthGuidance();
          this.loadOperatorSummary();
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to take over deployment';
        },
      });
  }

  toggleAllBackends() {
    if (this.allBackendsSelected) {
      this.selectedBackendIds = this.selectedBackendIds.filter((id) =>
        this.coreServiceIds.includes(id)
      );
    } else {
      for (const id of this.nonCoreBackendServiceIds) {
        if (!this.selectedBackendIds.includes(id))
          this.selectedBackendIds.push(id);
      }
    }
  }

  setBackendSelection(serviceId: string, selected: boolean) {
    if (this.coreServiceIds.includes(serviceId)) return;
    const idx = this.selectedBackendIds.indexOf(serviceId);
    if (selected && idx === -1) this.selectedBackendIds.push(serviceId);
    else if (!selected && idx > -1) this.selectedBackendIds.splice(idx, 1);
  }

  isBackendSelected(serviceId: string): boolean {
    return (
      this.selectedBackendIds.includes(serviceId) ||
      this.coreServiceIds.includes(serviceId)
    );
  }

  setAppSelection(appId: string, selected: boolean) {
    const idx = this.selectedAppIds.indexOf(appId);
    if (selected && idx === -1) this.selectedAppIds.push(appId);
    else if (!selected && idx > -1) this.selectedAppIds.splice(idx, 1);
  }

  isAppSelected(appId: string): boolean {
    return this.selectedAppIds.includes(appId);
  }

  toggleAllClientApps() {
    if (this.allClientAppsSelected) {
      for (const app of this.clientApps) this.setAppSelection(app.appId, false);
    } else {
      for (const app of this.clientApps) this.setAppSelection(app.appId, true);
    }
  }

  toggleAllAdminApps() {
    if (this.allAdminAppsSelected) {
      for (const app of this.adminApps) this.setAppSelection(app.appId, false);
    } else {
      for (const app of this.adminApps) this.setAppSelection(app.appId, true);
    }
  }

  setSettingsSection(section: SettingsSection) {
    this.settingsSection = section;
  }

  isPathLikeField(field: SetupSettingFieldDescriptor): boolean {
    return (
      field.valueType === 'path' ||
      field.valueType === 'directory' ||
      field.valueType === 'file'
    );
  }

  supportsManagedUpload(field: SetupSettingFieldDescriptor): boolean {
    return field.valueType !== 'directory' && this.isPathLikeField(field);
  }

  hostBrowseModeForField(field: SetupSettingFieldDescriptor): HostBrowserMode {
    if (field.valueType === 'directory') {
      return 'directory';
    }
    if (field.valueType === 'file') {
      return 'file';
    }
    return 'path';
  }

  get settingsSectionTitle(): string {
    switch (this.settingsSection) {
      case 'connections':
        return 'Connections';
      case 'global':
        return 'Global Defaults';
      case 'groups':
        return 'Group Defaults';
      case 'targets':
        return 'App & Service Overrides';
      case 'secrets':
        return 'Secrets';
      default:
        return 'Overview';
    }
  }

  get settingsSectionDescription(): string {
    switch (this.settingsSection) {
      case 'connections':
        return 'Create reusable Postgres and Redis connections, then assign them to the services that need them.';
      case 'global':
        return 'Set environment-wide defaults that can be inherited by apps and services. Legacy env-file imports land here unless a more specific app, service, or connection mapping exists.';
      case 'groups':
        return 'Define shared defaults for client apps, admin apps, or backend services.';
      case 'targets':
        return 'Adjust one app or service at a time. Overrides here win over shared defaults, and file-backed settings can either point at a host path or upload a managed copy into this deployment.';
      case 'secrets':
        return 'Maintain secret-backed values separately from visible runtime settings.';
      default:
        return 'Review the current environment model before editing settings.';
    }
  }

  selectSettingsGroup(groupId: string) {
    this.selectedSettingsGroupId = groupId;
  }

  selectSettingsTarget(targetId: string) {
    this.selectedSettingsTargetId = targetId;
  }

  getGlobalFields(): SetupSettingFieldDescriptor[] {
    return this.dedupeFields(
      this.settingsCatalog.targets.flatMap((target) => target.fields)
    );
  }

  getGroupFields(groupId: string): SetupSettingFieldDescriptor[] {
    return this.dedupeFields(
      this.settingsCatalog.targets
        .filter((target) => target.groupId === groupId)
        .flatMap((target) => target.fields)
    );
  }

  private dedupeFields(
    fields: SetupSettingFieldDescriptor[]
  ): SetupSettingFieldDescriptor[] {
    const fieldMap = new Map<string, SetupSettingFieldDescriptor>();
    for (const field of fields) {
      if (!fieldMap.has(field.key)) {
        fieldMap.set(field.key, field);
      }
    }
    return [...fieldMap.values()].sort((left, right) =>
      left.label.localeCompare(right.label)
    );
  }

  private targetSettingsStore(targetId: string): Record<string, string> {
    this.ensureConfigState();
    if (!this.config.settings!.targets[targetId]) {
      this.config.settings!.targets[targetId] = {};
    }
    return this.config.settings!.targets[targetId];
  }

  private groupSettingsStore(groupId: string): Record<string, string> {
    this.ensureConfigState();
    return this.config.settings!.groups[groupId];
  }

  globalValue(field: SetupSettingFieldDescriptor): string {
    this.ensureConfigState();
    return this.config.settings!.global[field.key] || '';
  }

  updateGlobalValue(field: SetupSettingFieldDescriptor, value: string) {
    this.ensureConfigState();
    this.config.settings!.global[field.key] = value;
  }

  openGlobalHostBrowser(field: SetupSettingFieldDescriptor) {
    this.openHostBrowser(
      {
        kind: 'global',
        field,
      },
      this.globalValue(field),
      `${field.label} Host Path`,
      this.hostBrowseModeForField(field)
    );
  }

  groupValue(groupId: string, field: SetupSettingFieldDescriptor): string {
    return this.groupSettingsStore(groupId)[field.key] || '';
  }

  updateGroupValue(
    groupId: string,
    field: SetupSettingFieldDescriptor,
    value: string
  ) {
    this.groupSettingsStore(groupId)[field.key] = value;
  }

  openGroupHostBrowser(groupId: string, field: SetupSettingFieldDescriptor) {
    this.openHostBrowser(
      {
        kind: 'group',
        groupId,
        field,
      },
      this.groupValue(groupId, field),
      `${field.label} Host Path`,
      this.hostBrowseModeForField(field)
    );
  }

  targetValue(
    target: SetupSettingsTarget,
    field: SetupSettingFieldDescriptor
  ): string {
    const targetValue = this.targetSettingsStore(target.id)[field.key];
    if (targetValue) return targetValue;
    const groupValue = this.groupSettingsStore(target.groupId)[field.key];
    if (groupValue) return groupValue;
    const globalValue = this.globalValue(field);
    if (globalValue) return globalValue;
    return this.fallbackTargetValue(target, field.key);
  }

  targetOwnValue(
    target: SetupSettingsTarget,
    field: SetupSettingFieldDescriptor
  ): string {
    return this.targetSettingsStore(target.id)[field.key] || '';
  }

  updateTargetValue(
    target: SetupSettingsTarget,
    field: SetupSettingFieldDescriptor,
    value: string
  ) {
    this.targetSettingsStore(target.id)[field.key] = value;
  }

  openTargetHostBrowser(
    target: SetupSettingsTarget,
    field: SetupSettingFieldDescriptor
  ) {
    this.openHostBrowser(
      {
        kind: 'target',
        target,
        field,
      },
      this.targetOwnValue(target, field) || this.targetValue(target, field),
      `${target.label}: ${field.label}`,
      this.hostBrowseModeForField(field)
    );
  }

  clearTargetOverride(
    target: SetupSettingsTarget,
    field: SetupSettingFieldDescriptor
  ) {
    delete this.targetSettingsStore(target.id)[field.key];
  }

  private fallbackTargetValue(
    target: SetupSettingsTarget,
    key: string
  ): string {
    if (target.targetKind === 'app') {
      const app = this.config.apps.find((entry) => entry.appId === target.id);
      if (!app) return '';
      if (key === 'domain') return app.domain;
      if (key === 'uiBaseUrl') return app.uiBaseUrl;
      if (key === 'apiBaseUrl') return app.apiBaseUrl;
    }
    return '';
  }

  addConnectionSlot(infra: SetupInfraKind) {
    this.ensureConfigState();
    const baseId = `${infra}-${
      (this.config.databases || []).filter((slot) => slot.infra === infra)
        .length + 1
    }`;
    this.config.databases = [
      ...(this.config.databases || []),
      {
        id: baseId,
        infra,
        provisionMode: 'managed',
        host: infra === 'postgres' ? 'postgres' : 'redis',
        port: infra === 'postgres' ? 5432 : 6379,
        databaseName: infra === 'postgres' ? 'postgres' : '0',
        username: infra === 'postgres' ? 'postgres' : 'default',
        passwordKey:
          infra === 'postgres' ? 'POSTGRES_PASSWORD' : 'REDIS_PASSWORD',
        create: infra === 'postgres',
        migrate: infra === 'postgres',
      },
    ];
  }

  removeConnectionSlot(slotId: string) {
    this.config.databases = (this.config.databases || []).filter(
      (slot) => slot.id !== slotId
    );
    for (const service of this.config.services) {
      if (service.database?.slotId === slotId) {
        service.database.slotId = '';
      }
    }
  }

  updateConnectionSelection(
    target: SetupSettingsTarget,
    infra: SetupInfraKind,
    slotId: string
  ) {
    if (infra === 'postgres') {
      const service = this.config.services.find(
        (entry) => entry.serviceId === target.id
      );
      const slot = this.config.databases?.find((entry) => entry.id === slotId);
      if (!service) return;
      service.database = {
        slotId,
        databaseName:
          service.database?.databaseName || slot?.databaseName || '',
        username: service.database?.username || slot?.username || '',
        passwordKey: service.database?.passwordKey || slot?.passwordKey || '',
      };
      return;
    }

    this.targetSettingsStore(target.id)[
      `${infra.toUpperCase()}_CONNECTION_ID`
    ] = slotId;
  }

  selectedConnectionId(
    target: SetupSettingsTarget,
    infra: SetupInfraKind
  ): string {
    if (infra === 'postgres') {
      return (
        this.config.services.find((entry) => entry.serviceId === target.id)
          ?.database?.slotId || ''
      );
    }
    return (
      this.targetSettingsStore(target.id)[
        `${infra.toUpperCase()}_CONNECTION_ID`
      ] || ''
    );
  }

  connectionOptions(infra: SetupInfraKind): SetupDatabaseSlot[] {
    return this.connectionSlots.filter((slot) => slot.infra === infra);
  }

  secretValue(secret: SetupSecretFieldDescriptor): string {
    return (
      this.secretEntries.find((entry) => entry.key === secret.envKey)?.value ||
      ''
    );
  }

  updateSecretValue(secret: SetupSecretFieldDescriptor, value: string) {
    this.upsertSecret(secret.envKey, value);
  }

  addSecretEntry() {
    this.secretEntries = [...this.secretEntries, { key: '', value: '' }];
  }

  removeSecretEntry(index: number) {
    this.secretEntries = this.secretEntries.filter(
      (_, current) => current !== index
    );
  }

  private upsertSecret(key: string, value: string) {
    const existing = this.secretEntries.find((entry) => entry.key === key);
    if (existing) {
      existing.value = value;
      return;
    }
    this.secretEntries = [...this.secretEntries, { key, value }];
  }

  private normalizedSecrets(): Record<string, string> {
    return this.secretEntries.reduce<Record<string, string>>((acc, entry) => {
      const key = entry.key.trim();
      if (!key) return acc;
      acc[key] = entry.value;
      return acc;
    }, {});
  }

  openTakeoverDeploymentBrowser() {
    this.openHostBrowser(
      { kind: 'takeover-deployment' },
      this.takeoverDeploymentPath,
      'Select Deployment YAML',
      'file'
    );
  }

  openTakeoverEnvBrowser() {
    this.openHostBrowser(
      { kind: 'takeover-env' },
      this.takeoverSecretsPath,
      'Select Environment / Secrets Env File',
      'file'
    );
  }

  loadHostBrowser(pathHint?: string) {
    this.hostBrowserLoading = true;
    this.setupService.browseHostPath(pathHint).subscribe({
      next: (listing) => {
        this.hostBrowserListing = listing;
        this.hostBrowserLoading = false;
      },
      error: (err) => {
        this.hostBrowserLoading = false;
        this.error = err.message || 'Failed to browse host paths';
      },
    });
  }

  browseHostParent() {
    if (this.hostBrowserListing.parentPath) {
      this.loadHostBrowser(this.hostBrowserListing.parentPath);
    }
  }

  browseHostEntry(entry: SetupHostPathEntry) {
    if (entry.directory) {
      this.loadHostBrowser(entry.path);
      return;
    }
    if (this.hostBrowserMode !== 'directory') {
      this.applyHostBrowserSelection(entry.path);
    }
  }

  useCurrentHostDirectory() {
    if (this.hostBrowserMode !== 'file') {
      this.applyHostBrowserSelection(this.hostBrowserListing.currentPath);
    }
  }

  closeHostBrowser() {
    this.hostBrowserOpen = false;
    this.hostBrowserTarget = null;
  }

  uploadManagedFileForGlobal(event: Event, field: SetupSettingFieldDescriptor) {
    this.uploadManagedFile(event, field.id, (value) =>
      this.updateGlobalValue(field, value)
    );
  }

  uploadManagedFileForGroup(
    event: Event,
    groupId: string,
    field: SetupSettingFieldDescriptor
  ) {
    this.uploadManagedFile(event, field.id, (value) =>
      this.updateGroupValue(groupId, field, value)
    );
  }

  uploadManagedFileForTarget(
    event: Event,
    target: SetupSettingsTarget,
    field: SetupSettingFieldDescriptor
  ) {
    this.uploadManagedFile(event, field.id, (value) =>
      this.updateTargetValue(target, field, value)
    );
  }

  private openHostBrowser(
    target: HostBrowserTarget,
    currentValue: string,
    title: string,
    mode: HostBrowserMode
  ) {
    this.hostBrowserTarget = target;
    this.hostBrowserTitle = title;
    this.hostBrowserMode = mode;
    this.hostBrowserOpen = true;
    this.loadHostBrowser(currentValue || '');
  }

  private applyHostBrowserSelection(selectedPath: string) {
    if (!this.hostBrowserTarget) {
      return;
    }

    switch (this.hostBrowserTarget.kind) {
      case 'takeover-deployment':
        this.takeoverDeploymentPath = selectedPath;
        break;
      case 'takeover-env':
        this.takeoverSecretsPath = selectedPath;
        break;
      case 'global':
        this.updateGlobalValue(this.hostBrowserTarget.field, selectedPath);
        break;
      case 'group':
        this.updateGroupValue(
          this.hostBrowserTarget.groupId,
          this.hostBrowserTarget.field,
          selectedPath
        );
        break;
      case 'target':
        this.updateTargetValue(
          this.hostBrowserTarget.target,
          this.hostBrowserTarget.field,
          selectedPath
        );
        break;
    }

    this.closeHostBrowser();
  }

  private uploadManagedFile(
    event: Event,
    fieldId: string,
    applyValue: (value: string) => void
  ) {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file || !isPlatformBrowser(this.platformId)) {
      return;
    }

    this.managedUploadInFlightFieldId = fieldId;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const contentBase64 = result.includes(',')
        ? result.slice(result.indexOf(',') + 1)
        : result;

      this.setupService
        .uploadManagedFile({
          environment: this.activeEnvironment,
          filename: file.name,
          contentBase64,
        })
        .subscribe({
          next: (res) => {
            applyValue(res.path);
            this.managedUploadInFlightFieldId = null;
            if (input) {
              input.value = '';
            }
          },
          error: (err) => {
            this.managedUploadInFlightFieldId = null;
            this.error = err.message || 'Failed to upload managed file';
          },
        });
    };
    reader.onerror = () => {
      this.managedUploadInFlightFieldId = null;
      this.error = 'Failed to read file for upload';
    };
    reader.readAsDataURL(file);
  }

  saveEnvironmentSettings() {
    this.loading = true;
    this.error = null;
    this.ensureConfigState();

    this.config.apps = this.config.apps.map((app) => {
      const target = this.settingsCatalog.targets.find(
        (entry) => entry.id === app.appId
      );
      if (!target) return app;
      return {
        ...app,
        domain: this.targetValue(target, {
          id: `${app.appId}:domain`,
          key: 'domain',
          label: 'Domain',
          valueType: 'string',
          scopes: ['global', 'group', 'target'],
          secret: false,
        }),
        uiBaseUrl: this.targetValue(target, {
          id: `${app.appId}:uiBaseUrl`,
          key: 'uiBaseUrl',
          label: 'UI Base URL',
          valueType: 'url',
          scopes: ['global', 'group', 'target'],
          secret: false,
        }),
        apiBaseUrl: this.targetValue(target, {
          id: `${app.appId}:apiBaseUrl`,
          key: 'apiBaseUrl',
          label: 'API Base URL',
          valueType: 'url',
          scopes: ['global', 'group', 'target'],
          secret: false,
        }),
      };
    });

    this.config.wizard = {
      currentStep: this.currentStep + 1,
      updatedAt: new Date().toISOString(),
    };

    this.setupService
      .saveConfig(this.config, this.activeEnvironment)
      .subscribe({
        next: () => {
          this.setupService
            .saveSecrets(this.normalizedSecrets(), this.activeEnvironment)
            .subscribe({
              next: () => {
                this.loading = false;
                this.nextStep();
              },
              error: (err) => {
                this.loading = false;
                this.error = err.message || 'Failed to save secrets';
              },
            });
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to save configuration';
        },
      });
  }

  saveOAuthConfig() {
    this.loading = true;
    this.error = null;
    const calls: Promise<void>[] = [];
    for (const [name, values] of Object.entries(this.oauthProviderValues)) {
      if (values.enabled && !values.redirectUri) {
        values.redirectUri = this.oauthSuggestedRedirectUri(name);
      }
      if (!values.enabled && !values.clientId && !values.clientSecret) continue;
      if (this.config.oauth.providers[name]) {
        this.config.oauth.providers[name] = {
          ...this.config.oauth.providers[name],
          enabled: values.enabled,
          redirectUri: values.redirectUri,
        };
      }
      calls.push(
        new Promise<void>((resolve, reject) => {
          this.setupService
            .configureOAuthProvider(name, values, this.activeEnvironment)
            .subscribe({
              next: () => resolve(),
              error: (err) => reject(err),
            });
        })
      );
    }
    Promise.all(calls)
      .then(() => {
        this.loading = false;
        this.nextStep();
      })
      .catch((err) => {
        this.error = err.message || 'Failed';
        this.loading = false;
      });
  }

  saveAppRouting() {
    this.loading = true;
    this.error = null;
    this.ensureConfigState();

    this.config.oauth.bridgeAppId =
      this.config.oauth.bridgeAppId ||
      this.oauthConfigurableApps[0]?.appId ||
      '';

    this.config.apps = this.config.apps.map((app) => {
      const draft = this.appRoutingDrafts.find(
        (entry) => entry.appId === app.appId
      );
      if (!draft) {
        return app;
      }
      const normalizedDraft = this.normalizeRoutingDraft(draft);
      return {
        ...app,
        domain: normalizedDraft.domain,
        uiBaseUrl: normalizedDraft.uiBaseUrl,
        apiBaseUrl: normalizedDraft.apiBaseUrl,
      };
    });

    for (const draft of this.appRoutingDrafts) {
      const normalizedDraft = this.normalizeRoutingDraft(draft);
      if (!this.config.settings!.targets[draft.appId]) {
        this.config.settings!.targets[draft.appId] = {};
      }
      this.config.settings!.targets[draft.appId] = {
        ...this.config.settings!.targets[draft.appId],
        domain: normalizedDraft.domain,
        uiBaseUrl: normalizedDraft.uiBaseUrl,
        apiBaseUrl: normalizedDraft.apiBaseUrl,
      };
      draft.domain = normalizedDraft.domain;
      draft.uiBaseUrl = normalizedDraft.uiBaseUrl;
      draft.apiBaseUrl = normalizedDraft.apiBaseUrl;
    }

    this.config.wizard = {
      currentStep: this.currentStep + 1,
      updatedAt: new Date().toISOString(),
    };

    this.setupService
      .saveConfig(this.config, this.activeEnvironment)
      .subscribe({
        next: () => {
          this.loading = false;
          this.loadOAuthGuidance();
          this.nextStep();
        },
        error: (err) => {
          this.loading = false;
          this.error = err.message || 'Failed to save application routing';
        },
      });
  }

  saveOperator() {
    this.loading = true;
    this.error = null;
    this.setupService
      .saveOperator(
        this.operatorName,
        this.operatorEmail,
        this.operatorPassword
      )
      .subscribe({
        next: () => {
          this.savedOperator = {
            name: this.operatorName,
            email: this.operatorEmail.trim().toLowerCase(),
            passwordSaved: true,
            source: 'saved',
            existingUser: false,
            existingCount: 0,
          };
          this.replaceSavedOperator = false;
          this.loading = false;
          this.nextStep();
        },
        error: (err) => {
          this.error = err.message || 'Failed to save operator info';
          this.loading = false;
        },
      });
  }

  deployPhaseDone(phase: string): boolean {
    if (this.deployPhase === 'done') {
      return true;
    }
    const order = [
      'building',
      'infra',
      'db',
      'deploying',
      'activating',
      'rebooting',
    ];
    const currentIdx = order.indexOf(this.deployPhase);
    const phaseIdx = order.indexOf(phase);
    return phaseIdx >= 0 && currentIdx > phaseIdx;
  }

  private runPhase(
    phase: DeployTrackedPhase,
    progress: {
      precomplete?: string[];
      running: string;
      complete: string[];
      startMessage: string;
      doneMessage: string;
    },
    call: () => Observable<{ success: boolean; message: string }>,
    next: () => void
  ) {
    this.startDeployPhase(phase, {
      completed: progress.precomplete,
      running: progress.running,
      message: progress.startMessage,
    });

    call().subscribe({
      next: (result) => {
        if (!result.success) {
          this.failDeployPhase(
            phase,
            progress.running,
            result.message || `${phase} failed`
          );
          return;
        }
        this.completeDeployPhase(phase, {
          completed: [progress.running, ...progress.complete],
          message: result.message || progress.doneMessage,
        });
        next();
      },
      error: (err) => {
        this.failDeployPhase(
          phase,
          progress.running,
          err.message || `${phase} failed`
        );
      },
    });
  }

  runDeployPipeline() {
    this.deployError = null;
    this.deployMessage = '';
    this.resetDeployPhases();
    this.startDeployProgressPolling();

    this.runPhase(
      'building',
      {
        precomplete: ['resolve-strategy', 'prepare-tag'],
        running: 'build-or-pull',
        complete: ['verify-artifacts'],
        startMessage: `${this.deploymentPreparationLabel}...`,
        doneMessage: 'Artifacts are ready for rollout.',
      },
      () => this.setupService.buildImages(),
      () => {
        this.runPhase(
          'infra',
          {
            precomplete: ['validate-infra'],
            running: 'start-shared-services',
            complete: ['wait-for-infra'],
            startMessage: 'Provisioning shared infrastructure...',
            doneMessage: 'Infrastructure services are available.',
          },
          () => this.setupService.provisionInfraCompose(),
          () => {
            this.runPhase(
              'db',
              {
                precomplete: ['prepare-db'],
                running: 'run-migrations',
                complete: ['seed-data'],
                startMessage: 'Initializing databases...',
                doneMessage: 'Database setup completed.',
              },
              () => this.setupService.initDatabases(),
              () => {
                this.runPhase(
                  'deploying',
                  {
                    precomplete: ['resolve-services'],
                    running: 'apply-services',
                    complete: ['verify-startup'],
                    startMessage: 'Deploying selected services...',
                    doneMessage: 'Service rollout completed.',
                  },
                  () => this.setupService.deployServices(),
                  () => {
                    this.startDeployPhase('activating', {
                      running: 'save-owner',
                      message: 'Creating or confirming operator account...',
                    });
                    this.setupService.activateOwner().subscribe({
                      next: () => {
                        this.completeDeployPhase('activating', {
                          completed: ['save-owner', 'mark-setup'],
                          message: 'Operator account activation complete.',
                        });
                        this.startDeployPhase('rebooting', {
                          running: 'wait-for-console',
                          message:
                            'Setup complete. Waiting for owner console handoff...',
                        });
                        this.completeDeployPhase('rebooting', {
                          completed: ['wait-for-console', 'redirect'],
                          message:
                            'Setup complete! Redirecting to owner console...',
                        });
                        this.deployPhase = 'done';
                        setTimeout(() => {
                          window.location.href =
                            'http://localhost:8084/dashboard';
                        }, 2000);
                      },
                      error: (err) => {
                        this.stopDeployProgressPolling();
                        this.failDeployPhase(
                          'activating',
                          'save-owner',
                          err.message || 'Failed to activate'
                        );
                      },
                    });
                  }
                );
              }
            );
          }
        );
      }
    );
  }

  testProvider(providerName: string) {
    this.testingProvider = providerName;
    this.setupService
      .testOAuthProvider(providerName, this.activeEnvironment)
      .subscribe({
        next: () => {
          this.testingProvider = null;
        },
        error: () => {
          this.testingProvider = null;
        },
      });
  }

  getServiceName(serviceId: string): string {
    const names: Record<string, string> = {
      gateway: 'Gateway',
      authentication: 'Authentication',
      profile: 'Profile',
      social: 'Social',
      permissions: 'Permissions',
      'chat-collector': 'Chat Collector',
      assets: 'Assets',
      'prompt-proxy': 'Prompt Proxy',
      'ai-orchestration': 'AI Orchestration',
      'telos-docs-service': 'Docs Service',
      blogging: 'Blogging',
      'project-planning': 'Project Planning',
      forum: 'Forum',
      finance: 'Finance',
      wellness: 'Wellness',
      classifieds: 'Classifieds',
      payments: 'Payments',
      'lead-tracker': 'Lead Tracker',
      store: 'Store',
      'app-configurator': 'App Configurator',
      'system-configurator-api': 'System Configurator API',
      videos: 'Videos',
      'video-transcoder-worker': 'Video Transcoder',
    };
    return names[serviceId] || serviceId;
  }
}
