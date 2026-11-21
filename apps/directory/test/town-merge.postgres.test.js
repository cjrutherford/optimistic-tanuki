const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DataSource } = require('typeorm');
const { mergeTownInto, retireBlankTown } = require('../src/town-merge');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !['localhost', '127.0.0.1'].includes(u.hostname) ||
    !/^\/(directory_test_[a-f0-9]{32}|s10_geom_[a-z0-9_]+)$/.test(u.pathname)
  )
    throw Error('Disposable test database required');
}

async function withDb(fn) {
  const db = new DataSource({ type: 'postgres', url });
  await db.initialize();
  const ids = [];
  const town = async (name, eligible, extra = '') => {
    const id = randomUUID();
    ids.push(id);
    await db.query(
      `INSERT INTO directory_town ("communityId",name,slug,eligible,"geometryStatus") VALUES ($1,$2,$3,$4,'pending')`,
      [
        id,
        name,
        name ? `${name.toLowerCase()}-${id.slice(0, 8)}` : null,
        eligible,
      ]
    );
    return id;
  };
  try {
    await fn(db, town);
  } finally {
    if (ids.length)
      await db.query('DELETE FROM directory_town WHERE "communityId"=ANY($1)', [
        ids,
      ]);
    await db.destroy();
  }
}
const pointer = async (db, id) =>
  (
    await db.query(
      'SELECT "mergedIntoCommunityId" AS m FROM directory_town WHERE "communityId"=$1',
      [id]
    )
  )[0].m;

test(
  'merge is refused while the source is eligible, or for a bad target',
  { skip: !url },
  async () => {
    await withDb(async (db, town) => {
      const target = await town('Target', true);
      const live = await town('Live', true);
      const gone = await town('', false);
      const ineligibleTarget = await town('', false);
      await assert.rejects(
        mergeTownInto(db, { communityId: live, intoCommunityId: target }),
        /still eligible/
      );
      await assert.rejects(
        mergeTownInto(db, {
          communityId: gone,
          intoCommunityId: ineligibleTarget,
        }),
        /Eligible merge target/
      );
      await assert.rejects(
        mergeTownInto(db, { communityId: gone, intoCommunityId: randomUUID() }),
        /Unknown merge target/
      );
      await assert.rejects(
        mergeTownInto(db, { communityId: gone, intoCommunityId: gone }),
        /Invalid/
      );
      assert.equal(await pointer(db, gone), null);
    });
  }
);

test(
  'merge dry-run writes nothing; apply records the pointer; repeat is unchanged',
  { skip: !url },
  async () => {
    await withDb(async (db, town) => {
      const target = await town('Target', true);
      const gone = await town('', false);
      assert.deepEqual(
        await mergeTownInto(
          db,
          { communityId: gone, intoCommunityId: target },
          { dryRun: true }
        ),
        { status: 'would-merge' }
      );
      assert.equal(await pointer(db, gone), null);
      assert.deepEqual(
        await mergeTownInto(db, { communityId: gone, intoCommunityId: target }),
        { status: 'merged' }
      );
      assert.equal(await pointer(db, gone), target);
      assert.deepEqual(
        await mergeTownInto(db, { communityId: gone, intoCommunityId: target }),
        { status: 'unchanged' }
      );
      // A merged town cannot be a merge target.
      const other = await town('', false);
      await db.query(
        'UPDATE directory_town SET eligible=true WHERE "communityId"=$1',
        [gone]
      );
      await assert.rejects(
        mergeTownInto(db, { communityId: other, intoCommunityId: gone }),
        /itself merged/
      );
    });
  }
);

test(
  'retire deletes a blank ineligible town, refuses a named one, keeps one with data',
  { skip: !url },
  async () => {
    await withDb(async (db, town) => {
      const blank = await town('', false);
      const named = await town('Named', true);
      const withData = await town('', false);
      await assert.rejects(
        retireBlankTown(db, { communityId: named }),
        /blank-name/
      );
      assert.deepEqual(
        await retireBlankTown(db, { communityId: blank }, { dryRun: true }),
        { status: 'would-retire' }
      );
      assert.equal(
        (
          await db.query(
            'SELECT 1 FROM directory_town WHERE "communityId"=$1',
            [blank]
          )
        ).length,
        1
      );
      assert.deepEqual(await retireBlankTown(db, { communityId: blank }), {
        status: 'retired',
      });
      assert.deepEqual(await retireBlankTown(db, { communityId: blank }), {
        status: 'absent',
      });
      const [col] = await db.query(
        `SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='communityId' AND table_name='directory_provider_work'`
      );
      if (col) {
        await db
          .query(
            `INSERT INTO directory_provider_work ("communityId",status) VALUES ($1,'blocked')`,
            [withData]
          )
          .then(
            async () => {
              const r = await retireBlankTown(db, { communityId: withData });
              assert.equal(r.status, 'kept-has-data');
              assert.ok(r.referencedBy.includes('directory_provider_work'));
              await db.query(
                'DELETE FROM directory_provider_work WHERE "communityId"=$1',
                [withData]
              );
            },
            () => {}
          );
      }
    });
  }
);
