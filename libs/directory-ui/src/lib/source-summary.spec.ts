import { summarizeSources } from './source-summary';

const meta = (credit: string) => ({
  attribution: [credit],
  notices: ['CDLA Permissive 2.0'],
  termsUrls: ['https://cdla.dev/permissive-2.0/'],
});

describe('summarizeSources', () => {
  it('collapses case variants and repeated licences', () => {
    const out = summarizeSources([
      meta('Meta; Overture'),
      meta('meta; overture'),
      { attribution: ['AllThePlaces'], notices: ['CC0'], termsUrls: [] },
    ]);
    expect(out).toEqual([
      { credit: 'AllThePlaces', licenses: [{ name: 'CC0', url: null }] },
      {
        credit: 'Meta; Overture',
        licenses: [
          {
            name: 'CDLA Permissive 2.0',
            url: 'https://cdla.dev/permissive-2.0/',
          },
        ],
      },
    ]);
  });

  it('returns nothing when no listing carries a credit', () => {
    expect(
      summarizeSources([{ attribution: [], notices: [], termsUrls: [] }])
    ).toEqual([]);
  });
});
