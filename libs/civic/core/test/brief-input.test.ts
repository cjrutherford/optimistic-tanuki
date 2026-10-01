import {
  BRIEF_EVIDENCE_BODY_CHARS,
  BRIEF_EVIDENCE_MAX_ITEMS,
  buildBriefInput,
  BRIEF_LEAD_EVIDENCE_ITEMS,
  BRIEF_LEAD_BODY_CHARS,
} from '../src/pipeline.js';
import type { CivicItemRow } from '../src/schema.js';

const item = (id: number, day: number): CivicItemRow =>
  ({
    id,
    sourceId: 'town-news',
    localitySlug: 'town-a',
    scopeSlug: 'town-a',
    scopeKind: 'town',
    kind: 'news',
    title: `Story ${id}`,
    body: `Story ${id} body. ${'Detail sentence for residents. '.repeat(80)}`,
    summary: null,
    publishedAt: `2026-08-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    eventDate: null,
    topics: null,
    uris: null,
    hash: `h${id}`,
    createdAt: '2026-09-01T00:00:00.000Z',
  } as CivicItemRow);

test('a brief cites the highest-priority evidence within the prompt budget, with bodies cut to length', () => {
  const clusters = [
    {
      kind: 'news' as const,
      topic: 'older',
      items: Array.from({ length: 20 }, (_, index) =>
        item(index + 1, 1 + (index % 9))
      ),
    },
    {
      kind: 'news' as const,
      topic: 'newer',
      items: Array.from({ length: 30 }, (_, index) =>
        item(index + 101, 10 + (index % 20))
      ),
    },
  ];
  const input = buildBriefInput({
    locality: { name: 'Town A', state: 'GA' },
    periodStart: '2026-08-30',
    periodEnd: '2026-08-31',
    editionMode: 'bootstrap',
    clusters,
    agendaRowsByItemId: new Map(),
    sourceNames: new Map(),
  });
  const evidence = input.clusterSummaries.flatMap(
    (cluster) => cluster.evidence ?? []
  );
  expect(evidence.length).toBe(BRIEF_EVIDENCE_MAX_ITEMS);
  // The evidence most likely to be cited gets a larger body so a correct lead
  // bullet is not rejected for figures that fell past the cut.
  expect(
    evidence
      .slice(0, BRIEF_LEAD_EVIDENCE_ITEMS)
      .every((entry) => (entry.body ?? '').length <= BRIEF_LEAD_BODY_CHARS)
  ).toBeTruthy();
  expect(
    evidence
      .slice(BRIEF_LEAD_EVIDENCE_ITEMS)
      .every((entry) => (entry.body ?? '').length <= BRIEF_EVIDENCE_BODY_CHARS)
  ).toBeTruthy();
  expect(
    input.clusterSummaries.map((cluster) => cluster.heading.endsWith('newer'))
  ).toStrictEqual([true]);
  expect(input.editionMode).toBe('bootstrap');
});
