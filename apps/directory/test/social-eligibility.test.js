const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isEligibleCommunity,
  applySocialCommunity,
} = require('../src/social-eligibility');
const { TownGeometryService } = require('../src/town-geometry');
const { DataSource } = require('typeorm');
const {
  DirectoryTown,
  DirectoryTownGeometry,
  DirectoryInstallation,
} = require('../src/entity');

const base = {
  id: '00000000-0000-4000-8000-000000000100',
  name: 'Town',
  slug: null,
  adminArea: null,
  appScope: 'local-hub',
  isPrivate: false,
  localityType: 'town',
};
test('Social eligibility fails closed for privacy, scope and non-town localities', () => {
  assert.equal(isEligibleCommunity(base), true);
  assert.equal(
    isEligibleCommunity({ ...base, adminArea: 'GA', isSystemCommunity: false }),
    true
  );
  for (const change of [
    { isPrivate: true },
    { isPrivate: undefined },
    { appScope: 'social' },
    { localityType: 'county' },
    { localityType: null },
    { adminArea: 'Development fixture' },
  ])
    assert.equal(isEligibleCommunity({ ...base, ...change }), false);
});

test(
  'actual Social seeded and non-seed UUIDs round trip through isolated PostGIS',
  { skip: !process.env.S2_SOCIAL_FIXTURES },
  async () => {
    const db = new DataSource({
      type: 'postgres',
      url: process.env.DIRECTORY_TEST_DATABASE_URL,
      entities: [DirectoryTown, DirectoryTownGeometry, DirectoryInstallation],
    });
    await db.initialize();
    try {
      const communities = await db.query(
        'SELECT * FROM social_fixture ORDER BY "isSystemCommunity"'
      );
      assert.deepEqual(
        communities.map((c) => c.isSystemCommunity),
        [false, true]
      );
      const service = new TownGeometryService(db);
      for (const community of communities) {
        await applySocialCommunity(service, { ...community, slug: null });
        assert.equal(
          (
            await db
              .getRepository(DirectoryTown)
              .findOneByOrFail({ communityId: community.id })
          ).communityId,
          community.id
        );
        await applySocialCommunity(service, {
          ...community,
          isPrivate: true,
          name: 'private replacement',
        });
        const withdrawn = await db
          .getRepository(DirectoryTown)
          .findOneByOrFail({ communityId: community.id });
        assert.equal(withdrawn.eligible, false);
        assert.notEqual(withdrawn.name, 'private replacement');
        await applySocialCommunity(service, community);
        assert.deepEqual(await service.validateTownPoint(community.id, 0, 0), {
          status: 'pending',
        });
      }
      await applySocialCommunity(service, { ...base, appScope: 'social' });
      assert.equal(
        await db
          .getRepository(DirectoryTown)
          .findOneBy({ communityId: base.id }),
        null
      );
    } finally {
      await db.destroy();
    }
  }
);
