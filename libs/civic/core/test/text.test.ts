import { truncate, truncateSentences } from '../src/text.js';
import { explainZoning } from '../src/zoning.js';

describe('truncate', () => {
  it('cuts at word boundary with ellipsis', () => {
    expect(truncate('Both events will be held at the hall', 20)).toBe(
      'Both events will be…'
    );
    expect(truncate('Short', 20)).toBe('Short');
  });
  it('truncateSentences keeps whole sentences', () => {
    expect(
      truncateSentences(
        'First is short. Second is also short. Third runs long here.',
        40
      )
    ).toBe('First is short. Second is also short.…');
  });
});

describe('explainZoning', () => {
  it('decodes common codes without false positives', () => {
    const hits = explainZoning(
      'Rezone parcels from Residential Professional (RP) to General Business (GB); also R-15 and PDO apply.'
    );
    const codes = hits.map((h) => h.code);
    expect(
      codes.includes('RP') &&
        codes.includes('GB') &&
        codes.includes('R-15') &&
        codes.includes('PDO')
    ).toBeTruthy();
    expect(hits.find((h) => h.code === 'GB')!.definition).toMatch(/retail/i);
    expect(explainZoning('The dog ran in the park.')).toStrictEqual([]);
  });
});
