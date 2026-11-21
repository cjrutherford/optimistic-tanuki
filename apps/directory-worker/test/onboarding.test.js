const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DeliveryScan } = require('../src/onboarding');

test('failed apply retries the page without remote deletion', async () => {
  const scan = new DeliveryScan(),
    cursors = [],
    applied = [];
  const source = {
    unread: async (after) => {
      cursors.push(after);
      return [
        { revision: '12', communityId: 'town' },
        { revision: '13', communityId: 'other' },
      ];
    },
  };
  let fail = true;
  const reconciler = {
    apply: async ({ revision: id }) => {
      applied.push(id);
      if (id === '13' && fail) throw Error('lost response');
    },
  };
  await assert.rejects(scan.deliverBatch(source, reconciler));
  fail = false;
  await scan.deliverBatch(source, reconciler);
  assert.deepEqual(cursors, [undefined, undefined]);
  assert.deepEqual(applied, ['12', '13', '12', '13']);
});

test('revisits late IDs while the forward traversal continues to the tail', async () => {
  const scan = new DeliveryScan(1),
    cursors = [],
    seen = [];
  let events = [
    { revision: '12', communityId: 'town' },
    { revision: '13', communityId: 'town' },
    { revision: '14', communityId: 'town' },
  ];
  const source = {
    unread: async (after) => {
      cursors.push(after);
      return events
        .filter((e) => !after || BigInt(e.revision) > BigInt(after))
        .slice(0, 1);
    },
  };
  const reconciler = { apply: async ({ revision: id }) => seen.push(id) };
  await scan.deliverBatch(source, reconciler);
  events.unshift({ revision: '3', communityId: 'town' });
  await scan.deliverBatch(source, reconciler);
  await scan.deliverBatch(source, reconciler);
  await scan.deliverBatch(source, reconciler);
  await scan.deliverBatch(source, reconciler);
  assert.deepEqual(cursors, [undefined, undefined, '12', undefined, '13']);
  assert.deepEqual(seen, ['12', '3', '13', '3', '14']);
});

test('revisit window grows so late IDs beyond the first page are eventually seen', async () => {
  const scan = new DeliveryScan(1),
    seen = [];
  let events = ['10', '20', '30', '40'].map((revision) => ({
    revision,
    communityId: 'town',
  }));
  const source = {
    unread: async (after) =>
      events
        .filter((e) => !after || BigInt(e.revision) > BigInt(after))
        .slice(0, 1),
  };
  const reconciler = { apply: async ({ revision: id }) => seen.push(id) };
  for (let i = 0; i < 6; i++) await scan.deliverBatch(source, reconciler);
  events.splice(2, 0, { revision: '25', communityId: 'town' });
  for (let i = 0; i < 20; i++) await scan.deliverBatch(source, reconciler);
  assert.ok(seen.includes('25'));
});
