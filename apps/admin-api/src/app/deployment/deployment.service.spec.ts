import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DeploymentService } from './deployment.service';

describe('DeploymentService', () => {
  let workspaceRoot: string;
  let deploymentPath: string;

  const buildService = () =>
    new DeploymentService({
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
    workspaceRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), 'deployment-service-')
    );
    deploymentPath = './production.yaml';
  });

  afterEach(() => {
    fs.rmSync(workspaceRoot, { force: true, recursive: true });
  });

  function rolloutsDir() {
    const dir = path.join(workspaceRoot, 'tmp', 'admin-env', 'rollouts');
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  describe('getHealth', () => {
    it('returns current config status with no rollout state, given an existing deployment file', () => {
      fs.writeFileSync(
        path.join(workspaceRoot, 'production.yaml'),
        'services: []\n'
      );
      const service = buildService();
      const health = service.getHealth();
      expect(health.configStatus).toBe('current');
      expect(health.lastDeployed).toBeUndefined();
    });

    it('reports pending-changes when the config hash no longer matches the rollout state', () => {
      fs.writeFileSync(
        path.join(workspaceRoot, 'production.yaml'),
        'services: []\n'
      );
      const dir = rolloutsDir();
      fs.writeFileSync(
        path.join(dir, 'production.json'),
        JSON.stringify({
          configHash: 'stale-hash',
          targetTag: 'v1',
          status: 'succeeded',
          startedAt: '2024-01-01T00:00:00Z',
          completedAt: '2024-01-01T01:00:00Z',
        })
      );
      const service = buildService();
      const health = service.getHealth();
      expect(health.configStatus).toBe('pending-changes');
      expect(health.lastDeployed).toEqual({
        timestamp: '2024-01-01T01:00:00Z',
        tag: 'v1',
        result: 'succeeded',
      });
    });

    it('treats an unparsable rollout state file as pending-changes', () => {
      fs.writeFileSync(
        path.join(workspaceRoot, 'production.yaml'),
        'services: []\n'
      );
      const dir = rolloutsDir();
      fs.writeFileSync(path.join(dir, 'production.json'), 'not json');
      const service = buildService();
      const health = service.getHealth();
      expect(health.configStatus).toBe('pending-changes');
      expect(health.lastDeployed).toBeUndefined();
    });
  });

  describe('getRolloutHistory', () => {
    it('returns an empty array when the rollouts directory does not exist', () => {
      const service = buildService();
      expect(service.getRolloutHistory()).toEqual([]);
    });

    it('sorts rollout states newest-first and applies the limit, skipping bad files', () => {
      const dir = rolloutsDir();
      fs.writeFileSync(
        path.join(dir, 'a.json'),
        JSON.stringify({ startedAt: '2024-01-01T00:00:00Z', tag: 'a' })
      );
      fs.writeFileSync(
        path.join(dir, 'b.json'),
        JSON.stringify({ startedAt: '2024-03-01T00:00:00Z', tag: 'b' })
      );
      fs.writeFileSync(path.join(dir, 'c.json'), '{ broken');
      fs.writeFileSync(path.join(dir, 'ignored.txt'), 'not json');

      const service = buildService();
      const history = service.getRolloutHistory(1);
      expect(history).toHaveLength(1);
      expect((history[0] as any).tag).toBe('b');
    });
  });

  describe('getImages', () => {
    it('returns an empty array when no deployment file exists', () => {
      const service = buildService();
      expect(service.getImages()).toEqual([]);
    });

    it('parses service ids and image owner from the deployment yaml', () => {
      fs.writeFileSync(
        path.join(workspaceRoot, 'production.yaml'),
        'imageOwner: myowner\nservices:\n  - serviceId: gateway\n  - serviceId: auth\n'
      );
      const service = buildService();
      const images = service.getImages();
      expect(images).toEqual([
        expect.objectContaining({
          serviceId: 'gateway',
          image: 'myowner/optimistic_tanuki_gateway',
          currentTag: 'latest',
        }),
        expect.objectContaining({
          serviceId: 'auth',
          image: 'myowner/optimistic_tanuki_auth',
        }),
      ]);
    });

    it('uses the current tag from rollout state and default owner when unset', () => {
      fs.writeFileSync(
        path.join(workspaceRoot, 'production.yaml'),
        'services:\n  - serviceId: gateway\n'
      );
      const dir = rolloutsDir();
      fs.writeFileSync(
        path.join(dir, 'production.json'),
        JSON.stringify({ targetTag: 'v9', configHash: 'x' })
      );
      const service = buildService();
      const [image] = service.getImages();
      expect(image.currentTag).toBe('v9');
      expect(image.image).toBe('cjrutherford/optimistic_tanuki_gateway');
    });
  });
});
