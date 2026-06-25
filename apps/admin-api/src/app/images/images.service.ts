import * as fs from 'fs';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

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
export class ImagesService {
  private readonly workspaceRoot: string;
  private readonly deploymentPath: string;
  private readonly registryCacheDir: string;

  constructor(private readonly configService: ConfigService) {
    this.workspaceRoot =
      this.configService.get<string>('admin-api.workspaceRoot') || '.';
    this.deploymentPath =
      this.configService.get<string>('admin-api.deploymentPath') ||
      './ops/deployments/production.yaml';
    this.registryCacheDir = path.join(
      this.workspaceRoot,
      'tmp',
      'admin-env',
      'registry-cache'
    );
  }

  getImages(): ImageInfo[] {
    const deploymentPath = this.resolveDeploymentPath();
    const rolloutStatePath = this.resolveRolloutStatePath();

    let currentTag = 'latest';
    let imageOwner = 'cjrutherford';
    const services: string[] = [];
    let pattern = 'latest';

    if (fs.existsSync(rolloutStatePath)) {
      try {
        const state = JSON.parse(
          fs.readFileSync(rolloutStatePath, 'utf-8')
        ) as { targetTag: string };
        currentTag = state.targetTag;
      } catch {
        // ignore
      }
    }

    if (fs.existsSync(deploymentPath)) {
      const content = fs.readFileSync(deploymentPath, 'utf-8');
      services.push(...this.parseServiceIds(content));
      imageOwner = this.parseImageOwner(content);
      pattern = this.parseImageTagPattern(content);
    }

    return services.map((serviceId) => ({
      serviceId,
      currentTag,
      latestTag: currentTag,
      updateAvailable: false,
      registry: 'docker.io',
      image: `${imageOwner}/optimistic_tanuki_${serviceId}`,
      pattern,
    }));
  }

  refreshImages(): ImageInfo[] {
    fs.mkdirSync(this.registryCacheDir, { recursive: true });
    const images = this.getImages();
    for (const image of images) {
      const cachePath = path.join(
        this.registryCacheDir,
        `${image.serviceId}.json`
      );
      fs.writeFileSync(
        cachePath,
        JSON.stringify({ ...image, lastRefreshed: new Date().toISOString() }),
        'utf-8'
      );
    }
    return images;
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

  private parseImageTagPattern(content: string): string {
    const match = content.match(/imageTagPattern:\s*([^\s]+)/);
    return match ? match[1] : 'latest';
  }
}
