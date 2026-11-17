import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInventory,
  selectRowGroups,
  parseRowGroupMetadata,
  readRowGroupMetadata,
} from './overture-release-preflight.mjs';

const envelope = [-83.8, 30.3, -81.7, 31.9];
const item = (id, bbox = [-84, 30, -81, 32]) => ({
  id,
  bbox,
  properties: { num_rows: 100, num_row_groups: 5 },
  assets: {
    aws: {
      href: `https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=places/type=place/${id}.parquet`,
      'file:size': 42,
    },
  },
});
const head = {
  etag: 'tag',
  lastModified: 'Wed, 21 Oct 2026 17:43:57 GMT',
  size: 42,
};
test('builds a deterministic identity and retains all shards despite reported bounds', () => {
  const docs = [item('b', [-70, 20, -69, 21]), item('a')];
  const a = buildInventory(docs, [head, head], envelope, '2026-10-21.0');
  const b = buildInventory(
    [...docs].reverse(),
    [head, head],
    envelope,
    '2026-10-21.0'
  );
  assert.equal(a.inventorySha256, b.inventorySha256);
  assert.deepEqual(
    a.selected.map((x) => x.id),
    ['a', 'b']
  );
});
test('parses Parquet statistics without discarding incomplete or inconsistent groups', () => {
  const rows = [
    [0, 3, 'bbox, xmin', '-84', '-83', 0],
    [0, 3, 'bbox, xmax', '-83.5', '-82', 0],
    [0, 3, 'bbox, ymin', '30', '31', 0],
    [0, 3, 'bbox, ymax', '31', '32', 0],
    [1, 2, 'bbox, xmin', '-70', '-69', 0],
  ];
  const groups = parseRowGroupMetadata(rows, 2, 5);
  assert.equal(groups[0].startRow, 0);
  assert.equal(groups[0].endRow, 3);
  assert.equal(groups[1].endRow, 5);
  assert.deepEqual(selectRowGroups(groups, envelope), [0, 1]);
  assert.throws(() => parseRowGroupMetadata(rows, 2, 6));
  assert.throws(() => parseRowGroupMetadata([...rows, rows[0]], 2, 5));
  assert.throws(() =>
    parseRowGroupMetadata(
      rows.map((row) => (row[0] === 1 ? [2, ...row.slice(1)] : row)),
      2,
      5
    )
  );
});
test('reads parquet metadata through a connection and computes candidates', async () => {
  const inventory = buildInventory(
    [item('a')],
    [head],
    envelope,
    '2026-10-21.0'
  );
  const source = { ...inventory.selected[0], rows: 3, rowGroups: 1 };
  let sql;
  const connection = {
    async runAndReadAll(query) {
      sql = query;
      return {
        getRowsJS: async () => [
          [0n, 3n, 'bbox, xmin', '-84', '-83', 0n],
          [0n, 3n, 'bbox, xmax', '-83', '-82', 0n],
          [0n, 3n, 'bbox, ymin', '30', '31', 0n],
          [0n, 3n, 'bbox, ymax', '31', '32', 0n],
        ],
      };
    },
  };
  const result = await readRowGroupMetadata(
    connection,
    source,
    envelope,
    '2026-10-21.0'
  );
  assert.match(sql, /parquet_metadata\(/);
  assert.match(sql, /WHERE path_in_schema/);
  assert.deepEqual(result.candidates, [0]);
  await assert.rejects(() =>
    readRowGroupMetadata(
      connection,
      { ...source, asset: 'https://example.com/a.parquet' },
      envelope,
      '2026-10-21.0'
    )
  );
  await assert.rejects(() =>
    readRowGroupMetadata(
      connection,
      { ...source, etag: '' },
      envelope,
      '2026-10-21.0'
    )
  );
});
test('rejects missing identity, malformed geometry, duplicates and wrong release', () => {
  assert.throws(() =>
    buildInventory(
      [item('a')],
      [{ ...head, size: 43 }],
      envelope,
      '2026-10-21.0'
    )
  );
  assert.throws(() =>
    buildInventory(
      [item('a')],
      [{ ...head, etag: '' }],
      envelope,
      '2026-10-21.0'
    )
  );
  assert.throws(() =>
    buildInventory([item('a', [1, 2, 0, 4])], [head], envelope, '2026-10-21.0')
  );
  assert.throws(() =>
    buildInventory(
      [item('a'), item('a')],
      [head, head],
      envelope,
      '2026-10-21.0'
    )
  );
  const duplicate = item('b');
  duplicate.assets.aws.href = item('a').assets.aws.href;
  assert.throws(() =>
    buildInventory(
      [item('a'), duplicate],
      [head, head],
      envelope,
      '2026-10-21.0'
    )
  );
  assert.throws(() =>
    buildInventory([item('a')], [head], envelope, '2026-09-23.0')
  );
  assert.throws(() =>
    buildInventory([item('a')], [head], [1, 2, 0, 4], '2026-10-21.0')
  );
  const hostile = item('a');
  hostile.assets.aws.href =
    'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com:444/release/2026-10-21.0/theme=places/type=place/a.parquet';
  assert.throws(() =>
    buildInventory([hostile], [head], envelope, '2026-10-21.0')
  );
});
test('identity changes when source object metadata changes', () => {
  const a = buildInventory([item('a')], [head], envelope, '2026-10-21.0');
  const b = buildInventory(
    [item('a')],
    [{ ...head, etag: 'another' }],
    envelope,
    '2026-10-21.0'
  );
  assert.notEqual(a.inventorySha256, b.inventorySha256);
});
test('conservatively selects row groups when statistics are missing or suspect', () => {
  const group = (
    rowGroupId,
    xminMin,
    xmaxMax,
    yminMin,
    ymaxMax,
    hasNullBounds = false
  ) => ({ rowGroupId, xminMin, xmaxMax, yminMin, ymaxMax, hasNullBounds });
  assert.deepEqual(
    selectRowGroups(
      [
        group(1, -84, -83, 30, 32),
        group(2, -70, -69, 20, 22),
        group(3, null, -69, 20, 22),
        group(4, -70, -69, 20, 22, true),
        group(5, -69, -70, 20, 22),
      ],
      envelope
    ),
    [1, 2, 3, 4, 5]
  );
  assert.throws(() => selectRowGroups([group(-1, -84, -83, 30, 32)], envelope));
  assert.throws(() =>
    selectRowGroups(
      [group(0, -84, -83, 30, 32), group(0, -84, -83, 30, 32)],
      envelope
    )
  );
  assert.deepEqual(
    selectRowGroups(
      [{ rowGroupId: 0, xminMin: -70, xmaxMax: -69, yminMin: 20, ymaxMax: 22 }],
      envelope
    ),
    [0]
  );
});
test('treats contradictory bounds as uncertain and rejects null group identities', () => {
  const rows = [
    [0, 3, 'bbox, xmin', -70, -84, 0],
    [0, 3, 'bbox, xmax', -69, -68, 0],
    [0, 3, 'bbox, ymin', 20, 21, 0],
    [0, 3, 'bbox, ymax', 21, 22, 0],
  ];
  assert.deepEqual(
    selectRowGroups(parseRowGroupMetadata(rows, 1, 3), envelope),
    [0]
  );
  assert.throws(() =>
    parseRowGroupMetadata(
      rows.map((r) => [null, ...r.slice(1)]),
      1,
      3
    )
  );
});
