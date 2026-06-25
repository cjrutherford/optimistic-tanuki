import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RolloutState {
  deploymentName: string;
  configHash: string;
  targetTag: string;
  services: string[];
  waves: string[][];
  status: 'succeeded' | 'failed';
  startedAt: string;
  completedAt: string;
  changes: {
    config: boolean;
    servicesAdded: string[];
    servicesRemoved: string[];
    databaseSlotsChanged: string[];
    oauthProvidersChanged: string[];
  };
}

export interface DeploymentHealth {
  configStatus: 'current' | 'pending-changes';
  infrastructure: 'compose-up' | 'k8s-synced' | 'not-provisioned';
  databaseReadiness: 'all-slots-ready' | 'missing-secrets' | 'slot-mismatch';
  secretsHealth: 'all-keys-present' | 'missing-keys' | 'pending-keys';
  lastDeployed?: {
    timestamp: string;
    tag: string;
    result: 'succeeded' | 'failed';
  };
}

export interface ImageInfo {
  serviceId: string;
  currentTag: string;
  latestTag: string;
  updateAvailable: boolean;
  registry: string;
  image: string;
  pattern: string;
}

@Injectable()
export class DeploymentService {
  private readonly workspaceRoot: string;
  private readonly deploymentPath: string;

  constructor(private readonly configService: ConfigService) {
    this.workspaceRoot =
      this.configService.get<string>('admin-api.workspaceRoot') || '.';
    this.deploymentPath =
      this.configService.get<string>('admin-api.deploymentPath') ||
      './ops/deployments/production.yaml';
  }

  getHealth(): DeploymentHealth {
    const rolloutStatePath = this.resolveRolloutStatePath();
    const deploymentPath = this.resolveDeploymentPath();

    let lastDeployed: DeploymentHealth['lastDeployed'] | undefined;
    if (fs.existsSync(rolloutStatePath)) {
      try {
        const state = JSON.parse(
          fs.readFileSync(rolloutStatePath, 'utf-8')
        ) as RolloutState;
        lastDeployed = {
          timestamp: state.completedAt || state.startedAt,
          tag: state.targetTag,
          result: state.status,
        };
      } catch {
        // ignore
      }
    }

    const configHash = this.hashFile(deploymentPath);
    let configStatus: DeploymentHealth['configStatus'] = 'current';
    if (fs.existsSync(rolloutStatePath)) {
      try {
        const state = JSON.parse(
          fs.readFileSync(rolloutStatePath, 'utf-8')
        ) as RolloutState;
        if (state.configHash !== configHash) {
          configStatus = 'pending-changes';
        }
      } catch {
        configStatus = 'pending-changes';
      }
    }

    return {
      configStatus,
      infrastructure: 'compose-up',
      databaseReadiness: 'all-slots-ready',
      secretsHealth: 'all-keys-present',
      lastDeployed,
    };
  }

  getRolloutHistory(limit = 20): RolloutState[] {
    const rolloutsDir = path.join(
      this.workspaceRoot,
      'tmp',
      'admin-env',
      'rollouts'
    );
    if (!fs.existsSync(rolloutsDir)) {
      return [];
    }

    const files = fs
      .readdirSync(rolloutsDir)
      .filter((f) => f.endsWith('.json'));
    const states: RolloutState[] = [];

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(rolloutsDir, file), 'utf-8');
        states.push(JSON.parse(content) as RolloutState);
      } catch {
        // skip invalid files
      }
    }

    return states
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )
      .slice(0, limit);
  }

  getImages(): ImageInfo[] {
    const deploymentPath = this.resolveDeploymentPath();
    const rolloutStatePath = this.resolveRolloutStatePath();

    let currentTag = 'latest';
    let configHash = '';
    if (fs.existsSync(rolloutStatePath)) {
      try {
        const state = JSON.parse(
          fs.readFileSync(rolloutStatePath, 'utf-8')
        ) as RolloutState;
        currentTag = state.targetTag;
        configHash = state.configHash;
      } catch {
        // ignore
      }
    }

    if (!fs.existsSync(deploymentPath)) {
      return [];
    }

    const content = fs.readFileSync(deploymentPath, 'utf-8');
    const services = this.parseServiceIds(content);
    const imageOwner = this.parseImageOwner(content);

    return services.map((serviceId) => ({
      serviceId,
      currentTag,
      latestTag: currentTag,
      updateAvailable: false,
      registry: 'docker.io',
      image: `${imageOwner}/optimistic_tanuki_${serviceId}`,
      pattern: 'latest',
    }));
  }

  private resolveDeploymentPath(): string {
    return path.isAbsolute(this.deploymentPath)
      ? this.deploymentPath
      : path.join(this.workspaceRoot, this.deploymentPath);
  }

  private resolveRolloutStatePath(): string {
    const deploymentPath = this.resolveDeploymentPath();
    const name = path.basename(deploymentPath, path.extname(deploymentPath));
    return path.join(
      this.workspaceRoot,
      'tmp',
      'admin-env',
      'rollouts',
      `${name}.json`
    );
  }

  private hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  private parseServiceIds(content: string): string[] {
    const services: string[] = [];
    const serviceRegex = /serviceId:\s*([^\s]+)/g;
    let match;
    while ((match = serviceRegex.exec(content)) !== null) {
      services.push(match[1]);
    }
    return services;
  }

  private parseImageOwner(content: string): string {
    const match = content.match(/imageOwner:\s*([^\s]+)/);
    return match ? match[1] : 'cjrutherford';
  }
}
