import { ClientProxy } from '@nestjs/microservices';
import { createHash, randomUUID } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { mkdtemp, readdir, readlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { of } from 'rxjs';
import { DataSource } from 'typeorm';
import { AccountExportOwnerSpoolService } from '@optimistic-tanuki/storage';
import loadDatabase from './loadDatabase';
import { Profile } from '../profiles/entities/profile.entity';
import {
  PROFILE_ACCOUNT_EXPORT_SOURCES,
  ProfileAccountExportOwnerService,
} from './account-export-owner.service';

// Unused local/network Storage adapters import ESM uuid. Export code stays real.
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));

const enabled =
  process.env.PROFILE_OWNER_PG_OPT_IN === 'profile_owner_j5_fixture' &&
  process.env.PROFILE_OWNER_PG_NAME === 'profile_owner_j5_fixture' &&
  process.env.PROFILE_OWNER_PG_HOST === '127.0.0.1' &&
  process.env.PROFILE_OWNER_PG_PORT === '15549' &&
  process.env.PROFILE_OWNER_PG_USER === 'owner_fixture' &&
  Boolean(process.env.PROFILE_OWNER_PG_PASSWORD);

// Generate an actual PNG whose encoded image spans several media chunks.
function pngFixture(): Buffer {
  const width = 256;
  const height = 128;
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let state = 0x12345678;
  for (let y = 0; y < height; y++) {
    for (let x = 1; x <= width * 3; x++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      raw[y * (width * 3 + 1) + x] = state >>> 24;
    }
  }
  const chunk = (type: string, bytes: Buffer): Buffer => {
    const body = Buffer.concat([Buffer.from(type), bytes]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4);
    length.writeUInt32BE(bytes.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, checksum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

(enabled ? describe : describe.skip)(
  'Profile owner real PostgreSQL staging and failure cleanup',
  () => {
    const accountId = 'a6a229d0-5c63-4b4d-8f31-a9b61dcc9164';
    const profileId = randomUUID();
    const png = pngFixture();
    const originalPic = `data:image/png;base64,${png.toString('base64')}`;
    let dataSource: DataSource;
    let owner: ProfileAccountExportOwnerService;
    const request = () => ({
      accountId,
      appId: 'client-interface',
      sessionToken: 'isolated-stub-auth-session',
    });

    beforeAll(async () => {
      dataSource = new DataSource({
        ...loadDatabase({
          get: () => ({
            host: process.env.PROFILE_OWNER_PG_HOST,
            port: Number(process.env.PROFILE_OWNER_PG_PORT),
            username: process.env.PROFILE_OWNER_PG_USER,
            password: process.env.PROFILE_OWNER_PG_PASSWORD,
            database: process.env.PROFILE_OWNER_PG_NAME,
          }),
        } as never),
        synchronize: false,
        migrationsRun: false,
      });
      await dataSource.initialize();
      await dataSource.runMigrations();
      owner = new ProfileAccountExportOwnerService(dataSource, {
        send: () =>
          of({
            isValid: true,
            data: { userId: accountId, appId: 'client-interface' },
          }),
      } as unknown as ClientProxy);
      await dataSource.getRepository(Profile).insert({
        id: profileId,
        userId: accountId,
        appScope: 'failure-fixture',
        profileName: 'isolated owner fixture',
        profilePic: originalPic,
        coverPic: '',
        bio: 'complete bio',
        location: '',
        occupation: '',
        interests: '',
        skills: '',
      });
    }, 30_000);

    afterEach(async () => {
      if (!dataSource?.isInitialized) return;
      await dataSource.query(
        'UPDATE "profile" SET "profilePic"=$1, "blogRole"=\'none\' WHERE "id"=$2::uuid',
        [originalPic, profileId]
      );
    });

    afterAll(async () => {
      if (!dataSource?.isInitialized) return;
      await dataSource.query(
        'DELETE FROM "profile" WHERE "id"=$1::uuid AND "userId"=$2',
        [profileId, accountId]
      );
      await dataSource.destroy();
    });

    async function storedFingerprint(): Promise<unknown> {
      return dataSource.query(
        `SELECT md5(row_to_json(p)::text) AS "sha" FROM "profile" p WHERE "id"=$1::uuid`,
        [profileId]
      );
    }

    it('stages the actual reader and reconstructs a multi-chunk image without changing its row', async () => {
      const before = await storedFingerprint();
      const handle = await new AccountExportOwnerSpoolService().capture(
        {
          participantId: 'profile',
          accountId,
          sources: PROFILE_ACCOUNT_EXPORT_SOURCES,
        },
        (onChunk, signal) =>
          owner.captureAccount({ ...request(), onChunk, signal })
      );
      try {
        const blocks: Buffer[] = [];
        for await (const block of handle.createReadStream())
          blocks.push(Buffer.from(block));
        const bytes = Buffer.concat(blocks);
        expect(bytes.length).toBe(handle.metadata.sizeBytes);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(
          handle.metadata.sha256
        );
        const pages = bytes
          .toString('utf8')
          .trimEnd()
          .split('\n')
          .map((line) => JSON.parse(line));
        const media = pages
          .flatMap((page) => page.records)
          .filter((record) => record.source === 'profileMedia');
        expect(media.length).toBeGreaterThan(1);
        expect(
          Buffer.concat(
            media.map((record) =>
              Buffer.from(record.data.bytesBase64, 'base64')
            )
          )
        ).toEqual(png);
        expect(media[0].data.sha256).toBe(
          createHash('sha256').update(png).digest('hex')
        );
        expect(pages.at(-1)).toMatchObject({
          complete: true,
          endOfStream: true,
        });
        expect(await storedFingerprint()).toEqual(before);
      } finally {
        await handle.cleanup();
      }
      await expect(handle.readChunk(0, 1)).rejects.toMatchObject({
        code: 'OWNER_SPOOL_CLOSED',
      });
    });

    it.each([
      'data:image/png;base64,AAAA',
      'data:image/jpeg;base64,iVBORw0KGgo=',
      'data:image/png;base64,not base64!',
      'DATA:image/png;base64,iVBORw0KGgo=',
    ])(
      'rejects invalid inline media with no terminal proof: %s',
      async (value) => {
        await dataSource.query(
          'UPDATE "profile" SET "profilePic"=$1 WHERE "id"=$2::uuid',
          [value, profileId]
        );
        let terminal = false;
        await expect(
          owner.captureAccount({
            ...request(),
            onChunk: async (chunk) => {
              terminal ||= chunk.endOfStream;
            },
          })
        ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
        expect(terminal).toBe(false);
      }
    );

    it('fails before reading oversized media and unsupported role text into the driver', async () => {
      await dataSource.query(
        `UPDATE "profile" SET "profilePic"='data:image/png;base64,' || repeat('A', 28 * 1024 * 1024) WHERE "id"=$1::uuid`,
        [profileId]
      );
      await expect(
        owner.captureAccount({ ...request(), onChunk: async () => undefined })
      ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
      await dataSource.query(
        `UPDATE "profile" SET "profilePic"='', "blogRole"=repeat('x', 1024 * 1024) WHERE "id"=$1::uuid`,
        [profileId]
      );
      await expect(
        owner.captureAccount({ ...request(), onChunk: async () => undefined })
      ).rejects.toMatchObject({ code: 'OWNER_READ_FAILED' });
    });

    it('rolls back on consumer rejection, caller abort and deadline with no terminal proof', async () => {
      const before = await storedFingerprint();
      for (const mode of ['sink', 'abort', 'deadline']) {
        const controller = new AbortController();
        let terminal = false;
        let enteredCallback = false;
        await expect(
          owner.captureAccount({
            ...request(),
            signal: controller.signal,
            captureTimeoutMs: mode === 'deadline' ? 1000 : undefined,
            onChunk: async (chunk, signal) => {
              enteredCallback = true;
              terminal ||= chunk.endOfStream;
              if (mode === 'sink') throw new Error('private sink diagnostic');
              if (mode === 'abort') controller.abort();
              if (mode === 'deadline' && !signal?.aborted)
                await new Promise<void>((resolve) =>
                  signal?.addEventListener('abort', () => resolve(), {
                    once: true,
                  })
                );
            },
          })
        ).rejects.toMatchObject({
          code:
            mode === 'sink'
              ? 'OWNER_STREAM_CONSUMER_FAILED'
              : mode === 'abort'
              ? 'OWNER_CAPTURE_ABORTED'
              : 'OWNER_CAPTURE_TIMEOUT',
        });
        expect(terminal).toBe(false);
        expect(enteredCallback).toBe(true);
        expect(await storedFingerprint()).toEqual(before);
      }
      const [state] = await dataSource.query(
        `SELECT count(*)::int AS "open" FROM pg_stat_activity WHERE datname=current_database() AND state='idle in transaction'`
      );
      expect(state.open).toBe(0);
    });

    it('cleans staging descriptors after the real owner fails following a staged write', async () => {
      const spoolRoot = await mkdtemp(join(tmpdir(), 'profile-owner-failure-'));
      const matchingDescriptors = async () => {
        const entries = await readdir('/proc/self/fd');
        const links = await Promise.all(
          entries.map(async (entry) => {
            try {
              return await readlink(`/proc/self/fd/${entry}`);
            } catch {
              return '';
            }
          })
        );
        return links.filter((link) =>
          link.startsWith(join(spoolRoot, 'ot-owner-spool-'))
        );
      };
      let stagedWriteObserved = false;
      try {
        expect(await matchingDescriptors()).toHaveLength(0);
        await expect(
          new AccountExportOwnerSpoolService().capture(
            {
              participantId: 'profile',
              accountId,
              sources: PROFILE_ACCOUNT_EXPORT_SOURCES,
              spoolRoot,
            },
            (onChunk, signal) =>
              owner.captureAccount({
                ...request(),
                signal,
                onChunk: async (chunk) => {
                  await onChunk(chunk);
                  stagedWriteObserved = true;
                  expect((await matchingDescriptors()).length).toBeGreaterThan(
                    0
                  );
                  throw new Error('injected owner sink failure after write');
                },
              })
          )
        ).rejects.toMatchObject({ code: 'OWNER_SPOOL_INVALID_CAPTURE' });
        expect(stagedWriteObserved).toBe(true);
        expect(await readdir(spoolRoot)).toEqual([]);
        expect(await matchingDescriptors()).toHaveLength(0);
      } finally {
        await rmdir(spoolRoot);
      }
    });
  }
);
