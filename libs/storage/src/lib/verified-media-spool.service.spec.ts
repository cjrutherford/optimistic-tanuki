import { Readable } from 'node:stream';
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EnvelopeEncryptionService } from './envelope-encryption.service';
import { VerifiedMediaSpoolService } from './verified-media-spool.service';

describe('VerifiedMediaSpoolService', () => {
  const kek = 'rr10-i01-test-key-that-is-not-production';
  let root: string;
  let encryption: EnvelopeEncryptionService;
  let service: VerifiedMediaSpoolService;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'rr10-media-spool-'));
    encryption = new EnvelopeEncryptionService({ VAULT_STORAGE_KEK: kek });
    service = new VerifiedMediaSpoolService(encryption, {
      spoolRoot: join(root, 'spool'),
      maxPlaintextBytes: 1024 * 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 1024 * 1024,
    });
  });

  afterEach(async () => rm(root, { recursive: true, force: true }));

  it('starts each unbounded read at byte zero after writing or a prior ranged read', async () => {
    const plaintext = Buffer.from('whole authenticated media stream');
    const handle = await service.create(() =>
      Readable.from([encryption.encrypt(plaintext)])
    );
    const read = async (start?: number, end?: number) => {
      const chunks: Buffer[] = [];
      for await (const chunk of handle.createReadStream(start, end))
        chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    };
    try {
      expect(await read()).toEqual(plaintext);
      expect(await read(3, 8)).toEqual(plaintext.subarray(3, 9));
      expect(await read()).toEqual(plaintext);
    } finally {
      await handle.cleanup();
    }
  });

  it('keeps authenticated bytes on an anonymous FD through ranged reads and cleanup', async () => {
    const plaintext = Buffer.from('authenticated media');
    const handle = await service.create(
      () => Readable.from([encryption.encrypt(plaintext)]),
      { maxPlaintextBytes: 1024 }
    );

    expect(handle.size).toBe(plaintext.length);
    expect(handle.path).toMatch(
      process.platform === 'linux' ? /^\/proc\/self\/fd\// : /^\/dev\/fd\//
    );
    expect(await readFile(handle.path)).toEqual(plaintext);
    expect(await readdir(service.processDirectory)).toEqual([]);
    expect((await stat(service.processDirectory)).mode & 0o777).toBe(0o700);
    const range = handle.createReadStream(2, 8);
    const chunks: Buffer[] = [];
    range.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    await new Promise<void>((resolve, reject) => {
      range.once('end', resolve);
      range.once('error', reject);
    });
    expect(Buffer.concat(chunks)).toEqual(plaintext.subarray(2, 9));
    await handle.cleanup();
    await expect(stat(handle.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('destroys active readers before closing the anonymous FD', async () => {
    const handle = await service.create(
      () => Readable.from([encryption.encrypt(Buffer.alloc(256 * 1024, 0x61))]),
      { maxPlaintextBytes: 512 * 1024 }
    );
    const stream = handle.createReadStream();
    await handle.cleanup();
    expect(stream.destroyed).toBe(true);
    await expect(stat(handle.path)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('blocks deletion verification while legacy named plaintext remains', async () => {
    await service.onModuleInit();
    const legacyPath = join(service.processDirectory, 'legacy.plain');
    await writeFile(legacyPath, 'private media', { mode: 0o600 });
    await expect(service.assertDeletionReady()).rejects.toThrow(
      'Legacy named media'
    );
    await rm(legacyPath);
    await expect(service.assertDeletionReady()).resolves.toBeUndefined();
  });

  it('leaves anonymous active readers to their database read leases', async () => {
    const handle = await service.create(() =>
      Readable.from([encryption.encrypt(Buffer.from('active'))])
    );
    try {
      await expect(service.assertDeletionReady()).resolves.toBeUndefined();
      expect(await readFile(handle.path)).toEqual(Buffer.from('active'));
    } finally {
      await handle.cleanup();
    }
  });

  it('never returns a spool when the whole-object GCM tag is invalid', async () => {
    const envelope = encryption.encrypt(Buffer.from('do not expose'));
    envelope[envelope.length - 1] ^= 0xff;

    await expect(
      service.create(() => Readable.from([envelope]), {
        maxPlaintextBytes: 1024,
      })
    ).rejects.toThrow(/authentication/i);
    expect(await readdir(service.processDirectory)).toEqual([]);
  });

  it('rejects input above the plaintext bound and removes partial output', async () => {
    const envelope = encryption.encrypt(Buffer.alloc(1025, 0x61));

    await expect(
      service.create(() => Readable.from([envelope]), {
        maxPlaintextBytes: 1024,
      })
    ).rejects.toThrow(/limit/i);
    expect(await readdir(service.processDirectory)).toEqual([]);
  });

  it('does not start a source when the process spool slot is occupied', async () => {
    const abort = new AbortController();
    const first = service.create(
      () =>
        new Readable({
          read() {
            // Keep the first transfer occupying the only slot.
          },
        }),
      { maxPlaintextBytes: 1024, signal: abort.signal }
    );
    let sourceOpened = false;
    const secondAbort = new AbortController();
    const second = service.create(
      () => {
        sourceOpened = true;
        return Readable.from([]);
      },
      { maxPlaintextBytes: 1024, signal: secondAbort.signal }
    );
    secondAbort.abort();
    await expect(second).rejects.toThrow(/cancel/i);
    expect(sourceOpened).toBe(false);
    abort.abort();
    await first.catch(() => undefined);
    expect(await readdir(service.processDirectory)).toEqual([]);
  });

  it('quarantines before source creation when anonymous unlink fails', async () => {
    class UnlinkFailureSpool extends VerifiedMediaSpoolService {
      protected override async removeSpoolFile(): Promise<void> {
        throw new Error('disk denied unlink');
      }
    }
    const failing = new UnlinkFailureSpool(encryption, {
      spoolRoot: join(root, 'cleanup-failure'),
      maxPlaintextBytes: 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 1024,
    });
    let sourceOpened = false;
    await expect(
      failing.create(() => {
        sourceOpened = true;
        return Readable.from([encryption.encrypt(Buffer.from('private'))]);
      })
    ).rejects.toThrow('disk denied unlink');
    expect(sourceOpened).toBe(false);
    expect(await readdir(failing.processDirectory)).toEqual([]);
    await expect(failing.create(() => Readable.from([]))).rejects.toThrow(
      /cleanup failed/i
    );
  });
});
