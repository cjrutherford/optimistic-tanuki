import { findJargon, renderJargonBuster } from '../src/glossary.js';

describe('glossary', () => {
  it('finds terms in reading order without duplicates', () => {
    const hits = findJargon(
      'Council set the millage rate. A motion carried 6-0. The millage rate funds roads.'
    );
    expect(hits.map((h) => h.term)).toStrictEqual([
      'millage rate',
      'motion carried',
    ]);
    expect(hits[0].definition).toMatch(/property-tax/);
  });
  it('renders the jargon-buster block', () => {
    const md = renderJargonBuster([
      { term: 'quorum', definition: 'minimum members' },
    ]);
    expect(md).toMatch(/## Words worth knowing/);
    expect(md).toMatch(/\*\*quorum\*\* — minimum members/);
  });
  it('returns empty for plain text', () => {
    expect(findJargon('The dog ran in the park.')).toStrictEqual([]);
    expect(renderJargonBuster([])).toBe('');
  });
});
