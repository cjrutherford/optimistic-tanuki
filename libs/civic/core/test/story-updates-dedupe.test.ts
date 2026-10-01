import { dedupeArticleUpdates } from '../src/pipeline.js';

describe('story update de-duplication', () => {
  it('shows an article once, keeping the copy with a lead, and keeps every agenda line', () => {
    const updates = dedupeArticleUpdates([
      {
        text: 'Florida High survives thriller — WTXL',
        url: 'https://www.wtxl.com/story',
        article: true,
      },
      {
        text: 'Florida High survives thriller — Justin White',
        url: 'https://www.wtxl.com/story',
        detail: 'TALLAHASSEE, Fla. (WTXL) — Florida High moved to 5-0.',
        article: true,
      },
      {
        text: 'Millage rate — Agenda 09/14/2026',
        url: 'https://city.example/agenda',
        article: false,
      },
      {
        text: 'Water rates — Agenda 09/14/2026',
        url: 'https://city.example/agenda',
        article: false,
      },
    ]);
    expect(updates.length).toBe(3);
    expect(updates[0]!.detail).toBe(
      'TALLAHASSEE, Fla. (WTXL) — Florida High moved to 5-0.'
    );
    expect(
      updates.filter((update) => update.url === 'https://city.example/agenda')
        .length
    ).toBe(2);
    expect('article' in updates[0]!).toBe(false);
  });
});
