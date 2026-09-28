import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const scannerPath = fileURLToPath(
  new URL('./check-client-ui-heuristics.mjs', import.meta.url)
);

test('ignores generated Compodoc styles under ui-playground public docs', () => {
  const workspace = mkdtempSync(join(tmpdir(), 'ui-heuristics-'));
  const generatedStyles = join(
    workspace,
    'apps/ui-playground/public/generated/compodoc/styles.scss'
  );

  try {
    mkdirSync(join(workspace, 'apps'), { recursive: true });
    mkdirSync(join(workspace, 'apps/ui-playground/public/generated/compodoc'), {
      recursive: true,
    });
    writeFileSync(generatedStyles, '.generated-doc { color: #123456; }\n');

    const result = spawnSync(
      process.execPath,
      [scannerPath, '--fail-on-findings'],
      { cwd: workspace, encoding: 'utf8' }
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /Client UI heuristic check passed\./);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});
