import {
  mkdtemp,
  rm,
  mkdir,
  readFile,
  writeFile,
  symlink,
  readdir,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import {
  localCustodyIdentity,
  localCustodyProbe,
} from './local-custody-identity';
let root: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'ot-custody-test-'));
});
afterEach(async () => rm(root, { recursive: true, force: true }));
it('proves a live shared directory and cleans only its nonidentifying probe', async () => {
  const nonce = randomUUID();
  const id = await localCustodyProbe(root, nonce, 'write');
  expect(await localCustodyProbe(root, nonce, 'read')).toBe(id);
  expect(await localCustodyProbe(root, nonce, 'remove')).toBe(id);
  expect(await readdir(root)).toEqual(['.ot-store-custody-v1']);
  expect(await localCustodyIdentity(root)).toBe(id);
});
it('rejects cloned identity markers when the stores cannot read the same live probe', async () => {
  const a = join(root, 'a'),
    b = join(root, 'b');
  await mkdir(a, { mode: 0o700 });
  await mkdir(b, { mode: 0o700 });
  const id = await localCustodyIdentity(a);
  await writeFile(
    join(b, '.ot-store-custody-v1'),
    await readFile(join(a, '.ot-store-custody-v1')),
    { mode: 0o600 }
  );
  expect(await localCustodyIdentity(b)).toBe(id);
  const nonce = randomUUID();
  await localCustodyProbe(a, nonce, 'write');
  await expect(localCustodyProbe(b, nonce, 'read')).rejects.toThrow();
  await localCustodyProbe(a, nonce, 'remove');
});
it('rejects unsafe names and marker symlinks without modifying the linked target', async () => {
  const target = join(root, 'other');
  await writeFile(target, randomUUID(), { mode: 0o600 });
  await symlink(target, join(root, '.ot-store-custody-v1'));
  await expect(localCustodyIdentity(root)).rejects.toThrow();
  await expect(localCustodyProbe(root, '../other', 'remove')).rejects.toThrow(
    'CUSTODY_PROBE_INVALID'
  );
  expect((await readFile(target)).length).toBe(36);
});
