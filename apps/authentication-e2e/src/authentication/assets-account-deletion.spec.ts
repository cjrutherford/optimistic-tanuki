import { fork, ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:net';
import {
  chmod,
  mkdir,
  lstat,
  readFile,
  rm,
  stat,
  readdir,
  writeFile,
} from 'node:fs/promises';
import * as path from 'node:path';
import { Test } from '@nestjs/testing';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { DataSource } from 'typeorm';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionController } from '../../../authentication/src/account-deletion/account-deletion.controller';
import { AppService } from '../../../authentication/src/app/app.service';
import { AssetCommands } from '@optimistic-tanuki/constants';
import {
  AccountDeletionGrant,
  AccountDeletionIdentityDomains,
  AssetType,
  StorageStrategy,
} from '@optimistic-tanuki/models';
import {
  AccountDeletionAuthorityClient,
  AccountDeletionWriteFenceEntity,
  EnvelopeEncryptionService,
  LocalStorageAdapter,
  VerifiedMediaSpoolService,
  VerifiedMediaSpoolHandle,
} from '@optimistic-tanuki/storage';
import AssetEntity from '../../../assets/src/entities/asset.entity';
import { GuardianAssetActivity } from '../../../assets/src/entities/guardian-asset-activity.entity';
import { AssetMediaReadFenceService } from '../../../assets/src/app/asset-media-read-fence.service';
import { AssetsAuditErasureService } from '../../../assets/src/app/audit-erasure.service';
import { AssetsAccountDeletionOwnerService } from '../../../assets/src/app/account-deletion-owner.service';
import { AssetsAccountDeletionOwnerController } from '../../../assets/src/app/account-deletion-owner.controller';

jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
const gated = process.env['D00_PRIVATE_FIXTURE'] === 'd00-private-fixture';
(gated ? describe : describe.skip)(
  'D03 Assets owner with real PostgreSQL and Auth/Assets TCP',
  () => {
    const account = randomUUID(),
      other = randomUUID();
    const profile = randomUUID(),
      readerProfile = randomUUID(),
      counterpartProfile = randomUUID();
    const ownActive = randomUUID(),
      ownPending = randomUUID(),
      foreignAsset = randomUUID(),
      lateAsset = randomUUID();
    const auditOwn = randomUUID(),
      auditMixed = randomUUID();
    const tables = [
      'asset_entity',
      'guardian_asset_activity',
      'account_deletion_write_fence',
    ];
    const oldProofKey = process.env['ACCOUNT_DELETION_PROOF_KEY'];
    const oldStorageKey = process.env['VAULT_STORAGE_KEK'];
    const oldStorageKeyId = process.env['VAULT_STORAGE_KEK_ID'];
    const basePath = path.join(
      process.env['TMPDIR'] ?? '/tmp',
      `d03-assets-${randomUUID()}`
    );
    let mediaSpool: VerifiedMediaSpoolService,
      storage: LocalStorageAdapter,
      readFence: AssetMediaReadFenceService;
    let ownRead: VerifiedMediaSpoolHandle | undefined,
      foreignRead: VerifiedMediaSpoolHandle | undefined;
    let readerChild: ChildProcess | undefined,
      readerExit: Promise<unknown> | undefined;
    let childDescriptor: { path: string; processDirectory: string } | undefined;
    let authDb: DataSource,
      db: DataSource,
      authority: AccountDeletionAuthorityService;
    let authApp: any, assetsApp: any, authClient: any, assetsClient: any;
    let operationId: string,
      baseline: Record<string, number>,
      ownDto: any,
      pendingDto: any,
      foreignDto: any;
    let foreignCiphertext: Buffer;
    const scope: AccountDeletionIdentityDomains = {
      currentProfileIds: [profile, readerProfile].sort(),
      legacyProfileIds: [],
    };
    const assetCall = (cmd: string, grant: AccountDeletionGrant) =>
      firstValueFrom(
        assetsClient.send({ cmd }, grant).pipe(timeout(8000))
      ) as Promise<any>;
    const counts = async (source: DataSource) =>
      Object.fromEntries(
        await Promise.all(
          tables.map(async (table) => [
            table,
            (
              await source.query(
                `SELECT count(*)::int AS count FROM "${table}"`
              )
            )[0].count,
          ])
        )
      );
    const port = async () => {
      const server = createServer();
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
      );
      const address = server.address();
      if (!address || typeof address === 'string') throw Error('PORT');
      const result = address.port;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
      return result;
    };
    const authBaseline = async () => ({
      operations: Number(
        (
          await authDb.query(
            'SELECT count(*)::int AS count FROM account_deletion_operations'
          )
        )[0].count
      ),
      fences: Number(
        (
          await authDb.query(
            'SELECT count(*)::int AS count FROM account_deletion_write_fence'
          )
        )[0].count
      ),
    });
    let authCounts: { operations: number; fences: number } = {
      operations: 0,
      fences: 0,
    };

    beforeAll(async () => {
      await mkdir(basePath, { mode: 0o700 });
      process.env['ACCOUNT_DELETION_PROOF_KEY'] =
        randomBytes(48).toString('base64url');
      process.env['VAULT_STORAGE_KEK'] = randomBytes(32).toString('base64');
      process.env['VAULT_STORAGE_KEK_ID'] = `d03-${randomUUID()}`;
      const common = {
        type: 'postgres' as const,
        host: process.env['POSTGRES_HOST'],
        port: Number(process.env['POSTGRES_PORT']),
        username: process.env['POSTGRES_USER'],
        password: process.env['POSTGRES_PASSWORD'],
        synchronize: false,
        migrationsRun: false,
        extra: { statement_timeout: 10000, lock_timeout: 5000 },
      };
      authDb = new DataSource({
        ...common,
        database: process.env['POSTGRES_DB'],
        entities: [AccountDeletionOperationEntity],
      });
      db = new DataSource({
        ...common,
        database: process.env['D03_ASSETS_DB'] ?? 'd03_assets',
        entities: [
          AssetEntity,
          GuardianAssetActivity,
          AccountDeletionWriteFenceEntity,
        ],
      });
      await authDb.initialize();
      await db.initialize();
      baseline = await counts(db);
      authCounts = await authBaseline();
      authority = new AccountDeletionAuthorityService(
        authDb.getRepository(AccountDeletionOperationEntity),
        authDb
      );
      const authPort = await port();
      const authModule = await Test.createTestingModule({
        controllers: [AccountDeletionController],
        providers: [
          { provide: AccountDeletionAuthorityService, useValue: authority },
          {
            provide: AppService,
            useValue: {
              validateToken: () => {
                throw Error('UNEXPECTED_PUBLIC_AUTH');
              },
            },
          },
        ],
      }).compile();
      authApp = authModule.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: authPort },
        logger: false,
      });
      await authApp.listen();
      authClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: authPort },
      });
      const encryption = new EnvelopeEncryptionService();
      mediaSpool = new VerifiedMediaSpoolService(encryption, {
        spoolRoot: path.join(basePath, 'spools'),
        maxPlaintextBytes: 1048576,
        maxConcurrent: 2,
        spoolBudgetBytes: 2097152,
      });
      storage = new LocalStorageAdapter(
        {
          log: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        } as any,
        basePath,
        encryption,
        undefined,
        undefined,
        mediaSpool
      );
      const adapter = storage;
      readFence = new AssetMediaReadFenceService(db);
      const owner = new AssetsAccountDeletionOwnerService(
        db,
        new AccountDeletionAuthorityClient(authClient),
        adapter,
        new AssetsAuditErasureService(db),
        mediaSpool
      );
      const module = await Test.createTestingModule({
        controllers: [AssetsAccountDeletionOwnerController],
        providers: [
          { provide: AssetsAccountDeletionOwnerService, useValue: owner },
        ],
      }).compile();
      const assetsPort = await port();
      assetsApp = module.createNestMicroservice({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: assetsPort },
        logger: false,
      });
      await assetsApp.listen();
      assetsClient = ClientProxyFactory.create({
        transport: Transport.TCP,
        options: { host: '127.0.0.1', port: assetsPort },
      });
      expect(
        (
          await db.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public'"
          )
        )
          .map((row: any) => row.tablename)
          .sort()
      ).toEqual([...tables, 'migrations'].sort());
      // Fixture-only premise: this explicit profile scope is supplied by the root fixture, not discovered in Assets.
      const accepted = await authority.accept(
        account,
        'client-interface',
        randomUUID()
      );
      operationId = accepted.id;
      await authority.claim(operationId);
      const profileGrant = await authority.issueGrant(
        operationId,
        'profile',
        'fence'
      );
      await authority.recordProfileScope(profileGrant, scope);
      ownDto = await storage.create({
        id: ownActive,
        profileId: readerProfile,
        name: 'own active.png',
        type: AssetType.IMAGE,
        content: Buffer.from('own encrypted bytes'),
      } as any);
      pendingDto = await storage.create({
        id: ownPending,
        profileId: profile,
        name: 'own pending.png',
        type: AssetType.IMAGE,
        content: Buffer.from('pending encrypted bytes'),
      } as any);
      foreignDto = await storage.create({
        id: foreignAsset,
        profileId: counterpartProfile,
        name: 'foreign asset.png',
        type: AssetType.IMAGE,
        content: Buffer.from('foreign bytes'),
      } as any);
      foreignCiphertext = await readFile(
        path.join(basePath, foreignDto.storagePath)
      );
      // Reservation and creation use the real adapter; metadata is seeded from its returned DTO.
      expect(ownDto.storagePath).toBe(
        storage.reservationPath({
          id: ownActive,
          name: 'own active.png',
        } as any)
      );
      for (const dto of [ownDto, pendingDto, foreignDto])
        await db.query(
          'INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId","lifecycleState","originKind","originProfileId","originAppId") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [
            dto.id,
            dto.name,
            dto.type,
            dto.storageStrategy,
            dto.storagePath,
            dto.profileId,
            dto.id === ownPending ? 'pending-upload' : 'active',
            dto.id === ownActive ? 'guardian-staged' : 'ordinary',
            dto.id === ownActive ? readerProfile : null,
            dto.id === ownActive ? 'client-interface' : null,
          ]
        );
      await db.query(
        'INSERT INTO guardian_asset_activity (id,"actorUserId","dependentUserId","profileId","assetId","appId",operation,"changedFieldNames") VALUES ($1,$2,$3,$4,$5,\'client-interface\',\'upload\',\'["name"]\'::jsonb),($6,$3,$2,$7,$8,\'local-hub\',\'read\',\'["name"]\'::jsonb)',
        [
          auditOwn,
          other,
          account,
          readerProfile,
          ownActive,
          auditMixed,
          counterpartProfile,
          foreignAsset,
        ]
      );
      await authority.acknowledge(profileGrant);
    }, 30000);

    afterAll(async () => {
      try {
        await ownRead?.cleanup();
        await foreignRead?.cleanup();
        if (
          readerChild &&
          readerChild.exitCode === null &&
          readerChild.signalCode === null
        )
          readerChild.kill('SIGKILL');
        if (readerExit) await readerExit;
        await chmod(path.join(basePath, 'assets', ownActive), 0o700).catch(
          () => undefined
        );
        await chmod(path.join(basePath, 'assets', ownPending), 0o700).catch(
          () => undefined
        );
        if (db?.isInitialized) {
          await db.transaction(async (manager) => {
            await manager.query(
              "SELECT set_config('ot.deletion_operation',$1,true)",
              [operationId]
            );
            await manager.query(
              'DELETE FROM guardian_asset_activity WHERE id=ANY($1::uuid[])',
              [[auditOwn, auditMixed]]
            );
            await manager.query(
              'DELETE FROM asset_entity WHERE id=ANY($1::uuid[])',
              [[ownActive, ownPending, foreignAsset, lateAsset]]
            );
            await manager.query(
              'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
              [operationId]
            );
          });
          expect(await counts(db)).toEqual(baseline);
        }
        await rm(basePath, { recursive: true, force: true });
        if (authDb?.isInitialized && operationId) {
          await authDb.query(
            'DELETE FROM account_deletion_write_fence WHERE "operationId"=$1',
            [operationId]
          );
          await authDb.query(
            'DELETE FROM account_deletion_operations WHERE id=$1',
            [operationId]
          );
          expect(await authBaseline()).toEqual(authCounts);
        }
      } finally {
        assetsClient?.close();
        authClient?.close();
        await assetsApp?.close();
        await authApp?.close();
        if (db?.isInitialized) await db.destroy();
        if (authDb?.isInitialized) await authDb.destroy();
        if (oldProofKey === undefined)
          delete process.env['ACCOUNT_DELETION_PROOF_KEY'];
        else process.env['ACCOUNT_DELETION_PROOF_KEY'] = oldProofKey;
        if (oldStorageKey === undefined)
          delete process.env['VAULT_STORAGE_KEK'];
        else process.env['VAULT_STORAGE_KEK'] = oldStorageKey;
        if (oldStorageKeyId === undefined)
          delete process.env['VAULT_STORAGE_KEK_ID'];
        else process.env['VAULT_STORAGE_KEK_ID'] = oldStorageKeyId;
      }
    }, 30000);

    it('fences owned assets, drains a late writer, retries physical deletion, and verifies owner and audit redaction independently', async () => {
      const active = await db
        .getRepository(AssetEntity)
        .findOneByOrFail({ id: ownActive });
      const foreign = await db
        .getRepository(AssetEntity)
        .findOneByOrFail({ id: foreignAsset });
      ownRead = await readFence.open(
        active,
        { maxPlaintextBytes: 1048576 },
        () =>
          storage.openAuthenticatedMedia(active, { maxPlaintextBytes: 1048576 })
      );
      foreignRead = await readFence.open(
        foreign,
        { maxPlaintextBytes: 1048576 },
        () =>
          storage.openAuthenticatedMedia(foreign, {
            maxPlaintextBytes: 1048576,
          })
      );
      readerChild = fork(path.join(__dirname, 'd03-media-read.worker.ts'), [], {
        cwd: path.resolve(__dirname, '../../../..'),
        execArgv: [
          '-r',
          require.resolve('ts-node/register/transpile-only'),
          '-r',
          require.resolve('tsconfig-paths/register'),
        ],
        env: {
          ...process.env,
          TS_NODE_PROJECT: path.resolve(
            __dirname,
            '../../../../apps/assets/tsconfig.app.json'
          ),
          D03_ASSETS_DB: 'd03_assets',
          ASSET_READ_FIXTURE_ID: ownActive,
          ASSET_READ_FIXTURE_ROOT: basePath,
          ASSET_READ_FIXTURE_SPOOL_ROOT: path.join(basePath, 'spools'),
        },
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      readerExit = once(readerChild, 'exit');
      childDescriptor = await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('READ_CHILD_START_TIMEOUT')),
          15000
        );
        readerChild!.once('message', (message: any) => {
          clearTimeout(timer);
          if (message?.type === 'ready') resolve(message);
          else
            reject(
              new Error(
                typeof message?.message === 'string' &&
                /^[A-Z_]+$/.test(message.message)
                  ? message.message
                  : 'READ_CHILD_START_FAILED'
              )
            );
        });
        readerChild!.once('error', (error) => {
          clearTimeout(timer);
          reject(error);
        });
      });
      expect(await readdir(childDescriptor.processDirectory)).toEqual([]);
      const writer = db.createQueryRunner();
      await writer.connect();
      await writer.startTransaction();
      await writer.query(
        'INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId") VALUES ($1,$2,$3,$4,$5,$6)',
        [
          lateAsset,
          'late.png',
          AssetType.IMAGE,
          StorageStrategy.LOCAL_BLOCK_STORAGE,
          `assets/${lateAsset}/late.png`,
          profile,
        ]
      );
      const fenceGrant = await authority.issueGrant(
        operationId,
        'assets',
        'fence'
      );
      const fencing = assetCall(
        AssetCommands.FENCE_ACCOUNT_DELETION,
        fenceGrant
      ).then(
        (value) => ({ value }),
        (error) => ({ error })
      );
      try {
        let waiting = false;
        for (let i = 0; i < 40; i++) {
          const rows = await db.query(
            "SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory'"
          );
          if (rows[0].count > 0) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        expect(waiting).toBe(true);
        await writer.commitTransaction();
      } finally {
        if (writer.isTransactionActive) await writer.rollbackTransaction();
        await writer.release();
      }
      // The writer has drained, but both authenticated read leases still block the deletion fence.
      await ownRead!.cleanup();
      await expect(stat(ownRead!.path)).rejects.toMatchObject({
        code: 'ENOENT',
      });
      expect(readerChild!.exitCode).toBeNull();
      const childPath = childDescriptor!.path.replace(
        '/proc/self/',
        `/proc/${readerChild!.pid}/`
      );
      expect((await stat(childPath)).size).toBeGreaterThan(0);
      readerChild!.kill('SIGKILL');
      await readerExit;
      await expect(stat(childPath)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readdir(childDescriptor!.processDirectory)).toEqual([]);
      expect(await fencing).not.toHaveProperty('error');
      await authority.acknowledge(fenceGrant);
      expect(
        await db.query(
          'SELECT "lifecycleState" FROM asset_entity WHERE id=$1',
          [lateAsset]
        )
      ).toEqual([{ lifecycleState: 'pending-delete' }]);
      await expect(
        db.query(
          'INSERT INTO asset_entity (id,name,type,"storageStrategy","storagePath","profileId") VALUES ($1,$2,$3,$4,$5,$6)',
          [
            randomUUID(),
            'late insert.png',
            AssetType.IMAGE,
            StorageStrategy.LOCAL_BLOCK_STORAGE,
            'late',
            profile,
          ]
        )
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      await expect(
        db.query('UPDATE asset_entity SET "profileId"=$2 WHERE id=$1', [
          ownActive,
          counterpartProfile,
        ])
      ).rejects.toThrow('ACCOUNT_DELETION_FENCED');
      expect(
        (
          await db.query('SELECT id FROM asset_entity WHERE id=$1', [
            foreignAsset,
          ])
        ).length
      ).toBe(1);
      await expect(
        readFence.open(active, { maxPlaintextBytes: 1048576 }, () =>
          storage.openAuthenticatedMedia(active, { maxPlaintextBytes: 1048576 })
        )
      ).rejects.toThrow('ASSET_MEDIA_DELETION_FENCED');
      expect((await stat(foreignRead!.path)).size).toBeGreaterThan(0);
      // Explicit fixture precondition for non-participating owner receipts; this does not claim they ran.
      await authDb.query(
        'UPDATE account_deletion_operations SET "ownerProgress"=$2::jsonb WHERE id=$1',
        [
          operationId,
          JSON.stringify(
            Object.fromEntries(
              [
                'authentication',
                'profile',
                'assets',
                'videos',
                'permissions',
                'social',
                'forum',
                'workspace',
                'app-configurator',
                'chat-collector',
                'classifieds',
                'payments',
              ].map((owner) => [owner, { fence: true }])
            )
          ),
        ]
      );
      const ownErase = await authority.issueGrant(
        operationId,
        'assets',
        'erase'
      );
      const ownDir = path.join(basePath, 'assets', ownActive);
      await chmod(ownDir, 0o500);
      await expect(
        assetCall(AssetCommands.ERASE_ACCOUNT_DELETION, ownErase)
      ).rejects.toBeTruthy();
      expect(
        await db.query(
          'SELECT id,"lifecycleState" FROM asset_entity WHERE id=$1',
          [ownActive]
        )
      ).toEqual([{ id: ownActive, lifecycleState: 'pending-delete' }]);
      expect(
        (await readFile(path.join(ownDir, ownDto.name)))
          .subarray(0, 7)
          .toString()
      ).toBe('OTENV1:');
      await chmod(ownDir, 0o700);
      await assetCall(AssetCommands.ERASE_ACCOUNT_DELETION, ownErase);
      await expect(lstat(ownDir)).rejects.toMatchObject({ code: 'ENOENT' });
      const rows = await db.query('SELECT id FROM asset_entity ORDER BY id');
      expect(rows.map((row: any) => row.id)).toEqual([foreignAsset].sort());
      const audit = await db.query(
        'SELECT id,"actorUserId","dependentUserId","profileId","assetId","changedFieldNames" FROM guardian_asset_activity ORDER BY id'
      );
      expect(audit).toHaveLength(2);
      expect(audit).toEqual(
        expect.arrayContaining([
          {
            id: auditOwn,
            actorUserId: other,
            dependentUserId: null,
            profileId: null,
            assetId: null,
            changedFieldNames: [],
          },
          {
            id: auditMixed,
            actorUserId: null,
            dependentUserId: other,
            profileId: counterpartProfile,
            assetId: null,
            changedFieldNames: [],
          },
        ])
      );
      await authority.acknowledge(ownErase);
      const readGrant = await authority.issueGrant(
        operationId,
        'assets',
        'readback'
      );
      await assetCall(AssetCommands.READBACK_ACCOUNT_DELETION, readGrant);
      await authority.acknowledge(readGrant);
      await assetCall(AssetCommands.ERASE_ACCOUNT_DELETION, ownErase);
      expect(
        await db.query('SELECT count(*)::int AS count FROM asset_entity')
      ).toEqual([{ count: 1 }]);
      // Foreign asset bytes and mixed counterpart audit fields remain owned by their original identities.
      expect(
        await readFile(path.join(basePath, foreignDto.storagePath))
      ).toEqual(foreignCiphertext);
      expect(
        (
          await db.query(
            'SELECT "actorUserId","dependentUserId","profileId" FROM guardian_asset_activity WHERE id=$1',
            [auditMixed]
          )
        )[0]
      ).toEqual({
        actorUserId: null,
        dependentUserId: other,
        profileId: counterpartProfile,
      });
    }, 45000);
  }
);
