import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadLocalityRegistry,
  parseLocalityConfig,
  renderLocalityRegistry,
  writeLocalityRegistry,
} from '../src/index';
import type { LocalityConfig, LocalityRow, SourceRow } from '../src/index';

interface SeedCity {
  slug: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
}

const fixtures = join(__dirname, 'fixtures', 'localities');
const tmpDirs: string[] = [];
const tmp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'registry-render-'));
  tmpDirs.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

function toRows(localities: readonly LocalityConfig[]): {
  localityRows: LocalityRow[];
  sourceRows: SourceRow[];
} {
  const sourceRows: SourceRow[] = [];
  const localityRows = localities.map((l): LocalityRow => {
    l.sources.forEach((s, index) =>
      sourceRows.push({
        id: `${l.slug}-${index}`,
        sourceKey: s.sourceKey,
        ownerSlug: s.ownerSlug,
        coverage: s.coverage,
        adapter: s.adapter,
        name: s.name,
        url: s.url,
        kind: s.kind,
        enabled: s.enabled !== false,
        config: s.config ? JSON.stringify(s.config) : null,
        desk: s.desk ?? null,
        accessMode: s.accessMode ?? null,
        accessRestrictionReason: s.accessRestrictionReason ?? null,
        restrictionPolicyUrl: s.restrictionPolicyUrl ?? null,
        aggregateDiscovery: s.aggregateDiscovery ?? null,
        aggregateUrl: s.aggregateUrl ?? null,
        coverageCapabilities: s.coverageCapabilities
          ? JSON.stringify(s.coverageCapabilities)
          : null,
      })
    );
    return {
      slug: l.slug,
      name: l.name,
      state: l.state,
      timezone: l.timezone,
      lat: l.lat,
      lon: l.lon,
      kind: l.kind,
      parents: JSON.stringify(l.parents),
      edition: l.edition,
      aliases: l.aliases ? JSON.stringify(l.aliases) : null,
      topics: JSON.stringify(l.topics),
      cadence: JSON.stringify(l.cadence),
      websites: l.websites ? JSON.stringify(l.websites) : null,
      excludePhrases: l.excludePhrases
        ? JSON.stringify(l.excludePhrases)
        : null,
      officials: l.officials ? JSON.stringify(l.officials) : null,
      active: true,
    };
  });
  return { localityRows, sourceRows };
}

const town = (
  slug: string,
  parents: string[],
  extra: Partial<LocalityRow> = {}
): LocalityRow => ({
  slug,
  name: slug,
  state: 'GA',
  timezone: 'America/New_York',
  lat: 31,
  lon: -83,
  kind: 'town',
  parents: JSON.stringify(parents),
  ...extra,
});
const source = (
  id: string,
  ownerSlug: string,
  extra: Partial<SourceRow> = {}
): SourceRow => ({
  id,
  sourceKey: id,
  ownerSlug,
  adapter: 'rss',
  name: id,
  url: `https://example.org/${id}.xml`,
  kind: 'news',
  enabled: true,
  ...extra,
});
const reasons = (r: { excluded: { key: string; reason: string }[] }) =>
  Object.fromEntries(r.excluded.map((e) => [e.key, e.reason]));

describe('renderLocalityRegistry', () => {
  it('round-trips the fixture registry', () => {
    const original = loadLocalityRegistry(fixtures);
    const { localityRows, sourceRows } = toRows(original.all());
    const rendered = renderLocalityRegistry(localityRows, sourceRows);
    // Only disabled sources are left out.
    expect(
      rendered.excluded.filter((e) => e.reason !== 'disabled')
    ).toStrictEqual([]);
    const dir = join(tmp(), 'localities');
    writeLocalityRegistry(dir, rendered.files);
    const again = loadLocalityRegistry(dir);

    const shape = (l: LocalityConfig) => ({
      slug: l.slug,
      name: l.name,
      state: l.state,
      kind: l.kind,
      parents: l.parents,
      edition: l.edition,
      broad: l.broad === true,
      topics: l.topics,
      cadence: l.cadence,
      websites: l.websites ?? [],
      excludePhrases: l.excludePhrases ?? [],
      officials: l.officials ?? null,
      sources: l.sources
        .filter((s) => s.enabled !== false)
        .map((s) => ({ ...s, enabled: undefined })),
    });
    const sortBySlug = (list: readonly LocalityConfig[]) =>
      list.map(shape).sort((a, b) => a.slug.localeCompare(b.slug));
    expect(sortBySlug(again.all())).toStrictEqual(sortBySlug(original.all()));
    expect(
      again
        .editions()
        .map((l) => l.slug)
        .sort()
    ).toStrictEqual(
      original
        .editions()
        .map((l) => l.slug)
        .sort()
    );
    for (const l of original.all())
      expect(again.sourcesForRun(l.slug)).toStrictEqual(
        original.sourcesForRun(l.slug).map((s) => ({ ...s }))
      );
  });

  it('carries excludePhrases and officials through the fixture round trip', () => {
    const original = loadLocalityRegistry(fixtures);
    expect(original.get('nashville-ga')?.excludePhrases).toStrictEqual([
      'Nashville, Tennessee',
      'Nashville, Tenn.',
      'Nashville, TN',
    ]);
    const { localityRows, sourceRows } = toRows(original.all());
    const dir = join(tmp(), 'localities');
    writeLocalityRegistry(
      dir,
      renderLocalityRegistry(localityRows, sourceRows).files
    );
    expect(
      loadLocalityRegistry(dir).get('nashville-ga')?.excludePhrases
    ).toStrictEqual(original.get('nashville-ga')?.excludePhrases);
  });

  it('renders officials, and excludes a row whose officials or excludePhrases are invalid', () => {
    const officials = {
      domains: ['groton-ct.gov'],
      roster: [
        {
          name: 'Pat Doe',
          office: 'Mayor',
          source: 'https://www.groton-ct.gov/mayor',
        },
      ],
      callbackNumberSource: 'https://www.groton-ct.gov/contact',
    };
    const rendered = renderLocalityRegistry(
      [
        town('good', [], {
          officials: JSON.stringify(officials),
          excludePhrases: JSON.stringify(['Good, Ohio']),
        }),
        town('bad-officials', [], {
          officials: JSON.stringify({ domains: [] }),
        }),
        town('bad-phrases', [], { excludePhrases: JSON.stringify('nope') }),
      ],
      []
    );
    expect(rendered.files.map((f) => f.relativePath)).toStrictEqual([
      'ga/good.yaml',
    ]);
    expect(rendered.files[0].contents).toContain('Good, Ohio');
    expect(rendered.files[0].contents).toContain('groton-ct.gov');
    expect(Object.keys(reasons(rendered)).sort()).toStrictEqual([
      'bad-officials',
      'bad-phrases',
    ]);
  });

  it('is deterministic and each file parses alone', () => {
    const rows = [town('b-ga', ['a-ga']), town('a-ga', [])];
    const first = renderLocalityRegistry(rows, [source('s1', 'b-ga')]);
    const second = renderLocalityRegistry([...rows].reverse(), [
      source('s1', 'b-ga'),
    ]);
    expect(first).toStrictEqual(second);
    expect(first.files.map((f) => f.relativePath)).toStrictEqual([
      'ga/a-ga.yaml',
      'ga/b-ga.yaml',
    ]);
    for (const f of first.files) parseLocalityConfig(f.contents);
  });

  it('excludes bad rows with reasons, and what depends on them', () => {
    const result = renderLocalityRegistry(
      [
        town('root', []),
        town('ok', ['root']),
        town('orphan', ['nowhere']),
        town('orphan-child', ['orphan']),
        town('loop-a', ['loop-b']),
        town('loop-b', ['loop-a']),
        town('loop-child', ['loop-a']),
        town('bad-tz', ['root'], { timezone: 'Mars/Olympus' }),
        town('bad-tz-child', ['bad-tz']),
        town('', ['root'], { name: '' }),
        town('nameless', ['root'], { name: '' }),
        town('gone', ['root'], { active: false }),
        town('gone-child', ['gone']),
        town('edition-no-cadence', ['root'], { edition: true }),
      ],
      [
        source('keep', 'ok'),
        source('dup', 'ok'),
        source('dup-2', 'root', { sourceKey: 'dup' }),
        source('under-orphan', 'orphan'),
        source('off', 'ok', { enabled: false }),
        source('bad-url', 'ok', { url: 'ftp://nope' }),
        source('no-owner', 'ghost'),
      ]
    );
    const r = reasons(result);
    expect(r['orphan']).toMatch(/missing parent nowhere/);
    expect(r['orphan-child']).toMatch(/parent orphan/);
    expect(r['loop-a']).toMatch(/cycle/);
    expect(r['loop-b']).toMatch(/cycle/);
    expect(r['loop-child']).toMatch(/cycle/);
    expect(r['bad-tz']).toMatch(/timezone/);
    expect(r['bad-tz-child']).toMatch(/bad-tz is excluded/);
    expect(r['nameless']).toMatch(/name/);
    expect(r['gone']).toBe('inactive');
    expect(r['gone-child']).toMatch(/gone is excluded/);
    expect(r['edition-no-cadence']).toMatch(/cadence/);
    expect(r['under-orphan']).toMatch(/owner orphan/);
    expect(r['off']).toBe('disabled');
    expect(r['bad-url']).toMatch(/url/);
    expect(r['no-owner']).toMatch(/owner ghost/);
    expect(r['dup']).toMatch(/duplicate sourceKey dup/);

    const dir = join(tmp(), 'localities');
    writeLocalityRegistry(dir, result.files);
    const registry = loadLocalityRegistry(dir);
    expect(
      registry
        .all()
        .map((l) => l.slug)
        .sort()
    ).toStrictEqual(['ok', 'root']);
    expect(
      registry
        .all()
        .flatMap((l) => l.sources.map((s) => s.sourceKey))
        .sort()
    ).toStrictEqual(['dup', 'keep']);
  });

  it('excludes a duplicate locality slug', () => {
    const result = renderLocalityRegistry([town('a', []), town('a', [])], []);
    expect(reasons(result)['a']).toMatch(/duplicate locality slug/);
    expect(result.files).toHaveLength(1);
  });

  it('renders 425 seeded towns under state roots that load and validate', () => {
    const { localities: cities } = JSON.parse(
      readFileSync(
        join(__dirname, '../../../../apps/social/src/data/seed-cities.json'),
        'utf8'
      )
    ) as { localities: SeedCity[] };
    const states = [...new Set(cities.map((c) => c.state))].sort();
    const rows: LocalityRow[] = [
      town('us', [], { name: 'United States', state: 'US', kind: 'country' }),
      ...states.map((s) =>
        town(`state-${s.toLowerCase()}`, ['us'], { state: s, kind: 'state' })
      ),
      ...cities.map((c) =>
        town(c.slug, [`state-${c.state.toLowerCase()}`], {
          name: c.city,
          state: c.state,
          lat: c.lat,
          lon: c.lng,
          edition: true,
          cadence: JSON.stringify(['weekly']),
          topics: JSON.stringify(['council']),
        })
      ),
    ];
    const sources = cities
      .slice(0, 50)
      .map((c) => source(`${c.slug}-feed`, c.slug));
    const result = renderLocalityRegistry(rows, sources);
    expect(result.excluded).toStrictEqual([]);
    expect(result.files).toHaveLength(rows.length);
    const dir = join(tmp(), 'localities');
    writeLocalityRegistry(dir, result.files);
    const registry = loadLocalityRegistry(dir);
    expect(registry.all()).toHaveLength(rows.length);
    expect(registry.editions()).toHaveLength(cities.length);
    expect(registry.sourcesForRun('us')).toHaveLength(50);
  });
});

describe('writeLocalityRegistry', () => {
  const file = (relativePath: string, contents = 'x: 1\n') => ({
    relativePath,
    contents,
  });

  it('works on first run', () => {
    const dir = join(tmp(), 'nested', 'localities');
    writeLocalityRegistry(dir, [file('ga/a.yaml')]);
    expect(existsSync(join(dir, 'ga', 'a.yaml'))).toBe(true);
  });

  it('replaces an existing directory and leaves no temp siblings', () => {
    const base = tmp();
    const dir = join(base, 'localities');
    mkdirSync(join(dir, 'old'), { recursive: true });
    writeFileSync(join(dir, 'old', 'stale.yaml'), 'stale: true\n');
    writeLocalityRegistry(dir, [file('ga/new.yaml')]);
    expect(existsSync(join(dir, 'old'))).toBe(false);
    expect(existsSync(join(dir, 'ga', 'new.yaml'))).toBe(true);
    expect(readdirSync(base)).toStrictEqual(['localities']);
  });
});
