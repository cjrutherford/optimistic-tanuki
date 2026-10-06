import {
  parseStoryLabels,
  scoreStories,
  type ScoredEvidence,
} from '../src/story-score.js';

const evidence = (
  key: string,
  storyId: number,
  sourceId: string,
  title: string,
  date: string
): ScoredEvidence => ({
  key,
  storyId,
  storyTitle: `story ${storyId}`,
  sourceId,
  title,
  date,
});

const labels = parseStoryLabels(`
version: 1
stories:
  - id: millage
    title: Millage rate
    evidence:
      - { source: city-docs, match: millage rate, date: 2026-08-24 }
      - { source: city-docs, match: millage rate, date: 2026-09-14 }
      - { source: city-paper, match: millage }
  - id: park
    title: Park grant
    evidence:
      - { source: city-docs, match: park grant }
      - { source: city-docs, match: land and water }
`);

describe('story scoring', () => {
  it('scores pairwise agreement and reports splits, merges, and unresolved labels', () => {
    const score = scoreStories(
      [
        evidence(
          '1:1',
          10,
          'city-docs',
          '4. Discussion - FY 27 Millage Rate',
          '2026-08-24'
        ),
        evidence(
          '2:1',
          10,
          'city-docs',
          '5. Millage Rate Tentative Proposal',
          '2026-09-14'
        ),
        evidence(
          '3:item',
          11,
          'city-paper',
          'Council sets millage',
          '2026-09-15'
        ),
        evidence(
          '2:2',
          12,
          'city-docs',
          '3. Park Grant Resolution 26-03',
          '2026-09-14'
        ),
        evidence(
          '2:3',
          12,
          'city-docs',
          '4. Sanitation Tipping Fee Increase',
          '2026-09-14'
        ),
      ],
      labels
    );
    // True: (1,2) millage. False: (park grant, tipping fee). Missed: (1,3), (2,3).
    expect([
      score.truePairs,
      score.falsePairs,
      score.missedPairs,
    ]).toStrictEqual([1, 1, 2]);
    expect(score.precision).toBe(0.5);
    expect(score.recall).toBe(0.333);
    expect(score.unresolved).toStrictEqual([
      { story: 'park', source: 'city-docs', match: 'land and water' },
    ]);
    expect(
      score.splits.map((split) => [
        split.story,
        split.engineStories.map((story) => story.id),
      ])
    ).toStrictEqual([['millage', [10, 11]]]);
    expect(
      score.merges.map((merge) => [
        merge.id,
        merge.groups.map((group) => group.label),
      ])
    ).toStrictEqual([[12, ['park', 'unlabeled:2:3']]]);
  });

  it('rejects labels without enough evidence to form a story', () => {
    expect(() =>
      parseStoryLabels(
        'version: 1\nstories:\n  - id: one\n    title: One\n    evidence:\n      - { source: a, match: b }\n'
      )
    ).toThrow(/at least two evidence/);
  });
});
