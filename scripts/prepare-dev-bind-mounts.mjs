import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function isNestedMount(parentTarget, childTarget) {
  return childTarget.startsWith(`${parentTarget}/`);
}

export function deriveNestedBindMountPaths(services, workspaceRoot) {
  const distRoot = resolve(workspaceRoot, 'dist');
  const paths = new Set();

  for (const service of Object.values(services)) {
    const mounts = service.volumes ?? [];
    const writableDistBinds = mounts.filter(
      (mount) =>
        mount.type === 'bind' &&
        mount.read_only !== true &&
        resolve(mount.source).startsWith(`${distRoot}/`)
    );

    for (const bind of writableDistBinds) {
      for (const nestedMount of mounts) {
        if (
          nestedMount === bind ||
          !isNestedMount(bind.target, nestedMount.target)
        ) {
          continue;
        }

        const nestedPath = resolve(
          bind.source,
          relative(bind.target, nestedMount.target)
        );
        paths.add(
          nestedMount.type === 'bind' ? dirname(nestedPath) : nestedPath
        );
      }
    }
  }

  return [...paths].sort();
}

function main() {
  const composeFile = process.argv[2] ?? 'docker-compose.dev.yaml';
  const workspaceRoot = process.cwd();
  const output = execFileSync(
    'docker',
    [
      'compose',
      '-f',
      'docker-compose.yaml',
      '-f',
      composeFile,
      'config',
      '--format',
      'json',
    ],
    { encoding: 'utf8' }
  );
  const config = JSON.parse(output);
  const paths = deriveNestedBindMountPaths(config.services, workspaceRoot);

  for (const path of paths) {
    mkdirSync(path, { recursive: true });
  }

  if (paths.length > 0) {
    console.log(`Prepared ${paths.length} local bind-mount path(s).`);
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main();
}
