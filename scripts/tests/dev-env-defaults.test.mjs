import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse } from 'dotenv';
import { ensureDevDefaults } from '../dev-env-defaults.mjs';
test('development defaults persist separate keys, preserve strong values and keep the file private', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ot-dev-defaults-'));
  const envPath = path.join(dir, '.env');
  try {
    const preserved = 'x'.repeat(64);
    fs.writeFileSync(envPath, `JWT_SECRET=${preserved}\nUNRELATED=keep\n`);
    ensureDevDefaults({
      envPath,
      otPort: 8086,
      externalServices: 'postgres',
      services: 'authentication,gateway',
    });
    const first = fs.readFileSync(envPath, 'utf8'),
      v = parse(first);
    assert.equal(v.JWT_SECRET, preserved);
    assert.equal(v.UNRELATED, 'keep');
    assert.equal(v.CLIENT_INTERFACE_PORT, '8086');
    const registry = JSON.parse(
      fs.readFileSync(path.join(dir, v.APP_REGISTRY_HOST_PATH), 'utf8')
    );
    const ot = registry.apps.find((a) => a.appId === 'client-interface');
    assert.equal(ot.uiBaseUrl, 'http://localhost:8086');
    assert.equal(ot.apiBaseUrl, 'http://127.0.0.1:3000');
    assert.equal(v.DOCKER_DEV_EXTERNAL_SERVICES, 'postgres');
    assert.equal(v.DOCKER_DEV_SERVICES, 'authentication,gateway');
    assert.equal(v.CLASSIFIEDS_POSTGRES_DB, 'ot_classifieds');
    assert.ok(!v.ADDITIONAL_DBS.split(',').includes('classifieds_db'));
    assert.notEqual(v.ACCOUNT_DELETION_PROOF_KEY, v.VAULT_STORAGE_KEK);
    assert.ok(v.VAULT_STORAGE_KEK.length >= 64);
    assert.equal(fs.statSync(envPath).mode & 0o777, 0o600);
    ensureDevDefaults({ envPath });
    assert.equal(fs.readFileSync(envPath, 'utf8'), first);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test('weak development JWT defaults are replaced and invalid ports are rejected', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ot-dev-defaults-'));
  const envPath = path.join(dir, '.env');
  try {
    fs.writeFileSync(envPath, 'JWT_SECRET=development-jwt-secret\n');
    ensureDevDefaults({ envPath });
    assert.ok(parse(fs.readFileSync(envPath)).JWT_SECRET.length >= 64);
    assert.throws(() => ensureDevDefaults({ envPath, otPort: 'bad' }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
