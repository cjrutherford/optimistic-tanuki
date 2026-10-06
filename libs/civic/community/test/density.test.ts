import {
  DENSITY_TARGET,
  renderDensityReport,
  shortBy,
  standingOfDensity,
  type TownDensity,
} from '../src/density.js';

const town = (overrides: Partial<TownDensity> = {}): TownDensity => ({
  localitySlug: 'tifton-ga',
  town: 'Tifton',
  active: 0,
  everContributed: 0,
  reports: 0,
  corroborations: 0,
  corroborated: 0,
  quotable: 0,
  confirmed: 0,
  contradicted: 0,
  meetings: 0,
  meetingsWithContributions: 0,
  officials: 0,
  ...overrides,
});

describe('contributor density', () => {
  it('measures people, not contributions', () => {
    expect(standingOfDensity(0)).toBe('none');
    expect(standingOfDensity(DENSITY_TARGET.low - 1)).toBe('short');
    expect(standingOfDensity(DENSITY_TARGET.low)).toBe('in band');
    expect(standingOfDensity(DENSITY_TARGET.high + 1)).toBe('above');
    expect(shortBy(3)).toBe(DENSITY_TARGET.low - 3);
    expect(shortBy(20)).toBe(0);
  });

  it('lists the thinnest towns first, and says where to recruit', () => {
    const report = renderDensityReport(
      [
        town({ localitySlug: 'a-ga', town: 'Ample', active: 10 }),
        town({ localitySlug: 'b-ga', town: 'Bare', active: 0 }),
        town({ localitySlug: 'c-ga', town: 'Thin', active: 3 }),
      ],
      '2026-09-21'
    );
    const order = ['Bare', 'Thin', 'Ample'].map((name) =>
      report.indexOf(`| ${name} |`)
    );
    expect([...order].sort((x, y) => x - y)).toStrictEqual(order);
    expect(report).toMatch(/\*\*Bare\*\* has nobody contributing/u);
    expect(report).toMatch(/\*\*Thin\*\* needs 5 more/u);
    expect(report).not.toMatch(/\*\*Ample\*\* needs/u);
  });

  it('reports what the record said about the towns together', () => {
    const report = renderDensityReport(
      [town({ active: 9, confirmed: 4, contradicted: 1 })],
      '2026-09-21'
    );
    expect(report).toMatch(
      /4 reports borne out by a later record, 1 contradicted by one\./u
    );
  });

  it('shows coverage as a fraction, and a dash where the town published nothing', () => {
    const report = renderDensityReport(
      [
        town({
          town: 'Covered',
          active: 9,
          meetings: 4,
          meetingsWithContributions: 1,
        }),
        town({ town: 'Quiet', active: 9 }),
      ],
      '2026-09-21'
    );
    expect(report).toMatch(/\| Covered \|.*\| 1\/4 \|/u);
    expect(report).toMatch(/\| Quiet \|.*\| — \|/u);
  });
});
