import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';

const workspaceRoot = path.resolve(new URL('../..', import.meta.url).pathname);

async function readYaml(relativePath) {
  return yaml.load(
    await readFile(path.join(workspaceRoot, relativePath), 'utf8')
  );
}

test('Kustomize generates the prompt-proxy config mounted by its deployment', async () => {
  const kustomization = await readYaml('k8s/base/kustomization.yaml');
  const generator = kustomization.configMapGenerator?.find(
    (entry) => entry.name === 'prompt-proxy-config'
  );

  assert.deepEqual(generator?.files, [
    'config.yaml=config/prompt-proxy-config.yaml',
  ]);

  const deployment = yaml.loadAll(
    await readFile(
      path.join(workspaceRoot, 'k8s/base/services/prompt-proxy.yaml'),
      'utf8'
    )
  )[0];
  assert.equal(
    deployment.spec.template.spec.volumes.find(
      (volume) => volume.name === 'config'
    )?.configMap?.name,
    'prompt-proxy-config'
  );

  const sourceConfig = await readYaml(
    'apps/prompt-proxy/src/assets/config.yaml'
  );
  const k8sConfig = await readYaml('k8s/base/config/prompt-proxy-config.yaml');
  assert.deepEqual(k8sConfig, sourceConfig);
});

test('database bootstrap diagnostics do not print the PostgreSQL password', async () => {
  const source = await readFile(
    path.join(workspaceRoot, 'scripts/create-dbs.sh'),
    'utf8'
  );

  assert.match(source, /postgres user:/i);
  assert.doesNotMatch(source, /postgres password:/i);
  assert.doesNotMatch(source, /POSTGRES_PASSWORD\}/);
});
