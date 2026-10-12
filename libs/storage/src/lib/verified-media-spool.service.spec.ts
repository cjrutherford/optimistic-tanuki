import { Readable } from 'node:stream';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
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

  it('releases authenticated bytes from a bounded spool and removes it on cleanup', async () => {
    const plaintext = Buffer.from('authenticated media');
    const handle = await service.create(
      () => Readable.from([encryption.encrypt(plaintext)]),
      { maxPlaintextBytes: 1024 }
    );

    expect(handle.size).toBe(plaintext.length);
    expect(await readFile(handle.path)).toEqual(plaintext);
    expect((await stat(handle.path)).mode & 0o777).toBe(0o600);
    expect((await stat(service.processDirectory)).mode & 0o777).toBe(0o700);
    await handle.cleanup();
    await expect(stat(handle.path)).rejects.toMatchObject({ code: 'ENOENT' });
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

  it('quarantines the process and retains its slot when plaintext cleanup fails', async () => {
    class CleanupFailureSpool extends VerifiedMediaSpoolService {
      protected override async removeSpoolFile(): Promise<void> {
        throw new Error('disk denied unlink');
      }
    }
    const failing = new CleanupFailureSpool(encryption, {
      spoolRoot: join(root, 'cleanup-failure'),
      maxPlaintextBytes: 1024,
      maxConcurrent: 1,
      spoolBudgetBytes: 1024,
    });
    const handle = await failing.create(
      () => Readable.from([encryption.encrypt(Buffer.from('private'))]),
      { maxPlaintextBytes: 1024 }
    );

    await expect(handle.cleanup()).rejects.toThrow('disk denied unlink');
    let sourceOpened = false;
    await expect(
      failing.create(() => {
        sourceOpened = true;
        return Readable.from([]);
      })
    ).rejects.toThrow(/cleanup failed/i);
    expect(sourceOpened).toBe(false);
    expect(await readFile(handle.path)).toEqual(Buffer.from('private'));
  });
});
