import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assembleOutsiderBriefing } from '../src/briefing2.js';
import {
  communityForEdition,
  readCommunitySnapshot,
  snapshotPath,
  type CommunityQuote,
  type CommunitySnapshot,
} from '../src/community-evidence.js';

const quote = (overrides: Partial<CommunityQuote> = {}): CommunityQuote => ({
  id: 'q1',
  quote:
    'The council took the vote after the room had emptied, just before ten.',
  attribution: 'a resident',
  office: null,
  subject: 'City council meeting',
  occurredOn: '2026-09-14',
  submittedAt: '2026-09-15T12:00:00.000Z',
  path: 'confirmed',
  confirmedBy: {
    title: 'Minutes 09/14/2026',
    url: 'https://town.example/minutes',
    publisher: 'City of Tifton',
    date: '2026-09-16',
  },
  url: '/contributors/abc',
  ...overrides,
});

const snapshot = (
  overrides: Partial<CommunitySnapshot> = {}
): CommunitySnapshot => ({
  generatedAt: '2026-09-17T00:00:00.000Z',
  localitySlug: 'tifton-ga',
  quotes: [quote()],
  corrections: [],
  ...overrides,
});

const briefing = (community?: {
  quotes: CommunityQuote[];
  corrections: CommunitySnapshot['corrections'];
}) =>
  assembleOutsiderBriefing({
    locality: 'Tifton, GA',
    cadence: 'daily',
    periodStart: '2026-09-14',
    periodEnd: '2026-09-14',
    lede: 'One new item.',
    inBrief: ['Something happened.'],
    newItems: [],
    upcoming: [],
    threads: [],
    appendix: [],
    sourceCount: 2,
    model: 'test',
    ...(community ? { community } : {}),
  });

describe('community material in a briefing', () => {
  it('quotes the contributor and attributes it, rather than restating it', () => {
    const markdown = briefing({ quotes: [quote()], corrections: [] });
    expect(markdown).toMatch(/## From the community/u);
    expect(markdown).toMatch(
      /> The council took the vote after the room had emptied, just before ten\./u
    );
    expect(markdown).toMatch(/> — a resident, 2026-09-14/u);
    expect(markdown).toMatch(
      /Daylight quotes it; it is not Daylight's own account\./u
    );
    expect(markdown).toMatch(
      /Minutes 09\/14\/2026, 2026-09-16 \(City of Tifton\)/u
    );
  });

  it("labels an official's material as what was checked, not as a resident report", () => {
    const markdown = briefing({
      quotes: [
        quote({
          path: 'official-record',
          office: 'City Clerk',
          attribution: 'jdoe',
          confirmedBy: null,
        }),
      ],
      corrections: [],
    });
    expect(markdown).toMatch(/> — jdoe, City Clerk, 2026-09-14/u);
    expect(markdown).toMatch(
      /confirmed by calling the number the town publishes/u
    );
    expect(markdown).not.toMatch(/corroborated independently/u);
  });

  it('carries a dated correction rather than changing what was published', () => {
    const markdown = briefing({
      quotes: [],
      corrections: [
        {
          id: 'c1',
          at: '2026-09-20',
          affects: '2026-09-14',
          text: "A resident's account of the meeting has been withdrawn.",
        },
      ],
    });
    expect(markdown).toMatch(/## Corrections/u);
    expect(markdown).toMatch(
      /- \*\*2026-09-20\*\* — A resident's account of the meeting has been withdrawn\./u
    );
  });

  it('adds nothing at all when a run is given no community material', () => {
    const markdown = briefing();
    expect(markdown).not.toMatch(/From the community/u);
    expect(markdown).not.toMatch(/Corrections/u);
  });

  it("takes the material of the edition's own period, and the corrections owed to it", () => {
    const view = communityForEdition(
      snapshot({
        quotes: [
          quote({ id: 'a', occurredOn: '2026-09-14' }),
          quote({ id: 'b', occurredOn: '2026-09-02' }),
        ],
        corrections: [
          {
            id: 'late',
            at: '2026-10-01',
            affects: '2026-09-14',
            text: 'corrects this edition',
          },
          {
            id: 'other',
            at: '2026-10-01',
            affects: '2026-08-01',
            text: 'corrects another',
          },
        ],
      }),
      '2026-09-14',
      '2026-09-14'
    );
    expect(view.quotes.map((q) => q.id)).toStrictEqual(['a']);
    expect(view.corrections.map((c) => c.id)).toStrictEqual(['late']);
  });

  it('reads a snapshot from disk, and treats a broken one as none', () => {
    const directory = mkdtempSync(join(tmpdir(), 'community-'));
    try {
      expect(readCommunitySnapshot(directory, 'tifton-ga')).toBe(null);
      expect(readCommunitySnapshot(undefined, 'tifton-ga')).toBe(null);
      writeFileSync(
        snapshotPath(directory, 'tifton-ga'),
        JSON.stringify(snapshot())
      );
      expect(readCommunitySnapshot(directory, 'tifton-ga')?.quotes.length).toBe(
        1
      );
      writeFileSync(snapshotPath(directory, 'tifton-ga'), '{ not json');
      expect(readCommunitySnapshot(directory, 'tifton-ga')).toBe(null);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
