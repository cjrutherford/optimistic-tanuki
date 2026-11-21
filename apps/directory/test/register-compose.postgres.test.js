const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { ClientProxyFactory, Transport } = require('@nestjs/microservices');
const { firstValueFrom, timeout: rxjsTimeout } = require('rxjs');
const CommunityCommands = {
  CREATE: 'CREATE_COMMUNITY',
  DELETE: 'DELETE_COMMUNITY',
};

const enabled = process.env.S3_COMPOSE_PROOF === 'disposable';
const socialUrl = process.env.S3_COMPOSE_SOCIAL_DATABASE_URL;
const directoryUrl = process.env.S3_COMPOSE_DIRECTORY_DATABASE_URL;
const socialHost = process.env.S3_COMPOSE_SOCIAL_HOST;
const socialPort = Number(process.env.S3_COMPOSE_SOCIAL_PORT);
const directoryHost = process.env.S3_COMPOSE_DIRECTORY_HOST;
const directoryPort = Number(process.env.S3_COMPOSE_DIRECTORY_HTTP_PORT);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function databaseUrl(value, name) {
  assert.ok(value, `S3_COMPOSE_*_DATABASE_URL must explicitly name ${name}`);
  const url = new URL(value);
  assert.equal(url.protocol, 'postgres:');
  assert.equal(
    url.hostname,
    '127.0.0.1',
    'proof databases must be loopback-only'
  );
  assert.equal(url.pathname, `/${name}`, `proof requires the ${name} database`);
  return url;
}

function loopback(host, port, label) {
  assert.ok(host, `${label} host must be explicitly configured`);
  assert.ok(
    ['127.0.0.1', 'localhost', '::1'].includes(host),
    `${label} host must be loopback`
  );
  assert.ok(
    Number.isInteger(port) && port > 0 && port < 65536,
    `${label} port must be explicitly configured`
  );
}

async function eventually(read, predicate, timeoutMs, message) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const value = await read();
    if (predicate(value)) return value;
    await pause(Math.min(1000, Math.max(10, end - Date.now())));
  }
  assert.fail(message);
}

test(
  'isolated Compose Social and Directory deployment exposes eligible pending towns',
  { skip: !enabled, timeout: 230000 },
  async () => {
    const socialDbUrl = databaseUrl(socialUrl, 's3social');
    databaseUrl(directoryUrl, 'directorybootstrap');
    assert.notEqual(socialUrl, directoryUrl);
    loopback(socialHost, socialPort, 'Social TCP');
    loopback(directoryHost, directoryPort, 'Directory HTTP');

    const socialDb = new DataSource({ type: 'postgres', url: socialUrl });
    const directoryDb = new DataSource({ type: 'postgres', url: directoryUrl });
    const client = ClientProxyFactory.create({
      transport: Transport.TCP,
      options: { host: socialHost, port: socialPort },
    });
    const ownerId = `compose-proof-${randomUUID()}`;
    const ownerProfileId = `compose-proof-profile-${randomUUID()}`;
    const townName = `Compose proof ${randomUUID()}`;
    let initializedSocial = false,
      initializedDirectory = false,
      createdId;

    const httpStatus = async (id) => {
      const response = await fetch(
        `http://${directoryHost}:${directoryPort}/internal/towns/${id}/status`,
        { signal: AbortSignal.timeout(5000), redirect: 'error' }
      );
      if (response.status === 404 || response.status === 503)
        return 'unavailable';
      if (!response.ok) return `http-${response.status}`;
      const body = await response.json();
      return body.status || 'invalid';
    };

    async function counts() {
      const [socialRows, directoryRows, blockedRows] = await Promise.all([
        socialDb.query(
          `SELECT id FROM community WHERE "appScope"='local-hub' AND "localityType" IN ('city','town') AND "isPrivate"=false AND "adminArea" IS DISTINCT FROM 'Development fixture'`
        ),
        directoryDb.query(
          'SELECT "communityId" FROM directory_town WHERE eligible=true'
        ),
        directoryDb.query(
          'SELECT "communityId" FROM directory_provider_work WHERE status=\'blocked\''
        ),
      ]);
      const eligibleIds = new Set(
        socialRows.map((row) => row.id.toLowerCase())
      );
      const directoryIds = new Set(
        directoryRows.map((row) => row.communityId.toLowerCase())
      );
      const blockedIds = new Set(
        blockedRows.map((row) => row.communityId.toLowerCase())
      );
      const absent = [...eligibleIds].filter((id) => !directoryIds.has(id));
      const unblocked = [...eligibleIds].filter((id) => !blockedIds.has(id));
      return {
        eligible: eligibleIds.size,
        directoryEligible: directoryIds.size,
        blocked: blockedIds.size,
        absent,
        unblocked,
      };
    }

    async function proveAllPending() {
      const snapshot = await counts();
      const ids = await idsOfEligible();
      assert.equal(
        snapshot.absent.length,
        0,
        'eligible Social communities must all have Directory contexts'
      );
      assert.equal(
        snapshot.unblocked.length,
        0,
        'eligible Social communities must all have blocked provider work'
      );
      assert.equal(
        snapshot.directoryEligible,
        snapshot.eligible,
        'Directory must have no extra eligible contexts'
      );
      assert.equal(
        snapshot.blocked,
        snapshot.eligible,
        'blocked work must match the eligible set'
      );
      let cursor = 0;
      await Promise.all(
        Array.from({ length: 8 }, async () => {
          while (cursor < ids.length)
            assert.equal(
              await httpStatus(ids[cursor++]),
              'pending',
              'every eligible town HTTP status must be pending'
            );
        })
      );
      return snapshot;
    }

    async function idsOfEligible() {
      const rows = await socialDb.query(
        `SELECT id FROM community WHERE "appScope"='local-hub' AND "localityType" IN ('city','town') AND "isPrivate"=false AND "adminArea" IS DISTINCT FROM 'Development fixture'`
      );
      return rows.map((row) => row.id.toLowerCase());
    }

    try {
      await socialDb.initialize();
      initializedSocial = true;
      await directoryDb.initialize();
      initializedDirectory = true;
      const baseline = await proveAllPending();
      const started = Date.now();
      const createResult = await firstValueFrom(
        client
          .send(
            { cmd: CommunityCommands.CREATE },
            {
              dto: {
                name: townName,
                ownerId,
                ownerProfileId,
                localityType: 'town',
                isPrivate: false,
              },
              userId: ownerId,
              profileId: ownerProfileId,
              appScope: 'local-hub',
            }
          )
          .pipe(rxjsTimeout({ first: 15000 }))
      );
      createdId = createResult?.id;
      assert.match(
        createdId || '',
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        'Social create must return its UUID'
      );
      const createdReady = await eventually(
        async () => {
          const status = await httpStatus(createdId);
          const [context] = await directoryDb.query(
            'SELECT eligible FROM directory_town WHERE "communityId"=$1',
            [createdId]
          );
          const [work] = await directoryDb.query(
            'SELECT status FROM directory_provider_work WHERE "communityId"=$1',
            [createdId]
          );
          return (
            status === 'pending' &&
            context?.eligible === true &&
            work?.status === 'blocked'
          );
        },
        Boolean,
        100000,
        'new town did not reach pending HTTP and blocked provider state within 100 seconds'
      );
      assert.equal(createdReady, true);
      assert.ok(Date.now() - started < 15 * 60 * 1000);
      const afterCreate = await proveAllPending();
      console.log(
        JSON.stringify({
          phase: 'create',
          baselineEligible: baseline.eligible,
          finalEligible: afterCreate.eligible,
          elapsedMs: Date.now() - started,
        })
      );

      const deleteStarted = Date.now();
      await firstValueFrom(
        client
          .send(
            { cmd: CommunityCommands.DELETE },
            { id: createdId, userId: ownerId }
          )
          .pipe(rxjsTimeout({ first: 15000 }))
      );
      await eventually(
        async () => {
          const status = await httpStatus(createdId);
          const work = await directoryDb.query(
            'SELECT 1 FROM directory_provider_work WHERE "communityId"=$1',
            [createdId]
          );
          return status === 'unavailable' && work.length === 0;
        },
        Boolean,
        100000,
        'deleted town did not become HTTP unavailable and lose blocked work within 100 seconds'
      );
      const afterDelete = await proveAllPending();
      console.log(
        JSON.stringify({
          phase: 'delete',
          eligible: afterDelete.eligible,
          elapsedMs: Date.now() - deleteStarted,
        })
      );
    } finally {
      if (createdId && initializedSocial) {
        try {
          const [exists] = await socialDb.query(
            'SELECT 1 FROM community WHERE id=$1 AND "ownerId"=$2',
            [createdId, ownerId]
          );
          if (exists)
            await firstValueFrom(
              client
                .send(
                  { cmd: CommunityCommands.DELETE },
                  { id: createdId, userId: ownerId }
                )
                .pipe(rxjsTimeout({ first: 10000 }))
            );
        } catch {
          /* Preserve the original failure; never touch a non-owned row. */
        }
      }
      client.close();
      if (initializedDirectory) await directoryDb.destroy();
      if (initializedSocial) await socialDb.destroy();
    }
  }
);
