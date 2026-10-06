import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  acquirePublicationLock,
  prepareImmutableMarkdown,
  prepareMarkdown,
  publishMarkdown,
  withPublicationLock,
} from '../src/publication.js';

const LONG_STORY_FILENAME =
  'tifton-ga-meeting-title-agenda-09-08-2026-date-2026-09-08-content-284fbe5b60de44-70c128e7df7961010629c36280ae3dd92d3534f1355b8bdf95ca74155a15e5e8.md';
const LONG_STORY_TOKEN =
  'story-story-grounded-render-v3-70c128e7df7961010629c36280ae3dd92d3534f1355b8bdf95ca74155a15e5e8';

test('shared Markdown publisher is atomic and rejects traversal or blocked roots', async () => {
  const root = await mkdtemp(join(tmpdir(), 'civic-publication-'));
  const path = await publishMarkdown(
    root,
    'adel-ga',
    'daily.md',
    '# prior\n',
    'first'
  );
  expect(await readFile(path, 'utf8')).toBe('# prior\n');
  await expect(
    (() => prepareMarkdown(root, 'adel-ga', '../escape.md', '# bad\n', 'bad'))()
  ).rejects.toThrow(/unsafe|escapes/);
  await expect(
    (() =>
      prepareMarkdown(root, 'adel-ga', 'daily.md', '# bad\n', '../escape'))()
  ).rejects.toThrow(/unsafe|escapes/);
  const blocked = join(root, 'blocked');
  await writeFile(blocked, 'not a directory');
  await expect(
    (() =>
      publishMarkdown(blocked, 'adel-ga', 'daily.md', '# bad\n', 'blocked'))()
  ).rejects.toThrow(/directory|EEXIST|ENOTDIR/);
  expect(await readFile(path, 'utf8')).toBe('# prior\n');
});

test('immutable Markdown publication preserves an existing revision path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'civic-immutable-publication-'));
  const first = await prepareImmutableMarkdown(
    root,
    'adel-ga',
    'roads-input-a.md',
    '# first\n',
    'token-a'
  );
  await first.commit();
  const same = await prepareImmutableMarkdown(
    root,
    'adel-ga',
    'roads-input-a.md',
    '# first\n',
    'token-a'
  );
  await same.commit();
  await expect(
    (() =>
      prepareImmutableMarkdown(
        root,
        'adel-ga',
        'roads-input-a.md',
        '# changed\n',
        'token-b'
      ))()
  ).rejects.toThrow(/immutable|exists|different/i);
  const second = await prepareImmutableMarkdown(
    root,
    'adel-ga',
    'roads-input-b.md',
    '# changed\n',
    'token-b'
  );
  await second.commit();
  expect(
    await readFile(join(root, 'adel-ga', 'roads-input-a.md'), 'utf8')
  ).toBe('# first\n');
  expect(
    await readFile(join(root, 'adel-ga', 'roads-input-b.md'), 'utf8')
  ).toBe('# changed\n');
});

test('immutable publication bounds temporary names for the longest contract-qualified story artifact', async () => {
  const root = await mkdtemp(join(tmpdir(), 'civic-immutable-long-name-'));
  const prepared = await prepareImmutableMarkdown(
    root,
    'adel-ga',
    LONG_STORY_FILENAME,
    '# long story\n',
    LONG_STORY_TOKEN
  );
  const staged = await readdir(join(root, 'adel-ga'));
  expect(staged.length).toBe(1);
  expect(staged[0]!.length <= 255).toBeTruthy();
  await prepared.commit();
  expect(await readdir(join(root, 'adel-ga'))).toStrictEqual([
    LONG_STORY_FILENAME,
  ]);
  expect(
    await readFile(join(root, 'adel-ga', LONG_STORY_FILENAME), 'utf8')
  ).toBe('# long story\n');
});

test('concurrent immutable preparations with one basename use isolated bounded temps and clean up', async () => {
  const root = await mkdtemp(join(tmpdir(), 'civic-immutable-concurrent-'));
  const filename = `${'same-basename-'.repeat(8)}${'c'.repeat(64)}.md`;
  const content = '# same story\n';
  const [first, second] = await Promise.all([
    prepareImmutableMarkdown(
      root,
      'adel-ga',
      filename,
      content,
      `story-a-${'d'.repeat(96)}`
    ),
    prepareImmutableMarkdown(
      root,
      'adel-ga',
      filename,
      content,
      `story-b-${'e'.repeat(96)}`
    ),
  ]);
  const staged = await readdir(join(root, 'adel-ga'));
  expect(staged.length).toBe(2);
  expect(staged.every((entry) => entry.length <= 255)).toBeTruthy();
  await Promise.all([first.commit(), second.commit()]);
  expect(await readdir(join(root, 'adel-ga'))).toStrictEqual([filename]);
  expect(await readFile(join(root, 'adel-ga', filename), 'utf8')).toBe(content);
});

test('identical concurrent immutable preparations own distinct temps and both commit idempotently', async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'civic-immutable-identical-concurrent-')
  );
  const content = '# identical story\n';
  const [first, second] = await Promise.all([
    prepareImmutableMarkdown(
      root,
      'adel-ga',
      LONG_STORY_FILENAME,
      content,
      LONG_STORY_TOKEN
    ),
    prepareImmutableMarkdown(
      root,
      'adel-ga',
      LONG_STORY_FILENAME,
      content,
      LONG_STORY_TOKEN
    ),
  ]);
  const staged = await readdir(join(root, 'adel-ga'));
  expect(staged.length).toBe(2);
  expect(staged[0]).not.toBe(staged[1]);
  expect(staged.every((entry) => entry.length <= 255)).toBeTruthy();
  await Promise.all([first.commit(), second.commit()]);
  expect(await readdir(join(root, 'adel-ga'))).toStrictEqual([
    LONG_STORY_FILENAME,
  ]);
  expect(
    await readFile(join(root, 'adel-ga', LONG_STORY_FILENAME), 'utf8')
  ).toBe(content);
});

test('identical concurrent mutable preparations do not let abort unlink the committing preparation', async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'civic-mutable-identical-concurrent-')
  );
  const [first, second] = await Promise.all([
    prepareMarkdown(
      root,
      'adel-ga',
      LONG_STORY_FILENAME,
      '# same mutable story\n',
      'same-token'
    ),
    prepareMarkdown(
      root,
      'adel-ga',
      LONG_STORY_FILENAME,
      '# same mutable story\n',
      'same-token'
    ),
  ]);
  const staged = await readdir(join(root, 'adel-ga'));
  expect(staged.length).toBe(2);
  expect(staged[0]).not.toBe(staged[1]);
  await first.abort();
  await second.commit();
  expect(await readdir(join(root, 'adel-ga'))).toStrictEqual([
    LONG_STORY_FILENAME,
  ]);
  expect(
    await readFile(join(root, 'adel-ga', LONG_STORY_FILENAME), 'utf8')
  ).toBe('# same mutable story\n');
});

test('rollback of a long mutable artifact uses a bounded temporary and restores the original bytes', async () => {
  const root = await mkdtemp(
    join(tmpdir(), 'civic-publication-long-rollback-')
  );
  const first = await prepareMarkdown(
    root,
    'adel-ga',
    LONG_STORY_FILENAME,
    '# original\n',
    'story-first'
  );
  await first.commit();
  const replacement = await prepareMarkdown(
    root,
    'adel-ga',
    LONG_STORY_FILENAME,
    '# replacement\n',
    'story-second'
  );
  await replacement.commit();
  await replacement.rollback();
  expect(
    await readFile(join(root, 'adel-ga', LONG_STORY_FILENAME), 'utf8')
  ).toBe('# original\n');
  expect(await readdir(join(root, 'adel-ga'))).toStrictEqual([
    LONG_STORY_FILENAME,
  ]);
});

test('publication lock releases after errors and recovers stale owners', async () => {
  const root = await mkdtemp(join(tmpdir(), 'civic-publication-lock-'));
  const lockPath = join(root, 'publication.lock');
  await expect(
    (() =>
      withPublicationLock(lockPath, async () => {
        throw new Error('forced lock operation failure');
      }))()
  ).rejects.toThrow(/forced lock operation failure/);
  const afterError = await acquirePublicationLock(lockPath, {
    waitMs: 100,
    staleMs: 60_000,
  });
  await afterError.release();
  const abandoned = await acquirePublicationLock(lockPath, { waitMs: 100 });
  const recovered = await acquirePublicationLock(lockPath, {
    waitMs: 100,
    staleMs: 0,
  });
  try {
    expect(recovered.token).not.toBe(abandoned.token);
  } finally {
    expect(await abandoned.renew()).toBe(false);
    await abandoned.release();
    await recovered.release();
  }
});

test('publication lock heartbeat prevents stale recovery during a long operation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'civic-publication-heartbeat-'));
  const lockPath = join(root, 'publication.lock');
  const first = await acquirePublicationLock(lockPath, {
    waitMs: 500,
    staleMs: 120,
    heartbeatMs: 20,
    pollMs: 10,
  });
  let contenderAcquired = false;
  const contender = (async () => {
    const second = await acquirePublicationLock(lockPath, {
      waitMs: 1_000,
      staleMs: 120,
      heartbeatMs: 20,
      pollMs: 10,
    });
    contenderAcquired = true;
    await second.release();
  })();
  try {
    await new Promise((resolve) => setTimeout(resolve, 360));
    expect(contenderAcquired).toBe(false);
  } finally {
    await first.release();
  }
  await contender;
  expect(contenderAcquired).toBe(true);
});
