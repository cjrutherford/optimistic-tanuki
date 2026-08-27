import { toStringList } from './to-string-list';

/**
 * `budgetRange` is declared `string[]` but the wizard's single-select wrote a
 * bare string, so both the prompt builder and the deterministic source picker
 * called array methods on a string. The fallback shared the fault, so the whole
 * analysis returned a 500 instead of degrading.
 */
describe('toStringList', () => {
  it('passes a list through, dropping blanks', () => {
    expect(toStringList(['$5k-$25k', '', '  ', '$100k+'])).toEqual([
      '$5k-$25k',
      '$100k+',
    ]);
  });

  it('wraps a single string, which is the shape that broke analysis', () => {
    expect(toStringList('$25k-$100k')).toEqual(['$25k-$100k']);
  });

  it('treats absent or empty values as no answer', () => {
    for (const value of [undefined, null, '', '   ', []]) {
      expect(toStringList(value)).toEqual([]);
    }
  });

  it('ignores non-string entries rather than throwing on them', () => {
    expect(toStringList([1, '$5k-$25k', null, {}])).toEqual(['$5k-$25k']);
    expect(toStringList(42)).toEqual([]);
  });
});
