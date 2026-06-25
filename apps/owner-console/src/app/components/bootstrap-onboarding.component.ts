import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  BootstrapService,
  BootstrapStatus,
  BootstrapConfig,
  OAuthProviderInfo,
} from '../services/bootstrap.service';
import { AppRegistryService } from '@optimistic-tanuki/app-registry';
import { AppRegistration } from '@optimistic-tanuki/app-registry-backend';
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

@Component({
  selector: 'app-bootstrap-onboarding',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
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
  styleUrls: ['./bootstrap-onboarding.component.scss'],
})
export class BootstrapOnboardingComponent implements OnInit, OnDestroy {
  private readonly bootstrapService = inject(BootstrapService);
  private readonly router = inject(Router);
  private readonly registryService = inject(AppRegistryService);
  private readonly platformId = inject(PLATFORM_ID);

  currentStep = 0;
  loading = false;
  error: string | null = null;
  status: BootstrapStatus | null = null;
  apiOnline = true;
  private healthTimer?: ReturnType<typeof setInterval>;

  registryApps: AppRegistration[] = [];
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

  config: BootstrapConfig = {
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
      { serviceId: 'gateway', enabled: true },
      { serviceId: 'authentication', enabled: true },
    ],
    apps: [],
    oauth: {
      enabled: true,
      bridgeAppId: 'client-interface',
      providers: {
        google: {
          enabled: false,
          clientIdKey: 'GOOGLE_CLIENT_ID',
          clientSecretKey: 'GOOGLE_CLIENT_SECRET',
          redirectUri: '',
        },
        github: {
          enabled: false,
          clientIdKey: 'GITHUB_CLIENT_ID',
          clientSecretKey: 'GITHUB_CLIENT_SECRET',
          redirectUri: '',
        },
        microsoft: {
          enabled: false,
          clientIdKey: 'MICROSOFT_CLIENT_ID',
          clientSecretKey: 'MICROSOFT_CLIENT_SECRET',
          redirectUri: '',
        },
        facebook: {
          enabled: false,
          clientIdKey: 'FACEBOOK_CLIENT_ID',
          clientSecretKey: 'FACEBOOK_CLIENT_SECRET',
          redirectUri: '',
        },
      },
    },
  };

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
  testResults: Record<string, OAuthProviderInfo['lastTested']> = {};
  clientDomainEdits: Record<string, { domain: string; uiBaseUrl: string }> = {};
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
  deployStep: string | null = null;
  deployMessage = '';
  deployError: string | null = null;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadStatus();
      this.loadOAuthProviders();
      this.registryService.getAllApps().subscribe((apps) => {
        this.registryApps = apps;
        this.selectedAppIds = apps
          .filter((a) => a.appType === 'client')
          .map((a) => a.appId);
        this.seedClientDomainEdits();
      });
      this.selectedBackendIds = [...this.backendServiceIds];
      this.startHealthCheck();
    }
  }

  ngOnDestroy() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
    }
  }

  private startHealthCheck() {
    this.healthTimer = setInterval(() => {
      this.bootstrapService.getStatus().subscribe({
        next: (s) => {
          if (!s || typeof s.configured !== 'boolean') return;
          const wasOffline = !this.apiOnline;
          this.apiOnline = true;
          if (wasOffline) {
            this.onApiReconnected(s);
          }
        },
        error: () => {
          this.apiOnline = false;
        },
      });
    }, 5000);
  }

  private onApiReconnected(status: BootstrapStatus) {
    if (!status || typeof status.configured !== 'boolean') return;
    if (status.configured) {
      this.router.navigate(['/dashboard']);
      return;
    }
    if (
      status.wizardStep !== undefined &&
      status.wizardStep > 0 &&
      status.wizardStep !== this.currentStep
    ) {
      this.currentStep = status.wizardStep;
      this.loadStatus();
      this.restoreFromConfig();
    }
  }

  private restoreFromConfig() {
    this.bootstrapService.getConfig().subscribe({
      next: (res) => {
        if (!res.success) return;
        const cfg = res.data;
        this.config = cfg;
        if (cfg.wizard?.currentStep !== undefined) {
          this.currentStep = cfg.wizard.currentStep;
        }
        this.selectedBackendIds = cfg.services
          .filter((s) => s.enabled)
          .map((s) => s.serviceId);
        this.selectedAppIds = cfg.apps
          .filter((a) => a.appType === 'client')
          .map((a) => a.appId);
        for (const app of cfg.apps) {
          if (this.clientDomainEdits[app.appId]) {
            this.clientDomainEdits[app.appId].domain = app.domain;
            this.clientDomainEdits[app.appId].uiBaseUrl = app.uiBaseUrl;
          }
        }
        for (const [name, p] of Object.entries(cfg.oauth.providers)) {
          if (this.oauthProviderValues[name]) {
            this.oauthProviderValues[name].enabled = p.enabled;
            this.oauthProviderValues[name].redirectUri = p.redirectUri;
          }
        }
      },
    });
  }

  get clientApps(): AppRegistration[] {
    return this.registryApps.filter((a) => a.appType === 'client');
  }

  get adminApps(): AppRegistration[] {
    return this.registryApps.filter((a) => a.appType === 'admin');
  }

  loadStatus() {
    this.bootstrapService.getStatus().subscribe({
      next: (s) => {
        this.status = s;
        this.apiOnline = true;
        if (s.configured) {
          this.router.navigate(['/dashboard']);
          return;
        }
        if (
          s.wizardStep !== undefined &&
          s.wizardStep > 0 &&
          s.wizardStep !== this.currentStep
        ) {
          this.currentStep = s.wizardStep;
          this.restoreFromConfig();
        }
      },
      error: () => {
        this.apiOnline = false;
      },
    });
  }

  nextStep() {
    if (this.currentStep < 5) {
      this.currentStep++;
    }
  }

  prevStep() {
    if (this.currentStep > 0) {
      this.currentStep--;
    }
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
    this.config.services = allServiceIds.map((id) => ({
      serviceId: id,
      enabled: true,
    }));
    this.config.wizard = {
      currentStep: this.currentStep + 1,
      updatedAt: new Date().toISOString(),
    };

    this.bootstrapService.saveConfig(this.config).subscribe({
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

  updateClientDomain(appId: string, domain: string) {
    this.clientDomainEdits[appId] = {
      ...(this.clientDomainEdits[appId] ?? this.getClientDefaults(appId)),
      domain,
    };
  }

  updateClientUiBaseUrl(appId: string, url: string) {
    this.clientDomainEdits[appId] = {
      ...(this.clientDomainEdits[appId] ?? this.getClientDefaults(appId)),
      uiBaseUrl: url,
    };
  }

  private seedClientDomainEdits() {
    for (const app of this.registryApps) {
      if (!this.clientDomainEdits[app.appId]) {
        this.clientDomainEdits[app.appId] = {
          domain: app.domain,
          uiBaseUrl: app.uiBaseUrl,
        };
      }
    }
  }

  private getClientDefaults(appId: string): {
    domain: string;
    uiBaseUrl: string;
  } {
    const app = this.registryApps.find((a) => a.appId === appId);
    return { domain: app?.domain ?? '', uiBaseUrl: app?.uiBaseUrl ?? '' };
  }

  saveClientDomains() {
    const edits = this.clientDomainEdits;
    this.config.apps = this.registryApps.map((a) => {
      const edit = edits[a.appId];
      return {
        appId: a.appId,
        domain: edit?.domain ?? a.domain,
        uiBaseUrl: edit?.uiBaseUrl ?? a.uiBaseUrl,
        apiBaseUrl: a.apiBaseUrl,
        appType: a.appType,
        visibility: a.visibility,
      };
    });
    if (this.config.gateway && this.clientApps.length > 0) {
      const firstClient = edits[this.clientApps[0].appId] ?? this.clientApps[0];
      this.config.gateway.publicUrl = `${
        firstClient.uiBaseUrl?.replace(/\/+$/, '') ?? firstClient.uiBaseUrl
      }/api`;
    }
    this.saveConfig();
  }

  toggleApp(appId: string) {
    const idx = this.selectedAppIds.indexOf(appId);
    if (idx > -1) {
      this.selectedAppIds.splice(idx, 1);
    } else {
      this.selectedAppIds.push(appId);
    }
  }

  setAppSelection(appId: string, selected: boolean) {
    const idx = this.selectedAppIds.indexOf(appId);
    if (selected && idx === -1) {
      this.selectedAppIds.push(appId);
    } else if (!selected && idx > -1) {
      this.selectedAppIds.splice(idx, 1);
    }
  }

  isAppSelected(appId: string): boolean {
    return this.selectedAppIds.includes(appId);
  }

  toggleBackend(serviceId: string) {
    if (this.coreServiceIds.includes(serviceId)) return;
    const idx = this.selectedBackendIds.indexOf(serviceId);
    if (idx > -1) {
      this.selectedBackendIds.splice(idx, 1);
    } else {
      this.selectedBackendIds.push(serviceId);
    }
  }

  setBackendSelection(serviceId: string, selected: boolean) {
    if (this.coreServiceIds.includes(serviceId)) return;
    const idx = this.selectedBackendIds.indexOf(serviceId);
    if (selected && idx === -1) {
      this.selectedBackendIds.push(serviceId);
    } else if (!selected && idx > -1) {
      this.selectedBackendIds.splice(idx, 1);
    }
  }

  isBackendSelected(serviceId: string): boolean {
    return this.selectedBackendIds.includes(serviceId);
  }

  isBackendRequired(serviceId: string): boolean {
    return this.coreServiceIds.includes(serviceId);
  }

  get allBackendsSelected(): boolean {
    return this.backendServiceIds.every(
      (id) => this.isBackendSelected(id) || this.isBackendRequired(id)
    );
  }

  toggleAllBackends() {
    if (this.allBackendsSelected) {
      this.selectedBackendIds = [...this.coreServiceIds];
    } else {
      this.selectedBackendIds = [...this.backendServiceIds];
    }
  }

  get allClientAppsSelected(): boolean {
    return (
      this.clientApps.length > 0 &&
      this.clientApps.every((a) => this.isAppSelected(a.appId))
    );
  }

  toggleAllClientApps() {
    if (this.allClientAppsSelected) {
      for (const app of this.clientApps) {
        this.setAppSelection(app.appId, false);
      }
    } else {
      for (const app of this.clientApps) {
        this.setAppSelection(app.appId, true);
      }
    }
  }

  get allAdminAppsSelected(): boolean {
    return (
      this.adminApps.length > 0 &&
      this.adminApps.every((a) => this.isAppSelected(a.appId))
    );
  }

  toggleAllAdminApps() {
    if (this.allAdminAppsSelected) {
      for (const app of this.adminApps) {
        this.setAppSelection(app.appId, false);
      }
    } else {
      for (const app of this.adminApps) {
        this.setAppSelection(app.appId, true);
      }
    }
  }

  loadOAuthProviders() {
    this.bootstrapService.getOAuthProviders().subscribe({
      next: (res) => {
        for (const provider of res.providers) {
          const existing = this.oauthProviders.find(
            (p) => p.name === provider.name
          );
          if (existing) {
            Object.assign(existing, provider);
            existing.clientIdPresent =
              provider.clientIdPresent ||
              !!this.oauthProviderValues[provider.name]?.clientId;
            existing.clientSecretPresent =
              provider.clientSecretPresent ||
              !!this.oauthProviderValues[provider.name]?.clientSecret;
          }
          if (this.oauthProviderValues[provider.name]) {
            this.oauthProviderValues[provider.name].enabled = provider.enabled;
            this.oauthProviderValues[provider.name].redirectUri =
              provider.redirectUri ||
              this.oauthProviderValues[provider.name].redirectUri;
          }
        }
      },
      error: () => {
        // providers are pre-seeded with defaults; fall back silently
      },
    });
  }

  saveOAuthConfig() {
    this.loading = true;
    this.error = null;

    const promises: Promise<void>[] = [];
    for (const [name, values] of Object.entries(this.oauthProviderValues)) {
      if (!values.enabled && !values.clientId && !values.clientSecret) continue;
      promises.push(
        new Promise<void>((resolve, reject) => {
          this.bootstrapService.configureOAuthProvider(name, values).subscribe({
            next: () => resolve(),
            error: (err) => reject(err),
          });
        })
      );
    }

    Promise.all(promises)
      .then(() => {
        this.loading = false;
        this.nextStep();
      })
      .catch((err) => {
        this.error = err.message || 'Failed to save OAuth config';
        this.loading = false;
      });
  }

  createOwner() {
    this.loading = true;
    this.error = null;

    this.bootstrapService
      .createOwner(this.operatorName, this.operatorEmail, this.operatorPassword)
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.nextStep();
        },
        error: (err) => {
          this.error = err.message || 'Failed to create owner';
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

  runDeployPipeline() {
    this.deployPhase = 'building';
    this.deployStep = 'building';
    this.deployMessage = 'Building container images...';
    this.deployError = null;

    this.bootstrapService.deployAll().subscribe({
      next: (result) => {
        if (!result.success) {
          this.deployPhase = 'error';
          this.deployStep = result.phase || 'deploying';
          this.deployError = result.message || 'Deployment failed';
          this.deployMessage = '';
          return;
        }
        this.deployPhase = 'activating';
        this.deployMessage = 'Activating setup...';
        this.bootstrapService.activateOwner().subscribe({
          next: () => {
            this.deployPhase = 'rebooting';
            this.deployMessage =
              'Rebooting services, waiting for admin API to come back online...';
            this.startRebootMonitor();
          },
          error: (err) => {
            this.deployPhase = 'error';
            this.deployStep = 'activating';
            this.deployError = err.message || 'Failed to activate';
            this.deployMessage = '';
          },
        });
      },
      error: (err) => {
        this.deployPhase = 'error';
        this.deployStep = 'deploying';
        this.deployError = err.message || 'Deployment request failed';
        this.deployMessage = '';
      },
    });
  }

  private startRebootMonitor() {
    const poll = () => {
      this.bootstrapService.getStatus().subscribe({
        next: (s) => {
          if (s && s.configured) {
            this.deployPhase = 'done';
            this.deployMessage = 'Platform deployed and ready!';
            setTimeout(() => this.router.navigate(['/dashboard']), 1000);
          } else {
            setTimeout(poll, 3000);
          }
        },
        error: () => {
          setTimeout(poll, 3000);
        },
      });
    };
    setTimeout(poll, 3000);
  }

  testProvider(providerName: string) {
    this.testingProvider = providerName;
    this.bootstrapService.testOAuthProvider(providerName).subscribe({
      next: () => {
        this.testResults[providerName] = new Date().toISOString();
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
