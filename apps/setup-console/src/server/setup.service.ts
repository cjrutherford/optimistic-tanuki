import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { dump, load } from 'js-yaml';
import {
  BootstrapConfig,
  SetupDatabaseSlot,
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

export class SetupService {
  private readonly workspaceRoot: string;
  private readonly deploymentPath: string;
  private readonly secretsPath: string;
  private readonly setupCompletePath: string;
  private readonly setupMode: 'setup' | 'reconfigure';
  private readonly operatorInfoPath: string;

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

  private async isGatewayRunning(): Promise<boolean> {
    try {
      const res = await fetch('http://localhost:3000/api-docs', {
        signal: AbortSignal.timeout(3000),
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
          { signal: AbortSignal.timeout(3000) }
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

    if (!fs.existsSync(goBin)) {
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
      return {
        success: true,
        message: `Artifacts generated at ${
          result.outputDir || 'dist/admin-env'
        }`,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('validation failed') || msg.includes('not enabled')) {
        return {
          success: true,
          message: 'Artifact generation skipped (config in wizard state)',
        };
      }
      return { success: false, message: `Build failed: ${msg}` };
    }
  }

  async provisionInfra(): Promise<{ success: boolean; message: string }> {
    const composeFile = path.join(this.workspaceRoot, 'docker-compose.yaml');
    if (!fs.existsSync(composeFile)) {
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
      return { success: true, message: stdout || 'Infrastructure provisioned' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('already in use') || msg.includes('Already exists')) {
        return { success: true, message: 'Infrastructure already running' };
      }
      return { success: false, message: `Infra provisioning failed: ${msg}` };
    }
  }

  async initDatabases(): Promise<{ success: boolean; message: string }> {
    const goBin = this.resolveGoBin();
    const deploymentPath = this.resolveDeploymentPath();
    const secretsPath = this.resolveSecretsPath();

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

    return { success: true, message: 'Databases initialized' };
  }

  async deployServices(): Promise<{ success: boolean; message: string }> {
    const composeFile = path.join(this.workspaceRoot, 'docker-compose.yaml');
    if (!fs.existsSync(composeFile)) {
      return { success: false, message: 'docker-compose.yaml not found' };
    }

    try {
      const config = this.loadDeploymentConfig() as BootstrapConfig;
      const enabledServices = (config.services || [])
        .filter((s) => s.enabled)
        .map((s) => s.serviceId);
      const { stdout } = await execFileAsync(
        'docker',
        this.composeArgs('up', '-d', ...enabledServices),
        {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        }
      );
      return { success: true, message: stdout || 'Services deployed' };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
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

  async completeSetup(): Promise<void> {
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
    fs.writeFileSync(this.setupCompletePath, new Date().toISOString(), 'utf-8');
  }

  async configureOAuthProvider(
    name: string,
    opts: {
      enabled: boolean;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    }
  ): Promise<void> {
    const deploymentPath = this.resolveDeploymentPath();
    const secretsPath = this.resolveSecretsPath();
    const providerKey = name.toLowerCase();
    const clientIdKey = `${providerKey.toUpperCase()}_CLIENT_ID`;
    const clientSecretKey = `${providerKey.toUpperCase()}_CLIENT_SECRET`;

    const existingSecrets = this.loadSecretsFile();
    existingSecrets[clientIdKey] = opts.clientId;
    existingSecrets[clientSecretKey] = opts.clientSecret;
    fs.writeFileSync(secretsPath, this.serializeEnv(existingSecrets), 'utf-8');

    if (fs.existsSync(deploymentPath)) {
      const content = fs.readFileSync(deploymentPath, 'utf-8');
      const doc = load(content) as Record<string, unknown>;
      const oauth = doc?.['oauth'] as Record<string, unknown> | undefined;
      if (oauth) {
        const providers = oauth['providers'] as
          | Record<string, unknown>
          | undefined;
        if (providers?.[providerKey]) {
          const provider = providers[providerKey] as Record<string, unknown>;
          provider['enabled'] = opts.enabled;
          provider['clientIdKey'] = clientIdKey;
          provider['clientSecretKey'] = clientSecretKey;
          provider['redirectUri'] = opts.redirectUri;
        }
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

  private loadDeploymentConfig(environmentName?: string): BootstrapConfig {
    const content = fs.readFileSync(
      this.resolveDeploymentPath(environmentName),
      'utf-8'
    );
    return load(content) as BootstrapConfig;
  }

  private normalizeConfig(config: BootstrapConfig): BootstrapConfig {
    const normalized: BootstrapConfig = {
      ...config,
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
    if (envKey.endsWith('_PORT')) return 'port';
    if (
      envKey.endsWith('_URL') ||
      envKey.endsWith('_URI') ||
      envKey.endsWith('_ENDPOINT')
    ) {
      return 'url';
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
    const content = fs.readFileSync(secretsPath, 'utf-8');
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
