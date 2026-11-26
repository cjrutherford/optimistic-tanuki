import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyMessage,
  createProgress,
  formatBytes,
  formatDuration,
  overallLine,
  preparingLine,
  progressBar,
  shortName,
  statusLine,
  summarize,
} from '../lib/pull-progress.mjs';

test('progressBar fills proportionally', () => {
  assert.equal(progressBar(0, 10), '[░░░░░░░░░░]');
  assert.equal(progressBar(100, 10), '[██████████]');
  assert.equal(progressBar(50, 10), '[█████░░░░░]');
  assert.equal(progressBar(-5, 4), '[░░░░]');
  assert.equal(progressBar(150, 4), '[████]');
});

test('formatBytes uses decimal units', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(999), '999 B');
  assert.equal(formatBytes(1500), '1.5 kB');
  assert.equal(formatBytes(20_100_000), '20.1 MB');
  assert.equal(formatBytes(3_200_000_000), '3.2 GB');
  assert.equal(formatBytes(Number.NaN), '0 B');
});

test('formatDuration renders mm:ss', () => {
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(65), '01:05');
  assert.equal(formatDuration(-3), '00:00');
  assert.equal(formatDuration(3600), '60:00');
});

test('shortName strips registry, tag and product prefix', () => {
  assert.equal(
    shortName('cjrutherford/optimistic_tanuki_assets:sha-a97ff1f'),
    'assets'
  );
  assert.equal(shortName('postgres:17'), 'postgres');
  assert.equal(shortName('ghcr.io/org/app:latest'), 'app');
  assert.equal(
    shortName('registry.example:5000/team/app@sha256:abcdef'),
    'app'
  );
});

test('applyMessage aggregates layer bytes and counts completions once', () => {
  const state = createProgress('example/assets:tag', 2, 5);

  applyMessage(state, {
    status: 'Pulling fs layer',
    id: 'layer-a',
  });
  applyMessage(state, {
    status: 'Downloading',
    id: 'layer-a',
    progressDetail: { current: 25, total: 100 },
  });
  applyMessage(state, {
    status: 'Downloading',
    id: 'layer-b',
    progressDetail: { current: 10, total: 50 },
  });

  let summary = summarize(state);
  assert.equal(summary.current, 35);
  assert.equal(summary.total, 150);
  assert.equal(Math.round(summary.percent), 23);

  applyMessage(state, {
    status: 'Download complete',
    id: 'layer-a',
    progressDetail: {},
  });
  applyMessage(state, {
    status: 'Download complete',
    id: 'layer-a',
    progressDetail: {},
  });
  assert.equal(state.downloaded, 1);

  applyMessage(state, {
    status: 'Pull complete',
    id: 'layer-a',
    progressDetail: {},
  });
  applyMessage(state, {
    status: 'Pull complete',
    id: 'layer-a',
    progressDetail: {},
  });
  assert.equal(state.extracted, 1);

  summary = summarize(state);
  assert.equal(summary.current, 110);
  assert.equal(summary.total, 150);
});

test('statusLine shows image counter, bar, name and bytes', () => {
  const state = createProgress(
    'cjrutherford/optimistic_tanuki_assets:sha-a97ff1f',
    3,
    12
  );
  applyMessage(state, {
    status: 'Downloading',
    id: 'layer-a',
    progressDetail: { current: 5_000_000, total: 10_000_000 },
  });

  const line = statusLine(state);
  assert.match(line, /^\[3\/12\]/);
  assert.ok(line.includes('50%'), line);
  assert.ok(line.includes('assets'), line);
  assert.ok(line.includes('5.0 MB/10.0 MB'), line);
});

test('applyMessage surfaces errors and up-to-date status', () => {
  const state = createProgress('example/app:tag', 1, 1);
  applyMessage(state, { status: 'Status: Image is up to date for app:tag' });
  assert.equal(state.upToDate, true);

  applyMessage(state, { error: 'denied: requested access is not allowed' });
  assert.equal(state.error, 'denied: requested access is not allowed');
});

test('preparingLine reports the registry phase and queued layers', () => {
  const state = createProgress(
    'cjrutherford/optimistic_tanuki_gateway:sha-a97ff1f',
    3,
    35
  );
  applyMessage(state, { status: 'Pulling fs layer', id: 'layer-a' });
  applyMessage(state, { status: 'Pulling fs layer', id: 'layer-b' });
  applyMessage(state, { status: 'Pulling fs layer', id: 'layer-b' });

  const line = preparingLine(state, 72);
  assert.ok(line.includes('gateway'), line);
  assert.ok(line.includes('Pulling fs layer, 2 layers'), line);
  assert.ok(line.includes('01:12'), line);
});

test('overallLine reports completed images, concurrency and elapsed time', () => {
  const line = overallLine(3, 12, 4, 65);
  assert.ok(line.includes('3/12'), line);
  assert.ok(line.includes('4 at a time'), line);
  assert.ok(line.includes('01:05'), line);
});
