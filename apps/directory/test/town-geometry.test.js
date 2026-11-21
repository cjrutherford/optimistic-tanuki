const test = require('node:test');
const assert = require('node:assert/strict');
const dataSource = require('../src/data-source').default;
const { TownGeometryService } = require('../src/town-geometry');

const url = process.env.DIRECTORY_TEST_DATABASE_URL;
test(
  'town identity, boundary versions and spatial policy on PostGIS',
  { skip: !url },
  async () => {
    dataSource.setOptions({ url });
    await dataSource.initialize();
    const service = new TownGeometryService(dataSource);
    const ids = [1, 2, 3, 4].map(
      (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
    );
    const town = (id, name, area, slug = null) => ({
      communityId: id,
      name,
      administrativeArea: area,
      slug,
      eligible: true,
    });
    const square = (x, y, size = 4) => [
      [x, y],
      [x + size, y],
      [x + size, y + size],
      [x, y + size],
      [x, y],
    ];
    const boundary = (geometry) => ({
      geometry,
      source: 'test fixture',
      vintage: 'test',
      rights: 'test only',
    });
    try {
      for (const [i, name, area] of [
        [0, 'Seed', 'A'],
        [1, 'Springfield', 'A'],
        [2, 'Springfield', 'B'],
        [3, 'Outside corridor', 'C'],
      ]) {
        const saved = await service.upsertTown(town(ids[i], name, area));
        assert.equal(saved.geometryStatus, 'pending');
      }
      await service.upsertTown(town(ids[0], 'Renamed', 'A', 'new-slug'));
      assert.equal(
        (
          await dataSource.query(
            'SELECT count(*)::int AS n FROM directory_town WHERE "communityId" = ANY($1::uuid[])',
            [ids]
          )
        )[0].n,
        4
      );
      assert.equal(
        (
          await dataSource
            .getRepository('DirectoryTown')
            .findOneBy({ communityId: ids[0] })
        ).name,
        'Renamed'
      );
      assert.deepEqual(await service.validateTownPoint(ids[2], 0, 0), {
        status: 'pending',
      });
      const polygon = {
        type: 'Polygon',
        coordinates: [square(0, 0), square(1, 1, 1)],
      };
      assert.equal(
        await service.setBoundary(ids[0], boundary(polygon)),
        'ready'
      );
      assert.deepEqual(
        (await service.townsCoveringPoint(1.5, 1.5)).communityIds,
        []
      ); // hole
      assert.deepEqual(await service.validateTownPoint(ids[0], 1, 1), {
        status: 'ready',
        covers: true,
      }); // hole border
      assert.deepEqual((await service.townsCoveringPoint(0, 0)).communityIds, [
        ids[0],
      ]); // border
      assert.equal(
        await service.setBoundary(
          ids[1],
          boundary({ type: 'MultiPolygon', coordinates: [[square(0, 0)]] })
        ),
        'ready'
      );
      assert.deepEqual(await service.townsCoveringPoint(0, 0), {
        kind: 'geometry-candidates',
        complete: false,
        communityIds: [ids[0], ids[1]],
        ambiguous: true,
      });
      assert.equal(
        await service.setBoundary(
          ids[0],
          boundary({ type: 'Polygon', coordinates: [square(10, 10)] })
        ),
        'ready'
      );
      assert.equal(
        (
          await dataSource
            .getRepository('DirectoryTown')
            .findOneBy({ communityId: ids[0] })
        ).geometryVersion,
        2
      );
      assert.equal(
        await service.setBoundary(
          ids[2],
          boundary({ type: 'Polygon', coordinates: [square(181, 0)] })
        ),
        'invalid'
      );
      assert.equal(
        await service.setBoundary(
          ids[3],
          boundary({ type: 'Polygon', coordinates: [] })
        ),
        'invalid'
      );
      assert.equal(
        await service.setBoundary(
          ids[3],
          boundary({
            type: 'Polygon',
            coordinates: [
              [
                [0, 0],
                [1, 1],
                [1, 0],
                [0, 1],
                [0, 0],
              ],
            ],
          })
        ),
        'invalid'
      );
      assert.equal(
        (
          await dataSource
            .getRepository('DirectoryTown')
            .findOneBy({ communityId: ids[3] })
        ).geometryStatus,
        'invalid'
      );
      assert.deepEqual(await service.validateTownPoint(ids[3], 0, 0), {
        status: 'invalid',
      });
      assert.deepEqual(await service.validateTownPoint(ids[0], 0, 0), {
        status: 'ready',
        covers: false,
      });
      // Withdrawing eligibility and restoring it must never revive an old review.
      await service.upsertTown({
        ...town(ids[0], 'Renamed', 'A'),
        eligible: false,
      });
      assert.deepEqual(await service.validateTownPoint(ids[0], 11, 11), {
        status: 'ineligible',
      });
      await assert.rejects(
        () => service.setBoundary(ids[0], boundary(polygon)),
        /Ineligible/
      );
      await service.upsertTown(town(ids[0], 'Renamed', 'A'));
      assert.deepEqual(await service.validateTownPoint(ids[0], 11, 11), {
        status: 'pending',
      });
      assert.equal(
        (await service.townsCoveringPoint(11, 11)).communityIds.includes(
          ids[0]
        ),
        false
      );
      assert.equal(
        await service.setBoundary(
          ids[0],
          boundary({ type: 'Polygon', coordinates: [square(10, 10)] })
        ),
        'ready'
      );
      assert.deepEqual(await service.validateTownPoint(ids[0], 11, 11), {
        status: 'ready',
        covers: true,
      });
      for (const geometry of [
        { type: 'Polygon', coordinates: square(0, 0) },
        { type: 'Polygon', coordinates: [[square(0, 0)]] },
        { type: 'MultiPolygon', coordinates: [square(0, 0)] },
        { type: 'Polygon', coordinates: [square(0, 0), square(5, 5, 1)] },
      ])
        assert.equal(
          await service.setBoundary(ids[3], boundary(geometry)),
          'invalid'
        );
      assert.deepEqual(await service.validateTownPoint(ids[1], 1, 1), {
        status: 'ready',
        covers: true,
      });
      await assert.rejects(
        () => service.townsCoveringPoint(undefined, 0),
        /Invalid/
      );
      await assert.rejects(() => service.townsCoveringPoint(0, 91), /Invalid/);
    } finally {
      await dataSource.destroy();
    }
  }
);
