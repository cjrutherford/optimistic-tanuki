import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import {
  SetupClientService,
  BootstrapStatus,
  OAuthProviderInfo,
} from '../services/setup-client.service';
import {
  ButtonComponent,
  HeadingComponent,
  CardComponent,
  SpinnerComponent,
  StateMessageComponent,
  BadgeComponent,
} from '@optimistic-tanuki/common-ui';
import {
  TextInputComponent,
  CheckboxComponent,
} from '@optimistic-tanuki/form-ui';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { AppRegistration } from '@optimistic-tanuki/app-registry-backend';
import {
  BootstrapConfig,
  SetupDatabaseSlot,
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
  availableEnvironments: string[] = [];
  activeEnvironment = 'production';
  newEnvironmentName = '';

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

  selectedAppIds: string[] = [];
  selectedBackendIds: string[] = [];

  oauthProviders: OAuthProviderInfo[] = [
    {
      name: 'google',
      enabled: false,
      status: 'pending',
      clientIdPresent: false,
      clientSecretPresent: false,
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
  testingProvider: string | null = null;
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
        if (
          status.wizardStep !== undefined &&
          status.wizardStep > 0 &&
          status.wizardStep !== this.currentStep
        ) {
          this.currentStep = status.wizardStep;
          this.restoreFromConfig();
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
        if (res.data.wizard?.currentStep !== undefined) {
          this.currentStep = res.data.wizard.currentStep;
        }
        this.selectedBackendIds = res.data.services
          .filter((service) => service.enabled)
          .map((service) => service.serviceId);
        this.selectedAppIds = res.data.apps
          .filter((app) => app.appType === 'client')
          .map((app) => app.appId);
        this.loadSettingsCatalog();
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
      },
      error: () => {
        this.secretEntries = [];
      },
    });
  }

  nextStep() {
    if (this.currentStep < 5) this.currentStep++;
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
        if (!this.availableEnvironments.includes(name)) {
          this.availableEnvironments = [
            ...this.availableEnvironments,
            name,
          ].sort();
        }
        this.loadSettingsCatalog();
        this.loadSecrets();
      },
      error: (err) => {
        this.loading = false;
        this.error = err.message || 'Failed to create environment';
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
        return 'Set environment-wide defaults that can be inherited by apps and services.';
      case 'groups':
        return 'Define shared defaults for client apps, admin apps, or backend services.';
      case 'targets':
        return 'Adjust one app or service at a time. Overrides here win over shared defaults.';
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
      if (!values.enabled && !values.clientId && !values.clientSecret) continue;
      calls.push(
        new Promise<void>((resolve, reject) => {
          this.setupService.configureOAuthProvider(name, values).subscribe({
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
    phase: 'building' | 'infra' | 'db' | 'deploying',
    call: () => Observable<{ success: boolean; message: string }>,
    next: () => void
  ) {
    this.deployPhase = phase;
    this.deployStep = phase;
    this.deployMessage = `Running: ${phase}...`;
    this.deployError = null;

    call().subscribe({
      next: (result) => {
        if (!result.success) {
          this.deployPhase = 'error';
          this.deployStep = phase;
          this.deployError = result.message || `${phase} failed`;
          this.deployMessage = '';
          return;
        }
        this.deployMessage = result.message || `${phase} complete`;
        next();
      },
      error: (err) => {
        this.deployPhase = 'error';
        this.deployStep = phase;
        this.deployError = err.message || `${phase} failed`;
        this.deployMessage = '';
      },
    });
  }

  runDeployPipeline() {
    this.deployError = null;
    this.deployMessage = '';

    this.runPhase(
      'building',
      () => this.setupService.buildImages(),
      () => {
        this.runPhase(
          'infra',
          () => this.setupService.provisionInfraCompose(),
          () => {
            this.runPhase(
              'db',
              () => this.setupService.initDatabases(),
              () => {
                this.runPhase(
                  'deploying',
                  () => this.setupService.deployServices(),
                  () => {
                    this.deployPhase = 'activating';
                    this.deployStep = 'activating';
                    this.deployMessage = 'Creating owner account...';
                    this.setupService.activateOwner().subscribe({
                      next: () => {
                        this.deployPhase = 'rebooting';
                        this.deployMessage =
                          'Setup complete! Redirecting to owner console...';
                        setTimeout(() => {
                          window.location.href =
                            'http://localhost:8084/dashboard';
                        }, 2000);
                      },
                      error: (err) => {
                        this.deployPhase = 'error';
                        this.deployStep = 'activating';
                        this.deployError = err.message || 'Failed to activate';
                        this.deployMessage = '';
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
    this.setupService.testOAuthProvider(providerName).subscribe({
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
