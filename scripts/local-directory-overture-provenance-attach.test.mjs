import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  planProvenanceAttach,
  minimalSources,
} = require('./local-directory-overture-provenance-attach.cjs');

const meta = { dataset: 'meta', license: 'CDLA-Permissive-2.0', property: '' };

test('minimalSources keeps only dataset, license and property', () => {
  assert.deepEqual(
    minimalSources([
      { ...meta, record_id: 'x', update_time: 't' },
      { dataset: 'Overture' },
      null,
      { dataset: 'BQ', license: 'CDLA-Permissive-2.0' },
    ]),
    [meta, { dataset: 'BQ', license: 'CDLA-Permissive-2.0' }]
  );
});

test('matches on region, row number and name; skips the rest', () => {
  const stage = [
    {
      regionId: 'a',
      sourceFileRowNumber: '1',
      listing: { name: 'Cafe', sources: [meta] },
    },
    {
      regionId: 'a',
      sourceFileRowNumber: '2',
      listing: { name: 'Shop', sources: [meta] },
    },
    {
      regionId: 'a',
      sourceFileRowNumber: '3',
      listing: { name: 'Dup', sources: [meta] },
    },
    {
      regionId: 'a',
      sourceFileRowNumber: '3',
      listing: { name: 'Dup', sources: [meta] },
    },
    {
      regionId: 'a',
      sourceFileRowNumber: '4',
      listing: { name: 'Bare', sources: [] },
    },
  ];
  const live = [
    {
      scanId: 's',
      regionId: 'a',
      sourceFileRowNumber: '1',
      listing: { name: ' cafe ' },
    },
    {
      scanId: 's',
      regionId: 'a',
      sourceFileRowNumber: '2',
      listing: { name: 'Other' },
    },
    {
      scanId: 's',
      regionId: 'a',
      sourceFileRowNumber: '3',
      listing: { name: 'Dup' },
    },
    {
      scanId: 's',
      regionId: 'a',
      sourceFileRowNumber: '4',
      listing: { name: 'Bare' },
    },
    {
      scanId: 's',
      regionId: 'a',
      sourceFileRowNumber: '9',
      listing: { name: 'Gone' },
    },
    {
      scanId: 's',
      regionId: null,
      sourceFileRowNumber: '1',
      listing: { name: 'Cafe' },
    },
    {
      scanId: 's',
      regionId: 'a',
      sourceFileRowNumber: '1',
      listing: { name: 'Cafe', sources: [] },
    },
  ];
  const { updates, summary } = planProvenanceAttach(stage, live);
  assert.deepEqual(updates, [
    { scanId: 's', sourceFileRowNumber: '1', sources: [meta] },
  ]);
  assert.equal(summary.matched, 1);
  assert.equal(summary.skippedNameMismatch, 1);
  assert.equal(summary.skippedAmbiguousStage, 1);
  assert.equal(summary.skippedEmptySources, 1);
  assert.equal(summary.skippedNoStageRow, 1);
  assert.equal(summary.skippedNoRegion, 1);
  assert.equal(summary.alreadyHasSources, 1);
  assert.deepEqual(summary.lineages, { 'meta|CDLA-Permissive-2.0|': 1 });
});
