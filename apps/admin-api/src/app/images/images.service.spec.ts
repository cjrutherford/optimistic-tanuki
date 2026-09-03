import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ImagesService } from './images.service';

describe('ImagesService', () => {
  let workspaceRoot: string;
  let deploymentPath: string;

  const buildService = () =>
    new ImagesService({
      get: jest.fn((key: string) => {
        switch (key) {
          case 'admin-api.workspaceRoot':
            return workspaceRoot;
          case 'admin-api.deploymentPath':
            return deploymentPath;
          default:
            return undefined;
        }
      }),
    } as unknown as ConfigService);

  beforeEach(() => {
    workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'images-service-'));
    deploymentPath = './production.yaml';
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  });

  describe('getImages', () => {
    it('returns an empty array when there is no deployment file', () => {
      const service = buildService();
      expect(service.getImages()).toEqual([]);
    });

    it('parses services, owner, and tag pattern from the deployment yaml', () => {
      fs.writeFileSync(
        path.join(workspaceRoot, 'production.yaml'),
        'imageOwner: acme\nimageTagPattern: semver\nservices:\n  - serviceId: gateway\n  - serviceId: auth\n'
      );
      const service = buildService();
      const images = service.getImages();
      expect(images).toEqual([
        expect.objectContaining({
          serviceId: 'gateway',
          image: 'acme/optimistic_tanuki_gateway',
          pattern: 'semver',
        }),
        expect.objectContaining({ serviceId: 'auth' }),
      ]);
    });

    it('uses the rollout state target tag when present, ignoring a broken state file', () => {
      fs.writeFileSync(
        path.join(workspaceRoot, 'production.yaml'),
        'services:\n  - serviceId: gateway\n'
      );
      const rolloutsDir = path.join(
        workspaceRoot,
        'tmp',
        'admin-env',
        'rollouts'
      );
      fs.mkdirSync(rolloutsDir, { recursive: true });
      fs.writeFileSync(
        path.join(rolloutsDir, 'production.json'),
        JSON.stringify({ targetTag: 'v7' })
      );
      const service = buildService();
      const [image] = service.getImages();
      expect(image.currentTag).toBe('v7');
    });
  });

  describe('refreshImages', () => {
    it('writes a cache file per image and returns the images', () => {
      fs.writeFileSync(
        path.join(workspaceRoot, 'production.yaml'),
        'services:\n  - serviceId: gateway\n'
      );
      const service = buildService();
      const images = service.refreshImages();
      expect(images).toHaveLength(1);

      const cacheFile = path.join(
        workspaceRoot,
        'tmp',
        'admin-env',
        'registry-cache',
        'gateway.json'
      );
      expect(fs.existsSync(cacheFile)).toBe(true);
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      expect(cached.serviceId).toBe('gateway');
      expect(cached.lastRefreshed).toEqual(expect.any(String));
    });
  });
});
