import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClientProxy } from '@nestjs/microservices';
import {
  AuthCommands,
  ProfileCommands,
  ServiceTokens,
} from '@optimistic-tanuki/constants';
import {
  RoleInitBuilder,
  RoleInitService,
} from '@optimistic-tanuki/permission-lib';
import { CreateProfileDto } from '@optimistic-tanuki/models';
import { firstValueFrom } from 'rxjs';
import { promisify } from 'util';
import { dump, load } from 'js-yaml';

const execFileAsync = promisify(execFile);

export interface BootstrapStatus {
  configured: boolean;
  phase: string;
  checks: CheckResult[];
  wizardStep?: number;
}

export interface CheckResult {
  name: string;
  status: 'pass' | 'fail' | 'warn' | 'info';
  message: string;
}

export interface ScaffoldOptions {
  name: string;
  target: 'compose' | 'k8s';
  operatorName: string;
  operatorEmail: string;
  services: string[];
}

export interface BootstrapConfig {
  version: string;
  environment: {
    name: string;
    namespace: string;
    targets: string[];
    composeMode: string;
    provider: string;
    imageOwner: string;
    defaultTag: string;
    infra: string[];
    capabilities: string[];
    services: string[];
  };
  gateway?: {
    publicUrl: string;
    publicWsUrl: string;
    internalUrl: string;
    internalWsUrl: string;
  };
  services: Array<{ serviceId: string; enabled: boolean }>;
  apps: Array<{
    appId: string;
    domain: string;
    uiBaseUrl: string;
    apiBaseUrl: string;
    appType: string;
    visibility: string;
    authEmail?: {
      enabled: boolean;
      from: string;
      replyTo?: string;
    };
  }>;
  oauth: {
    enabled: boolean;
    bridgeAppId: string;
    providers: Record<
      string,
      {
        enabled: boolean;
        clientIdKey: string;
        clientSecretKey: string;
        redirectUri: string;
      }
    >;
  };
  wizard?: {
    currentStep: number;
    updatedAt: string;
  };
}

@Injectable()
export class BootstrapService {
  private readonly workspaceRoot: string;
  private readonly deploymentPath: string;
  private readonly secretsPath: string;
  private readonly setupCompletePath: string;
  private readonly gatewayBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(ServiceTokens.AUTHENTICATION_SERVICE)
    private readonly authClient: ClientProxy,
    @Inject(ServiceTokens.PROFILE_SERVICE)
    private readonly profileClient: ClientProxy,
    private readonly roleInit: RoleInitService
  ) {
    this.workspaceRoot =
      this.configService.get<string>('admin-api.workspaceRoot') || '.';
    this.deploymentPath =
      this.configService.get<string>('admin-api.deploymentPath') ||
      './ops/deployments/production.yaml';
    this.secretsPath =
      this.configService.get<string>('admin-api.secretsPath') || './.secrets';
    this.setupCompletePath = path.join(this.workspaceRoot, '.setup-complete');
    this.gatewayBaseUrl = this.trimTrailingSlash(
      this.configService.get<string>('admin-api.gatewayBaseUrl') ||
        'http://gateway:3000'
    );
  }

  async getStatus(): Promise<BootstrapStatus> {
    const checks: CheckResult[] = [];
    const hasDeployment = fs.existsSync(this.resolveDeploymentPath());
    const hasSecrets = fs.existsSync(this.resolveSecretsPath());
    const hasSetupComplete = fs.existsSync(this.setupCompletePath);

    checks.push({
      name: 'deployment-config',
      status: hasDeployment ? 'pass' : 'info',
      message: hasDeployment
        ? 'production.yaml exists'
        : 'No production.yaml - will scaffold',
    });

    checks.push({
      name: 'secrets',
      status: hasSecrets ? 'pass' : 'info',
      message: hasSecrets ? '.secrets exists' : 'No .secrets - will generate',
    });

    checks.push({
      name: 'setup-complete',
      status: hasSetupComplete ? 'pass' : 'info',
      message: hasSetupComplete
        ? 'Setup wizard completed'
        : 'Setup wizard not yet completed',
    });

    if (!hasDeployment || !hasSecrets) {
      return {
        configured: false,
        phase: 'setup',
        checks,
      };
    }

    try {
      const doc = this.loadDeploymentConfig() as BootstrapConfig;
      return {
        configured: hasSetupComplete,
        phase: hasSetupComplete ? 'ready' : 'setup',
        checks,
        wizardStep: doc?.wizard?.currentStep,
      };
    } catch {
      return {
        configured: false,
        phase: 'error',
        checks,
      };
    }
  }

  async scaffoldConfig(
    options: ScaffoldOptions
  ): Promise<{ config: BootstrapConfig; secrets: Record<string, string> }> {
    const deploymentPath = this.resolveDeploymentPath();
    const secretsPath = this.resolveSecretsPath();

    if (fs.existsSync(deploymentPath)) {
      throw new Error('Deployment config already exists');
    }

    const config: BootstrapConfig = {
      version: 'v1alpha1',
      environment: {
        name: options.name,
        namespace: 'optimistic-tanuki',
        targets: [options.target],
        composeMode: 'image',
        provider: 'local',
        imageOwner: 'cjrutherford',
        defaultTag: 'latest',
        infra: ['postgres', 'redis'],
        capabilities: [],
        services: options.services,
      },
      gateway: {
        publicUrl: `https://${options.name}.example.com/api`,
        publicWsUrl: `wss://${options.name}.example.com/ws`,
        internalUrl: 'http://gateway:3000',
        internalWsUrl: 'http://gateway:3300',
      },
      services: options.services.map((id) => ({
        serviceId: id,
        enabled: true,
      })),
      apps: [],
      oauth: {
        enabled: true,
        bridgeAppId: 'client-interface',
        providers: {
          google: {
            enabled: true,
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

    const secrets: Record<string, string> = {
      JWT_SECRET: this.generateRandomString(64),
      POSTGRES_PASSWORD: this.generateRandomString(32),
      POSTGRES_USER: 'postgres',
      BOOTSTRAP_OPERATOR_NAME: options.operatorName,
      BOOTSTRAP_OPERATOR_EMAIL: options.operatorEmail,
      GOOGLE_CLIENT_ID: '',
      GOOGLE_CLIENT_SECRET: '',
      GITHUB_CLIENT_ID: '',
      GITHUB_CLIENT_SECRET: '',
      MICROSOFT_CLIENT_ID: '',
      MICROSOFT_CLIENT_SECRET: '',
      FACEBOOK_CLIENT_ID: '',
      FACEBOOK_CLIENT_SECRET: '',
    };

    const deploymentDir = path.dirname(deploymentPath);
    fs.mkdirSync(deploymentDir, { recursive: true });
    fs.writeFileSync(deploymentPath, this.serializeYaml(config), 'utf-8');
    fs.writeFileSync(secretsPath, this.serializeEnv(secrets), 'utf-8');

    return { config, secrets };
  }

  async loadConfig(): Promise<BootstrapConfig> {
    return this.loadDeploymentConfig();
  }

  async saveConfig(config: BootstrapConfig): Promise<void> {
    const deploymentPath = this.resolveDeploymentPath();
    fs.writeFileSync(deploymentPath, this.serializeYaml(config), 'utf-8');
  }

  async loadSecrets(): Promise<Record<string, string>> {
    return this.loadSecretsFile();
  }

  async saveSecrets(secrets: Record<string, string>): Promise<void> {
    const secretsPath = this.resolveSecretsPath();
    fs.writeFileSync(secretsPath, this.serializeEnv(secrets), 'utf-8');
  }

  async validate(): Promise<{
    valid: boolean;
    issues: Array<{ severity: string; message: string }>;
  }> {
    const deploymentPath = this.resolveDeploymentPath();
    const secretsPath = this.resolveSecretsPath();
    const goBin = this.resolveGoBin();

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
      const message = error instanceof Error ? error.message : String(error);
      return {
        valid: false,
        issues: [
          { severity: 'error', message: `Validation failed: ${message}` },
        ],
      };
    }
  }

  private resolveGoBin(): string {
    const containerBin = '/usr/local/bin/admin-env';
    if (fs.existsSync(containerBin)) {
      return containerBin;
    }
    return path.join(
      this.workspaceRoot,
      'tools',
      'admin-env-wizard',
      'admin-env'
    );
  }

  async buildImages(): Promise<{ success: boolean; message: string }> {
    const deploymentPath = this.resolveDeploymentPath();
    const secretsPath = this.resolveSecretsPath();
    const goBin = this.resolveGoBin();
    const deploymentDir = path.dirname(deploymentPath);

    if (!fs.existsSync(goBin)) {
      return {
        success: false,
        message: 'admin-env binary not found; unable to generate artifacts',
      };
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
      const stderr = error instanceof Error ? error.message : String(error);
      if (
        stderr.includes('validation failed') ||
        stderr.includes('not enabled')
      ) {
        return {
          success: true,
          message:
            'Artifact generation skipped (config in wizard-in-progress state, will generate during deploy)',
        };
      }
      return {
        success: false,
        message: `Build failed: ${stderr}`,
      };
    }
  }

  private composeArgs(...args: string[]): string[] {
    const composeFile = path.join(this.workspaceRoot, 'docker-compose.yaml');
    return ['compose', '-p', 'optimistic-tanuki', '-f', composeFile, ...args];
  }

  async provisionInfraCompose(): Promise<{
    success: boolean;
    message: string;
  }> {
    const composeFile = path.join(this.workspaceRoot, 'docker-compose.yaml');

    if (!fs.existsSync(composeFile)) {
      return {
        success: false,
        message: `compose file not found at ${composeFile}`,
      };
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

      return {
        success: true,
        message: stdout || 'Infrastructure provisioned',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Infrastructure provisioning failed: ${message}`,
      };
    }
  }

  async provisionInfraK8s(
    kubeconfig?: string
  ): Promise<{ success: boolean; message: string }> {
    const deploymentPath = this.resolveDeploymentPath();
    const scriptPath = path.join(
      this.workspaceRoot,
      'scripts',
      'first-install.sh'
    );
    const args = ['infra-k8s', '--deployment', deploymentPath];
    if (kubeconfig) {
      args.push('--kubeconfig', kubeconfig);
    }

    try {
      const { stdout } = await execFileAsync(scriptPath, args, {
        cwd: this.workspaceRoot,
        maxBuffer: 10 * 1024 * 1024,
      });

      return {
        success: true,
        message: stdout || 'K8s infrastructure provisioned',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `K8s provisioning failed: ${message}`,
      };
    }
  }

  async initDatabases(): Promise<{ success: boolean; message: string }> {
    const deploymentPath = this.resolveDeploymentPath();

    try {
      const goBin = this.resolveGoBin();
      if (fs.existsSync(goBin) && fs.existsSync(deploymentPath)) {
        await execFileAsync(
          goBin,
          [
            'validate',
            '-deployment',
            deploymentPath,
            '-secrets',
            this.resolveSecretsPath(),
            '--json',
          ],
          {
            cwd: this.workspaceRoot,
            maxBuffer: 10 * 1024 * 1024,
          }
        ).catch(() => {});
      }

      const migrateScript = path.join(
        this.workspaceRoot,
        'scripts',
        'setup-and-migrate.sh'
      );
      if (fs.existsSync(migrateScript)) {
        await execFileAsync(migrateScript, [], {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        }).catch(() => {});
      }

      return { success: true, message: 'Databases initialized' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Database initialization failed: ${message}`,
      };
    }
  }

  async deployServices(): Promise<{ success: boolean; message: string }> {
    const composeFile = path.join(this.workspaceRoot, 'docker-compose.yaml');

    if (!fs.existsSync(composeFile)) {
      return {
        success: false,
        message: `compose file not found at ${composeFile}`,
      };
    }

    try {
      const config = this.loadDeploymentConfig() as BootstrapConfig;
      const enabledServices = (config.services || [])
        .filter((s) => s.enabled)
        .map((s) => s.serviceId);

      const { stdout } = await execFileAsync(
        'docker',
        this.composeArgs('up', '-d', '--no-recreate', ...enabledServices),
        {
          cwd: this.workspaceRoot,
          maxBuffer: 10 * 1024 * 1024,
        }
      );

      return {
        success: true,
        message: stdout || 'Services deployed',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        message: `Deployment failed: ${message}`,
      };
    }
  }

  async createOwner(
    name: string,
    email: string,
    password: string
  ): Promise<{
    userId: string;
    profileId: string;
    email: string;
    name: string;
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    const [firstName, ...lastParts] = name.trim().split(/\s+/);
    const lastName = lastParts.join(' ') || firstName;

    const existingGlobalProfiles = (await firstValueFrom(
      this.profileClient.send(
        { cmd: ProfileCommands.GetAll },
        {
          where: [{ appScope: 'global' }, { appScope: null }],
        }
      )
    )) as Array<{ id: string }>;

    if (existingGlobalProfiles.length > 0) {
      throw new Error(
        'Owner Console registration is closed. An existing owner must invite or provision additional operators.'
      );
    }

    const registrationResult = await firstValueFrom(
      this.authClient.send(
        { cmd: AuthCommands.Register },
        {
          fn: firstName,
          ln: lastName,
          email: normalizedEmail,
          password,
          confirm: password,
          bio: 'Platform owner',
        }
      )
    );

    const userId = registrationResult?.data?.user?.id || '';
    if (!userId) {
      throw new Error('Owner registration did not return a user id');
    }

    const profileInput: CreateProfileDto & { appScope: string } = {
      userId,
      name,
      description: '',
      profilePic: '',
      coverPic: '',
      bio: 'Platform owner',
      location: '',
      occupation: '',
      interests: '',
      skills: '',
      appScope: 'global',
    };

    const createdProfile = (await firstValueFrom(
      this.profileClient.send({ cmd: ProfileCommands.Create }, profileInput)
    )) as { id?: string };

    if (!createdProfile?.id) {
      throw new Error('Owner registration did not return a profile id');
    }

    await this.roleInit.processNow(
      new RoleInitBuilder()
        .setScopeName('global')
        .setProfile(createdProfile.id)
        .assignOwnerRole()
        .addOwnerScopeDefaults()
        .addAssetOwnerPermissions()
        .build()
    );

    const ownerApp = this.loadDeploymentConfig().apps.find(
      (app) => app.appId === 'owner-console'
    );
    if (ownerApp?.authEmail?.enabled && ownerApp.authEmail.from) {
      try {
        await firstValueFrom(
          this.authClient.send(
            { cmd: AuthCommands.RequestEmailAuthAction },
            {
              purpose: 'verification',
              email: normalizedEmail,
              context: {
                appId: ownerApp.appId,
                appName: 'Owner Console',
                uiBaseUrl: ownerApp.uiBaseUrl,
                from: ownerApp.authEmail.from,
                replyTo: ownerApp.authEmail.replyTo,
                returnPath: '/',
              },
            }
          )
        );
      } catch {
        // Account creation remains idempotent; the owner can request another
        // verification message from the Owner Console login screen.
      }
    }

    return {
      userId,
      profileId: createdProfile.id,
      email: normalizedEmail,
      name,
    };
  }

  async configureOAuthProvider(
    name: string,
    config: {
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
    const redirectUriKey = `${providerKey.toUpperCase()}_REDIRECT_URI`;

    const existingSecrets = this.loadSecretsFile();
    existingSecrets[clientIdKey] = config.clientId;
    existingSecrets[clientSecretKey] = config.clientSecret;
    existingSecrets[redirectUriKey] = config.redirectUri;
    fs.writeFileSync(secretsPath, this.serializeEnv(existingSecrets), 'utf-8');

    if (fs.existsSync(deploymentPath)) {
      const content = fs.readFileSync(deploymentPath, 'utf-8');
      const updated = this.updateOAuthInYaml(
        content,
        providerKey,
        config.enabled,
        clientIdKey,
        clientSecretKey,
        config.redirectUri
      );
      fs.writeFileSync(deploymentPath, updated, 'utf-8');
    }
  }

  async completeSetup(): Promise<void> {
    fs.writeFileSync(this.setupCompletePath, new Date().toISOString(), 'utf-8');
  }

  private resolveDeploymentPath(): string {
    return path.isAbsolute(this.deploymentPath)
      ? this.deploymentPath
      : path.join(this.workspaceRoot, this.deploymentPath);
  }

  private resolveSecretsPath(): string {
    return path.isAbsolute(this.secretsPath)
      ? this.secretsPath
      : path.join(this.workspaceRoot, this.secretsPath);
  }

  private loadDeploymentConfig(): BootstrapConfig {
    const deploymentPath = this.resolveDeploymentPath();
    const content = fs.readFileSync(deploymentPath, 'utf-8');
    return this.parseYaml(content) as BootstrapConfig;
  }

  private loadSecretsFile(): Record<string, string> {
    const secretsPath = this.resolveSecretsPath();
    if (!fs.existsSync(secretsPath)) {
      return {};
    }
    const content = fs.readFileSync(secretsPath, 'utf-8');
    const secrets: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        secrets[key] = value;
      }
    }
    return secrets;
  }

  private updateOAuthInYaml(
    yaml: string,
    provider: string,
    enabled: boolean,
    clientIdKey: string,
    clientSecretKey: string,
    redirectUri: string
  ): string {
    const doc = load(yaml) as Record<string, unknown>;
    const oauth = doc?.['oauth'] as Record<string, unknown> | undefined;
    if (!oauth) return yaml;

    const providers = oauth['providers'] as Record<string, unknown> | undefined;
    if (providers?.[provider]) {
      const p = providers[provider] as Record<string, unknown>;
      p.enabled = enabled;
      p.clientIdKey = clientIdKey;
      p.clientSecretKey = clientSecretKey;
      p.redirectUri = redirectUri;
    }

    return dump(doc, {
      indent: 2,
      lineWidth: -1,
      noRefs: true,
      quotingType: "'",
      forceQuotes: false,
    });
  }

  private generateRandomString(length: number): string {
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => charset[b % charset.length]).join('');
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

  private serializeEnv(secrets: Record<string, string>): string {
    return (
      Object.entries(secrets)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n') + '\n'
    );
  }

  private parseYaml(content: string): unknown {
    return load(content);
  }

  private trimTrailingSlash(value: string): string {
    return value.replace(/\/+$/, '');
  }
}
