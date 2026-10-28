/** Full owner protocol: actual production modules, independent Node processes,
 * migrated PostgreSQL databases, real JWT/TCP/HTTP/Socket.IO and local bytes.
 * No fabricated participant acknowledgement or successful cleanup adapter. */
import { U03BrowserControls } from './u03-browser-controls';
import { fork, ChildProcess } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import {
  mkdir,
  readFile,
  writeFile,
  symlink,
  unlink,
  stat,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { DataSource, DataSourceOptions } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { Readable } from 'node:stream';
import {
  AccountExportArtifactStoreService,
  EnvelopeEncryptionService,
  ArtifactDescriptor,
} from '@optimistic-tanuki/storage';
import { verifyR2Runtime, verifyR2AfterDeletion } from './r2-runtime-controls';
import { runR4Journeys } from './r4-journeys';
import { runR6Release } from './r6-release';
import { io, Socket } from 'socket.io-client';
import {
  ACCOUNT_DELETION_OWNERS,
  AccountDeletionOwner,
  DELETED_ACCOUNT_ID,
} from '@optimistic-tanuki/models';
import { AuthCommands, AssetCommands } from '@optimistic-tanuki/constants';
import { AccountDeletionAuthorityService } from '../../../authentication/src/account-deletion/account-deletion-authority.service';
import { AccountDeletionOperationEntity } from '../../../authentication/src/account-deletion/account-deletion-operation.entity';
import {
  d27RegisteredDatabase,
  D27WorkerConfig,
  readD27WorkerConfig,
} from './d27-owner.worker';
jest.mock('uuid', () => ({ v4: () => require('node:crypto').randomUUID() }));
interface LiveOptions {
  root: string;
  base: D27WorkerConfig;
  extraAuth: { host: '127.0.0.1'; port: number };
  extraSocial: { host: '127.0.0.1'; port: number };
  gateways: Array<{ host: '127.0.0.1'; port: number }>;
}
interface Worker {
  child: ChildProcess;
  config: D27WorkerConfig;
  path: string;
  request: (type: string, value?: Record<string, unknown>) => Promise<any>;
}
const gated = process.env['D27_LIVE_FIXTURE'] === 'private-d27-otts-v1';
(gated ? describe : describe.skip)(
  'D27 full local twelve-owner recovery',
  () => {
    let settings: LiveOptions;
    const dbs = new Map<AccountDeletionOwner, DataSource>();
    const workers: Worker[] = [];
    const clients: ClientProxy[] = [];
    let ui: U03BrowserControls | undefined;
    const sockets: Socket[] = [];
    let rootWorker: Worker,
      extraAuth: Worker,
      readChild: ChildProcess | undefined;
    let operationId = '';
    const account = randomUUID(),
      profile = randomUUID(),
      profile2 = randomUUID(),
      other = randomUUID(),
      otherProfile = randomUUID();
    const ids: Record<string, string> = {};
    const tokens: Record<string, string> = {};
    const baseline = new Map<string, unknown>();
    let assetRoot = '',
      ownPath = '',
      otherPath = '',
      badLink = '';
    let authority: AccountDeletionAuthorityService;
    let artifactStore: AccountExportArtifactStoreService;
    const artifacts: Record<string, ArtifactDescriptor> = {};
    async function call(client: ClientProxy, cmd: string, value: unknown) {
      return firstValueFrom(client.send({ cmd }, value).pipe(timeout(25000)));
    }
    async function waitFor(predicate: () => Promise<boolean>, budget = 25000) {
      const deadline = Date.now() + budget;
      while (Date.now() < deadline) {
        if (await predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      throw Error('D27_OBSERVATION_TIMEOUT');
    }
    async function start(
      config: D27WorkerConfig,
      label: string,
      gateway = false
    ): Promise<Worker> {
      const path = join(settings.root, label + '.json');
      await mkdir(config.privateRoot, { recursive: true, mode: 0o700 });
      await writeFile(path, JSON.stringify(config), { mode: 0o600 });
      const output = createWriteStream(join(settings.root, label + '.log'), {
        mode: 0o600,
      });
      const child = fork(
        resolve(
          'apps/authentication-e2e/src/authentication',
          gateway ? 'd27-gateway.worker.ts' : 'd27-owner.worker.ts'
        ),
        [],
        {
          cwd: resolve('.'),
          execArgv: [
            '-r',
            'ts-node/register/transpile-only',
            '-r',
            'tsconfig-paths/register',
          ],
          env: {
            PATH: process.env['PATH'],
            HOME: process.env['HOME'],
            LANG: process.env['LANG'],
            TZ: process.env['TZ'],
            TMPDIR: config.privateRoot,
            TS_NODE_PREFER_TS_EXTS: 'true',
            TS_NODE_PROJECT: resolve(
              'apps/authentication-e2e/tsconfig.spec.json'
            ),
            D00_PRIVATE_FIXTURE: 'd00-private-fixture',
            D27_WORKER_CONFIG: path,
            CLAMAV_HOST:
              process.env['R4_JOURNEYS'] === '1'
                ? process.env['R4_CLAMAV_HOST']
                : undefined,
            CLAMAV_PORT:
              process.env['R4_JOURNEYS'] === '1'
                ? process.env['R4_CLAMAV_PORT']
                : undefined,
            R4_JOURNEYS: process.env['R4_JOURNEYS'] === '1' ? '1' : '0',
            R6_RELEASE: process.env['R6_RELEASE'] === '1' ? '1' : '0',
            R2_RETENTION_CONTROLS:
              process.env['R2_RETENTION_CONTROLS'] === '1' ? '1' : '0',
            U03_UI_CONTROLS: process.env['U03_UI_CONTROLS'] === '1' ? '1' : '0',
            OTEL_EXPORTER_OTLP_ENDPOINT: '',
            NODE_ENV: 'test',
          },
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        }
      );
      child.stdout?.pipe(output);
      child.stderr?.pipe(output);
      child.once('exit', () => output.end());
      const request = (type: string, value: Record<string, unknown> = {}) =>
        new Promise<any>((done, reject) => {
          const requestId = randomUUID();
          const timer = setTimeout(() => {
            cleanup();
            reject(Error('D27_WORKER_REQUEST_TIMEOUT'));
          }, 90000);
          const receive = (reply: any) => {
            if (reply.requestId !== requestId) return;
            cleanup();
            reply.type === 'result'
              ? done(reply.result)
              : reject(
                  Error('D27_WORKER_REQUEST_FAILED_' + label + '_' + type)
                );
          };
          const exit = () => {
            cleanup();
            reject(Error('D27_WORKER_EXIT'));
          };
          const cleanup = () => {
            clearTimeout(timer);
            child.off('message', receive);
            child.off('exit', exit);
          };
          child.on('message', receive);
          child.once('exit', exit);
          child.send({ type, requestId, ...value });
        });
      const worker = { child, config, path, request };
      workers.push(worker);
      await new Promise<void>((done, reject) => {
        const timer = setTimeout(() => {
          cleanup();
          reject(Error('D27_WORKER_BOOT_TIMEOUT_' + label));
        }, 45000);
        const receive = (message: any) => {
          if (message.type === 'ready') {
            cleanup();
            done();
          } else if (message.type === 'failed') {
            cleanup();
            reject(
              Error(
                'D27_WORKER_BOOT_' +
                  label +
                  '_' +
                  message.phase +
                  '_' +
                  message.kind +
                  '_' +
                  (message.code ?? '') +
                  '_' +
                  (message.dependency ?? '') +
                  '_' +
                  (message.index ?? '') +
                  '_' +
                  (message.locations ?? '')
              )
            );
          }
        };
        const exit = () => {
          cleanup();
          reject(Error('D27_WORKER_BOOT_EXIT_' + label));
        };
        const cleanup = () => {
          clearTimeout(timer);
          child.off('message', receive);
          child.off('exit', exit);
        };
        child.on('message', receive);
        child.once('exit', exit);
      });
      return worker;
    }
    async function seed(
      owner: AccountDeletionOwner,
      table: string,
      values: Record<string, unknown>
    ) {
      const db = dbs.get(owner)!;
      const meta = db.entityMetadatas.find(
        (value) => value.tableName === table
      );
      if (!meta)
        throw Error('D27_UNREGISTERED_SEED_TABLE_' + owner + '_' + table);
      const data: Record<string, unknown> = { id: randomUUID(), ...values };
      for (const column of meta.columns) {
        if (
          column.databaseName in data ||
          column.isNullable ||
          column.default !== undefined ||
          column.isGenerated ||
          column.isCreateDate ||
          column.isUpdateDate
        )
          continue;
        const type = column.type;
        data[column.databaseName] = column.enum
          ? column.enum[0]
          : type === 'uuid'
          ? randomUUID()
          : type === Boolean || type === 'boolean'
          ? false
          : type === Number ||
            ['integer', 'int', 'numeric', 'float', 'double precision'].includes(
              String(type)
            )
          ? 0
          : type === Date ||
            ['timestamp', 'timestamptz', 'date'].includes(String(type))
          ? new Date('2026-01-01')
          : ['json', 'jsonb'].includes(String(type))
          ? '{}'
          : type === 'simple-json'
          ? '[]'
          : type === 'simple-array'
          ? 'fixture'
          : 'fixture';
      }
      for (const [key, value] of Object.entries(data)) {
        const column = meta.columns.find((item) => item.databaseName === key);
        if (!column)
          throw Error('D27_UNKNOWN_SEED_COLUMN_' + table + '_' + key);
        if (Array.isArray(value))
          data[key] = column.isArray
            ? value
            : column.type === 'simple-array'
            ? value.join(',')
            : JSON.stringify(value);
        else if (
          value &&
          typeof value === 'object' &&
          !(value instanceof Date) &&
          !Buffer.isBuffer(value)
        )
          data[key] = JSON.stringify(value);
      }
      const keys = Object.keys(data);
      return (
        await db.query(
          `INSERT INTO "${table}" (${keys
            .map((key) => '"' + key + '"')
            .join(',')}) VALUES (${keys
            .map((_, i) => '$' + (i + 1))
            .join(',')}) RETURNING *`,
          Object.values(data)
        )
      )[0];
    }
    const row = async (
      owner: AccountDeletionOwner,
      table: string,
      id: string
    ) =>
      (
        await dbs
          .get(owner)!
          .query(`SELECT * FROM "${table}" WHERE id=$1`, [id])
      )[0];
    beforeAll(
      async () => {
        settings = JSON.parse(
          await readFile(process.env['D27_LIVE_OPTIONS'] ?? '', 'utf8')
        ) as LiveOptions;
        settings.base = readD27WorkerConfig(
          process.env['D27_BASE_CONFIG'] ?? ''
        );
        if (
          !resolve(settings.root).startsWith(
            resolve('.runtime-artifacts/account-rights/deletion') + '/'
          )
        )
          throw Error('D27_PRIVATE_ROOT_REQUIRED');
        for (const owner of ACCOUNT_DELETION_OWNERS) {
          const config = {
            ...settings.base,
            owner,
            database: {
              ...settings.base.database,
              database: 'd27_' + owner.replace(/-/g, '_'),
            },
          };
          const { options } = d27RegisteredDatabase(config);
          const db = new DataSource({
            ...options,
            ...config.database,
            type: 'postgres',
            synchronize: false,
            migrationsRun: false,
            logging: false,
            extra: {
              statement_timeout: 15000,
              lock_timeout: 5000,
              application_name: 'd27-observer-' + owner,
            },
          } as DataSourceOptions);
          await db.initialize();
          dbs.set(owner, db);
          for (const entry of await db.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'migrations'"
          )) {
            if (!/^[a-z_]+$/.test(entry.tablename))
              throw Error('D27_PHYSICAL_TABLE_INVALID');
            expect(
              (
                await db.query(
                  'SELECT count(*)::text n FROM "' + entry.tablename + '"'
                )
              )[0].n
            ).toBe('0');
          }
        }
        const auth = dbs.get('authentication')!;
        for (const [id, p, name] of [
          [account, profile, 'OWN_PRIVATE'],
          [other, otherProfile, 'COUNTERPART'],
        ] as const) {
          await auth.query(
            'INSERT INTO user_entity(id,email,"firstName","lastName",password,bio,"ageEligibilityStatus") VALUES($1,$2,$3::text,$3::text,$3::text,$3::text,\'adult\')',
            [id, id + '@example.test', name]
          );
          const kid = randomUUID();
          await auth.query(
            'INSERT INTO key_datum(id,public,salt,"userId") VALUES($1,$2,$3,$4)',
            [kid, Buffer.from(name), name, id]
          );
          await auth.query(
            'UPDATE user_entity SET "keyDataId"=$2 WHERE id=$1',
            [id, kid]
          );
          ids[id === account ? 'ownKey' : 'otherKey'] = kid;
          await seed('profile', 'profile', {
            id: p,
            userId: id,
            appScope: 'local-hub',
            profileName: name,
          });
          await seed('authentication', 'oauth_provider', {
            userId: id,
            provider: 'google',
            providerUserId: randomUUID(),
          });
        }
        await seed('profile', 'profile', {
          id: profile2,
          userId: account,
          appScope: 'client-interface',
          profileName: 'OWN_PRIVATE_OT',
        });
        const jwt = new JwtService({ secret: settings.base.jwtSecret });
        for (const [key, a, p, appId] of [
          ['ownTs', account, profile, 'local-hub'],
          ['ownOt', account, profile2, 'client-interface'],
          ['other', other, otherProfile, 'local-hub'],
        ] as const) {
          tokens[key] = jwt.sign(
            {
              userId: a,
              profileId: p,
              appId,
              name: a === account ? 'OWN_PRIVATE' : 'COUNTERPART',
              email: a + '@example.test',
            },
            { expiresIn: '1h' }
          );
          const token = await seed('authentication', 'token', {
            userId: a,
            profileId: p,
            tokenData: tokens[key],
          });
          ids[key + 'Session'] = token.id;
        }
        if (process.env['R2_RETENTION_CONTROLS'] === '1') {
          const old = await seed('social', 'activity', {
            profileId: profile,
            type: 'post',
            description: 'R2_OLD_ACTIVITY',
            createdAt: new Date(Date.now() - 91 * 86400000),
          });
          ids['r2OldActivity'] = old.id;
        }
        assetRoot = join(settings.root, 'runtime', 'assets', 'assets');
        await mkdir(assetRoot, { recursive: true, mode: 0o700 });
        await mkdir(join(assetRoot, 'spools'), { mode: 0o700 });
        for (const [name, p] of [
          ['ownAsset', profile],
          ['otherAsset', otherProfile],
        ] as const) {
          const id = randomUUID();
          const relative = 'assets/' + id + '/pixel.png';
          const path = join(assetRoot, relative);
          await mkdir(join(assetRoot, 'assets', id), {
            recursive: true,
            mode: 0o700,
          });
          await writeFile(
            path,
            new EnvelopeEncryptionService({
              VAULT_STORAGE_KEK: settings.base.proofKey,
            }).encrypt(
              Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lfoAAAAASUVORK5CYII=',
                'base64'
              )
            ),
            { mode: 0o600 }
          );
          await seed('assets', 'asset_entity', {
            id,
            name: 'pixel.png',
            storagePath: relative,
            profileId: p,
          });
          ids[name] = id;
          if (name === 'ownAsset') ownPath = path;
          else otherPath = path;
        }
        badLink = join(assetRoot, 'assets', ids['ownAsset'], 'outside');
        await seed('social', 'search_history', {
          profileId: profile,
          query: 'OWN_PRIVATE_QUERY',
        });
        await seed('social', 'search_history', {
          profileId: otherProfile,
          query: 'COUNTERPART_QUERY',
        });
        const post = await seed('social', 'post', {
          userId: account,
          profileId: profile,
          content: 'OWN_PRIVATE_POST',
          appScope: 'local-hub',
        });
        ids['socialOwnPost'] = post.id;
        const comment = await seed('social', 'comment', {
          userId: other,
          profileId: otherProfile,
          postId: post.id,
          content: 'COUNTERPART_REPLY',
          appScope: 'local-hub',
        });
        ids['socialReply'] = comment.id;
        const foreignPost = await seed('social', 'post', {
          userId: other,
          profileId: otherProfile,
          content: 'COUNTERPART_POST',
          appScope: 'local-hub',
        });
        ids['socialForeignPost'] = foreignPost.id;
        baseline.set('socialForeignPost', foreignPost);
        const topic = await seed('forum', 'topic', {
          userId: account,
          profileId: profile,
          title: 'OWN_PRIVATE_TOPIC',
          description: 'OWN_PRIVATE',
          appScope: 'local-hub',
        });
        const thread = await seed('forum', 'thread', {
          userId: account,
          profileId: profile,
          topicId: topic.id,
          title: 'OWN_PRIVATE_THREAD',
          content: 'OWN_PRIVATE',
          appScope: 'local-hub',
        });
        ids['forumReply'] = (
          await seed('forum', 'forum_post', {
            userId: other,
            profileId: otherProfile,
            threadId: thread.id,
            content: 'COUNTERPART_FORUM_REPLY',
            appScope: 'local-hub',
          })
        ).id;
        const scope = await seed('permissions', 'app_scope', {
          name: 'local-hub',
          description: 'shared',
        });
        const role = await seed('permissions', 'role', {
          name: 'd27-shared-role',
          description: 'shared',
          appScopeId: scope.id,
        });
        ids['ownRole'] = (
          await seed('permissions', 'role_assignment', {
            profileId: profile,
            roleId: role.id,
            appScopeId: scope.id,
          })
        ).id;
        ids['otherRole'] = (
          await seed('permissions', 'role_assignment', {
            profileId: otherProfile,
            roleId: role.id,
            appScopeId: scope.id,
          })
        ).id;
        for (const [prefix, a, p] of [
          ['own', account, profile],
          ['other', other, otherProfile],
        ] as const) {
          const workspace = await seed('workspace', 'workspaces', {
            kind: 'community',
            slug: prefix + '-' + randomUUID(),
            displayName: prefix + ' workspace',
            appScope: 'local-hub',
            ownerUserId: a,
            ownerProfileId: p,
            sourceService: 'app-configurator',
            sourceId: p,
            status: 'active',
          });
          ids[prefix + 'Workspace'] = workspace.id;
          const instance = await seed('app-configurator', 'app_instances', {
            workspaceId: workspace.id,
            appScope: 'local-hub',
            ownerUserId: a,
            ownerProfileId: p,
            status: 'active',
          });
          ids[prefix + 'Instance'] = instance.id;
          await seed('app-configurator', 'app_memberships', {
            workspaceId: workspace.id,
            appInstanceId: instance.id,
            appScope: 'local-hub',
            userId: a,
            profileId: p,
            role: 'owner',
            status: 'active',
          });
          const ad = await seed('classifieds', 'classified_ad', {
            title: prefix + ' ad',
            description: prefix + ' description',
            userId: a,
            profileId: p,
            appScope: 'local-hub',
          });
          ids[prefix + 'Ad'] = ad.id;
          if (prefix === 'other') baseline.set('otherAd', ad);
          const wallet = await seed('payments', 'seller_wallets', {
            sellerId: a,
            availableBalance: '19.00',
            payoutEmail: prefix + '@example.test',
          });
          ids[prefix + 'Wallet'] = wallet.id;
          if (prefix === 'other') baseline.set('otherWallet', wallet);
          await seed('payments', 'donations', {
            userId: a,
            profileId: p,
            amount: '5.00',
            message: prefix + ' donation',
          });
        }
        await seed('app-configurator', 'app_configuration_entity', {
          name: 'OWN_PRIVATE_CONFIGURATION',
          workspaceId: ids['ownWorkspace'],
          appInstanceId: ids['ownInstance'],
          ownerUserId: account,
          ownerProfileId: profile,
          appScope: 'local-hub',
          landingPage: { text: 'OWN_PRIVATE_CONFIGURATION_PAYLOAD' },
        });
        if (!settings.base.artifactRoot)
          throw Error('D27_SHARED_ARTIFACT_ROOT_REQUIRED');
        artifactStore = new AccountExportArtifactStoreService(
          new EnvelopeEncryptionService({
            VAULT_STORAGE_KEK: settings.base.proofKey,
          }),
          { root: settings.base.artifactRoot }
        );
        for (const [key, a] of [
          ['own', account],
          ['other', other],
        ] as const) {
          const bytes = Buffer.from(
            key === 'own' ? 'OWN_PRIVATE_ARTIFACT' : 'COUNTERPART_ARTIFACT'
          );
          const jobId = randomUUID();
          const descriptor = await artifactStore.put({
            artifactId: randomUUID(),
            jobId,
            accountId: a,
            appId: 'local-hub',
            attempt: 1,
            expiresAt: '2099-01-01T00:00:00.000Z',
            sizeBytes: bytes.length,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            stream: Readable.from([bytes]),
          });
          artifacts[key] = descriptor;
          await seed('authentication', 'account_export_jobs', {
            id: jobId,
            accountId: a,
            appId: 'local-hub',
            kind: 'export',
            idempotencyKey: randomUUID(),
            state: 'complete',
            attempt: 1,
            coverageSummary: {
              blockers: [],
              artifactAvailable: true,
              privateArtifact: descriptor,
              artifactReady: true,
            },
          });
        }
        ids['outOfScopeAd'] = (
          await seed('classifieds', 'classified_ad', {
            title: 'unaccepted fixture scope',
            description: 'must not be erased by OT/TS adapter',
            userId: account,
            profileId: profile,
            appScope: 'unaccepted-fixture-scope',
          })
        ).id;
        ids['sharedMembership'] = (
          await seed('app-configurator', 'app_memberships', {
            workspaceId: ids['ownWorkspace'],
            appInstanceId: ids['ownInstance'],
            appScope: 'local-hub',
            userId: other,
            profileId: otherProfile,
            role: 'member',
            status: 'active',
          })
        ).id;
        const conv = await seed('chat-collector', 'conversation', {
          title: 'OWN_PRIVATE_CONVERSATION',
          ownerId: profile,
          participants: [profile, otherProfile],
        });
        ids['conversation'] = conv.id;
        ids['ownMessage'] = (
          await seed('chat-collector', 'message', {
            senderId: profile,
            content: 'OWN_PRIVATE_MESSAGE',
            recipients: [otherProfile],
            conversationId: conv.id,
          })
        ).id;
        ids['otherMessage'] = (
          await seed('chat-collector', 'message', {
            senderId: otherProfile,
            content: 'COUNTERPART_MESSAGE',
            recipients: [profile],
            conversationId: conv.id,
          })
        ).id;
        ids['payment'] = (
          await seed('payments', 'classified_payments', {
            classifiedId: ids['ownAd'],
            buyerId: account,
            sellerId: other,
            amount: '20.00',
            platformFeeAmount: '1.00',
            sellerReceivesAmount: '19.00',
            paymentIntentId: 'OWN_PRIVATE_PROVIDER',
            proofImageUrl: 'OWN_PRIVATE_PROOF',
            disputeReason: 'OWN_PRIVATE_DISPUTE',
          })
        ).id;
        baseline.set(
          'otherProfile',
          await row('profile', 'profile', otherProfile)
        );
        baseline.set(
          'otherMediaHash',
          createHash('sha256')
            .update(await readFile(otherPath))
            .digest('hex')
        );
        const base = (
          owner: AccountDeletionOwner,
          listen: LiveOptions['extraAuth'],
          label: string
        ) => ({
          ...settings.base,
          owner,
          listen,
          database: {
            ...settings.base.database,
            database: 'd27_' + owner.replace(/-/g, '_'),
          },
          privateRoot: join(settings.root, 'runtime', label),
        });
        extraAuth = await start(
          base('authentication', settings.extraAuth, 'auth-extra'),
          'auth-extra'
        );
        for (const owner of ACCOUNT_DELETION_OWNERS.filter(
          (value) => value !== 'authentication'
        ))
          await start(
            base(owner, settings.base.endpoints[owner], owner),
            owner
          );
        await start(
          base('social', settings.extraSocial, 'social-extra'),
          'social-extra'
        );
        rootWorker = await start(
          base(
            'authentication',
            settings.base.endpoints['authentication'],
            'auth-primary'
          ),
          'auth-primary'
        );
        for (let i = 0; i < settings.gateways.length; i++)
          await start(
            base('authentication', settings.gateways[i], 'gateway-' + i),
            'gateway-' + i,
            true
          );
        authority = new AccountDeletionAuthorityService(
          auth.getRepository(AccountDeletionOperationEntity),
          auth
        );
        process.env['ACCOUNT_DELETION_PROOF_KEY'] = settings.base.proofKey;
        for (const worker of [
          extraAuth,
          workers.find((value) =>
            value.config.privateRoot.endsWith('social-extra')
          )!,
        ])
          for (const id of [account, other])
            await worker.request('seed-spool', { accountId: id });
      },
      process.env['U03_UI_CONTROLS'] === '1' ? 400000 : 150000
    );
    afterAll(async () => {
      await ui?.close();
      for (const socket of sockets) socket.disconnect();
      if (
        readChild &&
        readChild.exitCode === null &&
        readChild.signalCode === null
      ) {
        readChild.send('close');
        await new Promise<void>((done) => {
          const timer = setTimeout(() => {
            readChild?.kill('SIGKILL');
            done();
          }, 5000);
          readChild!.once('exit', () => {
            clearTimeout(timer);
            done();
          });
        });
      }
      for (const worker of [...workers].reverse()) {
        if (
          worker.child.exitCode === null &&
          worker.child.signalCode === null
        ) {
          const ended = new Promise<void>((done) => {
            const timer = setTimeout(() => {
              worker.child.kill('SIGKILL');
              done();
            }, 8000);
            worker.child.once('exit', () => {
              clearTimeout(timer);
              done();
            });
          });
          if (worker.child.connected)
            worker.child.send({ type: 'close' }, () => undefined);
          await ended;
        }
        await unlink(worker.path).catch(() => undefined);
      }
      for (const client of clients) client.close();
      for (const db of dbs.values()) {
        if (!db.isInitialized) continue;
        try {
          const tables = await db.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'migrations'"
          );
          if (
            tables.some(
              (table: { tablename: string }) =>
                !/^[a-z_]+$/.test(table.tablename)
            )
          )
            throw Error('D27_CLEANUP_IDENTIFIER');
          if (tables.length)
            await db.query(
              'TRUNCATE ' +
                tables
                  .map(
                    (table: { tablename: string }) =>
                      '"' + table.tablename + '"'
                  )
                  .join(',') +
                ' CASCADE'
            );
        } finally {
          await db.destroy();
        }
      }
    }, 90000);
    it(
      'recovers from a killed coordinator, source custody failure, and post-Profile Auth failure without fabricated acknowledgements',
      async () => {
        const auth = ClientProxyFactory.create({
          transport: Transport.TCP,
          options: settings.base.endpoints['authentication'],
        });
        clients.push(auth);
        const authReplica = ClientProxyFactory.create({
          transport: Transport.TCP,
          options: settings.extraAuth,
        });
        clients.push(authReplica);
        for (const [key, appId] of [
          ['ownTs', 'local-hub'],
          ['ownOt', 'client-interface'],
          ['other', 'local-hub'],
        ] as const)
          expect(
            (
              await call(auth, AuthCommands.Validate, {
                token: tokens[key],
                userId: key === 'other' ? other : account,
                appId,
              })
            ).isValid
          ).toBe(true);
        if (process.env['R6_RELEASE'] === '1') {
          await runR6Release({ settings, dbs, account, other, tokens });
          return;
        }
        if (process.env['R4_JOURNEYS'] === '1') {
          await runR4Journeys({
            settings,
            dbs,
            workers,
            account,
            profile,
            profile2,
            other,
            otherProfile,
            ids,
            tokens,
            seed,
          });
          return;
        }
        if (process.env['R2_RETENTION_CONTROLS'] === '1')
          await verifyR2Runtime({
            settings,
            dbs,
            workers,
            auth,
            authReplica,
            account,
            profile,
            profile2,
            other,
            otherProfile,
            ids,
            tokens,
          });
        if (process.env['U03_UI_CONTROLS'] === '1') {
          ui = new U03BrowserControls(
            settings.root,
            account,
            [profile, profile2],
            tokens
          );
          try {
            await ui.openAndExport();
          } catch (error) {
            const jobs = await dbs
              .get('authentication')!
              .query(
                `SELECT state,"lastErrorCode","coverageSummary"->'blockers' blockers,"coverageSummary"->'capturedDatabaseOwners' captured FROM account_export_jobs ORDER BY "createdAt"`
              );
            await writeFile(
              join(settings.root, 'u03-export-diagnostic.json'),
              JSON.stringify({ jobs }, null, 2)
            );
            throw error;
          }
        }
        const gateways = workers.filter((worker) =>
          worker.config.privateRoot.includes('/gateway-')
        );
        for (const gateway of gateways) {
          await gateway.request('seed', {
            accountId: account,
            profileId: profile,
            sessionId: ids['ownTsSession'],
          });
          await gateway.request('seed', {
            accountId: other,
            profileId: otherProfile,
            sessionId: ids['otherSession'],
          });
          for (const [token, accountKey] of [
            [tokens['ownTs'], 'own'],
            [tokens['other'], 'other'],
          ] as const)
            for (const namespace of ['chat', 'social']) {
              const socket = io(
                'http://127.0.0.1:' +
                  gateway.config.listen.port +
                  '/' +
                  namespace,
                {
                  transports: ['websocket'],
                  reconnection: false,
                  extraHeaders: {
                    origin: 'http://127.0.0.1:19081',
                    cookie: 'ot_session=' + token,
                  },
                }
              );
              sockets.push(socket);
              await new Promise<void>((done, reject) => {
                const timer = setTimeout(
                  () => reject(Error('D27_SOCKET_AUTH_TIMEOUT_' + accountKey)),
                  10000
                );
                socket.once('private-ready', () => {
                  clearTimeout(timer);
                  done();
                });
                socket.once('connect_error', () => {
                  clearTimeout(timer);
                  reject(Error('D27_SOCKET_AUTH_FAILED'));
                });
              });
              (socket as any).fixtureAccount = accountKey;
            }
        }
        const mediaOutput = createWriteStream(
          join(settings.root, 'media-read-child.log'),
          { mode: 0o600 }
        );
        const env: NodeJS.ProcessEnv = {
          PATH: process.env['PATH'],
          HOME: process.env['HOME'],
          D00_PRIVATE_FIXTURE: 'd00-private-fixture',
          POSTGRES_HOST: '127.0.0.1',
          POSTGRES_PORT: String(settings.base.database.port),
          POSTGRES_USER: 'd00',
          POSTGRES_PASSWORD: settings.base.database.password,
          D03_ASSETS_DB: 'd27_assets',
          ASSET_READ_FIXTURE_ID: ids['ownAsset'],
          ASSET_READ_FIXTURE_ROOT: assetRoot,
          ASSET_READ_FIXTURE_SPOOL_ROOT: join(assetRoot, 'spools'),
          VAULT_STORAGE_KEK: settings.base.proofKey,
          TS_NODE_PREFER_TS_EXTS: 'true',
          TS_NODE_PROJECT: resolve(
            'apps/authentication-e2e/tsconfig.spec.json'
          ),
        };
        readChild = fork(
          resolve(
            'apps/authentication-e2e/src/authentication/d03-media-read.worker.ts'
          ),
          [],
          {
            execArgv: [
              '-r',
              'ts-node/register/transpile-only',
              '-r',
              'tsconfig-paths/register',
            ],
            env,
            stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
          }
        );
        readChild.stdout?.pipe(mediaOutput);
        readChild.stderr?.pipe(mediaOutput);
        readChild.once('exit', () => mediaOutput.end());
        await new Promise<void>((done, reject) => {
          const timer = setTimeout(
            () => reject(Error('D27_MEDIA_READER_TIMEOUT')),
            15000
          );
          readChild!.once('message', (message: any) => {
            clearTimeout(timer);
            message.type === 'ready'
              ? done()
              : reject(
                  Error(
                    'D27_MEDIA_READER_FAILED_' +
                      (/^[A-Z0-9_]+$/.test(message.message)
                        ? message.message
                        : 'UNKNOWN')
                  )
                );
          });
        });
        await symlink(otherPath, badLink);
        const created = ui
          ? { operationId: await ui.acceptDeletion() }
          : await call(auth, AuthCommands.CreateAccountDeletionOperation, {
              token: tokens['ownTs'],
              appId: 'local-hub',
              idempotencyKey: randomUUID(),
              confirmation: 'delete-account',
            });
        operationId = created.operationId;
        expect(typeof operationId).toBe('string');
        await waitFor(
          async () =>
            Number(
              (
                await dbs
                  .get('assets')!
                  .query(
                    "SELECT count(*)::text n FROM pg_stat_activity WHERE datname='d27_assets' AND application_name LIKE 'd27-assets-%' AND wait_event_type='Lock'"
                  )
              )[0].n
            ) > 0
        );
        const oldGrant = await authority.issueGrant(
          operationId,
          'assets',
          'fence'
        );
        rootWorker.child.kill('SIGKILL');
        await new Promise<void>((done) =>
          rootWorker.child.once('exit', () => done())
        );
        expect(
          (
            await dbs
              .get('authentication')!
              .query('SELECT count(*)::text n FROM user_entity WHERE id=$1', [
                account,
              ])
          )[0].n
        ).toBe('1');
        expect(await stat(ownPath)).toBeTruthy();
        for (const key of ['ownTs', 'ownOt'])
          await expect(
            call(authReplica, AuthCommands.Validate, {
              token: tokens[key],
              userId: account,
              appId: key === 'ownTs' ? 'local-hub' : 'client-interface',
            })
          ).rejects.toBeTruthy();
        readChild.send('close');
        await new Promise<void>((done) =>
          readChild!.once('exit', () => done())
        );
        await dbs
          .get('authentication')!
          .query(
            'UPDATE account_deletion_operations SET "leaseExpiresAt"=clock_timestamp()-interval \'1 second\',"updatedAt"=clock_timestamp()-interval \'40 seconds\' WHERE id=$1',
            [operationId]
          );
        rootWorker = await start(
          { ...rootWorker.config, workerEnabled: true },
          'auth-restarted'
        );
        const assets = ClientProxyFactory.create({
          transport: Transport.TCP,
          options: settings.base.endpoints['assets'],
        });
        clients.push(assets);
        await expect(
          call(assets, AssetCommands.FENCE_ACCOUNT_DELETION, oldGrant)
        ).rejects.toBeTruthy();
        await waitFor(
          async () =>
            Number(
              (
                await dbs
                  .get('authentication')!
                  .query(
                    'SELECT attempt FROM account_deletion_operations WHERE id=$1',
                    [operationId]
                  )
              )[0].attempt
            ) > oldGrant.attempt
        );
        expect(Date.parse(oldGrant.expiresAt)).toBeGreaterThan(Date.now());
        await expect(
          call(assets, AssetCommands.FENCE_ACCOUNT_DELETION, oldGrant)
        ).rejects.toBeTruthy();
        await waitFor(async () => {
          const value = (
            await dbs
              .get('authentication')!
              .query(
                'SELECT state,"leaseOwner" FROM account_deletion_operations WHERE id=$1',
                [operationId]
              )
          )[0];
          return value.state === 'blocked' && value.leaseOwner === null;
        });
        let ledger = (
          await dbs
            .get('authentication')!
            .query('SELECT * FROM account_deletion_operations WHERE id=$1', [
              operationId,
            ])
        )[0];
        expect(ledger.state).toBe('blocked');
        expect(ledger.ownerProgress._blocker).toBe(
          'classifieds-fence-unverified'
        );
        expect(ledger.ownerProgress.classifieds?.fence).not.toBe(true);
        expect(
          await row('classifieds', 'classified_ad', ids['outOfScopeAd'])
        ).toBeTruthy();
        expect(
          (
            await dbs
              .get('authentication')!
              .query('SELECT count(*)::text n FROM key_datum WHERE id=$1', [
                ids['ownKey'],
              ])
          )[0].n
        ).toBe('1');
        // Correct the deliberately unsupported fixture inventory; this is NOT app cleanup of another product.
        await dbs
          .get('classifieds')!
          .query('DELETE FROM classified_ad WHERE id=$1', [
            ids['outOfScopeAd'],
          ]);
        if (ui) {
          const beforeAttempt = Number(
            (
              await dbs
                .get('authentication')!
                .query(
                  'SELECT attempt FROM account_deletion_operations WHERE id=$1',
                  [operationId]
                )
            )[0].attempt
          );
          await ui.retry();
          await waitFor(async () => {
            const observed = (
              await dbs
                .get('authentication')!
                .query(
                  'SELECT state,attempt,"leaseOwner" FROM account_deletion_operations WHERE id=$1',
                  [operationId]
                )
            )[0];
            return (
              Number(observed.attempt) > beforeAttempt &&
              observed.state === 'blocked' &&
              observed.leaseOwner === null
            );
          });
        } else await rootWorker.request('run', { operationId });
        ledger = (
          await dbs
            .get('authentication')!
            .query('SELECT * FROM account_deletion_operations WHERE id=$1', [
              operationId,
            ])
        )[0];
        expect(ledger.state).toBe('blocked');
        await writeFile(
          join(settings.root, 'blocked-progress.json'),
          JSON.stringify(
            {
              blocker: ledger.ownerProgress._blocker,
              missingFences: ACCOUNT_DELETION_OWNERS.filter(
                (owner) => ledger.ownerProgress[owner]?.fence !== true
              ),
            },
            null,
            2
          )
        );
        expect(
          ACCOUNT_DELETION_OWNERS.filter(
            (owner) => ledger.ownerProgress[owner]?.fence !== true
          )
        ).toEqual([]);
        expect(
          (
            await dbs
              .get('authentication')!
              .query('SELECT count(*)::text n FROM key_datum WHERE id=$1', [
                ids['ownKey'],
              ])
          )[0].n
        ).toBe('1');
        expect(await stat(ownPath)).toBeTruthy();
        await expect(
          seed('social', 'post', {
            userId: account,
            profileId: profile,
            content: 'LATE_PRIVATE_WRITE',
            appScope: 'local-hub',
          })
        ).rejects.toThrow();
        await unlink(badLink);
        const authDb = dbs.get('authentication')!;
        await authDb.query(
          "CREATE FUNCTION d27_stop_auth_root() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF OLD.id::text=TG_ARGV[0] THEN RAISE EXCEPTION 'PRIVATE_ROOT_FAILURE'; END IF; RETURN OLD; END $$"
        );
        await authDb.query(
          `CREATE TRIGGER d27_stop_auth_root BEFORE DELETE ON user_entity FOR EACH ROW EXECUTE FUNCTION d27_stop_auth_root('${account}')`
        );
        if (ui) {
          const beforeAttempt = Number(
            (
              await dbs
                .get('authentication')!
                .query(
                  'SELECT attempt FROM account_deletion_operations WHERE id=$1',
                  [operationId]
                )
            )[0].attempt
          );
          await ui.retry();
          await waitFor(async () => {
            const observed = (
              await dbs
                .get('authentication')!
                .query(
                  'SELECT state,attempt,"leaseOwner" FROM account_deletion_operations WHERE id=$1',
                  [operationId]
                )
            )[0];
            return (
              Number(observed.attempt) > beforeAttempt &&
              observed.state === 'blocked' &&
              observed.leaseOwner === null
            );
          });
        } else await rootWorker.request('run', { operationId });
        ledger = (
          await authDb.query(
            'SELECT * FROM account_deletion_operations WHERE id=$1',
            [operationId]
          )
        )[0];
        expect(ledger.state).toBe('blocked');
        expect(ledger.ownerProgress.profile.finalize).toBe(true);
        expect(
          (
            await dbs
              .get('profile')!
              .query('SELECT count(*)::text n FROM profile WHERE "userId"=$1', [
                account,
              ])
          )[0].n
        ).toBe('0');
        expect(
          (
            await authDb.query(
              'SELECT count(*)::text n FROM user_entity WHERE id=$1',
              [account]
            )
          )[0].n
        ).toBe('1');
        expect(
          (
            await authDb.query(
              'SELECT count(*)::text n FROM key_datum WHERE id=$1',
              [ids['ownKey']]
            )
          )[0].n
        ).toBe('1');
        await authDb.query('DROP TRIGGER d27_stop_auth_root ON user_entity');
        await authDb.query('DROP FUNCTION d27_stop_auth_root()');
        await authDb.query(
          'UPDATE account_deletion_operations SET "updatedAt"=clock_timestamp()-interval \'40 seconds\' WHERE id=$1',
          [operationId]
        );
        await rootWorker.request('recover');
        await waitFor(
          async () =>
            (
              await authDb.query(
                'SELECT state FROM account_deletion_operations WHERE id=$1',
                [operationId]
              )
            )[0].state === 'complete'
        );
        if (ui) await ui.complete();
        ledger = (
          await authDb.query(
            'SELECT * FROM account_deletion_operations WHERE id=$1',
            [operationId]
          )
        )[0];
        expect(
          (await authority.status(operationId)).progress.every(
            (value) => value.status === 'complete'
          )
        ).toBe(true);
        expect(ledger.state).toBe('complete');
        expect(ledger.accountId).toBeNull();
        expect(ledger.privateScope).toBeNull();
        expect(ledger.idempotencyKey).toBe(DELETED_ACCOUNT_ID);
        expect(ledger.leaseOwner).toBeNull();
        expect(
          (
            await authDb.query(
              'SELECT count(*)::text n FROM user_entity WHERE id=$1',
              [account]
            )
          )[0].n
        ).toBe('0');
        expect(
          (
            await authDb.query(
              'SELECT count(*)::text n FROM key_datum WHERE id=$1',
              [ids['ownKey']]
            )
          )[0].n
        ).toBe('0');
        expect(
          (
            await authDb.query(
              'SELECT count(*)::text n FROM token WHERE "userId"=$1',
              [account]
            )
          )[0].n
        ).toBe('0');
        expect(
          (
            await authDb.query(
              'SELECT count(*)::text n FROM oauth_provider WHERE "userId"=$1',
              [account]
            )
          )[0].n
        ).toBe('0');
        for (const target of [auth, authReplica]) {
          expect(
            (
              await call(target, AuthCommands.Validate, {
                token: tokens['other'],
                userId: other,
                appId: 'local-hub',
              })
            ).isValid
          ).toBe(true);
          for (const key of ['ownTs', 'ownOt'])
            await expect(
              call(target, AuthCommands.Validate, {
                token: tokens[key],
                userId: account,
                appId: key === 'ownTs' ? 'local-hub' : 'client-interface',
              })
            ).rejects.toBeTruthy();
        }
        expect(
          await artifactStore.inspectAbsent(artifacts['own'].artifactId)
        ).toBe(true);
        const retained = await artifactStore.openVerified(artifacts['other']);
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of retained.createReadStream())
            chunks.push(Buffer.from(chunk));
          expect(Buffer.concat(chunks).toString('utf8')).toBe(
            'COUNTERPART_ARTIFACT'
          );
        } finally {
          await retained.cleanup();
        }
        expect(await row('profile', 'profile', otherProfile)).toEqual(
          baseline.get('otherProfile')
        );
        expect(await row('social', 'post', ids['socialForeignPost'])).toEqual(
          baseline.get('socialForeignPost')
        );
        expect(
          (await row('social', 'comment', ids['socialReply'])).content
        ).toBe('COUNTERPART_REPLY');
        expect(
          (await row('forum', 'forum_post', ids['forumReply'])).content
        ).toBe('COUNTERPART_FORUM_REPLY');
        expect(
          (await row('chat-collector', 'message', ids['otherMessage'])).content
        ).toBe('COUNTERPART_MESSAGE');
        expect(
          await row('chat-collector', 'message', ids['ownMessage'])
        ).toBeUndefined();
        expect(
          await row('classifieds', 'classified_ad', ids['otherAd'])
        ).toEqual(baseline.get('otherAd'));
        expect(
          await row('payments', 'seller_wallets', ids['otherWallet'])
        ).toEqual(baseline.get('otherWallet'));
        expect(
          (await row('payments', 'classified_payments', ids['payment']))
            .sellerId
        ).toBe(other);
        expect(
          (
            await row(
              'app-configurator',
              'app_memberships',
              ids['sharedMembership']
            )
          ).userId
        ).toBe(other);
        expect(
          await row('permissions', 'role_assignment', ids['ownRole'])
        ).toBeUndefined();
        expect(
          await row('permissions', 'role_assignment', ids['otherRole'])
        ).toBeTruthy();
        await expect(stat(ownPath)).rejects.toThrow();
        expect(
          createHash('sha256')
            .update(await readFile(otherPath))
            .digest('hex')
        ).toBe(baseline.get('otherMediaHash'));
        for (const gateway of gateways)
          expect(
            (await gateway.request('inspect', { profileId: otherProfile }))
              .cached
          ).toBe(true);
        for (const worker of [
          extraAuth,
          workers.find((value) =>
            value.config.privateRoot.endsWith('social-extra')
          )!,
        ]) {
          expect(
            (await worker.request('inspect-spool', { accountId: account }))
              .readable
          ).toBe(false);
          expect(
            (await worker.request('inspect-spool', { accountId: other }))
              .readable
          ).toBe(true);
        }
        for (const socket of sockets)
          expect(socket.connected).toBe(
            (socket as any).fixtureAccount === 'other'
          );
        if (process.env['R2_RETENTION_CONTROLS'] === '1')
          await verifyR2AfterDeletion({
            root: settings.root,
            workers: workers.filter(
              (w) =>
                w.child.exitCode === null &&
                !w.child.killed &&
                !w.config.privateRoot.includes('/gateway-')
            ),
            rootWorker,
            auth,
            authReplica,
            account,
            tokens,
            database: authDb,
          });
        const counts: Record<string, number> = {};
        for (const [owner, db] of dbs) {
          const tables = await db.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'migrations'"
          );
          for (const entry of tables) {
            const rows = await db.query(
              'SELECT row_to_json(t) AS data FROM "' + entry.tablename + '" t'
            );
            counts[owner + ':' + entry.tablename] = rows.length;
            for (const candidate of rows)
              for (const identity of [
                account,
                profile,
                profile2,
                'OWN_PRIVATE',
              ])
                expect(JSON.stringify(candidate.data)).not.toContain(identity);
          }
        }
        await writeFile(
          join(settings.root, 'result.json'),
          JSON.stringify(
            {
              acceptedLocalProtocol: true,
              owners: [...ACCOUNT_DELETION_OWNERS],
              fabricatedAcknowledgements: 0,
              successfulFakeAdapters: 0,
              profileScope: 'actual-owner-discovery',
              faults: [
                'killed-coordinator-while-real-media-read-held',
                'unaccepted-product-scope-blocks-before-erasure',
                'real-local-symlink-custody-failure',
                'real-auth-delete-trigger-after-profile-finalize',
              ],
              ownerProcessStarts: workers.length - 2,
              liveOwnerProcesses: workers.filter(
                (worker) =>
                  !gateways.includes(worker) &&
                  worker.child.exitCode === null &&
                  worker.child.signalCode === null
              ).length,
              gatewayProcesses: gateways.length,
              sourceTableCounts: counts,
              browserBoundary:
                'accepted-N06-session-boundary; independently rebuilt Chrome fixture',
              externalBackupAndProviderQualification: false,
            },
            null,
            2
          ) + '\n'
        );
      },
      process.env['U03_UI_CONTROLS'] === '1' ? 400000 : 150000
    );
  }
);
