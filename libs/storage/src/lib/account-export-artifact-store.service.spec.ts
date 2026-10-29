import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readdirSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
  stat,
  utimes,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import {
  EnvelopeEncryptionService,
  VAULT_STORAGE_KEK_ENV,
} from './envelope-encryption.service';
import {
  AccountExportArtifactStoreService,
  ArtifactDescriptor,
} from './account-export-artifact-store.service';

const APP = 'client-interface';
const accountId = randomUUID();
const jobId = randomUUID();
const future = '2099-01-01T00:00:00.000Z';
const content = Buffer.from(Array.from({ length: 150_000 }, (_, i) => i % 251));
const digest = createHash('sha256').update(content).digest('hex');

describe('AccountExportArtifactStoreService', () => {
  let base: string;
  let root: string;
  let encryption: EnvelopeEncryptionService;
  let clock: number;
  const descriptorInput = (artifactId = randomUUID()) => ({
    artifactId,
    jobId,
    accountId,
    appId: APP,
    attempt: 2,
    expiresAt: future,
    sizeBytes: content.length,
    sha256: digest,
    stream: Readable.from([content]),
  });
  const service = () =>
    new AccountExportArtifactStoreService(encryption, {
      root,
      now: () => clock,
    });

  beforeEach(async () => {
    base = await mkdtemp(join(tmpdir(), 'artifact-store-'));
    root = join(base, 'store');
    clock = Date.parse('2026-01-01T00:00:00Z');
    encryption = new EnvelopeEncryptionService({
      [VAULT_STORAGE_KEK_ENV]:
        Buffer.from('private test kek').toString('base64'),
    });
  });
  afterEach(async () => rm(base, { recursive: true, force: true }));

  it('purges corrupt ciphertext only under explicit ledger authority, with independent absence readback', async () => {
    const store = service();
    const descriptor = await store.put(descriptorInput());
    await writeFile(
      join(root, descriptor.artifactId),
      Buffer.from('corrupted ciphertext')
    );
    await expect(store.remove(descriptor)).rejects.toThrow();
    await expect(
      store.purgeOwnedArtifact(descriptor, async () => false)
    ).rejects.toThrow('ARTIFACT_PURGE_NOT_AUTHORIZED');
    expect(await store.inspectAbsent(descriptor.artifactId)).toBe(false);
    await store.purgeOwnedArtifact(descriptor, async () => true);
    expect(await readdir(root)).toEqual([]);
    expect(await store.inspectAbsent(descriptor.artifactId)).toBe(true);
    await store.purgeOwnedArtifact(descriptor, async () => true);
    // Purging an artifact removes its wrapped DEKs, not the shared wrapping key.
    const next = await store.put(descriptorInput());
    const opened = await store.openVerified(next);
    await opened.cleanup();
    await store.remove(next);
  });

  it('persists framed encrypted bytes and opens them after a service restart', async () => {
    const first = service();
    const descriptor = await first.put(descriptorInput());
    const raw = await readFile(join(root, descriptor.artifactId));
    expect(raw.includes(Buffer.from(accountId))).toBe(false);
    expect(raw.includes(content.subarray(0, 64))).toBe(false);
    const firstLength = raw.readUInt32BE(21);
    expect(encryption.isEnvelope(raw.subarray(25, 25 + firstLength))).toBe(
      true
    );
    const handle = await service().openVerified(descriptor);
    try {
      expect(handle.sizeBytes).toBe(content.length);
      expect(await handle.readChunk(65_000, 64 * 1024)).toEqual(
        content.subarray(65_000, 65_000 + 64 * 1024)
      );
      const chunks: Buffer[] = [];
      for await (const chunk of handle.createReadStream(4, 18))
        chunks.push(Buffer.from(chunk));
      expect(Buffer.concat(chunks)).toEqual(content.subarray(4, 18));
      expect(
        (await readdir(root)).some((name) => name.startsWith('.verified'))
      ).toBe(false);
    } finally {
      await handle.cleanup();
    }
  });

  it('rejects descriptors bound to another account, app, attempt, or expired time while allowing expired removal', async () => {
    const descriptor = await service().put(descriptorInput());
    await expect(
      service().openVerified({ ...descriptor, accountId: randomUUID() })
    ).rejects.toThrow();
    await expect(
      service().openVerified({ ...descriptor, appId: 'forgeofwill' })
    ).rejects.toThrow();
    await expect(
      service().openVerified({ ...descriptor, attempt: 3 })
    ).rejects.toThrow();
    clock = Date.parse(future);
    await expect(service().openVerified(descriptor)).rejects.toThrow(
      'ARTIFACT_EXPIRED'
    );
    await expect(service().remove(descriptor)).resolves.toBeUndefined();
  });

  it('rejects bit flips, truncation, and trailing bytes before returning plaintext', async () => {
    const descriptor = await service().put(descriptorInput());
    const path = join(root, descriptor.artifactId);
    const original = await readFile(path);
    for (const mutated of [
      Buffer.from(original),
      Buffer.from(original.subarray(0, original.length - 1)),
      Buffer.concat([original, Buffer.from([0])]),
    ]) {
      if (mutated.length === original.length) mutated[mutated.length - 1] ^= 1;
      await writeFile(path, mutated);
      await expect(service().openVerified(descriptor)).rejects.toThrow();
    }
  });

  it('compensates a late lost lease and refuses to overwrite an existing artifact', async () => {
    const id = randomUUID();
    await expect(
      service().put({
        ...descriptorInput(id),
        assertCurrent: async () => false,
      })
    ).rejects.toThrow('ARTIFACT_LEASE_LOST');
    expect(await service().inspectAbsent(id)).toBe(true);
    const descriptor = await service().put(descriptorInput(id));
    await expect(service().put(descriptorInput(id))).rejects.toThrow(
      'ARTIFACT_ALREADY_EXISTS'
    );
    expect(await service().inspectAbsent(id)).toBe(false);
    await service().remove(descriptor);
  });

  it('cleans encrypted temporaries after aborts and source stream faults', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      service().put({ ...descriptorInput(), signal: controller.signal })
    ).rejects.toThrow('ARTIFACT_ABORTED');
    const failed = new Readable({
      read() {
        this.destroy(new Error('injected source fault'));
      },
    });
    await expect(
      service().put({ ...descriptorInput(), stream: failed })
    ).rejects.toThrow('injected source fault');
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects symlink roots and bounds the source size', async () => {
    const target = join(base, 'target');
    await import('node:fs/promises').then(({ mkdir }) => mkdir(target));
    const linked = join(base, 'linked');
    await symlink(target, linked);
    await expect(
      new AccountExportArtifactStoreService(encryption, { root: linked }).put(
        descriptorInput()
      )
    ).rejects.toThrow('ARTIFACT_ROOT_INVALID');
    await expect(
      new AccountExportArtifactStoreService(encryption, {
        root,
        maxBytes: 100,
      }).put(descriptorInput())
    ).rejects.toThrow('ARTIFACT_SIZE_EXCEEDED');
  });

  it('removes only expired pending encrypted temporary files', async () => {
    await import('node:fs/promises').then(({ mkdir }) =>
      mkdir(root, { mode: 0o700 })
    );
    const temp = join(root, `.pending${randomUUID()}`);
    const other = join(root, 'other');
    await writeFile(temp, Buffer.from('ciphertext'));
    await writeFile(other, Buffer.from('leave alone'));
    await service().sweepExpiredTemps(Date.now() + 10_000);
    expect(await service().inspectAbsent(randomUUID())).toBe(true);
    expect(await readdir(root)).toContain('other');
  });
  it('supports TS and rejects apps outside the explicit OT/TS release scope', async () => {
    const input = { ...descriptorInput(), appId: 'local-hub' };
    const descriptor = await service().put(input);
    const handle = await service().openVerified(descriptor);
    await handle.cleanup();
    await expect(
      service().put({ ...descriptorInput(), appId: 'other-app' })
    ).rejects.toThrow();
    await service().remove(descriptor);
  });
  it('never exposes named plaintext while verifying a write or a download', async () => {
    const decrypt = encryption.decrypt.bind(encryption);
    const probe = jest
      .spyOn(encryption, 'decrypt')
      .mockImplementation((bytes) => {
        expect(
          readdirSync(root).filter((name) => name.startsWith('.verified'))
        ).toEqual([]);
        return decrypt(bytes);
      });
    const descriptor = await service().put(descriptorInput());
    const handle = await service().openVerified(descriptor);
    expect(probe).toHaveBeenCalled();
    expect(
      (await readdir(root)).filter((name) => name !== descriptor.artifactId)
    ).toEqual([]);
    await handle.cleanup();
    await expect(handle.readChunk(0, 1)).rejects.toThrow('ARTIFACT_CLOSED');
    await service().remove(descriptor);
    await service().remove(descriptor);
    expect(await readdir(root)).toEqual([]);
  });
  it('recovers only encrypted orphan staging after a real writer process is killed', async () => {
    const ready = join(base, 'child-ready');
    const script = `setInterval(()=>{},1000);const {Readable}=require('node:stream');const fs=require('node:fs');const {randomUUID,createHash}=require('node:crypto');const {EnvelopeEncryptionService}=require(process.env.ARTIFACT_STORE_SOURCE+'/envelope-encryption.service.ts');const {AccountExportArtifactStoreService}=require(process.env.ARTIFACT_STORE_SOURCE+'/account-export-artifact-store.service.ts');const body=Buffer.alloc(65536,65);const stream=Readable.from((async function*(){yield body;fs.writeFileSync(process.env.ARTIFACT_READY,'ready');await new Promise(()=>{});})());new AccountExportArtifactStoreService(new EnvelopeEncryptionService(),{root:process.env.ARTIFACT_ROOT}).put({artifactId:randomUUID(),jobId:randomUUID(),accountId:randomUUID(),appId:'local-hub',attempt:1,expiresAt:'2099-01-01T00:00:00.000Z',sizeBytes:131072,sha256:createHash('sha256').update(Buffer.alloc(131072,65)).digest('hex'),stream}).catch(()=>process.exit(2));`;
    const child = spawn(
      process.execPath,
      ['-r', 'ts-node/register', '-e', script],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TS_NODE_PROJECT: join(
            process.cwd(),
            'libs/storage/tsconfig.lib.json'
          ),
          TS_NODE_TRANSPILE_ONLY: '1',
          TS_NODE_COMPILER_OPTIONS: JSON.stringify({
            module: 'commonjs',
            moduleResolution: 'node',
          }),
          [VAULT_STORAGE_KEK_ENV]: Buffer.alloc(32, 7).toString('base64'),
          ARTIFACT_STORE_SOURCE: join(process.cwd(), 'libs/storage/src/lib'),
          ARTIFACT_ROOT: root,
          ARTIFACT_READY: ready,
        },
        stdio: 'ignore',
      }
    );
    const exited = once(child, 'exit');
    try {
      const deadline = Date.now() + 12000;
      for (;;) {
        try {
          await stat(ready);
          break;
        } catch {
          if (Date.now() > deadline || child.exitCode !== null)
            throw new Error('Private writer did not reach encrypted staging');
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }
      child.kill('SIGKILL');
      const termination = await exited;
      expect(termination).toEqual([null, 'SIGKILL']);
      const files = await readdir(root);
      expect(files).toHaveLength(1);
      expect(files[0]).toMatch(/^\.pending/);
      const cipher = await readFile(join(root, files[0]));
      expect(cipher.subarray(0, 5).toString()).toBe('OTAS1');
      expect(cipher.includes(Buffer.alloc(32, 65))).toBe(false);
      const old = new Date(Date.now() - 60000);
      await utimes(join(root, files[0]), old, old);
      await service().sweepExpiredTemps(Date.now() - 1000);
      expect(await readdir(root)).toEqual([]);
    } finally {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await exited;
      }
    }
  }, 20000);
  it('drains only owned plaintext FDs with retry while leaving encrypted deletion to ledger custody', async () => {
    const store = service();
    const ownDescriptor = await store.put(descriptorInput());
    const foreignDescriptor = await store.put({
      ...descriptorInput(),
      accountId: randomUUID(),
    });
    const own = await store.openVerified(ownDescriptor),
      foreign = await store.openVerified(foreignDescriptor);
    try {
      const file = [...(store as any).runtimeFiles.keys()][0];
      jest.spyOn(file, 'close').mockRejectedValueOnce(Error('CLOSE_FAILED'));
      await expect(
        (store as any).purgeAccountRuntime(accountId)
      ).rejects.toThrow('CLOSE_FAILED');
      expect(await (store as any).readbackAccountRuntime(accountId)).toBe(1);
      await (store as any).purgeAccountRuntime(accountId);
      expect(await (store as any).readbackAccountRuntime(accountId)).toBe(0);
      await expect(own.readChunk(0, 1)).rejects.toThrow();
      expect(await foreign.readChunk(0, 1)).toEqual(content.subarray(0, 1));
      expect(
        (await readFile(join(root, ownDescriptor.artifactId))).equals(content)
      ).toBe(false);
      await expect(store.openVerified(ownDescriptor)).rejects.toThrow(
        'ARTIFACT_ACCOUNT_FENCED'
      );
      await store.remove(ownDescriptor, async () => true);
      expect(await store.inspectAbsent(ownDescriptor.artifactId)).toBe(true);
    } finally {
      await own.cleanup();
      await foreign.cleanup();
    }
  });
});
