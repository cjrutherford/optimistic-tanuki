import './d27-gateway.worker';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  chmodSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { readD27WorkerConfig } from './d27-owner.worker';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const root = resolve('.runtime-artifacts/account-rights/deletion');
let privateDir: string;
beforeEach(() => {
  mkdirSync(root, { recursive: true });
  privateDir = mkdtempSync(join(root, 'd27-config-test-'));
});
afterEach(() => rmSync(privateDir, { recursive: true, force: true }));
function fixture() {
  const endpoint = { host: '127.0.0.1' as const, port: 15991 };
  return {
    marker: 'private-d27-otts-v1',
    owner: 'profile',
    database: {
      ...endpoint,
      username: 'd00',
      password: randomBytes(32).toString('hex'),
      database: 'd27_profile',
    },
    endpoints: { authentication: endpoint },
    replicas: { profile: [endpoint] },
    listen: endpoint,
    privateRoot: privateDir,
    jwtSecret: randomBytes(32).toString('hex'),
    proofKey: randomBytes(32).toString('hex'),
    gatewayOrigins: ['http://127.0.0.1:15992'],
  };
}
it('accepts only an owned private config and loopback-only synthetic database/storage', () => {
  const path = join(privateDir, 'config.json');
  writeFileSync(path, JSON.stringify(fixture()), { mode: 0o600 });
  expect(readD27WorkerConfig(path)).toMatchObject({
    owner: 'profile',
    database: { database: 'd27_profile' },
  });
  chmodSync(path, 0o644);
  expect(() => readD27WorkerConfig(path)).toThrow('D27_PRIVATE_CONFIG_CUSTODY');
});
it('rejects shared databases, nonloopback replicas, and storage outside its private root', () => {
  const path = join(privateDir, 'config.json');
  for (const bad of [
    { ...fixture(), database: { ...fixture().database, database: 'postgres' } },
    { ...fixture(), replicas: { profile: [{ host: 'db', port: 5432 }] } },
    { ...fixture(), privateRoot: resolve('.') },
  ]) {
    writeFileSync(path, JSON.stringify(bad), { mode: 0o600 });
    expect(() => readD27WorkerConfig(path)).toThrow(/D27_PRIVATE_/);
  }
});
