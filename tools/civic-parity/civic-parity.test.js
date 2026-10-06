const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const load = () => import('./civic-parity.mjs');

const baseline = (artifacts, runs = []) => ({
  recordedAt: '2026-09-20T00:00:00.000Z',
  normalisation: 'timestamps',
  runs,
  artifacts,
});

describe('civic parity comparison', () => {
  it('normalises run-time timestamps but leaves dates that are content', async () => {
    const { normalize } = await load();
    expect(
      normalize('- Source — fetched 2026-09-20T19:06:02.277Z (unavailable)')
    ).toBe(
      normalize('- Source — fetched 2026-09-20T19:11:56.734Z (unavailable)')
    );
    expect(normalize('# Tifton, GA — daily briefing, 2026-09-17')).not.toBe(
      normalize('# Tifton, GA — daily briefing, 2026-09-16')
    );
  });

  it('reports changed, added, and removed artifacts', async () => {
    const { compare } = await load();
    expect(
      compare(
        baseline({
          ga: { 'briefings/a.md': 'aaa', 'briefings/gone.md': 'ccc' },
        }),
        baseline({ ga: { 'briefings/a.md': 'bbb', 'briefings/new.md': 'ddd' } })
      )
    ).toEqual([
      { corpus: 'ga', artifact: 'briefings/a.md', kind: 'changed' },
      { corpus: 'ga', artifact: 'briefings/gone.md', kind: 'removed' },
      { corpus: 'ga', artifact: 'briefings/new.md', kind: 'added' },
    ]);
  });

  it('is silent when nothing moved', async () => {
    const { compare } = await load();
    const same = { ga: { 'briefings/a.md': 'aaa' } };
    expect(compare(baseline(same), baseline(same))).toEqual([]);
  });
});

describe('civic parity verify', () => {
  let root;
  let poc;
  let lines;
  const io = () => ({
    out: (line) => lines.push(line),
    err: (line) => lines.push(line),
  });

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'civic-parity-'));
    poc = path.join(root, 'poc');
    fs.mkdirSync(path.join(poc, 'golden'), { recursive: true });
    lines = [];
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  /** A stand-in replay that publishes one briefing per town into --artifacts. */
  const writeStubReplay = (body) => {
    const script = path.join(root, 'replay.js');
    fs.writeFileSync(
      script,
      `const argv = process.argv;
const at = (name) => argv[argv.indexOf('--' + name) + 1];
const fs = require('node:fs');
const path = require('node:path');
const towns = [];
for (let i = argv.indexOf('--towns') + 1; !argv[i].startsWith('--'); i += 1) towns.push(argv[i]);
for (const town of towns) {
  const dir = path.join(at('artifacts'), 'briefings', town);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, at('from') + '-daily.md'), ${JSON.stringify(
    body
  )} + ' fetched ' + new Date().toISOString());
}
fs.writeFileSync(path.join(at('artifacts'), 'args.json'), JSON.stringify(argv.slice(2)));
`
    );
    return script;
  };

  const writeBaseline = async (body) => {
    const { normalize } = await load();
    const hash = require('node:crypto')
      .createHash('sha256')
      .update(normalize(`${body} fetched 2026-01-01T00:00:00.000Z`))
      .digest('hex');
    fs.writeFileSync(
      path.join(poc, 'golden', 'baseline.json'),
      JSON.stringify(
        baseline(
          { ga: { 'briefings/nashville-ga/2026-09-08-daily.md': hash } },
          [
            {
              corpus: 'ga',
              towns: ['nashville-ga'],
              from: '2026-09-08',
              to: '2026-09-09',
            },
          ]
        )
      )
    );
  };

  const env = (replay) => ({
    DAYLIGHT_POC_DIR: poc,
    CIVIC_PARITY_REPLAY: replay,
    CIVIC_PARITY_WORK: path.join(root, 'work'),
    CIVIC_PARITY_DATABASE_URL: 'postgres://db/parity_{corpus}',
  });

  it('skips with a reason when the POC checkout is not configured', async () => {
    const { verify } = await load();
    expect(verify({ env: {}, cwd: root, argv: [], ...io() })).toBe(0);
    expect(lines).toEqual(['SKIPPED: DAYLIGHT_POC_DIR is not set']);
  });

  it('fails a skip when the gate is required', async () => {
    const { verify } = await load();
    expect(verify({ env: {}, cwd: root, argv: ['--require'], ...io() })).toBe(
      1
    );
  });

  it('says civic-briefing is not built yet when the replay entry is missing', async () => {
    const { verify } = await load();
    await writeBaseline('# Briefing');
    expect(
      verify({
        env: env(path.join(root, 'missing.js')),
        cwd: root,
        argv: [],
        ...io(),
      })
    ).toBe(0);
    expect(lines[0]).toMatch(
      /^SKIPPED: civic-briefing replay is not built yet/
    );
  });

  it('skips until a per-corpus Postgres URL is configured', async () => {
    const { verify } = await load();
    await writeBaseline('# Briefing');
    const settings = {
      ...env(writeStubReplay('# Briefing')),
      CIVIC_PARITY_DATABASE_URL: 'postgres://db/parity',
    };
    expect(verify({ env: settings, cwd: root, argv: [], ...io() })).toBe(0);
    expect(lines[0]).toMatch(/^SKIPPED: CIVIC_PARITY_DATABASE_URL/);
  });

  it('passes when the replay reproduces the baseline', async () => {
    const { verify } = await load();
    await writeBaseline('# Briefing');
    expect(
      verify({
        env: env(writeStubReplay('# Briefing')),
        cwd: root,
        argv: [],
        ...io(),
      })
    ).toBe(0);
    expect(lines.at(-1)).toBe('identical to the baseline: 1 artifacts');
  });

  it('fails and names the artifact when the replay output changes', async () => {
    const { verify } = await load();
    await writeBaseline('# Briefing');
    expect(
      verify({
        env: env(writeStubReplay('# Different')),
        cwd: root,
        argv: [],
        ...io(),
      })
    ).toBe(1);
    expect(lines).toContain(
      '- ga/briefings/nashville-ga/2026-09-08-daily.md: changed'
    );
  });

  it('reads corpora and localities from the POC and writes only to the work directory', async () => {
    const { verify } = await load();
    await writeBaseline('# Briefing');
    verify({
      env: env(writeStubReplay('# Briefing')),
      cwd: root,
      argv: [],
      ...io(),
    });
    const args = JSON.parse(
      fs.readFileSync(path.join(root, 'work', 'ga', 'out', 'args.json'), 'utf8')
    );
    const after = (flag) => args[args.indexOf(flag) + 1];
    expect(after('--corpus')).toBe(path.join(poc, 'data', 'corpus', 'ga'));
    expect(after('--localities')).toBe(path.join(poc, 'localities'));
    expect(after('--database')).toBe('postgres://db/parity_ga');
    expect(after('--backfill-days')).toBe('120');
    expect(fs.readdirSync(poc)).toEqual(['golden']);
  });

  it('gives each corpus its own database from a URL template', async () => {
    const { databaseUrl } = await load();
    expect(databaseUrl('postgres://db/parity_{corpus}', 'ct')).toBe(
      'postgres://db/parity_ct'
    );
  });

  it('refuses a work directory inside the POC checkout', async () => {
    const { verify } = await load();
    await writeBaseline('# Briefing');
    expect(() =>
      verify({
        env: {
          ...env(writeStubReplay('x')),
          CIVIC_PARITY_WORK: path.join(poc, 'out'),
        },
        cwd: root,
        argv: [],
        ...io(),
      })
    ).toThrow(/read-only/);
  });
});
