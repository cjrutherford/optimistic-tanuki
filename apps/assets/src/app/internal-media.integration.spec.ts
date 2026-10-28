import { Logger } from '@nestjs/common';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execFile as execFileCallback } from 'node:child_process';
import { createServer, Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AddressInfo } from 'node:net';
import { promisify } from 'node:util';

import { StorageStrategy } from '@optimistic-tanuki/models';
import { EnvelopeEncryptionService } from '@optimistic-tanuki/storage';
import { LocalStorageAdapter } from '@optimistic-tanuki/storage';
import { VerifiedMediaSpoolService } from '@optimistic-tanuki/storage';

import { InternalMediaController } from './internal-media.controller';
import { InternalMediaService } from './internal-media.service';

describe('RR10-I01 authenticated media HTTP integration', () => {
  // This suite encrypts and streams a 30 MiB payload through HTTP and a child
  // process; the default 5 s unit-test timeout is too short under CI load.
  jest.setTimeout(30_000);

  const token = 'rr10-isolated-integration-token';
  const payloadSize = 30 * 1024 * 1024;
  let root: string;
  let storageRoot: string;
  let spoolRoot: string;
  let encryption: EnvelopeEncryptionService;
  let spoolService: VerifiedMediaSpoolService;
  let adapter: LocalStorageAdapter;
  let mediaService: InternalMediaService;
  let controller: InternalMediaController;
  let server: Server;
  let origin: string;
  let envelopePath: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'rr10-media-http-'));
    storageRoot = join(root, 'storage');
    spoolRoot = join(root, 'spool');
    const keyEnv = { VAULT_STORAGE_KEK: 'isolated-test-only-key-material' };
    encryption = new EnvelopeEncryptionService(keyEnv);
    spoolService = new VerifiedMediaSpoolService(encryption, {
      spoolRoot,
      maxPlaintextBytes: 64 * 1024 * 1024,
      maxConcurrent: 2,
      spoolBudgetBytes: 128 * 1024 * 1024,
    });
    adapter = new LocalStorageAdapter(
      new Logger('RR10MediaIntegration'),
      storageRoot,
      encryption,
      undefined,
      { isZfsRequired: () => false } as any,
      spoolService
    );

    const relativePath = 'assets/rr10-large/large.mp4';
    envelopePath = join(storageRoot, relativePath);
    await mkdir(join(storageRoot, 'assets/rr10-large'), { recursive: true });
    const plaintext = Buffer.alloc(payloadSize, 0x5a);
    await writeFile(envelopePath, encryption.encrypt(plaintext));
    plaintext.fill(0);

    const asset = {
      id: 'rr10-large',
      name: 'large.mp4',
      storagePath: relativePath,
      type: 'video',
      storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
      audienceCommunityIds: [],
      audienceRestrictions: [],
      originKind: 'ordinary',
      originProfileId: null,
      originAppId: null,
    } as any;
    const appService = {
      retrieveAsset: jest.fn((query: { id: string }) =>
        Promise.resolve(
          query.id === 'rr10-private'
            ? {
                ...asset,
                id: query.id,
                audienceCommunityIds: ['private-community'],
              }
            : asset
        )
      ),
      openAuthenticatedMedia: jest.fn((record, options) =>
        adapter.openAuthenticatedMedia(record, options)
      ),
    };
    const configService = {
      get: (key: string) =>
        key === 'internalMediaToken'
          ? token
          : key === 'mediaMaxReadBytes'
          ? 64 * 1024 * 1024
          : undefined,
    };
    mediaService = new InternalMediaService(
      appService as any,
      configService as any
    );
    controller = new InternalMediaController(
      mediaService,
      configService as any
    );

    server = createServer((request, response) => {
      (response as any).status = (statusCode: number) => {
        response.statusCode = statusCode;
        return response;
      };
      const id = request.url?.split('?')[0]?.split('/').pop() || '';
      controller
        .stream(
          id,
          request.headers['x-internal-media-token'] as string | undefined,
          request.headers['x-internal-media-viewer'] as string | undefined,
          request.headers['x-internal-media-timestamp'] as string | undefined,
          request.headers['x-internal-media-signature'] as string | undefined,
          request.headers.range,
          response as any,
          request as any
        )
        .catch((error) => {
          if (response.headersSent || response.destroyed) {
            response.destroy();
            return;
          }
          response.statusCode =
            typeof error?.getStatus === 'function' ? error.getStatus() : 500;
          response.end();
        });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    if (server?.listening) {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
    await rm(root, { recursive: true, force: true });
  });

  it('serves authenticated >25MiB plaintext with exact full and byte-range lengths', async () => {
    const full = await fetch(`${origin}/internal/media/rr10-large`, {
      headers: { 'x-internal-media-token': token },
    });
    expect(full.status).toBe(200);
    expect(full.headers.get('content-length')).toBe(String(payloadSize));
    expect(full.headers.get('content-type')).toBe('video/mp4');
    const fullBytes = Buffer.from(await full.arrayBuffer());
    expect(fullBytes.length).toBe(payloadSize);
    expect(fullBytes[0]).toBe(0x5a);
    expect(fullBytes[payloadSize - 1]).toBe(0x5a);
    expect(fullBytes.includes(Buffer.from('OTENV1:'))).toBe(false);

    const range = await fetch(`${origin}/internal/media/rr10-large`, {
      headers: {
        'x-internal-media-token': token,
        range: 'bytes=1048576-1049599',
      },
    });
    expect(range.status).toBe(206);
    expect(range.headers.get('content-length')).toBe('1024');
    expect(range.headers.get('content-range')).toBe(
      `bytes 1048576-1049599/${payloadSize}`
    );
    const rangeBytes = Buffer.from(await range.arrayBuffer());
    expect(rangeBytes.length).toBe(1024);
    expect(rangeBytes.every((value) => value === 0x5a)).toBe(true);
  });

  it('denies missing gateway authorization with no response body', async () => {
    const denied = await fetch(`${origin}/internal/media/rr10-large`);
    expect(denied.status).toBe(403);
    expect(Buffer.from(await denied.arrayBuffer()).length).toBe(0);
  });

  it('does not open storage when private audience authorization is absent', async () => {
    const openMedia = jest.spyOn(adapter, 'openAuthenticatedMedia');
    const denied = await fetch(`${origin}/internal/media/rr10-private`, {
      headers: { 'x-internal-media-token': token },
    });
    expect(denied.status).toBe(404);
    expect(Buffer.from(await denied.arrayBuffer()).length).toBe(0);
    expect(openMedia).not.toHaveBeenCalled();
    openMedia.mockRestore();
  });

  it('releases no bytes when the stored GCM tag is corrupted', async () => {
    const validEnvelope = await readFile(envelopePath);
    const damaged = Buffer.from(validEnvelope);
    damaged[damaged.length - 1] ^= 0x01;
    await writeFile(envelopePath, damaged);
    const response = await fetch(`${origin}/internal/media/rr10-large`, {
      headers: { 'x-internal-media-token': token },
    });
    expect(response.status).toBe(503);
    expect(Buffer.from(await response.arrayBuffer()).length).toBe(0);
    await writeFile(envelopePath, validEnvelope);
  });

  it('releases no bytes when the envelope was encrypted under a different key', async () => {
    const validEnvelope = await readFile(envelopePath);
    const wrongKeyEnvelope = new EnvelopeEncryptionService({
      VAULT_STORAGE_KEK: 'another-isolated-test-key',
    }).encrypt(Buffer.alloc(1024, 0x2a));
    await writeFile(envelopePath, wrongKeyEnvelope);
    const response = await fetch(`${origin}/internal/media/rr10-large`, {
      headers: { 'x-internal-media-token': token },
    });
    expect(response.status).toBe(503);
    expect(Buffer.from(await response.arrayBuffer()).length).toBe(0);
    await writeFile(envelopePath, validEnvelope);
  });

  it('removes the verified spool after an HTTP client aborts mid-response', async () => {
    const abortController = new AbortController();
    const response = await fetch(`${origin}/internal/media/rr10-large`, {
      headers: { 'x-internal-media-token': token },
      signal: abortController.signal,
    });
    expect(response.status).toBe(200);
    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    const first = await reader!.read();
    expect(first.value?.byteLength).toBeGreaterThan(0);
    abortController.abort();
    await reader!.cancel().catch(() => undefined);

    const deadline = Date.now() + 5000;
    let remaining: string[] = [];
    do {
      remaining = await readdir(spoolService.processDirectory).catch(() => []);
      if (remaining.length === 0) break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    } while (Date.now() < deadline);
    expect(remaining).toEqual([]);
  });

  it('measures bounded RSS and plaintext disk size in an isolated child process', async () => {
    const largeBytes = 96 * 1024 * 1024;
    const largeEncryptedPath = join(root, 'resource-bound.otenv');
    const payload = Buffer.alloc(largeBytes, 0x36);
    await writeFile(largeEncryptedPath, encryption.encrypt(payload));
    payload.fill(0);
    const childSpoolRoot = join(root, 'child-spool');
    const execFile = promisify(execFileCallback);
    const childPath = join(__dirname, 'internal-media-spool.resource-child.ts');
    const { stdout } = await execFile(
      process.execPath,
      [
        '-r',
        'ts-node/register',
        '-r',
        'tsconfig-paths/register',
        childPath,
        largeEncryptedPath,
        childSpoolRoot,
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TS_NODE_PROJECT: join(process.cwd(), 'apps/assets/tsconfig.app.json'),
          VAULT_STORAGE_KEK: 'isolated-test-only-key-material',
        },
        maxBuffer: 1024 * 1024,
        timeout: 90_000,
      }
    );
    const metrics = JSON.parse(stdout) as {
      bytesRead: number;
      spoolBytes: number;
      rssDelta: number;
      spoolExistsAfterCleanup: boolean;
    };
    expect(metrics.bytesRead).toBe(largeBytes);
    expect(metrics.spoolBytes).toBe(largeBytes);
    expect(metrics.rssDelta).toBeLessThan(64 * 1024 * 1024);
    expect(metrics.spoolExistsAfterCleanup).toBe(false);
  }, 120_000);
});
