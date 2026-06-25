import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { dump, load } from 'js-yaml';
import {
  BootstrapConfig,
  SetupDatabaseSlot,
  SetupDeployPhaseId,
  SetupDeployPhaseProgress,
  SetupDeployProgressSnapshot,
  SetupDeploySubstepProgress,
  SetupHostPathListing,
  SetupSettingsCatalog,
  SetupSettingsDocument,
  SetupSettingsGroup,
  SetupSettingsTarget,
  SetupSettingFieldDescriptor,
  SetupSecretFieldDescriptor,
  SetupServiceSelection,
  SetupServiceDatabaseBinding,
} from '../shared/setup.models';

const execFileAsync = promisify(execFile);

export interface BootstrapStatus {
  configured: boolean;
  phase: string;
  checks: Array<{
    name: string;
    status: 'pass' | 'fail' | 'warn' | 'info';
    message: string;
  }>;
  wizardStep?: number;
}

const DEFAULT_GROUPS: SetupSettingsGroup[] = [
  {
    id: 'clients',
    label: 'Client Apps',
    description: 'Shared defaults for public client applications.',
  },
  {
    id: 'admins',
    label: 'Admin Apps',
    description: 'Shared defaults for internal and admin applications.',
  },
  {
    id: 'services',
    label: 'Backend Services',
    description: 'Shared defaults for backend service runtime settings.',
  },
];

const SERVICE_DIRECTORY_OVERRIDES: Record<string, string> = {
  'ai-orchestration': 'ai-orchestrator',
  'chat-collector': 'chat-collector',
  'project-planning': 'project-planning',
  'prompt-proxy': 'prompt-proxy',
  'system-configurator-api': 'system-configurator-api',
  'telos-docs-service': 'telos-docs-service',
  'video-transcoder-worker': 'video-transcoder-worker',
};

const COMMON_SERVICE_LABELS: Record<string, string> = {
  gateway: 'Gateway',
  authentication: 'Authentication',
  profile: 'Profile',
  social: 'Social',
  permissions: 'Permissions',
  'chat-collector': 'Chat Collector',
  assets: 'Assets',
  'prompt-proxy': 'Prompt Proxy',
  'ai-orchestration': 'AI Orchestration',
  'telos-docs-service': 'Telos Docs Service',
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
  'video-transcoder-worker': 'Video Transcoder Worker',
};

const SECRET_ENV_SUFFIXES = [
  'SECRET',
  'PASSWORD',
  'TOKEN',
  'API_KEY',
  'ACCESS_KEY',
  'SECRET_KEY',
  'CLIENT_SECRET',
];

const PATH_VALUE_TYPE_OVERRIDES: Record<string, 'file' | 'directory'> = {
  APP_REGISTRY_HOST_PATH: 'file',
  ASSETS_HOST_PATH: 'directory',
  VIDEO_SEED_SOURCE_DIR: 'directory',
  VIDEO_SEED_SOURCE_HOST_PATH: 'directory',
  POSTGRES_DATA_DIR: 'directory',
};

const OAUTH_PROVIDER_KEYS = ['google', 'github', 'microsoft', 'facebook'];

type OAuthProviderRecord = {
  enabled: boolean;
  clientIdKey: string;
  clientSecretKey: string;
  redirectUri: string;
};

type OAuthProviderInfo = {
  name: string;
  enabled: boolean;
  status: 'configured' | 'pending' | 'error';
  clientIdPresent: boolean;
  clientSecretPresent: boolean;
  clientIdValue: string;
  clientSecretValue: string;
  clientIdKey: string;
  clientSecretKey: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userInfoEndpoint: string;
  scopes: string[];
  validationErrors: string[];
  lastTested: string | null;
};

type OAuthAppsInfo = {
  bridgeAppId: string;
  bridgeAppDomain: string;
  bridgeAppBaseUrl: string;
  apps: Array<{
    appId: string;
    domain: string;
    oauthEligible: boolean;
    allowedProviders: string[];
    returnToOrigin: string;
  }>;
};

type SavedOperatorSummary = {
  name: string;
  email: string;
  passwordSaved: boolean;
  source: 'saved' | 'existing' | 'saved-existing';
  existingUser: boolean;
  existingCount: number;
  userId?: string;
};

type ExistingOwnerUserSummary = {
  userId?: string;
  name: string;
  email: string;
};

type PartialEnvironmentConfig = Partial<BootstrapConfig['environment']>;

export class SetupService {
  private readonly workspaceRoot: string;
  private readonly deploymentPath: string;
  private readonly secretsPath: string;
  private readonly setupCompletePath: string;
  private readonly setupMode: 'setup' | 'reconfigure';
  private readonly operatorInfoPath: string;
  private deployProgress: SetupDeployProgressSnapshot;

  constructor() {
    this.workspaceRoot = process.env['SETUP_WORKSPACE_ROOT'] || process.cwd();
    this.deploymentPath =
      process.env['ADMIN_API_DEPLOYMENT_PATH'] ||
      './ops/deployments/production.yaml';
    this.secretsPath = process.env['ADMIN_API_SECRETS_PATH'] || './.secrets';
    this.setupCompletePath = path.join(this.workspaceRoot, '.setup-complete');
    this.operatorInfoPath = path.join(
      this.workspaceRoot,
      '.setup-operator.json'
    );
    this.setupMode =
      process.env['SETUP_CONSOLE_MODE'] === 'reconfigure'
        ? 'reconfigure'
        : 'setup';
    this.deployProgress = this.createDeployProgressSnapshot();
  }

  private isReconfigureMode(): boolean {
    return this.setupMode === 'reconfigure';
  }

  private configuredDeploymentPath(): string {
    return path.isAbsolute(this.deploymentPath)
      ? this.deploymentPath
      : path.join(this.workspaceRoot, this.deploymentPath);
  }

  private deploymentDirectory(): string {
    return path.dirname(this.configuredDeploymentPath());
  }

  private activeEnvironmentName(): string {
    return path.basename(this.configuredDeploymentPath(), '.yaml');
  }

  private resolveDeploymentPath(environmentName?: string): string {
    if (!environmentName || environmentName === this.activeEnvironmentName()) {
      return this.configuredDeploymentPath();
    }

    return path.join(this.deploymentDirectory(), `${environmentName}.yaml`);
  }

  private resolveSecretsPath(environmentName?: string): string {
    if (!environmentName || environmentName === this.activeEnvironmentName()) {
      return path.isAbsolute(this.secretsPath)
        ? this.secretsPath
        : path.join(this.workspaceRoot, this.secretsPath);
    }

    return path.join(
      this.deploymentDirectory(),
      `${environmentName}.secrets.env`
    );
  }

  private resolveGoBin(): string {
    const localBin = path.join(
      this.workspaceRoot,
      'tools',
      'admin-env-wizard',
      'admin-env'
    );
    if (fs.existsSync(localBin)) return localBin;
    if (fs.existsSync('/usr/local/bin/admin-env'))
      return '/usr/local/bin/admin-env';
    return localBin;
  }

  private composeArgs(...args: string[]): string[] {
    const composeFile = path.join(this.workspaceRoot, 'docker-compose.yaml');
    return ['compose', '-f', composeFile, ...args];
  }

  private timeoutSignal(ms: number): AbortSignal | undefined {
    if (
      typeof AbortSignal !== 'undefined' &&
      typeof AbortSignal.timeout === 'function'
    ) {
      return AbortSignal.timeout(ms);
    }
    return undefined;
  }

  private async isGatewayRunning(): Promise<boolean> {
    try {
      const res = await fetch('http://localhost:3000/api-docs', {
        signal: this.timeoutSignal(3000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<BootstrapStatus> {
    const checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn' | 'info';
      message: string;
    }> = [];
    const hasDeployment = fs.existsSync(this.resolveDeploymentPath());
    const hasSecrets = fs.existsSync(this.resolveSecretsPath());
    const hasSetupComplete = fs.existsSync(this.setupCompletePath);

    checks.push({
      name: 'deployment-config',
      status: hasDeployment ? 'pass' : 'info',
      message: hasDeployment ? 'production.yaml exists' : 'No production.yaml',
    });
    checks.push({
      name: 'secrets',
      status: hasSecrets ? 'pass' : 'info',
      message: hasSecrets ? '.secrets exists' : 'No .secrets',
    });
    checks.push({
      name: 'setup-complete',
      status: hasSetupComplete ? 'pass' : 'info',
      message: hasSetupComplete ? 'Setup complete' : 'Not completed',
    });

    if (hasSetupComplete && !this.isReconfigureMode()) {
      return { configured: true, phase: 'ready', checks, wizardStep: 6 };
    }

    const gwRunning = await this.isGatewayRunning();
    checks.push({
      name: 'gateway',
      status: gwRunning ? 'pass' : 'info',
      message: gwRunning ? 'Gateway is running' : 'Gateway not detected',
    });

    if (gwRunning && hasDeployment && !this.isReconfigureMode()) {
      try {
        const res = await fetch(
          'http://localhost:3000/api/users?scope=owner-console',
          { signal: this.timeoutSignal(3000) }
        );
        if (res.ok) {
          const users = await res.json();
          if (Array.isArray(users) && users.length > 0) {
            fs.writeFileSync(
              this.setupCompletePath,
              new Date().toISOString(),
              'utf-8'
            );
            return { configured: true, phase: 'ready', checks, wizardStep: 6 };
          }
        }
      } catch {}
    }

    if (!hasDeployment || !hasSecrets) {
      return { configured: false, phase: 'setup', checks };
    }

    try {
      const doc = this.loadDeploymentConfig() as BootstrapConfig;
      return {
        configured: false,
        phase: this.isReconfigureMode() ? 'reconfigure' : 'setup',
        checks,
        wizardStep: this.isReconfigureMode() ? 0 : doc?.wizard?.currentStep,
      };
    } catch {
      return { configured: false, phase: 'error', checks };
    }
  }

  async listEnvironments(): Promise<{
    activeEnvironment: string;
    environments: string[];
  }> {
    const deploymentDir = this.deploymentDirectory();
    const environments = fs.existsSync(deploymentDir)
      ? fs
          .readdirSync(deploymentDir)
          .filter((file) => file.endsWith('.yaml'))
          .map((file) => path.basename(file, '.yaml'))
          .sort()
      : [];
    const activeEnvironment = this.activeEnvironmentName();
    if (!environments.includes(activeEnvironment)) {
      environments.unshift(activeEnvironment);
    }

    return {
      activeEnvironment,
      environments: [...new Set(environments)],
    };
  }

  async createEnvironment(name: string): Promise<BootstrapConfig> {
    const environmentName = name.trim();
    if (!environmentName) {
      throw new Error('Environment name is required');
    }

    const sourceConfig = this.loadDeploymentConfig();
    const clonedConfig = this.normalizeConfig({
      ...sourceConfig,
      environment: {
        ...sourceConfig.environment,
        name: environmentName,
      },
      services: sourceConfig.services.map((service) => ({
        ...service,
        database: service.database ? { ...service.database } : undefined,
      })),
      apps: sourceConfig.apps.map((app) => ({ ...app })),
      oauth: {
        ...sourceConfig.oauth,
        providers: Object.fromEntries(
          Object.entries(sourceConfig.oauth.providers).map(([key, value]) => [
            key,
            { ...value },
          ])
        ),
      },
      databases: (sourceConfig.databases || []).map((slot) => ({ ...slot })),
      settings: sourceConfig.settings
        ? {
            global: { ...sourceConfig.settings.global },
            groups: Object.fromEntries(
              Object.entries(sourceConfig.settings.groups).map(
                ([key, value]) => [key, { ...value }]
              )
            ),
            targets: Object.fromEntries(
              Object.entries(sourceConfig.settings.targets).map(
                ([key, value]) => [key, { ...value }]
              )
            ),
          }
        : undefined,
      wizard: sourceConfig.wizard
        ? { ...sourceConfig.wizard, updatedAt: new Date().toISOString() }
        : undefined,
    });

    await this.saveConfig(clonedConfig, environmentName);
    const sourceSecrets = this.loadSecretsFile();
    await this.saveSecrets(sourceSecrets, environmentName);
    return clonedConfig;
  }

  async takeOverDeployment(input: {
    deploymentPath: string;
    secretsPath?: string;
    environmentName?: string;
  }): Promise<{ data: BootstrapConfig; environment: string }> {
    const sourceDeploymentPath = this.resolveImportPath(input.deploymentPath);
    if (!fs.existsSync(sourceDeploymentPath)) {
      throw new Error('Deployment file not found');
    }

    const sourceEnvironmentName =
      input.environmentName?.trim() ||
      path.basename(sourceDeploymentPath, path.extname(sourceDeploymentPath));
    if (!sourceEnvironmentName) {
      throw new Error('Environment name is required');
    }

    const sourceEnvPath = this.resolveTakeoverSecretsPath(
      sourceDeploymentPath,
      input.secretsPath
    );
    const sourceConfig =
      this.loadDeploymentConfigFromPath(sourceDeploymentPath);
    const normalizedConfig = this.normalizeConfig({
      ...sourceConfig,
      environment: {
        ...sourceConfig.environment,
        name: sourceEnvironmentName,
      },
    });
    const migrated = sourceEnvPath
      ? this.applyImportedEnvFile(
          normalizedConfig,
          this.loadSecretsFileFromPath(sourceEnvPath)
        )
      : { config: normalizedConfig, secrets: {} };

    await this.saveConfig(migrated.config, sourceEnvironmentName);
    await this.saveSecrets(migrated.secrets, sourceEnvironmentName);

    return {
      data: migrated.config,
      environment: sourceEnvironmentName,
    };
  }

  async loadConfig(environmentName?: string): Promise<BootstrapConfig> {
    return this.normalizeConfig(this.loadDeploymentConfig(environmentName));
  }

  async saveConfig(
    config: BootstrapConfig,
    environmentName?: string
  ): Promise<void> {
    const deploymentPath = this.resolveDeploymentPath(environmentName);
    const dir = path.dirname(deploymentPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      deploymentPath,
      this.serializeYaml(this.normalizeConfig(config)),
      'utf-8'
    );
  }

  async getSettingsCatalog(
    environmentName?: string
  ): Promise<SetupSettingsCatalog> {
    const config = await this.loadConfig(environmentName);
    const targets: SetupSettingsTarget[] = [];

    for (const app of config.apps) {
      targets.push({
        id: app.appId,
        label: this.humanizeLabel(app.appId),
        targetKind: 'app',
        groupId: app.appType === 'admin' ? 'admins' : 'clients',
        fields: [
          {
            id: `${app.appId}:domain`,
            key: 'domain',
            label: 'Domain',
            valueType: 'string',
            scopes: ['global', 'group', 'target'],
            secret: false,
            placeholder: 'example.com',
          },
          {
            id: `${app.appId}:uiBaseUrl`,
            key: 'uiBaseUrl',
            label: 'UI Base URL',
            valueType: 'url',
            scopes: ['global', 'group', 'target'],
            secret: false,
            placeholder: 'https://app.example.com',
          },
          {
            id: `${app.appId}:apiBaseUrl`,
            key: 'apiBaseUrl',
            label: 'API Base URL',
            valueType: 'url',
            scopes: ['global', 'group', 'target'],
            secret: false,
            placeholder: 'https://api.example.com',
          },
        ],
        secrets: [],
        connections: [],
      });
    }

    for (const service of config.services.filter((entry) => entry.enabled)) {
      targets.push(this.discoverServiceTarget(service.serviceId));
    }

    return {
      groups: DEFAULT_GROUPS,
      targets,
    };
  }

  async loadSecrets(environmentName?: string): Promise<Record<string, string>> {
    return this.loadSecretsFile(environmentName);
  }

  async saveSecrets(
    secrets: Record<string, string>,
    environmentName?: string
  ): Promise<void> {
    fs.writeFileSync(
      this.resolveSecretsPath(environmentName),
      this.serializeEnv(secrets),
      'utf-8'
    );
  }

  getDeployProgress(): SetupDeployProgressSnapshot {
    return {
      ...this.deployProgress,
      phases: this.deployProgress.phases.map((phase) => ({
        ...phase,
        substeps: phase.substeps.map((substep) => ({ ...substep })),
      })),
    };
  }

  resetDeployProgress(): void {
    this.deployProgress = this.createDeployProgressSnapshot();
  }

  private createDeployProgressSnapshot(): SetupDeployProgressSnapshot {
    return {
      activePhase: 'idle',
      activeSubstepId: null,
      message: '',
      error: null,
      updatedAt: new Date().toISOString(),
      phases: [
        this.createDeployPhase('building', 'Prepare rollout assets', [
          ['resolve-strategy', 'Determine deployment strategy'],
          ['prepare-tag', 'Prepare image tag and rollout inputs'],
          ['build-or-pull', 'Build or pull runtime artifacts'],
          ['verify-artifacts', 'Verify image availability'],
        ]),
        this.createDeployPhase('infra', 'Provision infrastructure', [
          ['validate-infra', 'Validate infrastructure prerequisites'],
          ['start-shared-services', 'Start shared infrastructure services'],
          ['wait-for-infra', 'Wait for infrastructure health'],
        ]),
        this.createDeployPhase('db', 'Initialize databases', [
          ['prepare-db', 'Prepare database bootstrap plan'],
          ['run-migrations', 'Run schema and migration tasks'],
          ['seed-data', 'Run seed and bootstrap tasks'],
        ]),
        this.createDeployPhase('deploying', 'Deploy services', [
          ['resolve-services', 'Resolve enabled services'],
          ['apply-services', 'Apply service rollout'],
          ['verify-startup', 'Verify gateway and service startup'],
        ]),
        this.createDeployPhase('activating', 'Create owner account', [
          ['save-owner', 'Create or confirm operator account'],
          ['mark-setup', 'Mark setup as complete'],
        ]),
        this.createDeployPhase('rebooting', 'Finalize setup', [
          ['wait-for-console', 'Wait for owner console handoff'],
          ['redirect', 'Redirect to owner console'],
        ]),
      ],
    };
  }

  private createDeployPhase(
    id: SetupDeployPhaseId,
    label: string,
    substeps: Array<[string, string]>
  ): SetupDeployPhaseProgress {
    return {
      id,
      label,
      status: 'pending',
      substeps: substeps.map(([substepId, substepLabel]) => ({
        id: substepId,
        label: substepLabel,
        status: 'pending',
      })),
    };
  }

  private deployPhaseState(
    phase: SetupDeployPhaseId
  ): SetupDeployPhaseProgress | undefined {
    return this.deployProgress.phases.find((entry) => entry.id === phase);
  }

  private deploySubstepState(
    phase: SetupDeployPhaseId,
    substepId: string
  ): SetupDeploySubstepProgress | undefined {
    return this.deployPhaseState(phase)?.substeps.find(
      (entry) => entry.id === substepId
    );
  }

  private startDeployProgress(
    phase: SetupDeployPhaseId,
    substepId: string,
    message: string
  ): void {
    this.deployProgress.activePhase = phase;
    this.deployProgress.activeSubstepId = substepId;
    this.deployProgress.message = message;
    this.deployProgress.error = null;
    const phaseState = this.deployPhaseState(phase);
    if (phaseState) {
      phaseState.status = 'running';
    }
    const substepState = this.deploySubstepState(phase, substepId);
    if (substepState) {
      substepState.status = 'running';
    }
    this.deployProgress.updatedAt = new Date().toISOString();
  }

  private completeDeploySubstep(
    phase: SetupDeployPhaseId,
    substepId: string
  ): void {
    const substepState = this.deploySubstepState(phase, substepId);
    if (substepState) {
      substepState.status = 'done';
    }
    const phaseState = this.deployPhaseState(phase);
    if (
      phaseState &&
      phaseState.substeps.every((entry) => entry.status === 'done')
    ) {
      phaseState.status = 'done';
    } else if (phaseState) {
      phaseState.status = 'running';
    }
    this.deployProgress.updatedAt = new Date().toISOString();
  }

  private failDeployProgress(
    phase: SetupDeployPhaseId,
    substepId: string,
    message: string
  ): void {
    this.deployProgress.activePhase = 'error';
    this.deployProgress.activeSubstepId = substepId;
    this.deployProgress.error = message;
    this.deployProgress.message = '';
    const phaseState = this.deployPhaseState(phase);
    if (phaseState) {
      phaseState.status = 'error';
    }
    const substepState = this.deploySubstepState(phase, substepId);
    if (substepState) {
      substepState.status = 'error';
    }
    this.deployProgress.updatedAt = new Date().toISOString();
  }

  async browseHostPath(inputPath?: string): Promise<SetupHostPathListing> {
    const requestedPath = (inputPath || this.workspaceRoot).trim();
    const resolvedPath = this.resolveImportPath(requestedPath);
    const stats = fs.existsSync(resolvedPath)
      ? fs.statSync(resolvedPath)
      : null;

    const currentPath =
      stats && stats.isDirectory()
        ? resolvedPath
        : stats
        ? path.dirname(resolvedPath)
        : path.dirname(resolvedPath);

    if (
      !fs.existsSync(currentPath) ||
      !fs.statSync(currentPath).isDirectory()
    ) {
      throw new Error('Host path not found');
    }

    const entries = fs
      .readdirSync(currentPath, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.'))
      .map((entry) => {
        const entryPath = path.join(currentPath, entry.name);
        const directory = entry.isDirectory();
        return {
          name: entry.name,
          path: entryPath,
          directory,
          file: !directory,
        };
      })
      .sort((left, right) => {
        if (left.directory !== right.directory) {
          return left.directory ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      });

    return {
      currentPath,
      parentPath:
        path.dirname(currentPath) !== currentPath
          ? path.dirname(currentPath)
          : undefined,
      entries,
    };
  }

  async storeManagedFile(input: {
    environmentName?: string;
    filename: string;
    contentBase64: string;
  }): Promise<{ path: string }> {
    const environmentName =
      input.environmentName?.trim() || this.activeEnvironmentName();
    const safeFilename = path.basename(input.filename || 'upload.dat');
    const outputDir = path.join(
      this.deploymentDirectory(),
      'managed-files',
      environmentName
    );
    fs.mkdirSync(outputDir, { recursive: true });

    const outputPath = path.join(outputDir, safeFilename);
    fs.writeFileSync(outputPath, Buffer.from(input.contentBase64, 'base64'));

    return { path: outputPath };
  }

  async validate(): Promise<{
    valid: boolean;
    issues: Array<{ severity: string; message: string }>;
  }> {
    const deploymentPath = this.resolveDeploymentPath();
    const secretsPath = this.resolveSecretsPath();
    const goBin = this.resolveGoBin();

    if (!fs.existsSync(goBin)) {
      return {
        valid: false,
        issues: [{ severity: 'error', message: 'admin-env binary not found' }],
      };
    }
    if (!fs.existsSync(deploymentPath)) {
      return {
        valid: false,
        issues: [{ severity: 'error', message: 'No deployment config' }],
      };
    }

    try {
      const { stdout } = await execFileAsync(
        goBin,
        [
          'validate',
          '-deployment',
          deploymentPath,
          '-secrets',
          secretsPath,
          '--json',
        ],
        {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      const result = JSON.parse(stdout);
      return {
        valid: result.issues?.length === 0,
        issues: result.issues || [],
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        issues: [{ severity: 'error', message: `Validation failed: ${msg}` }],
      };
    }
  }

  async buildImages(): Promise<{ success: boolean; message: string }> {
    const deploymentPath = this.resolveDeploymentPath();
    const secretsPath = this.resolveSecretsPath();
    const goBin = this.resolveGoBin();
    this.resetDeployProgress();
    this.startDeployProgress(
      'building',
      'resolve-strategy',
      'Resolving deployment strategy...'
    );
    this.completeDeploySubstep('building', 'resolve-strategy');
    this.startDeployProgress(
      'building',
      'prepare-tag',
      'Preparing image tag and rollout inputs...'
    );
    this.completeDeploySubstep('building', 'prepare-tag');
    this.startDeployProgress(
      'building',
      'build-or-pull',
      'Generating deployment artifacts...'
    );

    if (!fs.existsSync(goBin)) {
      this.failDeployProgress(
        'building',
        'build-or-pull',
        'admin-env binary not found'
      );
      return { success: false, message: 'admin-env binary not found' };
    }

    try {
      const { stdout } = await execFileAsync(
        goBin,
        [
          'generate',
          '-deployment',
          deploymentPath,
          '-secrets',
          secretsPath,
          '--json',
        ],
        {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      const result = JSON.parse(stdout);
      this.completeDeploySubstep('building', 'build-or-pull');
      this.startDeployProgress(
        'building',
        'verify-artifacts',
        'Verifying generated deployment artifacts...'
      );
      this.completeDeploySubstep('building', 'verify-artifacts');
      return {
        success: true,
        message: `Artifacts generated at ${
          result.outputDir || 'dist/admin-env'
        }`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('validation failed') || msg.includes('not enabled')) {
        this.completeDeploySubstep('building', 'build-or-pull');
        this.startDeployProgress(
          'building',
          'verify-artifacts',
          'Artifact generation skipped because the wizard configuration is not fully applied yet.'
        );
        this.completeDeploySubstep('building', 'verify-artifacts');
        return {
          success: true,
          message: 'Artifact generation skipped (config in wizard state)',
        };
      }
      this.failDeployProgress(
        'building',
        'build-or-pull',
        `Build failed: ${msg}`
      );
      return { success: false, message: `Build failed: ${msg}` };
    }
  }

  async provisionInfra(): Promise<{ success: boolean; message: string }> {
    const composeFile = path.join(this.workspaceRoot, 'docker-compose.yaml');
    this.startDeployProgress(
      'infra',
      'validate-infra',
      'Validating infrastructure prerequisites...'
    );
    this.completeDeploySubstep('infra', 'validate-infra');
    this.startDeployProgress(
      'infra',
      'start-shared-services',
      'Starting shared infrastructure services...'
    );
    if (!fs.existsSync(composeFile)) {
      this.failDeployProgress(
        'infra',
        'start-shared-services',
        'docker-compose.yaml not found'
      );
      return { success: false, message: 'docker-compose.yaml not found' };
    }

    try {
      const { stdout } = await execFileAsync(
        'docker',
        this.composeArgs(
          'up',
          '-d',
          '--no-recreate',
          'postgres',
          'redis',
          'db-setup',
          'gateway',
          'authentication',
          'owner-console'
        ),
        {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      this.completeDeploySubstep('infra', 'start-shared-services');
      this.startDeployProgress(
        'infra',
        'wait-for-infra',
        'Waiting for infrastructure health...'
      );
      this.completeDeploySubstep('infra', 'wait-for-infra');
      return { success: true, message: stdout || 'Infrastructure provisioned' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already in use') || msg.includes('Already exists')) {
        this.completeDeploySubstep('infra', 'start-shared-services');
        this.startDeployProgress(
          'infra',
          'wait-for-infra',
          'Infrastructure was already running.'
        );
        this.completeDeploySubstep('infra', 'wait-for-infra');
        return { success: true, message: 'Infrastructure already running' };
      }
      this.failDeployProgress(
        'infra',
        'start-shared-services',
        `Infra provisioning failed: ${msg}`
      );
      return { success: false, message: `Infra provisioning failed: ${msg}` };
    }
  }

  async initDatabases(): Promise<{ success: boolean; message: string }> {
    const goBin = this.resolveGoBin();
    const deploymentPath = this.resolveDeploymentPath();
    const secretsPath = this.resolveSecretsPath();
    this.startDeployProgress(
      'db',
      'prepare-db',
      'Preparing database bootstrap plan...'
    );
    this.completeDeploySubstep('db', 'prepare-db');
    this.startDeployProgress('db', 'run-migrations', 'Running migrations...');

    if (fs.existsSync(goBin) && fs.existsSync(deploymentPath)) {
      try {
        await execFileAsync(
          goBin,
          [
            'validate',
            '-deployment',
            deploymentPath,
            '-secrets',
            secretsPath,
            '--json',
          ],
          {
            cwd: this.workspaceRoot,
            maxBuffer: 10 * 1024 * 1024,
          }
        );
      } catch {}
    }

    const migrateScript = path.join(
      this.workspaceRoot,
      'scripts',
      'setup-and-migrate.sh'
    );
    if (fs.existsSync(migrateScript)) {
      try {
        await execFileAsync(migrateScript, [], {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        });
      } catch {}
    }

    this.completeDeploySubstep('db', 'run-migrations');
    this.startDeployProgress(
      'db',
      'seed-data',
      'Running seed and bootstrap tasks...'
    );
    this.completeDeploySubstep('db', 'seed-data');

    return { success: true, message: 'Databases initialized' };
  }

  async deployServices(): Promise<{ success: boolean; message: string }> {
    const composeFile = path.join(this.workspaceRoot, 'docker-compose.yaml');
    this.startDeployProgress(
      'deploying',
      'resolve-services',
      'Resolving enabled services...'
    );
    if (!fs.existsSync(composeFile)) {
      this.failDeployProgress(
        'deploying',
        'resolve-services',
        'docker-compose.yaml not found'
      );
      return { success: false, message: 'docker-compose.yaml not found' };
    }

    try {
      const config = this.loadDeploymentConfig() as BootstrapConfig;
      const enabledServices = (config.services || [])
        .filter((s) => s.enabled)
        .map((s) => s.serviceId);
      this.completeDeploySubstep('deploying', 'resolve-services');
      this.startDeployProgress(
        'deploying',
        'apply-services',
        'Applying service rollout...'
      );
      const { stdout } = await execFileAsync(
        'docker',
        this.composeArgs('up', '-d', ...enabledServices),
        {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      this.completeDeploySubstep('deploying', 'apply-services');
      this.startDeployProgress(
        'deploying',
        'verify-startup',
        'Verifying gateway and service startup...'
      );
      this.completeDeploySubstep('deploying', 'verify-startup');
      return { success: true, message: stdout || 'Services deployed' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.failDeployProgress(
        'deploying',
        'apply-services',
        `Deployment failed: ${msg}`
      );
      return { success: false, message: `Deployment failed: ${msg}` };
    }
  }

  async deployAll(): Promise<{
    phase?: string;
    success: boolean;
    message: string;
  }> {
    const build = await this.buildImages();
    if (!build.success) return { phase: 'build-images', ...build };

    const infra = await this.provisionInfra();
    if (!infra.success) return { phase: 'infra-compose', ...infra };

    const db = await this.initDatabases();
    if (!db.success) return { phase: 'init-databases', ...db };

    return this.deployServices();
  }

  async createOwner(
    name: string,
    email: string,
    password: string
  ): Promise<{ userId: string; email: string; name: string }> {
    const [firstName, ...lastParts] = name.trim().split(/\s+/);
    const lastName = lastParts.join(' ') || firstName;

    const response = await fetch(
      'http://localhost:3000/api/authentication/register',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ot-appscope': 'owner-console',
        },
        body: JSON.stringify({
          fn: firstName,
          ln: lastName,
          email: email.trim().toLowerCase(),
          password,
          confirm: password,
          bio: 'Platform owner',
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Owner registration failed (${response.status}): ${body}`
      );
    }

    const result = await response.json();
    return {
      userId: result?.data?.user?.id || result?.userId || '',
      email: email.trim().toLowerCase(),
      name,
    };
  }

  async saveOperator(
    name: string,
    email: string,
    password: string
  ): Promise<void> {
    fs.writeFileSync(
      this.operatorInfoPath,
      JSON.stringify({ name, email, password }),
      'utf-8'
    );
  }

  async getSavedOperatorSummary(): Promise<SavedOperatorSummary | null> {
    const operator = this.getSavedOperator();
    const existingUsers = await this.getExistingOwnerUsers();
    const matchingExistingUser = operator
      ? existingUsers.find(
          (user) =>
            user.email.trim().toLowerCase() ===
            operator.email.trim().toLowerCase()
        ) || null
      : null;
    const fallbackExistingUser =
      matchingExistingUser ||
      (existingUsers.length === 1
        ? existingUsers[0]
        : existingUsers[0] || null);

    if (!operator && !fallbackExistingUser) {
      return null;
    }
    if (operator) {
      return {
        name: operator.name,
        email: operator.email.trim().toLowerCase(),
        passwordSaved: !!operator.password,
        source: matchingExistingUser ? 'saved-existing' : 'saved',
        existingUser: !!matchingExistingUser,
        existingCount: existingUsers.length,
        userId: matchingExistingUser?.userId,
      };
    }

    return {
      name: fallbackExistingUser?.name || '',
      email: fallbackExistingUser?.email || '',
      passwordSaved: false,
      source: 'existing',
      existingUser: true,
      existingCount: existingUsers.length,
      userId: fallbackExistingUser?.userId,
    };
  }

  private getSavedOperator(): {
    name: string;
    email: string;
    password: string;
  } | null {
    if (!fs.existsSync(this.operatorInfoPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(this.operatorInfoPath, 'utf-8'));
    } catch {
      return null;
    }
  }

  private async getExistingOwnerUsers(): Promise<ExistingOwnerUserSummary[]> {
    try {
      const res = await fetch(
        'http://localhost:3000/api/users?scope=owner-console',
        {
          signal: this.timeoutSignal(3000),
        }
      );
      if (!res.ok) {
        return [];
      }
      const payload = await res.json();
      const users: unknown[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : [];

      return users
        .map((user: unknown) => this.normalizeExistingOwnerUser(user))
        .filter(
          (
            user: ExistingOwnerUserSummary | null
          ): user is ExistingOwnerUserSummary => !!user && !!user.email.trim()
        );
    } catch {
      return [];
    }
  }

  private normalizeExistingOwnerUser(
    user: unknown
  ): ExistingOwnerUserSummary | null {
    if (!user || typeof user !== 'object') {
      return null;
    }
    const record = user as Record<string, unknown>;
    const email = this.readString(record, ['email', 'userEmail']);
    if (!email) {
      return null;
    }
    const firstName = this.readString(record, ['firstName', 'fn']);
    const lastName = this.readString(record, ['lastName', 'ln']);
    const compositeName = [firstName, lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    const name =
      this.readString(record, ['name', 'displayName', 'fullName']) ||
      compositeName ||
      email;
    return {
      userId: this.readString(record, ['id', 'userId']) || undefined,
      name,
      email: email.trim().toLowerCase(),
    };
  }

  private readString(record: Record<string, unknown>, keys: string[]): string {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
    return '';
  }

  async completeSetup(): Promise<void> {
    this.startDeployProgress(
      'activating',
      'save-owner',
      'Creating or confirming operator account...'
    );
    const operator = this.getSavedOperator();
    if (operator) {
      try {
        await this.createOwner(
          operator.name,
          operator.email,
          operator.password
        );
      } catch {
        // owner creation may fail if already exists; proceed with activation
      }
      try {
        fs.unlinkSync(this.operatorInfoPath);
      } catch {}
    }
    this.completeDeploySubstep('activating', 'save-owner');
    this.startDeployProgress(
      'activating',
      'mark-setup',
      'Marking setup as complete...'
    );
    fs.writeFileSync(this.setupCompletePath, new Date().toISOString(), 'utf-8');
    this.completeDeploySubstep('activating', 'mark-setup');
    this.startDeployProgress(
      'rebooting',
      'wait-for-console',
      'Waiting for owner console handoff...'
    );
    this.completeDeploySubstep('rebooting', 'wait-for-console');
    this.startDeployProgress(
      'rebooting',
      'redirect',
      'Redirecting operator to owner console...'
    );
    this.completeDeploySubstep('rebooting', 'redirect');
    this.deployProgress.activePhase = 'done';
    this.deployProgress.message =
      'Setup complete! Redirecting to owner console...';
    this.deployProgress.updatedAt = new Date().toISOString();
  }

  async configureOAuthProvider(
    name: string,
    opts: {
      enabled: boolean;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    },
    environmentName?: string
  ): Promise<void> {
    const deploymentPath = this.resolveDeploymentPath(environmentName);
    const secretsPath = this.resolveSecretsPath(environmentName);
    const providerKey = name.toLowerCase();
    const clientIdKey = `${providerKey.toUpperCase()}_CLIENT_ID`;
    const clientSecretKey = `${providerKey.toUpperCase()}_CLIENT_SECRET`;

    const existingSecrets = this.loadSecretsFile(environmentName);
    existingSecrets[clientIdKey] = opts.clientId;
    existingSecrets[clientSecretKey] = opts.clientSecret;
    fs.writeFileSync(secretsPath, this.serializeEnv(existingSecrets), 'utf-8');

    if (fs.existsSync(deploymentPath)) {
      const content = fs.readFileSync(deploymentPath, 'utf-8');
      const doc = load(content) as Record<string, unknown>;
      const oauth = doc?.['oauth'] as Record<string, unknown> | undefined;
      if (oauth) {
        const providers =
          (oauth['providers'] as Record<string, unknown> | undefined) || {};
        oauth['providers'] = providers;
        const provider =
          (providers[providerKey] as Record<string, unknown> | undefined) || {};
        providers[providerKey] = provider;
        provider['enabled'] = opts.enabled;
        provider['clientIdKey'] = clientIdKey;
        provider['clientSecretKey'] = clientSecretKey;
        provider['redirectUri'] = opts.redirectUri;
        fs.writeFileSync(
          deploymentPath,
          dump(doc, {
            indent: 2,
            lineWidth: -1,
            noRefs: true,
            quotingType: "'",
            forceQuotes: false,
          }),
          'utf-8'
        );
      }
    }
  }

  async getOAuthProviders(environmentName?: string): Promise<{
    enabled: boolean;
    bridgeAppId: string;
    bridgeAppDomain: string;
    bridgeAppBaseUrl: string;
    providers: OAuthProviderInfo[];
  }> {
    const config = await this.loadConfig(environmentName);
    const secrets = this.loadSecretsFile(environmentName);
    const providers: OAuthProviderInfo[] = [];

    for (const [name, provider] of Object.entries(config.oauth.providers)) {
      const clientId = secrets[provider.clientIdKey] || '';
      const clientSecret = secrets[provider.clientSecretKey] || '';

      providers.push({
        name,
        enabled: provider.enabled,
        status: this.getOAuthProviderStatus(provider, clientId, clientSecret),
        clientIdPresent: clientId.length > 0,
        clientSecretPresent: clientSecret.length > 0,
        clientIdValue: clientId,
        clientSecretValue: clientSecret,
        clientIdKey: provider.clientIdKey,
        clientSecretKey: provider.clientSecretKey,
        redirectUri: provider.redirectUri,
        authorizationEndpoint: this.getOAuthAuthorizationEndpoint(name),
        tokenEndpoint: this.getOAuthTokenEndpoint(name),
        userInfoEndpoint: this.getOAuthUserInfoEndpoint(name),
        scopes: this.getOAuthDefaultScopes(name),
        validationErrors: this.getOAuthValidationErrors(
          provider,
          clientId,
          clientSecret
        ),
        lastTested: null,
      });
    }

    const bridgeApp = config.apps.find(
      (app) => app.appId === config.oauth.bridgeAppId
    );

    return {
      enabled: config.oauth.enabled,
      bridgeAppId: config.oauth.bridgeAppId,
      bridgeAppDomain: bridgeApp?.domain || '',
      bridgeAppBaseUrl: bridgeApp?.uiBaseUrl || '',
      providers,
    };
  }

  async getOAuthApps(environmentName?: string): Promise<OAuthAppsInfo> {
    const config = await this.loadConfig(environmentName);
    const enabledProviders = Object.entries(config.oauth.providers)
      .filter(([, provider]) => provider.enabled)
      .map(([name]) => name);
    const bridgeApp = config.apps.find(
      (app) => app.appId === config.oauth.bridgeAppId
    );

    return {
      bridgeAppId: config.oauth.bridgeAppId,
      bridgeAppDomain: bridgeApp?.domain || '',
      bridgeAppBaseUrl: bridgeApp?.uiBaseUrl || '',
      apps: config.apps.map((app) => ({
        appId: app.appId,
        domain: app.domain,
        oauthEligible: app.appType === 'client' || app.appType === 'admin',
        allowedProviders: enabledProviders,
        returnToOrigin: app.uiBaseUrl,
      })),
    };
  }

  async testOAuthProvider(
    providerName: string,
    _environmentName?: string
  ): Promise<{
    provider: string;
    reachable: boolean;
    credentialValid: boolean;
    authorizationEndpointOk: boolean;
    tokenEndpointOk: boolean;
    userInfoEndpointOk: boolean;
    responseTimeMs: number;
    testedAt: string;
    errors: string[];
  }> {
    const start = Date.now();
    const errors: string[] = [];
    let reachable = true;
    let credentialValid = true;
    let authorizationEndpointOk = true;
    let tokenEndpointOk = true;
    let userInfoEndpointOk = true;

    try {
      await fetch(this.getOAuthAuthorizationEndpoint(providerName), {
        method: 'GET',
        signal: this.timeoutSignal(5000),
      });
    } catch {
      reachable = false;
      authorizationEndpointOk = false;
      errors.push('Authorization endpoint unreachable');
    }

    try {
      const res = await fetch(this.getOAuthTokenEndpoint(providerName), {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=authorization_code&code=invalid&redirect_uri=http://localhost',
        signal: this.timeoutSignal(5000),
      });
      if (res.ok) {
        credentialValid = false;
        tokenEndpointOk = false;
        errors.push('Token endpoint accepted invalid credentials');
      } else if (res.status !== 400 && res.status !== 401) {
        tokenEndpointOk = false;
        errors.push(`Token endpoint returned unexpected status ${res.status}`);
      }
    } catch {
      reachable = false;
      tokenEndpointOk = false;
      errors.push('Token endpoint unreachable');
    }

    try {
      await fetch(this.getOAuthUserInfoEndpoint(providerName), {
        method: 'GET',
        signal: this.timeoutSignal(5000),
      });
    } catch {
      reachable = false;
      userInfoEndpointOk = false;
      errors.push('User info endpoint unreachable');
    }

    return {
      provider: providerName,
      reachable,
      credentialValid,
      authorizationEndpointOk,
      tokenEndpointOk,
      userInfoEndpointOk,
      responseTimeMs: Date.now() - start,
      testedAt: new Date().toISOString(),
      errors,
    };
  }

  private loadDeploymentConfig(environmentName?: string): BootstrapConfig {
    const content = fs.readFileSync(
      this.resolveDeploymentPath(environmentName),
      'utf-8'
    );
    return load(content) as BootstrapConfig;
  }

  private loadDeploymentConfigFromPath(
    deploymentPath: string
  ): BootstrapConfig {
    return load(fs.readFileSync(deploymentPath, 'utf-8')) as BootstrapConfig;
  }

  private resolveImportPath(filePath: string): string {
    const trimmed = filePath.trim();
    if (!trimmed) {
      throw new Error('A deployment path is required');
    }
    return path.isAbsolute(trimmed)
      ? trimmed
      : path.resolve(this.workspaceRoot, trimmed);
  }

  private resolveTakeoverSecretsPath(
    deploymentPath: string,
    secretsPath?: string
  ): string | null {
    if (secretsPath?.trim()) {
      const resolved = this.resolveImportPath(secretsPath);
      if (!fs.existsSync(resolved)) {
        throw new Error('Secrets file not found');
      }
      return resolved;
    }

    const siblingPath = deploymentPath.replace(/\.[^.]+$/, '.secrets.env');
    return fs.existsSync(siblingPath) ? siblingPath : null;
  }

  private normalizeConfig(config: BootstrapConfig): BootstrapConfig {
    const normalizedProviders = Object.fromEntries(
      OAUTH_PROVIDER_KEYS.map((name) => [
        name,
        this.normalizeOAuthProvider(name, config.oauth?.providers?.[name]),
      ])
    );

    const normalized: BootstrapConfig = {
      ...config,
      version: config.version || 'v1alpha1',
      environment: this.normalizeEnvironment(
        config.environment,
        config.services
      ),
      oauth: {
        enabled: config.oauth?.enabled ?? true,
        bridgeAppId:
          config.oauth?.bridgeAppId ||
          this.defaultOAuthBridgeAppId(config.apps || []),
        providers: normalizedProviders,
      },
      gateway: config.gateway
        ? { ...config.gateway }
        : {
            publicUrl: '',
            publicWsUrl: '',
            internalUrl: 'http://gateway:3000',
            internalWsUrl: 'http://gateway:3300',
          },
      services: (config.services || []).map((service) => ({
        ...service,
        database: service.database ? { ...service.database } : undefined,
      })),
      apps: (config.apps || []).map((app) => ({ ...app })),
      databases: (config.databases || []).map((slot) => ({ ...slot })),
      settings: this.normalizeSettings(config.settings),
    };

    const activeServiceIds = normalized.services
      .filter((service) => service.enabled)
      .map((service) => service.serviceId);

    for (const app of normalized.apps) {
      normalized.settings!.targets[app.appId] = {
        ...normalized.settings!.targets[app.appId],
        domain:
          normalized.settings!.targets[app.appId]?.['domain'] || app.domain,
        uiBaseUrl:
          normalized.settings!.targets[app.appId]?.['uiBaseUrl'] ||
          app.uiBaseUrl,
        apiBaseUrl:
          normalized.settings!.targets[app.appId]?.['apiBaseUrl'] ||
          app.apiBaseUrl,
      };
    }

    const requiredInfra = this.discoverRequiredInfra(activeServiceIds);
    normalized.databases = this.normalizeDatabaseSlots(
      normalized.databases || [],
      requiredInfra
    );

    normalized.services = normalized.services.map((service) =>
      this.normalizeServiceBinding(service, requiredInfra)
    );

    return normalized;
  }

  private normalizeEnvironment(
    environment: PartialEnvironmentConfig | undefined,
    services: BootstrapConfig['services'] | undefined
  ): BootstrapConfig['environment'] {
    const enabledServices =
      services
        ?.filter((service) => service.enabled)
        .map((service) => service.serviceId) || [];

    return {
      name: environment?.name || this.activeEnvironmentName(),
      namespace: environment?.namespace || 'optimistic-tanuki',
      targets:
        environment?.targets && environment.targets.length > 0
          ? [...environment.targets]
          : ['compose'],
      composeMode: environment?.composeMode || 'image',
      provider: environment?.provider || 'local',
      imageOwner: environment?.imageOwner || 'cjrutherford',
      defaultTag: environment?.defaultTag || 'latest',
      infra:
        environment?.infra && environment.infra.length > 0
          ? [...environment.infra]
          : ['postgres', 'redis'],
      capabilities: [...(environment?.capabilities || [])],
      services:
        environment?.services && environment.services.length > 0
          ? [...environment.services]
          : enabledServices,
    };
  }

  private defaultOAuthBridgeAppId(apps: BootstrapConfig['apps']): string {
    const preferred =
      apps.find((app) => app.appId === 'client-interface') ||
      apps.find((app) => app.appType === 'client') ||
      apps.find((app) => app.appType === 'admin') ||
      apps[0];
    return preferred?.appId || 'client-interface';
  }

  private normalizeOAuthProvider(
    name: string,
    existing?: Partial<OAuthProviderRecord>
  ): OAuthProviderRecord {
    const upper = name.toUpperCase();
    return {
      enabled: existing?.enabled ?? false,
      clientIdKey: existing?.clientIdKey || `${upper}_CLIENT_ID`,
      clientSecretKey: existing?.clientSecretKey || `${upper}_CLIENT_SECRET`,
      redirectUri: existing?.redirectUri || '',
    };
  }

  private normalizeSettings(
    settings?: SetupSettingsDocument
  ): SetupSettingsDocument {
    const groups = Object.fromEntries(
      DEFAULT_GROUPS.map((group) => [
        group.id,
        { ...(settings?.groups?.[group.id] || {}) },
      ])
    );

    return {
      global: { ...(settings?.global || {}) },
      groups,
      targets: Object.fromEntries(
        Object.entries(settings?.targets || {}).map(([key, value]) => [
          key,
          { ...value },
        ])
      ),
    };
  }

  private applyImportedEnvFile(
    config: BootstrapConfig,
    envEntries: Record<string, string>
  ): { config: BootstrapConfig; secrets: Record<string, string> } {
    const nextConfig = this.normalizeConfig(config);
    const secrets: Record<string, string> = {};
    const targetIdMap = new Map(
      nextConfig.apps.map((app) => [this.envPrefixForApp(app.appId), app.appId])
    );

    for (const [key, value] of Object.entries(envEntries)) {
      if (!value && value !== '') {
        continue;
      }

      const oauthProvider = this.oauthProviderForEnvKey(key);
      if (oauthProvider) {
        if (key.endsWith('_REDIRECT_URI')) {
          nextConfig.oauth.providers[oauthProvider] = {
            ...nextConfig.oauth.providers[oauthProvider],
            enabled: true,
            redirectUri: value,
          };
        } else {
          secrets[key] = value;
          nextConfig.oauth.providers[oauthProvider] = {
            ...nextConfig.oauth.providers[oauthProvider],
            enabled: true,
          };
        }
        continue;
      }

      if (this.shouldImportAsSecret(key)) {
        secrets[key] = value;
        continue;
      }

      if (key === 'PRODUCTION_IMAGE_TAG') {
        nextConfig.environment.defaultTag = value;
        continue;
      }

      if (this.applyAppOverrideFromEnv(nextConfig, targetIdMap, key, value)) {
        continue;
      }

      if (this.applyConnectionOverrideFromEnv(nextConfig, key, value)) {
        continue;
      }

      nextConfig.settings!.global[key] = value;
    }

    return { config: nextConfig, secrets };
  }

  private applyAppOverrideFromEnv(
    config: BootstrapConfig,
    targetIdMap: Map<string, string>,
    key: string,
    value: string
  ): boolean {
    for (const [prefix, targetId] of targetIdMap.entries()) {
      if (key === `${prefix}_DOMAIN`) {
        this.ensureTargetSettings(config, targetId)['domain'] = value;
        return true;
      }
      if (key === `${prefix}_UI_BASE_URL`) {
        this.ensureTargetSettings(config, targetId)['uiBaseUrl'] = value;
        return true;
      }
      if (key === `${prefix}_API_BASE_URL`) {
        this.ensureTargetSettings(config, targetId)['apiBaseUrl'] = value;
        return true;
      }
    }
    return false;
  }

  private applyConnectionOverrideFromEnv(
    config: BootstrapConfig,
    key: string,
    value: string
  ): boolean {
    if (/^POSTGRES_(HOST|PORT|DB|USER)$/.test(key)) {
      const slot = this.ensureDatabaseSlot(
        config,
        'postgres-primary',
        'postgres'
      );
      if (key === 'POSTGRES_HOST') slot.host = value;
      if (key === 'POSTGRES_PORT') slot.port = Number(value || '5432') || 5432;
      if (key === 'POSTGRES_DB') slot.databaseName = value;
      if (key === 'POSTGRES_USER') slot.username = value;
      return true;
    }

    if (/^REDIS_(HOST|PORT|DB)$/.test(key)) {
      const slot = this.ensureDatabaseSlot(config, 'redis-primary', 'redis');
      if (key === 'REDIS_HOST') slot.host = value;
      if (key === 'REDIS_PORT') slot.port = Number(value || '6379') || 6379;
      if (key === 'REDIS_DB') slot.databaseName = value;
      return true;
    }

    return false;
  }

  private ensureDatabaseSlot(
    config: BootstrapConfig,
    slotId: string,
    infra: SetupDatabaseSlot['infra']
  ): SetupDatabaseSlot {
    config.databases = config.databases || [];
    const existing = config.databases.find((slot) => slot.id === slotId);
    if (existing) {
      return existing;
    }

    const created: SetupDatabaseSlot = {
      id: slotId,
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
    };
    config.databases.push(created);
    return created;
  }

  private ensureTargetSettings(
    config: BootstrapConfig,
    targetId: string
  ): Record<string, string> {
    config.settings = this.normalizeSettings(config.settings);
    if (!config.settings.targets[targetId]) {
      config.settings.targets[targetId] = {};
    }
    return config.settings.targets[targetId];
  }

  private envPrefixForApp(appId: string): string {
    return appId.replace(/-/g, '_').toUpperCase();
  }

  private oauthProviderForEnvKey(key: string): string | null {
    for (const provider of OAUTH_PROVIDER_KEYS) {
      const prefix = provider.toUpperCase();
      if (
        key === `${prefix}_CLIENT_ID` ||
        key === `${prefix}_CLIENT_SECRET` ||
        key === `${prefix}_REDIRECT_URI`
      ) {
        return provider;
      }
    }
    return null;
  }

  private shouldImportAsSecret(key: string): boolean {
    return this.isSecretEnvKey(key) || key.endsWith('_CLIENT_ID');
  }

  private discoverRequiredInfra(
    serviceIds: string[]
  ): Set<'postgres' | 'redis'> {
    const infra = new Set<'postgres' | 'redis'>();
    for (const serviceId of serviceIds) {
      const content = this.readServiceConfigSource(serviceId);
      if (/POSTGRES_|DATABASE_HOST|DB_HOST|database:\s*\{/m.test(content)) {
        infra.add('postgres');
      }
      if (/REDIS_/m.test(content)) {
        infra.add('redis');
      }
    }
    return infra;
  }

  private normalizeDatabaseSlots(
    slots: SetupDatabaseSlot[],
    requiredInfra: Set<'postgres' | 'redis'>
  ): SetupDatabaseSlot[] {
    const slotMap = new Map<string, SetupDatabaseSlot>(
      slots.map((slot) => [slot.id, { ...slot }])
    );

    if (requiredInfra.has('postgres') && !slotMap.has('postgres-primary')) {
      slotMap.set('postgres-primary', {
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
      });
    }

    if (requiredInfra.has('redis') && !slotMap.has('redis-primary')) {
      slotMap.set('redis-primary', {
        id: 'redis-primary',
        infra: 'redis',
        provisionMode: 'managed',
        host: 'redis',
        port: 6379,
        databaseName: '0',
        username: 'default',
        passwordKey: 'REDIS_PASSWORD',
      });
    }

    return [...slotMap.values()].sort((left, right) =>
      left.id.localeCompare(right.id)
    );
  }

  private normalizeServiceBinding(
    service: SetupServiceSelection,
    requiredInfra: Set<'postgres' | 'redis'>
  ): SetupServiceSelection {
    const content = this.readServiceConfigSource(service.serviceId);
    const requiresPostgres =
      requiredInfra.has('postgres') &&
      /POSTGRES_|DATABASE_HOST|DB_HOST|database:\s*\{/m.test(content);

    if (!requiresPostgres) {
      return service;
    }

    const binding: SetupServiceDatabaseBinding = {
      slotId: service.database?.slotId || 'postgres-primary',
      databaseName:
        service.database?.databaseName ||
        this.defaultDatabaseName(service.serviceId),
      username: service.database?.username || 'postgres',
      passwordKey: service.database?.passwordKey || 'POSTGRES_PASSWORD',
    };

    return {
      ...service,
      database: binding,
    };
  }

  private defaultDatabaseName(serviceId: string): string {
    return `ot_${serviceId.replace(/-/g, '_')}`;
  }

  private resolveServiceConfigPath(serviceId: string): string | undefined {
    const directory = SERVICE_DIRECTORY_OVERRIDES[serviceId] || serviceId;
    const candidates = [
      path.join(this.workspaceRoot, 'apps', directory, 'src', 'config.ts'),
      path.join(
        this.workspaceRoot,
        'apps',
        directory,
        'src',
        'app',
        'config.ts'
      ),
      path.join(
        this.workspaceRoot,
        'apps',
        directory,
        'src',
        'app',
        'loadConfig.ts'
      ),
    ];

    return candidates.find((candidate) => fs.existsSync(candidate));
  }

  private readServiceConfigSource(serviceId: string): string {
    const configPath = this.resolveServiceConfigPath(serviceId);
    if (!configPath) {
      return '';
    }

    return fs.readFileSync(configPath, 'utf-8');
  }

  private discoverServiceTarget(serviceId: string): SetupSettingsTarget {
    const sourcePath = this.resolveServiceConfigPath(serviceId);
    const content = sourcePath ? fs.readFileSync(sourcePath, 'utf-8') : '';
    const envKeys = [...this.extractEnvKeys(content)].sort();
    const typeFields = this.extractTypeFields(content);
    const fields: SetupSettingFieldDescriptor[] = [];
    const secrets: SetupSecretFieldDescriptor[] = [];
    const connections: SetupSettingsTarget['connections'] = [];

    const hasPostgres =
      envKeys.some((key) => /^(POSTGRES_|DB_|DATABASE_)/.test(key)) ||
      typeFields.some((field) => field.startsWith('database.'));
    const hasRedis =
      envKeys.some((key) => key.startsWith('REDIS_')) ||
      typeFields.some((field) => field.startsWith('redis.'));

    if (hasPostgres) {
      connections.push({
        infra: 'postgres',
        fieldId: `${serviceId}:postgres`,
        label: 'Postgres Connection',
      });
    }
    if (hasRedis) {
      connections.push({
        infra: 'redis',
        fieldId: `${serviceId}:redis`,
        label: 'Redis Connection',
      });
    }

    for (const envKey of envKeys) {
      if (this.isDatabaseEnvKey(envKey) || this.isRedisEnvKey(envKey)) {
        continue;
      }

      const secret = this.isSecretEnvKey(envKey);
      const descriptor: SetupSettingFieldDescriptor = {
        id: `${serviceId}:${envKey}`,
        key: envKey,
        envKey,
        label: this.humanizeLabel(envKey),
        valueType: this.inferValueType(envKey),
        scopes: ['global', 'group', 'target'],
        secret,
        placeholder: this.inferPlaceholder(envKey),
      };

      if (secret) {
        secrets.push({
          id: descriptor.id,
          key: envKey,
          label: descriptor.label,
          envKey,
          targetId: serviceId,
          targetLabel: this.serviceLabel(serviceId),
        });
      } else {
        fields.push(descriptor);
      }
    }

    return {
      id: serviceId,
      label: this.serviceLabel(serviceId),
      targetKind: 'service',
      groupId: 'services',
      sourcePath,
      fields,
      secrets,
      connections,
    };
  }

  private extractEnvKeys(content: string): Set<string> {
    const envKeys = new Set<string>();
    const pattern =
      /process\.env(?:\[['"]([A-Z0-9_]+)['"]\]|\.(?:['"])?([A-Z0-9_]+)(?:['"])?)?/g;
    for (const match of content.matchAll(pattern)) {
      const envKey = match[1] || match[2];
      if (envKey) {
        envKeys.add(envKey);
      }
    }
    return envKeys;
  }

  private extractTypeFields(content: string): string[] {
    const declarationMatch = content.match(
      /export\s+(?:declare\s+)?type\s+[A-Za-z0-9_]+\s*=\s*\{/
    );
    if (!declarationMatch || declarationMatch.index === undefined) {
      return [];
    }

    const start = declarationMatch.index + declarationMatch[0].length - 1;
    let depth = 0;
    let end = start;
    for (let index = start; index < content.length; index += 1) {
      const char = content[index];
      if (char === '{') depth += 1;
      if (char === '}') {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }

    const block = content.slice(start + 1, end);
    const fields: string[] = [];
    const stack: string[] = [];
    for (const line of block.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('};') || trimmed === '}' || trimmed === '},') {
        stack.pop();
        continue;
      }

      const keyMatch = trimmed.match(/^['"]?([A-Za-z0-9_-]+)['"]?\??:\s*(.+)$/);
      if (!keyMatch) {
        continue;
      }

      const [, key, remainder] = keyMatch;
      if (remainder.endsWith('{')) {
        stack.push(key);
        continue;
      }

      fields.push([...stack, key].join('.'));
    }

    return fields;
  }

  private isDatabaseEnvKey(envKey: string): boolean {
    return /^(POSTGRES_|DB_|DATABASE_)/.test(envKey);
  }

  private isRedisEnvKey(envKey: string): boolean {
    return envKey.startsWith('REDIS_');
  }

  private isSecretEnvKey(envKey: string): boolean {
    return SECRET_ENV_SUFFIXES.some(
      (suffix) => envKey.endsWith(suffix) || envKey.includes(`_${suffix}_`)
    );
  }

  private inferValueType(
    envKey: string
  ): SetupSettingFieldDescriptor['valueType'] {
    if (PATH_VALUE_TYPE_OVERRIDES[envKey]) {
      return PATH_VALUE_TYPE_OVERRIDES[envKey];
    }
    if (envKey.endsWith('_PORT')) return 'port';
    if (
      envKey.endsWith('_URL') ||
      envKey.endsWith('_URI') ||
      envKey.endsWith('_ENDPOINT')
    ) {
      return 'url';
    }
    if (envKey.endsWith('_DIR') || envKey.endsWith('_DIRECTORY')) {
      return 'directory';
    }
    if (envKey.endsWith('_FILE')) {
      return 'file';
    }
    if (envKey.endsWith('_PATH')) {
      return 'path';
    }
    return 'string';
  }

  private inferPlaceholder(envKey: string): string | undefined {
    if (envKey.endsWith('_URL') || envKey.endsWith('_ENDPOINT')) {
      return 'https://example.com';
    }
    if (envKey.endsWith('_PORT')) {
      return '3000';
    }
    if (envKey.endsWith('_DIR') || envKey.endsWith('_DIRECTORY')) {
      return '/srv/optimistic-tanuki/data';
    }
    if (envKey.endsWith('_FILE') || envKey.endsWith('_PATH')) {
      return '/srv/optimistic-tanuki/config/file.json';
    }
    return undefined;
  }

  private humanizeLabel(value: string): string {
    return value
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  private serviceLabel(serviceId: string): string {
    return COMMON_SERVICE_LABELS[serviceId] || this.humanizeLabel(serviceId);
  }

  private loadSecretsFile(environmentName?: string): Record<string, string> {
    const secretsPath = this.resolveSecretsPath(environmentName);
    if (!fs.existsSync(secretsPath)) return {};
    return this.parseEnvContent(fs.readFileSync(secretsPath, 'utf-8'));
  }

  private loadSecretsFileFromPath(secretsPath: string): Record<string, string> {
    return this.parseEnvContent(fs.readFileSync(secretsPath, 'utf-8'));
  }

  private parseEnvContent(content: string): Record<string, string> {
    const secrets: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        secrets[trimmed.slice(0, eqIndex).trim()] = value;
      }
    }
    return secrets;
  }

  private serializeEnv(secrets: Record<string, string>): string {
    return (
      Object.entries(secrets)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n'
    );
  }

  private getOAuthProviderStatus(
    provider: OAuthProviderRecord,
    clientId: string,
    clientSecret: string
  ): 'configured' | 'pending' | 'error' {
    if (!provider.enabled) {
      return 'pending';
    }
    if (clientId && clientSecret && provider.redirectUri) {
      return 'configured';
    }
    return 'pending';
  }

  private getOAuthValidationErrors(
    provider: OAuthProviderRecord,
    clientId: string,
    clientSecret: string
  ): string[] {
    if (!provider.enabled) {
      return [];
    }
    const errors: string[] = [];
    if (!clientId) {
      errors.push('clientId is missing');
    }
    if (!clientSecret) {
      errors.push('clientSecret is missing');
    }
    if (!provider.redirectUri) {
      errors.push('redirectUri is missing');
    }
    return errors;
  }

  private getOAuthAuthorizationEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      google: 'https://accounts.google.com/o/oauth2/v2/auth',
      github: 'https://github.com/login/oauth/authorize',
      microsoft:
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      facebook: 'https://www.facebook.com/v18.0/dialog/oauth',
    };
    return endpoints[provider] || '';
  }

  private getOAuthTokenEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      google: 'https://oauth2.googleapis.com/token',
      github: 'https://github.com/login/oauth/access_token',
      microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      facebook: 'https://graph.facebook.com/v18.0/oauth/access_token',
    };
    return endpoints[provider] || '';
  }

  private getOAuthUserInfoEndpoint(provider: string): string {
    const endpoints: Record<string, string> = {
      google: 'https://openidconnect.googleapis.com/v1/userinfo',
      github: 'https://api.github.com/user',
      microsoft: 'https://graph.microsoft.com/v1.0/me',
      facebook: 'https://graph.facebook.com/v18.0/me',
    };
    return endpoints[provider] || '';
  }

  private getOAuthDefaultScopes(provider: string): string[] {
    const scopes: Record<string, string[]> = {
      google: ['openid', 'email', 'profile'],
      github: ['read:user', 'user:email'],
      microsoft: ['openid', 'email', 'profile', 'User.Read'],
      facebook: ['email', 'public_profile'],
    };
    return scopes[provider] || [];
  }

  private serializeYaml(obj: unknown): string {
    return dump(obj, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: "'",
      forceQuotes: false,
    });
  }
}
