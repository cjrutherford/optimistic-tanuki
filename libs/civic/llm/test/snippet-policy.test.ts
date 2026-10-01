import {
  validateClusterAnalysis,
  validateBriefAnalysis,
} from '../src/validators.js';

describe('snippet evidence policy', () => {
  it('relegates all-snippet cluster claims', () => {
    const result = validateClusterAnalysis(
      JSON.stringify({
        headline: 'Headline',
        summary: 'A snippet says roads changed.',
        whyItMatters: 'Residents should watch updates.',
        citations: [{ sourceKey: 'restricted', civicItemId: 9 }],
      }),
      [{ sourceKey: 'restricted', civicItemId: 9, snippetOnly: true }]
    );
    expect(result.relegated).toBe(true);
  });
  it('rejects mixed full and snippet claims without a limitation', () => {
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline: 'Update',
          summary: 'Full report and snippet.',
          whyItMatters: 'Residents should know.',
          citations: [
            { sourceKey: 'full', civicItemId: 1 },
            { sourceKey: 'restricted', civicItemId: 9, snippetOnly: true },
          ],
        }),
        [
          { sourceKey: 'full', civicItemId: 1, snippetOnly: false },
          { sourceKey: 'restricted', civicItemId: 9, snippetOnly: true },
        ]
      )
    ).toThrow(/limitation/i);
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({
          bullets: [
            {
              text: 'Update',
              citations: [
                { sourceKey: 'full', civicItemId: 1 },
                { sourceKey: 'restricted', civicItemId: 9 },
              ],
            },
          ],
        }),
        [
          { sourceKey: 'full', civicItemId: 1, snippetOnly: false },
          { sourceKey: 'restricted', civicItemId: 9, snippetOnly: true },
        ]
      )
    ).toThrow(/limitation/i);
  });

  it('retains the authoritative evidence URL while ignoring model URL fields', () => {
    const result = validateClusterAnalysis(
      JSON.stringify({
        headline: 'Update',
        summary: 'Full report.',
        whyItMatters: 'Residents should know.',
        citations: [
          {
            sourceKey: 'full',
            civicItemId: 1,
            articleUrl: 'https://evil.example',
          },
        ],
      }),
      [
        {
          sourceKey: 'full',
          civicItemId: 1,
          snippetOnly: false,
          articleUrl: 'https://official.example/item',
        },
      ]
    );
    expect(result.citations).toStrictEqual([
      {
        sourceKey: 'full',
        civicItemId: 1,
        articleUrl: 'https://official.example/item',
      },
    ]);
    expect(JSON.stringify(result).includes('evil.example')).toBe(false);
  });
});
