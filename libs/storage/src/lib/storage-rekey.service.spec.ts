import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { EnvelopeEncryptionService } from './envelope-encryption.service';
import { StorageRekeyService } from './storage-rekey.service';

describe('StorageRekeyService', () => {
  const previousKek = process.env['VAULT_STORAGE_KEK'];
  let service: StorageRekeyService;

  beforeEach(() => {
    process.env['VAULT_STORAGE_KEK'] =
      'test-storage-kek-with-sufficient-entropy-0123456789';
    service = new StorageRekeyService(new EnvelopeEncryptionService());
  });

  afterEach(() => {
    if (previousKek === undefined) {
      delete process.env['VAULT_STORAGE_KEK'];
    } else {
      process.env['VAULT_STORAGE_KEK'] = previousKek;
    }
  });

  const seedDir = async (files: Record<string, string>): Promise<string> => {
    const dir = await mkdtemp(path.join(tmpdir(), 'vault-rekey-'));
    for (const [name, content] of Object.entries(files)) {
      await writeFile(path.join(dir, name), content);
    }
    return dir;
  };

  it('leaves envelope objects untouched and reports them', async () => {
    const encryption = new EnvelopeEncryptionService();
    const container = encryption.encrypt(Buffer.from('already sealed'));
    const dir = await mkdtemp(path.join(tmpdir(), 'vault-rekey-'));
    await writeFile(path.join(dir, 'sealed.bin'), container);

    const report = await service.rekeyLocalDirectory(dir);

    expect(report.scanned).toBe(1);
    expect(report.encrypted).toBe(0);
    expect(report.failed).toBe(0);
    expect(report.entries[0].status).toBe('already-encrypted');
  });

  it('encrypts legacy plaintext only after a verified round-trip', async () => {
    const dir = await seedDir({
      'legacy.txt': 'legacy plaintext content here',
    });

    const report = await service.rekeyLocalDirectory(dir);

    expect(report.encrypted).toBe(1);
    expect(report.entries[0].status).toBe('re-encrypted');
    const stored = await readFile(path.join(dir, 'legacy.txt'));
    const decrypted = new EnvelopeEncryptionService().decrypt(stored);
    expect(decrypted.toString('utf8')).toBe('legacy plaintext content here');
  });

  it('dry-run changes nothing on disk', async () => {
    const dir = await seedDir({
      'legacy.txt': 'untouched plaintext content here',
    });

    const report = await service.rekeyLocalDirectory(dir, { dryRun: true });

    expect(report.entries[0].status).toBe('dry-run-would-encrypt');
    expect(await readFile(path.join(dir, 'legacy.txt'), 'utf8')).toBe(
      'untouched plaintext content here'
    );
  });

  it('fails closed without a KEK and leaves originals untouched', async () => {
    delete process.env['VAULT_STORAGE_KEK'];
    const failing = new StorageRekeyService(new EnvelopeEncryptionService());
    const dir = await seedDir({
      'legacy.txt': 'untouched plaintext content here',
    });

    const report = await failing.rekeyLocalDirectory(dir);

    expect(report.failed).toBe(1);
    expect(report.entries[0].status).toBe('failed-verification');
    expect(await readFile(path.join(dir, 'legacy.txt'), 'utf8')).toBe(
      'untouched plaintext content here'
    );
  });

  it('re-encrypts S3 objects and skips envelopes', async () => {
    const objects = new Map<string, Buffer>([
      ['docs/plain.txt', Buffer.from('s3 legacy plaintext content here')],
    ]);
    const s3 = {
      getObject: async (key: string) => {
        const object = objects.get(key);
        if (!object) throw new Error(`NoSuchKey: ${key}`);
        return object;
      },
      uploadObject: async (key: string, body: Buffer) => {
        objects.set(key, body);
      },
    };

    const report = await service.rekeyS3Keys(s3, [
      'docs/plain.txt',
      'docs/missing.txt',
    ]);

    expect(report.scanned).toBe(2);
    expect(report.encrypted).toBe(1);
    expect(report.failed).toBe(1);
    const stored = objects.get('docs/plain.txt');
    expect(stored).toBeDefined();
    expect(
      new EnvelopeEncryptionService().decrypt(stored as Buffer).toString('utf8')
    ).toBe('s3 legacy plaintext content here');
    expect(report.entries[1]).toEqual(
      expect.objectContaining({ status: 'skipped-unreadable' })
    );
  });
});
