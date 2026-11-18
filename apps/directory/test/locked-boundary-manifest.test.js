const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const {
  assertOwnerApprovalForEntity,
} = require('../src/locked-boundary-manifest');

const manifest = JSON.parse(
  readFileSync(
    'docs/plans/town-square-directory/s10-evidence/s10-locked-boundaries.json',
    'utf8'
  )
);
const decision = {
  id: 'D23',
  date: '2026-11-18',
  summary: 'Owner chose the township as the town border.',
};

test('every locked manifest entry passes the owner-approval rule', () => {
  const locked = manifest.locked ?? manifest.entries ?? [];
  assert.ok(locked.length >= 21);
  for (const e of locked)
    assert.doesNotThrow(() => assertOwnerApprovalForEntity(e), e.townName);
});

test('a differently named entity needs a valid owner decision', () => {
  const e = { townName: 'Corolla, NC', censusName: 'Poplar Branch' };
  assert.throws(() => assertOwnerApprovalForEntity(e), /no owner decision/);
  assert.throws(
    () =>
      assertOwnerApprovalForEntity({
        ...e,
        ownerDecision: { ...decision, summary: 'short' },
      }),
    /Invalid owner decision/
  );
  assert.doesNotThrow(() =>
    assertOwnerApprovalForEntity({ ...e, ownerDecision: decision })
  );
});

test('descriptor-word names still match without a decision', () => {
  for (const [t, c] of [
    ['St. Simons Island, GA', 'St. Simons'],
    ['Spotsylvania, VA', 'Spotsylvania Courthouse'],
    ['Cary, NC', 'cary'],
  ])
    assert.doesNotThrow(() =>
      assertOwnerApprovalForEntity({ townName: t, censusName: c })
    );
});

test('Corolla and Palm Valley carry their owner decisions', () => {
  const locked = manifest.locked ?? manifest.entries ?? [];
  assert.equal(
    locked.find((e) => e.townName === 'Corolla, NC').ownerDecision.id,
    'D23'
  );
  assert.equal(
    locked.find((e) => e.townName === 'Palm Valley, FL').ownerDecision.id,
    'D20'
  );
});
