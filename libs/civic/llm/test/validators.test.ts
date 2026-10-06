import type { LlmEvidence } from '../src/contracts.js';
import {
  firstSentences,
  validateBriefPlan,
  salvageJson,
  fillFromPlan,
  orderPlanByConsequence,
  isRefusal,
  keyTokens,
  missingTokens,
  stripFences,
  tryParseJsonArray,
  validateClaimGrounding,
  validateClusterAnalysis,
  validateBriefAnalysis,
  validateStoryAnalysis,
  validateAgendaAnalysis,
  validateAgendaSemantics,
} from '../src/validators.js';

describe('validators', () => {
  it('stripFences removes code fences', () => {
    expect(stripFences('```json\n[1]\n```')).toBe('[1]');
  });
  it('tryParseJsonArray parses fenced arrays, rejects objects', () => {
    expect(tryParseJsonArray('```json\n[{"a":1}]\n```')).toStrictEqual([
      { a: 1 },
    ]);
    expect(tryParseJsonArray('{"a":1}')).toBe(null);
    expect(tryParseJsonArray('nope')).toBe(null);
  });
  it('isRefusal catches refusals', () => {
    expect(isRefusal('I cannot provide a summary of the given text.')).toBe(
      true
    );
    expect(isRefusal('The council meets Monday.')).toBe(false);
  });
  it('missingTokens finds dropped case IDs and dates', () => {
    const src = 'Case CU-2026-11, parcel 0123-045, hearing Oct 6 2026';
    const tokens = keyTokens(src);
    expect(tokens.includes('CU-2026-11')).toBeTruthy();
    expect(
      missingTokens('Case CU-2026-11 heard Oct 6 2026', tokens).length >= 1
    ).toStrictEqual(true);
    expect(missingTokens(src, tokens)).toStrictEqual([]);
  });
  it('firstSentences extracts deterministically', () => {
    expect(firstSentences('One. Two. Three.', 2)).toBe('One.  Two.');
  });

  it('rejects malformed, fenced, refusal, and empty strict analyses', () => {
    const evidence = [
      { sourceKey: 'town-news', civicItemId: 7, snippetOnly: false },
    ];
    expect(() =>
      validateClusterAnalysis('```json {"summary":"x"} ```', evidence)
    ).toThrow(/JSON|fence|malformed/i);
    expect(() =>
      validateClusterAnalysis(JSON.stringify({ summary: '' }), evidence)
    ).toThrow(/empty|required/i);
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline: 'I cannot help',
          summary: 'I cannot help',
          whyItMatters: 'I cannot help',
          citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
        }),
        evidence
      )
    ).toThrow(/refusal/i);
  });

  it('rejects truncated ellipsis in every public strict prose field', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road update',
        body: 'Road work begins.',
        snippetOnly: false,
      },
    ];
    const cluster = {
      headline: 'Road update',
      summary: 'Road work…',
      whyItMatters: 'Residents can plan.',
      citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
    };
    expect(() =>
      validateClusterAnalysis(JSON.stringify(cluster), evidence)
    ).toThrow(/ellipsis|truncated|incomplete/i);
  });

  it('rejects unknown fields in strict cluster and agenda responses', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        body: 'Road work begins.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline: 'Roads',
          summary: 'Road work.',
          whyItMatters: 'Plan.',
          citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
          briefing: {},
        }),
        evidence
      )
    ).toThrow(/unknown field/i);
  });

  it('rejects unknown, withheld, uncertain, and unbound citations', () => {
    const evidence = [
      { sourceKey: 'full', civicItemId: 1, snippetOnly: false },
      {
        sourceKey: 'withheld',
        civicItemId: 2,
        snippetOnly: false,
        geographyDecision: 'withhold' as const,
      },
      {
        sourceKey: 'uncertain',
        civicItemId: 3,
        snippetOnly: false,
        geographyDecision: 'uncertain' as const,
      },
    ];
    const base = {
      headline: 'Update',
      summary: 'A factual update.',
      whyItMatters: 'Residents can follow it.',
      citations: [{ sourceKey: 'missing', civicItemId: 99 }],
    };
    expect(() =>
      validateClusterAnalysis(JSON.stringify(base), evidence)
    ).toThrow(/unknown|bound/i);
    for (const citation of [
      { sourceKey: 'withheld', civicItemId: 2 },
      { sourceKey: 'uncertain', civicItemId: 3 },
    ]) {
      expect(() =>
        validateClusterAnalysis(
          JSON.stringify({ ...base, citations: [citation] }),
          evidence
        )
      ).toThrow(/withheld|uncertain/i);
    }
  });

  it('requires limitations for mixed snippet and full brief claims and relegates all-snippet claims', () => {
    const mixed = [
      { sourceKey: 'full', civicItemId: 1, snippetOnly: false },
      { sourceKey: 'snip', civicItemId: 2, snippetOnly: true },
    ];
    const output = {
      bullets: [
        {
          text: 'A report and a headline were published.',
          citations: [
            { sourceKey: 'full', civicItemId: 1 },
            { sourceKey: 'snip', civicItemId: 2 },
          ],
        },
      ],
    };
    expect(() => validateBriefAnalysis(JSON.stringify(output), mixed)).toThrow(
      /limitation/i
    );
    const allSnippet = validateBriefAnalysis(
      JSON.stringify({
        bullets: [
          {
            text: 'Headline says road work starts.',
            citations: [{ sourceKey: 'snip', civicItemId: 2 }],
          },
        ],
      }),
      [{ sourceKey: 'snip', civicItemId: 2, snippetOnly: true }]
    );
    expect(allSnippet.relegated).toBe(true);
  });

  it('normalizes canonical decimal-string citation IDs for cluster, brief, and story outputs', () => {
    const evidence = [
      {
        sourceKey: 'nashville-documents',
        civicItemId: 105,
        snippetOnly: false,
      },
      { sourceKey: 'adel-documents', civicItemId: 141, snippetOnly: false },
      { sourceKey: 'cook-schools-board', civicItemId: 145, snippetOnly: false },
    ];
    const cluster = validateClusterAnalysis(
      JSON.stringify({
        headline: 'Council records',
        summary: 'The records describe a local update.',
        whyItMatters: 'Residents can follow the source.',
        citations: [{ sourceKey: 'nashville-documents', civicItemId: '105' }],
      }),
      evidence
    );
    expect(cluster.citations).toStrictEqual([
      { sourceKey: 'nashville-documents', civicItemId: 105 },
    ]);

    const brief = validateBriefAnalysis(
      JSON.stringify({
        bullets: [
          {
            text: 'The records describe a local update.',
            citations: [{ sourceKey: 'adel-documents', civicItemId: '141' }],
          },
        ],
      }),
      evidence
    );
    expect(brief.bullets[0]?.citations).toStrictEqual([
      { sourceKey: 'adel-documents', civicItemId: 141 },
    ]);

    const story = validateStoryAnalysis(
      JSON.stringify({
        title: 'A local reporting thread',
        narrative: 'The records describe an ongoing matter.',
        status: 'ongoing',
        citations: [{ sourceKey: 'cook-schools-board', civicItemId: '145' }],
      }),
      evidence
    );
    expect(story.citations).toStrictEqual([
      { sourceKey: 'cook-schools-board', civicItemId: 145 },
    ]);
  });

  it('requires JSON-number citation IDs for strict operation validation', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road update',
        body: 'Road work begins.',
        snippetOnly: false,
      },
    ];
    const cluster = {
      headline: 'Road update',
      summary: 'Road work begins.',
      whyItMatters: 'Residents can plan.',
      citations: [{ sourceKey: 'town-news', civicItemId: '7' }],
    };
    expect(() =>
      validateClusterAnalysis(JSON.stringify(cluster), evidence, {
        requireGrounding: true,
        requireNumericCitationIds: true,
      })
    ).toThrow(/citation|bind/i);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: 'Road update',
          claims: [{ text: 'Road work begins.', citations: cluster.citations }],
          status: 'ongoing',
        }),
        evidence,
        { requireClaims: true, requireNumericCitationIds: true }
      )
    ).toThrow(/citation|bind/i);
  });

  it('keeps agenda event types exact and does not turn proposed actions into outcomes', () => {
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 130 }];
    const workshop = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'City Council Workshop — September 8, 2026',
        body: 'The City Council workshop agenda lists a housing application for discussion.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The City Council town hall discussed a housing application.',
        citation,
        workshop
      )
    ).toThrow(/event.type/i);
    expect(() =>
      validateClaimGrounding(
        'The City Council workshop discussed a housing application.',
        citation,
        workshop
      )
    ).toThrow(/action|agenda/i);
    expect(() =>
      validateClaimGrounding(
        'The City Council workshop will discuss a housing application.',
        citation,
        workshop
      )
    ).not.toThrow();

    const proposed = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 131,
        title: 'City Council agenda',
        body: 'Resolution Approving the preliminary housing plan is listed for consideration.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The City Council approved the preliminary housing plan.',
        [{ sourceKey: 'tifton-documents', civicItemId: 131 }],
        proposed
      )
    ).toThrow(/outcome/i);
    const minutes = [
      {
        ...proposed[0],
        body: 'The City Council approved the preliminary housing plan.',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The City Council approved the preliminary housing plan.',
        [{ sourceKey: 'tifton-documents', civicItemId: 131 }],
        minutes
      )
    ).not.toThrow();
  });

  it('rejects unsupported agenda action attribution when a row only names a person and role', () => {
    const evidence = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 144,
        title: 'Agenda item',
        body: 'Resolution Granting Enterprise Zone Incentives to Veazey White, LLC (Abbey McLaren, Main Street Director).',
        date: '2026-09-08',
        snippetOnly: false,
        parentDocumentContext: {
          title: 'City Council Agenda 09/08/2026',
          body: 'Agenda for the council workshop.',
        },
      },
    ];
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 144 }];
    for (const text of [
      'The resolution request was submitted by Abbey McLaren.',
      'Abbey McLaren presented the resolution request.',
      'Abbey McLaren requested the resolution.',
    ]) {
      expect(() => validateClaimGrounding(text, citation, evidence)).toThrow(
        /action|attribution|agenda/i
      );
    }
    expect(() =>
      validateClaimGrounding(
        'The agenda item lists Abbey McLaren as Main Street Director.',
        citation,
        evidence
      )
    ).not.toThrow();
  });

  it('uses as-of date to reject present/future modality for historical agenda evidence', () => {
    const evidence = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 145,
        title: 'City Council Agenda 09/08/2026',
        body: 'The agenda lists a resolution for discussion.',
        date: '2026-09-08',
        snippetOnly: false,
      },
    ];
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 145 }];
    for (const text of [
      'The City Council will discuss the resolution.',
      'The City Council meeting is scheduled for September 8, 2026.',
      'The City Council met to discuss the resolution.',
    ]) {
      expect(() =>
        validateClaimGrounding(text, citation, evidence, 'story claim', {
          asOf: '2026-09-13',
        })
      ).toThrow(/temporal|modality|occurrence|agenda/i);
    }
    expect(() =>
      validateClaimGrounding(
        'The agenda listed the resolution, and no outcome record is available.',
        citation,
        evidence,
        'story claim',
        { asOf: '2026-09-13' }
      )
    ).not.toThrow();
  });

  it('preserves future agenda modality at or after the as-of date', () => {
    const evidence = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 146,
        title: 'City Council Agenda 09/20/2026',
        body: 'The agenda lists a resolution for discussion.',
        date: '2026-09-20',
        snippetOnly: false,
      },
    ];
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 146 }];
    expect(() =>
      validateClaimGrounding(
        'The City Council will discuss the resolution.',
        citation,
        evidence,
        'story claim',
        { asOf: '2026-09-13' }
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The City Council meeting is scheduled for September 20, 2026.',
        citation,
        evidence,
        'story claim',
        { asOf: '2026-09-13' }
      )
    ).not.toThrow();
  });

  it('accepts exactly five bullets in strict brief validation', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road update',
        body: 'Road work begins.',
        snippetOnly: false,
      },
    ];
    const bullets = Array.from({ length: 5 }, () => ({
      text: 'Road work begins.',
      citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
    }));
    expect(
      validateBriefAnalysis(JSON.stringify({ bullets }), evidence, {
        requireGrounding: true,
        requireNumericCitationIds: true,
      }).bullets.length
    ).toBe(5);
  });

  it('rejects six bullets in strict brief validation', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road update',
        body: 'Road work begins.',
        snippetOnly: false,
      },
    ];
    const bullets = Array.from({ length: 6 }, () => ({
      text: 'Road work begins.',
      citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
    }));
    expect(() =>
      validateBriefAnalysis(JSON.stringify({ bullets }), evidence, {
        requireGrounding: true,
        requireNumericCitationIds: true,
      })
    ).toThrow(/five|5|max|brief|bullet/i);
  });

  it('rejects six bullets under the legacy alias wrapper in strict brief validation', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road update',
        body: 'Road work begins.',
        snippetOnly: false,
      },
    ];
    const bulletPoints = Array.from({ length: 6 }, () => ({
      text: 'Road work begins.',
      citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
    }));
    expect(() =>
      validateBriefAnalysis(JSON.stringify({ bulletPoints }), evidence, {
        requireGrounding: true,
        requireNumericCitationIds: true,
      })
    ).toThrow(/unknown|wrapper|brief|field/i);
  });

  it('normalizes the observed qwen brief wrapper aliases without weakening citation validation', () => {
    const evidence = [
      { sourceKey: 'tifton-documents', civicItemId: 131, snippetOnly: false },
      { sourceKey: 'adel-documents', civicItemId: 141, snippetOnly: false },
      { sourceKey: 'cook-schools-board', civicItemId: 145, snippetOnly: false },
    ];
    const qwen25BulletPoints = validateBriefAnalysis(
      JSON.stringify({
        civicItem: 131,
        bulletPoints: [
          {
            text: 'The council reviewed the supplied local record.',
            citations: [{ sourceKey: 'tifton-documents', civicItemId: 131 }],
          },
        ],
      }),
      evidence
    );
    expect(qwen25BulletPoints.bullets.length).toBe(1);
    expect(qwen25BulletPoints.bullets[0]?.citations).toStrictEqual([
      { sourceKey: 'tifton-documents', civicItemId: 131 },
    ]);

    const qwen25Briefing = validateBriefAnalysis(
      JSON.stringify({
        briefing: [
          {
            text: 'The supplied records describe a local update.',
            citations: [{ sourceKey: 'adel-documents', civicItemId: 141 }],
          },
        ],
      }),
      evidence
    );
    expect(qwen25Briefing.bullets.length).toBe(1);
    expect(qwen25Briefing.bullets[0]?.citations).toStrictEqual([
      { sourceKey: 'adel-documents', civicItemId: 141 },
    ]);
  });

  it('fails closed for empty qwen bullets and alias bullets without exact evidence citations', () => {
    const evidence = [
      { sourceKey: 'tifton-documents', civicItemId: 131, snippetOnly: false },
    ];
    expect(() =>
      validateBriefAnalysis(JSON.stringify({ bullets: [] }), evidence)
    ).toThrow(/requires bullets/i);
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({ bulletPoints: [{ text: 'An uncited claim.' }] }),
        evidence
      )
    ).toThrow(/citation/i);
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({ briefing: 'A prose-only briefing.' }),
        evidence
      )
    ).toThrow(/requires bullets/i);
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({
          bulletPoints: [
            {
              text: 'Invented source.',
              citations: [{ sourceKey: 'evil', civicItemId: 999 }],
            },
          ],
        }),
        evidence
      )
    ).toThrow(/unknown|bound/i);
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({
          bulletPoints: [
            {
              text: 'One claim.',
              citations: [{ sourceKey: 'tifton-documents', civicItemId: 131 }],
            },
          ],
          briefing: [
            {
              text: 'A conflicting claim.',
              citations: [{ sourceKey: 'tifton-documents', civicItemId: 131 }],
            },
          ],
        }),
        evidence
      )
    ).toThrow(/wrapper|alias|ambiguous|brief/i);
  });

  it('requires exactly one brief wrapper and rejects unknown fields at every nesting level', () => {
    const evidence = [
      { sourceKey: 'tifton-documents', civicItemId: 131, snippetOnly: false },
    ];
    const valid = {
      bullets: [
        {
          text: 'The council reviewed the supplied local record.',
          citations: [{ sourceKey: 'tifton-documents', civicItemId: 131 }],
        },
      ],
    };
    for (const output of [
      { ...valid, bulletPoints: valid.bullets },
      { ...valid, briefing: valid.bullets },
      { bullets: valid.bullets, unexpected: 'ignored-looking metadata' },
      { bullets: [{ ...valid.bullets[0], headline: 'unknown bullet field' }] },
      {
        bullets: [
          {
            ...valid.bullets[0],
            citations: [
              {
                ...valid.bullets[0].citations[0],
                note: 'unknown citation field',
              },
            ],
          },
        ],
      },
    ])
      expect(() =>
        validateBriefAnalysis(JSON.stringify(output), evidence)
      ).toThrow(/unknown|wrapper|field|ambiguous/i);
  });

  it('allows observed civicItem metadata only as ignored harmless data and never lets it rebind citations', () => {
    const result = validateBriefAnalysis(
      JSON.stringify({
        civicItem: {
          sourceKey: 'evil',
          civicItemId: 999,
          title: 'untrusted metadata',
        },
        bulletPoints: [
          {
            text: 'The council reviewed the supplied local record.',
            citations: [{ sourceKey: 'tifton-documents', civicItemId: 131 }],
          },
        ],
      }),
      [{ sourceKey: 'tifton-documents', civicItemId: 131, snippetOnly: false }]
    );
    expect(result.bullets[0]?.citations).toStrictEqual([
      { sourceKey: 'tifton-documents', civicItemId: 131 },
    ]);
    expect(JSON.stringify(result).includes('evil')).toBe(false);
  });

  it('deduplicates repeated story citations while rejecting conflicting civic-item source bindings', () => {
    const evidence = [
      { sourceKey: 'town-news', civicItemId: 7, snippetOnly: false },
      { sourceKey: 'other-news', civicItemId: 7, snippetOnly: false },
      { sourceKey: 'restricted-news', civicItemId: 8, snippetOnly: true },
    ];
    const repeated = validateStoryAnalysis(
      JSON.stringify({
        title: 'A local reporting thread',
        narrative: 'The records describe an ongoing matter.',
        status: 'ongoing',
        citations: [
          { sourceKey: 'town-news', civicItemId: 7 },
          { sourceKey: 'town-news', civicItemId: 7, snippetOnly: false },
          { sourceKey: 'restricted-news', civicItemId: 8 },
          { sourceKey: 'restricted-news', civicItemId: 8, snippetOnly: true },
        ],
        limitation: 'The restricted source is available only as a snippet.',
      }),
      evidence
    );
    expect(repeated.citations).toStrictEqual([
      { sourceKey: 'town-news', civicItemId: 7 },
      { sourceKey: 'restricted-news', civicItemId: 8, snippetOnly: true },
    ]);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: 'A local reporting thread',
          narrative: 'The records describe an ongoing matter.',
          status: 'ongoing',
          citations: [
            { sourceKey: 'town-news', civicItemId: 7 },
            { sourceKey: 'other-news', civicItemId: 7 },
          ],
        }),
        evidence
      )
    ).toThrow(/conflict|sourceKey|binding|citation/i);
  });

  it('grounds a repeated civic-item citation against every supplied evidence block', () => {
    const evidence = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'Agenda 09/08/2026',
        heading:
          '1. Zoning Application PP26-0016 – Submitted by Strong Rock Development Group',
        body: '1. Zoning Application PP26-0016 – Submitted by Strong Rock Development Group, Requesting to Amend the Existing Planned Development Overlay (PDO) on file for a 42.49 Acre Tract, Located on Whiddon Mill Road.',
        snippetOnly: false,
      },
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'Agenda 09/08/2026',
        heading:
          '8. Ordinance Proposing the Creation of a Downtown Entertainment District',
        body: '8. Ordinance Proposing the Creation of a Downtown Entertainment District.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: 'Strong Rock Development zoning application',
          claims: [
            {
              text: 'Strong Rock Development Group submitted a zoning application for a planned development overlay on Whiddon Mill Road.',
              citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
            },
          ],
          status: 'ongoing',
        }),
        evidence,
        { requireClaims: true, allowLegacyNarrative: false }
      )
    ).not.toThrow();
  });

  it('grounds the run-24 second-story shape across all eight agenda blocks', () => {
    const headings = [
      '1. Zoning Application PP26-0016 – Submitted by Strong Rock Development Group',
      '2. Resolution Approving the Preliminary Plan Submitted by Strong Rock Development Group, LLC',
      '3. Resolution Authorizing Submittal of an Application for OneGeorgia Authority',
      '4. Resolution Setting the Millage Rate for 2026',
      '5. Resolution Amending the FY2027 Budget for Radio Upgrade Purchase',
      '6. Resolution Authorizing the Surplus and Sale of Property at 418 Ridge Avenue',
      '7. Resolution Granting Enterprise Zone Incentives to Veazey White, LLC',
      '8. Ordinance Proposing the Creation of a Downtown Entertainment District',
    ];
    const evidence = headings.map((heading, index) => ({
      sourceKey: 'tifton-documents',
      civicItemId: 130,
      title: 'Agenda 09/08/2026',
      heading,
      body:
        index === 0
          ? `${heading}, Requesting to Amend the Existing Planned Development Overlay (PDO) on file for a 42.49 Acre Tract, Located on Whiddon Mill Road, Map & Parcel 0046 052.`
          : `${heading}.`,
      snippetOnly: false,
    }));
    expect(evidence.length).toBe(8);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: 'Strong Rock Development zoning application',
          claims: [
            {
              text: 'Strong Rock Development Group submitted a zoning application to amend the Existing Planned Development Overlay (PDO) for a 42.49 acre tract on Whiddon Mill Road.',
              citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
            },
          ],
          status: 'ongoing',
        }),
        evidence,
        { requireClaims: true, allowLegacyNarrative: false }
      )
    ).not.toThrow();
  });

  it('rejects the observed non-story wrappers instead of treating them as a story', () => {
    const evidence = [
      { sourceKey: 'Tifton Gazette', civicItemId: 22468, snippetOnly: false },
      { sourceKey: 'Tifton Gazette', civicItemId: 22469, snippetOnly: false },
      { sourceKey: 'Tifton Gazette', civicItemId: 22470, snippetOnly: false },
    ];
    const qwen3Briefing = {
      briefing: {
        title: 'Local News Update: Education and Community Support',
        sections: [
          {
            header: 'Schools',
            content: [
              {
                paragraph: 'A report.',
                citations: [
                  { sourceKey: 'Tifton Gazette', civicItemId: 22468 },
                ],
              },
            ],
          },
        ],
      },
    };
    const qwen25Articles = {
      article1: { title: 'A school update', snippet: 'A short report.' },
      article2: {
        title: 'Another school update',
        snippet: 'Another short report.',
      },
    };
    expect(() =>
      validateStoryAnalysis(JSON.stringify(qwen3Briefing), evidence)
    ).toThrow(/unknown|story|title|narrative/i);
    expect(() =>
      validateStoryAnalysis(JSON.stringify(qwen25Articles), evidence)
    ).toThrow(/unknown|story|title|narrative/i);
  });

  it('accepts only the stable headline alias and marks it as model-authored', () => {
    const result = validateStoryAnalysis(
      JSON.stringify({
        headline: 'Tift schools recognize local support',
        narrative: 'The supplied records describe support for a local school.',
        status: 'ongoing',
        citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
      }),
      [{ sourceKey: 'town-news', civicItemId: 7, snippetOnly: false }]
    );
    expect(result.title).toBe('Tift schools recognize local support');
    expect(result.titleOrigin).toBe('model');
  });

  it('uses an evidence title only for a blank model title after all story fields validate', () => {
    const result = validateStoryAnalysis(
      JSON.stringify({
        title: '  ',
        narrative: 'The supplied records describe support for a local school.',
        status: 'ongoing',
        citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
      }),
      [{ sourceKey: 'town-news', civicItemId: 7, snippetOnly: false }],
      { fallbackTitle: 'Tift schools support', fallbackTitleOrigin: 'evidence' }
    );
    expect(result.title).toBe('Tift schools support');
    expect(result.titleOrigin).toBe('evidence');
  });

  it('rejects ambiguous title aliases and unsafe fallback candidates', () => {
    const evidence = [
      { sourceKey: 'town-news', civicItemId: 7, snippetOnly: false },
    ];
    const valid = {
      narrative: 'The supplied records describe support for a local school.',
      status: 'ongoing',
      citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
    };
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({ ...valid, title: 'Title A', headline: 'Title B' }),
        evidence
      )
    ).toThrow(/alias|ambiguous|title/i);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({ ...valid, title: '  ' }),
        evidence,
        { fallbackTitle: '   ', fallbackTitleOrigin: 'evidence' }
      )
    ).toThrow(/title|empty/i);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({ ...valid, title: '  ' }),
        evidence,
        { fallbackTitle: 'Fallback', fallbackTitleOrigin: undefined }
      )
    ).toThrow(/title is empty|origin|fallback/i);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: '  ',
          status: 'ongoing',
          citations: valid.citations,
        }),
        evidence,
        { fallbackTitle: 'Fallback', fallbackTitleOrigin: 'evidence' }
      )
    ).toThrow(/narrative|empty/i);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: '  ',
          narrative: valid.narrative,
          status: 'ongoing',
          citations: valid.citations,
          invented: true,
        }),
        evidence,
        { fallbackTitle: 'Fallback', fallbackTitleOrigin: 'evidence' }
      )
    ).toThrow(/unknown|field/i);
  });

  it('rejects non-canonical or unsafe citation IDs even when an evidence ID looks similar', () => {
    const evidence = [
      { sourceKey: 'town-news', civicItemId: 7, snippetOnly: false },
    ];
    const output = (civicItemId: unknown) =>
      JSON.stringify({
        headline: 'Update',
        summary: 'A factual update.',
        whyItMatters: 'Residents can follow the source.',
        citations: [{ sourceKey: 'town-news', civicItemId }],
      });
    for (const civicItemId of [
      7.5,
      '+7',
      ' 7',
      '07',
      '0',
      '-7',
      '9007199254740992',
      0,
      -7,
    ]) {
      expect(() =>
        validateClusterAnalysis(output(civicItemId), evidence)
      ).toThrow();
    }
  });

  it('requires citation-bound story claims in strict mode and derives the narrative', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road work begins',
        body: 'Road work begins Sept 12 at Main Street.',
        snippetOnly: false,
      },
    ];
    const result = validateStoryAnalysis(
      JSON.stringify({
        title: 'Road work begins',
        claims: [
          {
            text: 'Road repairs begin Sept 12 at Main Street.',
            citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
          },
        ],
        status: 'ongoing',
      }),
      evidence,
      { requireClaims: true, allowLegacyNarrative: false }
    );
    expect(result.narrative).toBe('Road repairs begin Sept 12 at Main Street.');
    expect(result.claims?.length).toBe(1);
  });

  it('rejects a fabricated claim despite a valid citation', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road work begins',
        body: 'Road work begins Sept 12 at Main Street.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: 'Road work begins',
          claims: [
            {
              text: 'A moon base will open next week.',
              citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
            },
          ],
          status: 'ongoing',
        }),
        evidence,
        { requireClaims: true, allowLegacyNarrative: false }
      )
    ).toThrow(/claim-grounding|overlap|unsupported/i);
  });

  it('rejects unsupported numbers, dates, and named identifiers in a claim', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road work begins',
        body: 'Road work begins Sept 12 at Main Street.',
        snippetOnly: false,
      },
    ];
    for (const text of [
      'Road work costs $9,999.',
      'Road work begins October 31.',
      'Road work begins at Main Street for Nashville City Council.',
    ]) {
      expect(() =>
        validateStoryAnalysis(
          JSON.stringify({
            title: 'Road work begins',
            claims: [
              { text, citations: [{ sourceKey: 'town-news', civicItemId: 7 }] },
            ],
            status: 'ongoing',
          }),
          evidence,
          { requireClaims: true, allowLegacyNarrative: false }
        )
      ).toThrow(/claim-grounding|unsupported|number|date|identifier/i);
    }
  });

  it('accepts a grounded paraphrase and isolates legacy narrative compatibility', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road work begins',
        body: 'Road work begins at Main Street.',
        date: '2026-09-12',
        snippetOnly: false,
      },
    ];
    const legacy = validateStoryAnalysis(
      JSON.stringify({
        title: 'Road work begins',
        narrative: 'The supplied records describe an ongoing road matter.',
        status: 'ongoing',
        citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
      }),
      evidence
    );
    expect(legacy.claims).toBe(undefined);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: 'Road work begins',
          narrative: 'The supplied records describe an ongoing road matter.',
          status: 'ongoing',
          citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
        }),
        evidence,
        { requireClaims: true, allowLegacyNarrative: false }
      )
    ).toThrow(/claims|strict|unknown/i);
    const grounded = validateStoryAnalysis(
      JSON.stringify({
        title: 'Road work begins',
        claims: [
          {
            text: 'Repairs start on Main Street on Sept 12.',
            citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
          },
        ],
        status: 'ongoing',
      }),
      evidence,
      { requireClaims: true, allowLegacyNarrative: false }
    );
    expect(grounded.narrative).toBe('Repairs start on Main Street on Sept 12.');
  });

  it('applies the same gross-mismatch guard to strict cluster fields and brief bullets', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road work begins',
        body: 'Road work begins Sept 12 at Main Street.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline: 'Moon base opens',
          summary: 'Road work begins.',
          whyItMatters: 'Residents can follow the source.',
          citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
        }),
        evidence,
        { requireGrounding: true }
      )
    ).toThrow(/claim-grounding|overlap/i);
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({
          bullets: [
            {
              text: 'Road work costs $9,999.',
              citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
            },
          ],
        }),
        evidence,
        { requireGrounding: true }
      )
    ).toThrow(/claim-grounding|unsupported|number/i);
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({
          bullets: [
            {
              text: 'Repairs start on Main Street.',
              citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
            },
          ],
        }),
        evidence,
        { requireGrounding: true }
      )
    ).not.toThrow();
  });

  it('matches case, permit, number, and date identifiers as exact normalized tokens', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Case AB-123 and permit P-007',
        body: 'Road work begins Sept 12, 2026. The permit covers 9,999 feet under FY27.',
        snippetOnly: false,
      },
    ];
    const citation = [{ sourceKey: 'town-news', civicItemId: 7 }];
    expect(() =>
      validateClaimGrounding(
        'Case AB-123 and permit P-007 cover 9,999 feet beginning September 12.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding('Road work begins 09/12/2026.', citation, evidence)
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The FY27 permit covers the road work.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'Road work uses an image-only workflow.',
        citation,
        evidence
      )
    ).not.toThrow();
    for (const text of [
      'Road work uses case AB-1234.',
      'Road work uses permit P-008.',
      'Road work covers 999 feet.',
      'Road work begins September 13.',
      'The FY28 permit covers the road work.',
    ]) {
      expect(() => validateClaimGrounding(text, citation, evidence)).toThrow(
        /unsupported|identifier|date|number/i
      );
    }
  });

  it('matches equivalent hyphenated and plural numeric units without accepting near values', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Rezoning tract',
        body: 'The tract covers 42.49 acres.',
        snippetOnly: false,
      },
    ];
    const citation = [{ sourceKey: 'town-news', civicItemId: 7 }];
    expect(() =>
      validateClaimGrounding('The tract covers 42.49-acre.', citation, evidence)
    ).not.toThrow();
    for (const text of [
      'The tract covers 42 acres.',
      'The tract covers 42.5 acres.',
      'The tract covers 42.49 feet.',
    ]) {
      expect(() => validateClaimGrounding(text, citation, evidence)).toThrow(
        /unsupported|number|identifier/i
      );
    }
  });

  it('fails closed on contradictory metadata across duplicate evidence blocks', () => {
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 130 }];
    const base = {
      sourceKey: 'tifton-documents',
      civicItemId: 130,
      title: 'Agenda',
      body: 'Zoning application for a planned development overlay.',
      localitySlug: 'tifton-ga',
      scopeSlug: 'tifton-ga',
      scopeKind: 'town',
      snippetOnly: false,
    };
    expect(() =>
      validateClaimGrounding(
        'The zoning application is on the agenda.',
        citation,
        [
          { ...base, sourceName: 'City agenda center' },
          { ...base, sourceName: 'Different agenda center' },
        ]
      )
    ).toThrow(/metadata|contradict|consistent/i);
    for (const [field, left, right] of [
      ['publisher', 'City Records', 'County Records'],
      ['localitySlug', 'tifton-ga', 'adel-ga'],
      ['scopeSlug', 'tifton-ga', 'tift-county-ga'],
      ['scopeKind', 'town', 'county'],
      [
        'articleUrl',
        'https://city.example/agenda-a',
        'https://city.example/agenda-b',
      ],
      ['geographyDecision', 'include', 'uncertain'],
    ] as const) {
      expect(() =>
        validateClaimGrounding(
          'The zoning application is on the agenda.',
          citation,
          [
            { ...base, [field]: left },
            { ...base, [field]: right },
          ]
        )
      ).toThrow(/metadata|contradict|consistent/i);
    }
    expect(() =>
      validateClaimGrounding(
        'The zoning application is on the agenda.',
        citation,
        [{ ...base }, { ...base, sourceName: 'City agenda center' }]
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The zoning application is on the agenda.',
        citation,
        [
          { ...base, accessMode: 'full' },
          { ...base, accessMode: 'snippet-only', snippetOnly: true },
        ]
      )
    ).toThrow(/metadata|contradict|snippet|consistent/i);
  });

  it('does not let a missing access marker mask a duplicate snippet-only block', () => {
    const evidence = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'Agenda',
        body: 'Zoning application for a planned development overlay.',
      },
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'Agenda',
        body: 'Zoning application for a planned development overlay.',
        accessMode: 'snippet-only' as const,
      },
    ];
    const result = validateStoryAnalysis(
      JSON.stringify({
        title: 'Zoning application',
        claims: [
          {
            text: 'The zoning application is on the agenda.',
            citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
          },
        ],
        status: 'ongoing',
      }),
      evidence,
      { requireClaims: true, allowLegacyNarrative: false }
    );
    expect(result.citations).toStrictEqual([
      { sourceKey: 'tifton-documents', civicItemId: 130, snippetOnly: true },
    ]);
  });

  it('normalizes fiscal-year formatting while keeping distinct fiscal years strict', () => {
    const citation = [{ sourceKey: 'nashville-documents', civicItemId: 105 }];
    const fiscalYearForms = ['FY 27', 'FY27', 'FY 2027', 'fiscal year 2027'];
    for (const evidenceForm of fiscalYearForms) {
      const evidence = [
        {
          sourceKey: 'nashville-documents',
          civicItemId: 105,
          title: 'Agenda',
          body: `The agenda includes an ${evidenceForm} millage rate discussion.`,
          snippetOnly: false,
        },
      ];
      for (const claimForm of fiscalYearForms) {
        expect(() =>
          validateClaimGrounding(
            `The agenda includes an ${claimForm} millage rate discussion.`,
            citation,
            evidence
          )
        ).not.toThrow();
      }
    }
    const fiscalEvidence = [
      {
        sourceKey: 'nashville-documents',
        civicItemId: 105,
        title: 'Agenda',
        body: 'The agenda includes an FY27 millage rate discussion.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The agenda includes an FY28 millage rate discussion.',
        citation,
        fiscalEvidence
      )
    ).toThrow(/unsupported|identifier|number/i);
    expect(() =>
      validateClaimGrounding(
        'The agenda includes a 2027 millage rate discussion.',
        citation,
        fiscalEvidence
      )
    ).toThrow(/unsupported|identifier|number/i);
    const calendarEvidence = [
      {
        sourceKey: 'nashville-documents',
        civicItemId: 105,
        title: 'Agenda',
        body: 'The agenda includes a 2027 millage rate discussion.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The agenda includes an FY27 millage rate discussion.',
        citation,
        calendarEvidence
      )
    ).toThrow(/unsupported|identifier|number/i);
    for (const malformedForm of ['FY', 'FY 27x', 'FY-27']) {
      const evidence = [
        {
          sourceKey: 'nashville-documents',
          civicItemId: 105,
          title: 'Agenda',
          body: `The agenda includes an ${malformedForm} millage rate discussion.`,
          snippetOnly: false,
        },
      ];
      expect(() =>
        validateClaimGrounding(
          'The agenda includes an FY27 millage rate discussion.',
          citation,
          evidence
        )
      ).toThrow(/unsupported|identifier|number/i);
    }
    const noFiscalMarkerEvidence = [
      {
        sourceKey: 'nashville-documents',
        civicItemId: 105,
        title: 'Agenda',
        body: 'The agenda includes a millage rate discussion.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The agenda includes an FY millage rate discussion.',
        citation,
        noFiscalMarkerEvidence
      )
    ).toThrow(/named|identifier/i);
  });

  it('rejects unsupported named entities when an entity context makes the name explicit', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Nashville road work',
        body: 'Nashville road work begins at Main Street with FEMA support.',
        snippetOnly: false,
      },
    ];
    const citation = [{ sourceKey: 'town-news', civicItemId: 7 }];
    expect(() =>
      validateClaimGrounding(
        'Nashville road work begins with FEMA support.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The Atlantis City Council approved road work.',
        citation,
        evidence
      )
    ).toThrow(/named|identifier/i);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: 'Road work begins',
          claims: [
            {
              text: 'The Atlantis City Council approved road work.',
              citations: citation,
            },
          ],
          status: 'ongoing',
        }),
        evidence,
        { requireClaims: true, allowLegacyNarrative: false }
      )
    ).toThrow(/named|identifier/i);
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline: 'Road work begins',
          summary: 'The Atlantis City Council approved road work.',
          whyItMatters: 'Residents should follow the work.',
          citations: citation,
        }),
        evidence,
        { requireGrounding: true }
      )
    ).toThrow(/named|identifier/i);
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({
          bullets: [
            {
              text: 'The Atlantis City Council approved road work.',
              citations: citation,
            },
          ],
        }),
        evidence,
        { requireGrounding: true }
      )
    ).toThrow(/named|identifier/i);
  });

  it('allows grammatical/title words, cited localities, acronyms, and paraphrased claims', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Nashville City Council road project',
        body: "Nashville City Council approved work on Main Street. FEMA support was announced for Nashville's project.",
        snippetOnly: false,
      },
    ];
    const citation = [{ sourceKey: 'town-news', civicItemId: 7 }];
    expect(() =>
      validateClaimGrounding(
        'The council approved repairs on Main Street with FEMA support.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'Nashville officials approved the road project.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        "Nashville's council approved the road project.",
        citation,
        evidence
      )
    ).not.toThrow();
  });

  it('matches dotted, spaced, and undotted personal initials as one exact identifier', () => {
    const citation = [{ sourceKey: 'tifton-gazette', civicItemId: 132 }];
    const shapes = [
      ['J.T. Reddick Elementary', 'JT Reddick Elementary'],
      ['J. T. Reddick Elementary', 'J.T. Reddick Elementary'],
      ['JT Reddick Elementary', 'J. T. Reddick Elementary'],
    ] as const;
    for (const [evidenceText, claimText] of shapes) {
      const evidence = [
        {
          sourceKey: 'tifton-gazette',
          civicItemId: 132,
          title: 'School update',
          body: evidenceText,
          snippetOnly: false,
        },
      ];
      expect(() =>
        validateClaimGrounding(
          `The district recognized ${claimText}.`,
          citation,
          evidence
        )
      ).not.toThrow();
    }
  });

  it('rejects unsupported or near-match initial sequences and names', () => {
    const citation = [{ sourceKey: 'tifton-gazette', civicItemId: 132 }];
    const evidence = [
      {
        sourceKey: 'tifton-gazette',
        civicItemId: 132,
        title: 'School update',
        body: 'The district recognized J.T. Reddick Elementary.',
        snippetOnly: false,
      },
    ];
    for (const text of [
      'The district recognized J.R. Reddick Elementary.',
      'The district recognized J.T.A. Reddick Elementary.',
      'The district recognized J.T. Redding Elementary.',
      'The district recognized J.TX Reddick Elementary.',
    ]) {
      expect(() => validateClaimGrounding(text, citation, evidence)).toThrow(
        /named|identifier/i
      );
    }
  });

  it('accepts only dotted or compact evidenced initials and rejects punctuation laundering', () => {
    const citation = [{ sourceKey: 'tifton-gazette', civicItemId: 132 }];
    const evidence = [
      {
        sourceKey: 'tifton-gazette',
        civicItemId: 132,
        title: 'School update',
        body: 'The district recognized J.T. Reddick Elementary.',
        snippetOnly: false,
      },
    ];
    for (const text of [
      'The district recognized J.T. Reddick Elementary.',
      'The district recognized J. T. Reddick Elementary.',
      'The district recognized JT Reddick Elementary.',
    ])
      expect(() =>
        validateClaimGrounding(text, citation, evidence)
      ).not.toThrow();
    for (const text of [
      'The district recognized X Y Reddick Elementary.',
      'The district recognized J T Reddick Elementary.',
      'The district recognized J-T Reddick Elementary.',
      'The district recognized J/R Reddick Elementary.',
      'The district recognized T.J. Reddick Elementary.',
    ])
      expect(() => validateClaimGrounding(text, citation, evidence)).toThrow(
        /named|identifier/i
      );
    expect(() =>
      validateClaimGrounding(
        'The district recognized J T Reddick Elementary.',
        citation,
        [
          {
            ...evidence[0],
            body: 'The district recognized J T Reddick Elementary.',
          },
        ]
      )
    ).not.toThrow();
  });

  it('never lets source identity launder overlap or named grounding', () => {
    const citation = [{ sourceKey: 'moon-base-opening-2026', civicItemId: 7 }];
    const evidence = [
      {
        sourceKey: 'moon-base-opening-2026',
        civicItemId: 7,
        title: 'Road update',
        body: 'Road repairs begin at Main Street.',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClaimGrounding('A moon base opens in 2026.', citation, evidence)
    ).toThrow(/claim-grounding|overlap|unsupported/i);
    expect(() =>
      validateClaimGrounding(
        'The Moon City Council approved the road work.',
        citation,
        evidence
      )
    ).toThrow(/named|identifier|overlap/i);
  });

  it('uses legitimate source metadata for names only, never general facts, numbers, or dates', () => {
    const citation = [{ sourceKey: 'official-records-2026', civicItemId: 7 }];
    const evidence = [
      {
        sourceKey: 'official-records-2026',
        civicItemId: 7,
        title: 'Council agenda',
        body: 'The meeting is scheduled.',
        sourceName: 'City of Nashville agenda office',
        publisher: 'Nashville Civic Records',
        localitySlug: 'nashville-ga',
        scopeSlug: 'berrien-county-ga',
        scopeKind: 'county',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The Nashville meeting is scheduled.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The Nashville meeting is scheduled on September 9.',
        citation,
        evidence
      )
    ).toThrow(/date|unsupported/i);
    expect(() =>
      validateClaimGrounding(
        'The Nashville meeting has 2026 attendees.',
        citation,
        evidence
      )
    ).toThrow(/number|unsupported/i);
    expect(() =>
      validateClaimGrounding(
        'Moon base opens.',
        [{ sourceKey: 'moon-base-authority', civicItemId: 8 }],
        [
          {
            sourceKey: 'moon-base-authority',
            civicItemId: 8,
            title: 'Council agenda',
            body: 'The meeting is scheduled.',
            sourceName: 'Moon Base Authority',
            snippetOnly: false,
          },
        ]
      )
    ).toThrow(/overlap|claim-grounding/i);
  });

  it('matches dotted acronym shapes without weakening exact acronym binding', () => {
    const citation = [{ sourceKey: 'town-news', civicItemId: 11 }];
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 11,
        title: 'Policy update',
        body: 'The agency discussed U.S. policy.',
        snippetOnly: false,
      },
    ];
    for (const text of [
      'The agency discussed US policy.',
      'The agency discussed U. S. policy.',
    ]) {
      expect(() =>
        validateClaimGrounding(text, citation, evidence)
      ).not.toThrow();
    }
    expect(() =>
      validateClaimGrounding(
        'The agency discussed U.K. policy.',
        citation,
        evidence
      )
    ).toThrow(/named|identifier/i);
  });

  it('does not treat ordinary headline capitalization as unsupported proper names', () => {
    const nashvilleEvidence = [
      {
        sourceKey: 'nashville-documents',
        civicItemId: 105,
        title: 'Agenda 08/24/2026',
        body: 'The City Council meeting includes public works and sanitation items.',
        eventDate: '2026-08-24',
        snippetOnly: false,
      },
      {
        sourceKey: 'berrien-schools-board',
        civicItemId: 9,
        title: 'School board meeting',
        body: 'School board meetings and announcements include a public hearing for budget input.',
        eventDate: '2026-04-20',
        snippetOnly: false,
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'Upcoming Municipal and School Board Meetings',
        nashvilleEvidence.map(({ sourceKey, civicItemId }) => ({
          sourceKey,
          civicItemId,
        })),
        nashvilleEvidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'Important Announcements and Events',
        nashvilleEvidence.map(({ sourceKey, civicItemId }) => ({
          sourceKey,
          civicItemId,
        })),
        nashvilleEvidence
      )
    ).not.toThrow();

    const tiftonEvidence = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 131,
        title: 'Agenda 08/17/2026',
        body: 'AGENDA CITY OF TIFTON COUNCIL MEETING. Resolution Designating La Fiesta Del Pueblo as a Festival.',
        eventDate: '2026-08-17',
        snippetOnly: false,
      },
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'Agenda 09/08/2026',
        body: 'AGENDA CITY OF TIFTON COUNCIL WORKSHOP. Resolution approving zoning changes.',
        eventDate: '2026-09-08',
        snippetOnly: false,
      },
    ];
    const tiftonCitation = tiftonEvidence.map(({ sourceKey, civicItemId }) => ({
      sourceKey,
      civicItemId,
    }));
    expect(() =>
      validateClaimGrounding(
        'Tifton Council Approves Festival Designations and Zoning Changes',
        tiftonCitation,
        tiftonEvidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'Meeting Items Focus on Community and Development',
        tiftonCitation,
        tiftonEvidence
      )
    ).not.toThrow();

    const adelEvidence = [
      {
        sourceKey: 'adel-documents',
        civicItemId: 141,
        title: 'Scanned document',
        body: '[needs_ocr] City of Adel agendas and minutes: scanned-image PDF, text extraction and OCR empty.',
        snippetOnly: false,
      },
    ];
    const adelCitation = [{ sourceKey: 'adel-documents', civicItemId: 141 }];
    expect(() =>
      validateClaimGrounding(
        'City of Adel Agendas and Minutes Require OCR Processing',
        adelCitation,
        adelEvidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'City of Adel agendas and minutes are in a scanned-image PDF format, requiring Optical Character Recognition (OCR) for text extraction.',
        adelCitation,
        adelEvidence
      )
    ).not.toThrow();

    const namedEvidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 8,
        title: 'Board recognition',
        body: 'The board honored Shae Tucker and designated La Fiesta Del Pueblo as a festival.',
        snippetOnly: false,
      },
    ];
    const namedCitation = [{ sourceKey: 'town-news', civicItemId: 8 }];
    expect(() =>
      validateClaimGrounding(
        'The board honored Shae Tucker and designated La Fiesta Del Pueblo as a festival.',
        namedCitation,
        namedEvidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The board honored Morgan Blake as a festival guest.',
        namedCitation,
        namedEvidence
      )
    ).toThrow(/named|identifier/i);
  });

  it('does not treat a sentence-initial temporal preposition as a named identifier when evidence is truncated', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'tifton-gazette',
        civicItemId: 127,
        title: 'Tift County Schools update',
        body: 'September 12, 2026 Tift County Schools held a Board of Education meeting and awarded Shae Tucker with a Beyond the T Award for J.T. Reddick Elementary.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tift-county-ga',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'On September 12, 2026, Tift County Schools held a Board of Education meeting and awarded Shae Tucker with a Beyond the T Award for her support at J.T. Reddick Elementary.',
        [{ sourceKey: 'tifton-gazette', civicItemId: 127 }],
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'On September 12, 2026, Atlantis City Council held a Board of Education meeting.',
        [{ sourceKey: 'tifton-gazette', civicItemId: 127 }],
        evidence
      )
    ).toThrow(/named|identifier/i);
  });

  it('grounds a locality from citation-bound source metadata when body text is truncated', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'nashville-documents',
        civicItemId: 105,
        title: 'Agenda 08/24/2026',
        body: 'City Council meeting includes public works and sanitation items.',
        date: '2026-08-24',
        localitySlug: 'nashville-ga',
        scopeSlug: 'berrien-county-ga',
        sourceName: 'City of Nashville GA agenda and minutes documents',
        publisher: 'City of Nashville',
        snippetOnly: false,
      },
    ];
    const citation = [{ sourceKey: 'nashville-documents', civicItemId: 105 }];
    expect(() =>
      validateClaimGrounding(
        'The Nashville city council meeting is on August 24.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The Atlantis city council meeting is on August 24.',
        citation,
        evidence
      )
    ).toThrow(/named|identifier/i);
  });

  it('rejects meeting-occurrence claims when cited evidence is agenda-only', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 126,
        title: 'City Council Agenda 08/17/2026',
        body: 'The agenda lists proposed resolutions and discussion items for the scheduled meeting.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tifton-ga',
      },
    ];
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 126 }];
    expect(() =>
      validateClaimGrounding(
        'The Tifton City Council met on August 17, 2026.',
        citation,
        evidence
      )
    ).toThrow(/occurrence|agenda|held|met/i);
    expect(() =>
      validateClaimGrounding(
        'The Tifton City Council agenda lists proposed resolutions for August 17, 2026.',
        citation,
        evidence
      )
    ).not.toThrow();
  });

  it('does not treat a future held phrase as evidence that an agenda meeting occurred', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 127,
        title: 'City Council Agenda 09/08/2026',
        body: 'The council meeting will be held on September 8, 2026. The agenda lists a zoning application.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tifton-ga',
      },
    ];
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 127 }];
    expect(() =>
      validateClaimGrounding(
        'The City Council met on September 8, 2026.',
        citation,
        evidence
      )
    ).toThrow(/occurrence|agenda|held|met/i);
    expect(() =>
      validateClaimGrounding(
        'The City Council meeting is scheduled for September 8, 2026.',
        citation,
        evidence
      )
    ).not.toThrow();
  });

  it('uses item 127 parent document context only for institutional-role grounding', () => {
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 127 }];
    const row = {
      sourceKey: 'tifton-documents',
      civicItemId: 127,
      title: '1. Award Recommendation for RFP# 2026-03 GEMA Generator Project',
      body: 'Award Recommendation for RFP# 2026-03 GEMA Generator Project.',
      date: '2026-08-17',
      localitySlug: 'tifton-ga',
      scopeSlug: 'tift-county-ga',
      parentDocumentContext: {
        title: 'Agenda 08/17/2026',
        body: 'AGENDA CITY OF TIFTON COUNCIL MEETING Monday, August 17, 2026. Resolution approving 999 unrelated generators.',
      },
    };
    const scheduled = JSON.stringify({
      title: 'GEMA Generator Project council agenda',
      claims: [
        {
          text: 'The council meeting is scheduled alongside the GEMA Generator Project agenda for August 17, 2026.',
          citations: citation,
        },
      ],
      status: 'pending',
    });
    expect(() =>
      validateStoryAnalysis(scheduled, [row], {
        requireClaims: true,
        requireNumericCitationIds: true,
      })
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The GEMA Generator Project workshop is scheduled for August 17, 2026.',
        citation,
        [
          {
            ...row,
            parentDocumentContext: {
              title: 'Agenda 08/17/2026',
              body: 'AGENDA CITY OF TIFTON COUNCIL WORKSHOP Monday, August 17, 2026.',
            },
          },
        ]
      )
    ).not.toThrow();
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: 'Council action',
          claims: [
            {
              text: 'The council approved 999 generators for the GEMA Generator Project.',
              citations: citation,
            },
          ],
          status: 'decided',
        }),
        [row],
        { requireClaims: true, requireNumericCitationIds: true }
      )
    ).toThrow(/number|identifier|outcome/i);
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title: 'GEMA Generator Project council meeting',
          claims: [
            {
              text: 'The council met about the GEMA Generator Project on August 17, 2026.',
              citations: citation,
            },
          ],
          status: 'decided',
        }),
        [row],
        { requireClaims: true, requireNumericCitationIds: true }
      )
    ).toThrow(/occurrence|agenda|held|met/i);
    expect(() =>
      validateStoryAnalysis(
        scheduled,
        [
          {
            ...row,
            parentDocumentContext: {
              title: 'Agenda 08/17/2026',
              body: 'AGENDA CITY OF TIFTON SCHOOL BOARD MEETING Monday, August 17, 2026.',
            },
          },
        ],
        { requireClaims: true, requireNumericCitationIds: true }
      )
    ).toThrow(/institutional|role|council/i);
  });

  it('grounds agenda logistics from parent context with symmetric time and address formatting', () => {
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 126 }];
    const row: LlmEvidence = {
      sourceKey: 'tifton-documents',
      civicItemId: 126,
      title: 'Agenda item',
      body: 'The agenda includes a zoning application for the workshop.',
      date: '2026-09-08',
      localitySlug: 'tifton-ga',
      scopeSlug: 'tifton-ga',
      parentDocumentContext: {
        title: 'Agenda 09/08/2026',
        body: 'AGENDA CITY OF TIFTON COUNCIL WORKSHOP Tuesday, September 8, 2026 5:30 PM Council Chambers, 130 E. 1 st Street.',
      },
    };
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 5:30 p.m. in the Council Chambers at 130 E. 1st Street.',
        citation,
        [row]
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 5:30 p.m. in the Council Chambers at 999 E. 1st Street.',
        citation,
        [row]
      )
    ).toThrow(/number|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 5:30 p.m. in the Council Chambers and includes 999 unrelated seats.',
        citation,
        [row]
      )
    ).toThrow(/number|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 5:30 P. M. in the Council Chambers at 130 EAST 1ST STREET.',
        citation,
        [row]
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 5:30 AM in the Council Chambers at 130 EAST 1ST STREET.',
        citation,
        [row]
      )
    ).toThrow(/number|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 5:30 PM in the Council Chambers at 130 WEST 1ST STREET.',
        citation,
        [row]
      )
    ).toThrow(/number|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 5:30 PM in the Council Chambers at 130 EAST 1ST AVENUE.',
        citation,
        [row]
      )
    ).toThrow(/number|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 6:30 PM in the Council Chambers at 130 EAST 1ST STREET.',
        citation,
        [row]
      )
    ).toThrow(/number|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Wednesday, September 9, 2026, at 5:30 PM in the Council Chambers at 130 EAST 1ST STREET.',
        citation,
        [row]
      )
    ).toThrow(/date|number|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled at 130 EAST in the Council Chambers.',
        citation,
        [row]
      )
    ).toThrow(/number|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The PM workshop is listed for the City of Tifton Council.',
        citation,
        [row]
      )
    ).toThrow(/named|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The AM workshop is listed for the City of Tifton Council.',
        citation,
        [row]
      )
    ).toThrow(/named|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The EAST workshop is listed for the City of Tifton Council.',
        citation,
        [row]
      )
    ).toThrow(/named|identifier/i);

    const amRow = {
      ...row,
      parentDocumentContext: {
        title: 'Agenda 09/08/2026',
        body: 'AGENDA CITY OF TIFTON COUNCIL WORKSHOP Tuesday, September 8, 2026 8:00 a.m. Council Chambers, 130 East 1st St.',
      },
    };
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 8:00 A. M. in the Council Chambers at 130 EAST 1ST STREET.',
        citation,
        [amRow]
      )
    ).not.toThrow();
  });

  it('normalizes full-width authoritative logistics without widening partial components', () => {
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 126 }];
    const row: LlmEvidence = {
      sourceKey: 'tifton-documents',
      civicItemId: 126,
      title: 'Agenda item',
      body: 'The agenda includes a zoning application for the workshop.',
      date: '2026-09-08',
      localitySlug: 'tifton-ga',
      scopeSlug: 'tifton-ga',
      parentDocumentContext: {
        title: 'Agenda 09/08/2026',
        body: 'ＡＧＥＮＤＡ ＣＩＴＹ ＯＦ ＴＩＦＴＯＮ ＣＯＵＮＣＩＬ ＷＯＲＫＳＨＯＰ Tuesday, September 8, 2026 ５：３０ Ｐ．Ｍ． Council Chambers, １３０ Ｅ． １ｓｔ Ｓｔｒｅｅｔ．',
      },
    };
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 5:30 PM in the Council Chambers at 130 E. 1st Street.',
        citation,
        [row]
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The City of Tifton Council workshop is scheduled for Tuesday, September 8, 2026, at 5:30 PM in the Council Chambers at 130 E.',
        citation,
        [row]
      )
    ).toThrow(/number|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The PM workshop is listed for the City of Tifton Council.',
        citation,
        [row]
      )
    ).toThrow(/named|identifier/i);

    const inlineRow = {
      ...row,
      body: 'The workshop is scheduled for 5:30 PM at 130 EAST 1ST STREET.',
    };
    expect(() =>
      validateClaimGrounding('The PM workshop is listed at EAST.', citation, [
        inlineRow,
      ])
    ).toThrow(/named|identifier/i);
  });

  it('keeps item 127 agenda-row actions bound to the row, with explicit minutes controls', () => {
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 127 }];
    const row = {
      sourceKey: 'tifton-documents',
      civicItemId: 127,
      title: '1. Award Recommendation for RFP# 2026-03 GEMA Generator Project',
      body: 'Award Recommendation for RFP# 2026-03 GEMA Generator Project.',
      date: '2026-08-17',
      localitySlug: 'tifton-ga',
      scopeSlug: 'tift-county-ga',
      parentDocumentContext: {
        title: 'Agenda 08/17/2026',
        body: 'AGENDA CITY OF TIFTON COUNCIL MEETING Monday, August 17, 2026. Resolution approving the generator project.',
      },
    };
    for (const verb of [
      'discussed',
      'reviewed',
      'considered',
      'awarded',
      'decided',
    ]) {
      expect(() =>
        validateClaimGrounding(
          `The council ${verb} the GEMA Generator Project.`,
          citation,
          [row],
          'item 127 action'
        )
      ).toThrow(/action|agenda|outcome/i);
    }
    for (const text of [
      'The council will review the GEMA Generator Project.',
      'The council will consider the GEMA Generator Project.',
      'The council agenda lists the GEMA Generator Project.',
    ]) {
      expect(() => validateClaimGrounding(text, citation, [row])).not.toThrow();
    }
    const minutes = {
      ...row,
      title: 'Minutes 08/17/2026',
      body: 'Minutes: the council reviewed and awarded the GEMA Generator Project.',
    };
    expect(() =>
      validateClaimGrounding(
        'The council reviewed and awarded the GEMA Generator Project.',
        citation,
        [minutes]
      )
    ).not.toThrow();
  });

  it('rejects unsupported action, purpose, and governance claims in item 127 story fields', () => {
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 127 }];
    const row = {
      sourceKey: 'tifton-documents',
      civicItemId: 127,
      title: 'Agenda item',
      body: '4. Resolution Approving Amendments to the Tax Collection Services Agreement with Tift County and Tifton County Tax Commissioner (Bobby Bennett).',
      date: '2026-08-17',
      localitySlug: 'tifton-ga',
      scopeSlug: 'tift-county-ga',
      parentDocumentContext: {
        title: 'Agenda 08/17/2026',
        body: 'AGENDA CITY OF TIFTON COUNCIL MEETING Monday, August 17, 2026.',
      },
    };
    for (const text of [
      'Bobby Bennett presented the resolution seeking approval of amendments.',
      'The proposed amendments aimed at ensuring smoother tax collection.',
      'The resolution must be agreed upon by a majority of the Council members.',
    ]) {
      expect(() =>
        validateStoryAnalysis(
          JSON.stringify({
            title:
              'Resolution Approving Amendments to the Tax Collection Services Agreement',
            claims: [{ text, citations: citation }],
            status: 'pending',
            limitation: text.includes('must') ? text : undefined,
          }),
          [row],
          { requireClaims: true, requireNumericCitationIds: true }
        )
      ).toThrow(/agenda-(action|purpose|requirement)|grounding/i);
    }
    expect(() =>
      validateStoryAnalysis(
        JSON.stringify({
          title:
            'Resolution Approving Amendments to the Tax Collection Services Agreement',
          claims: [
            {
              text: 'The agenda lists a resolution concerning amendments to the Tax Collection Services Agreement.',
              citations: citation,
            },
          ],
          status: 'pending',
          limitation: 'The agenda record does not state a final decision.',
        }),
        [row],
        { requireClaims: true, requireNumericCitationIds: true }
      )
    ).not.toThrow();
  });

  it('does not treat future conducted or convened phrases as past occurrence evidence', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 129,
        title: 'City Council Agenda 09/08/2026',
        body: 'The council meeting will be conducted on September 8, 2026, and the agenda lists a zoning application.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tifton-ga',
      },
    ];
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 129 }];
    expect(() =>
      validateClaimGrounding(
        'The City Council met on September 8, 2026.',
        citation,
        evidence
      )
    ).toThrow(/occurrence|agenda|held|met/i);
    expect(() =>
      validateClaimGrounding(
        'The City Council meeting will be conducted on September 8, 2026.',
        citation,
        evidence
      )
    ).not.toThrow();
  });

  it('directly rejects agenda-only occurrence and outcome semantics while allowing future scheduling', () => {
    expect(() =>
      validateAgendaSemantics(
        'The council held the meeting and approved the proposal.',
        'Agenda: the meeting will be held September 8; proposed proposal listed.',
        'agenda body'
      )
    ).toThrow(/occurrence|outcome/i);
    expect(() =>
      validateAgendaSemantics(
        'The meeting will be held September 8 and the proposal is listed.',
        'Agenda: the meeting will be held September 8; proposed proposal listed.',
        'agenda body'
      )
    ).not.toThrow();
    expect(() =>
      validateAgendaSemantics(
        'The council held the meeting and approved the proposal.',
        'Minutes: the council held the meeting and approved the proposal.',
        'minutes body'
      )
    ).not.toThrow();
  });

  it('direct agenda analysis validation grounds all prose fields by default', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'City Council Agenda 09/08/2026',
        body: 'The agenda lists a proposed zoning application for discussion.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tifton-ga',
      },
    ];
    expect(() =>
      validateAgendaAnalysis(
        JSON.stringify({
          items: [
            {
              section: 'Synthetic',
              heading: 'The council met',
              body: 'The council approved the application.',
              citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
            },
          ],
        }),
        evidence
      )
    ).toThrow(/occurrence|outcome|grounding/i);
  });

  it('grounds every strict agenda-fixup prose field and rejects fabricated occurrence or outcome text', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 128,
        title: 'City Council Agenda 09/08/2026',
        body: 'The agenda lists a proposed zoning application for discussion at the scheduled meeting.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tifton-ga',
      },
    ];
    const citation = [{ sourceKey: 'tifton-documents', civicItemId: 128 }];
    expect(() =>
      validateAgendaAnalysis(
        JSON.stringify({
          items: [
            {
              section: 'Zoning',
              heading: 'The council met',
              body: 'The council approved the application.',
              citations: citation,
            },
          ],
        }),
        evidence,
        { requireGrounding: true, requireNumericCitationIds: true }
      )
    ).toThrow(/occurrence|outcome|grounding/i);
    expect(() =>
      validateAgendaAnalysis(
        JSON.stringify({
          items: [
            {
              section: 'Agenda',
              heading: 'Proposed zoning application',
              body: 'The agenda lists a proposed zoning application for discussion.',
              citations: citation,
            },
          ],
        }),
        evidence,
        { requireGrounding: true, requireNumericCitationIds: true }
      )
    ).not.toThrow();
  });

  it('keeps the run-15 August meeting headline rejected when cited records do not support it', () => {
    const evidence = [
      {
        sourceKey: 'berrien-schools-board',
        civicItemId: 9,
        title: 'Public hearings',
        body: 'The board will hold public hearings on April 20 and May 11.',
        localitySlug: 'nashville-ga',
        scopeSlug: 'berrien-county-ga',
      },
      {
        sourceKey: 'berrien-schools-board',
        civicItemId: 19,
        title: 'Safety drills',
        body: 'Safety drills will be completed within the next two weeks.',
        localitySlug: 'nashville-ga',
        scopeSlug: 'berrien-county-ga',
      },
    ];
    const citations = evidence.map(({ sourceKey, civicItemId }) => ({
      sourceKey,
      civicItemId,
    }));
    expect(() =>
      validateClaimGrounding(
        'Meeting Highlights for August',
        citations,
        evidence
      )
    ).toThrow(/overlap|unsupported/i);
  });

  it('ignores temporal/editorial modifiers before entity types in lower, title, and all-caps forms', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 9,
        title: 'City Council updates',
        body: 'The City Council and Department publish meeting updates and agendas.',
        snippetOnly: false,
      },
    ];
    const citation = [{ sourceKey: 'town-news', civicItemId: 9 }];
    for (const text of [
      'Upcoming City Council Meetings',
      'Recent City Council Updates',
      'New City Council Agenda',
      'upcoming city council meetings',
      'UPCOMING CITY COUNCIL MEETINGS',
      'Annual Department Updates',
      'ANNUAL DEPARTMENT UPDATES',
    ])
      expect(() =>
        validateClaimGrounding(text, citation, evidence)
      ).not.toThrow();
    for (const text of [
      'Atlantis City Council approved the agenda.',
      'Atlantis Department published meeting updates.',
      'ATLANTIS CITY COUNCIL APPROVED THE AGENDA.',
      'ATLANTIS DEPARTMENT PUBLISHED MEETING UPDATES.',
    ])
      expect(() => validateClaimGrounding(text, citation, evidence)).toThrow(
        /named|identifier/i
      );

    const acronymEvidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 10,
        title: 'Council update',
        body: 'The City Council discussed SPLOST funding and CCRPI scores. EPA and OCR reports were reviewed.',
        snippetOnly: false,
      },
    ];
    const acronymCitation = [{ sourceKey: 'town-news', civicItemId: 10 }];
    for (const acronym of ['SPLOST', 'CCRPI']) {
      expect(() =>
        validateClaimGrounding(
          `The City Council discussed ${acronym} funding.`,
          citation,
          [
            {
              ...evidence[0],
              body: 'The City Council discussed funding and reports.',
            },
          ]
        )
      ).toThrow(/named|identifier/i);
      expect(() =>
        validateClaimGrounding(
          `The City Council discussed ${acronym} funding.`,
          acronymCitation,
          acronymEvidence
        )
      ).not.toThrow();
    }
    expect(() =>
      validateClaimGrounding(
        'The City Council reviewed EPA and OCR reports.',
        acronymCitation,
        acronymEvidence
      )
    ).not.toThrow();
  });

  it('treats a supported USPS state abbreviation beside civic entity words as geographic context, not initials', () => {
    const states = ['GA', 'NY', 'CA', 'TX', 'WA', 'OH'] as const;
    for (const state of states) {
      const evidence: LlmEvidence[] = [
        {
          sourceKey: `town-${state.toLowerCase()}`,
          civicItemId: 7,
          title: 'Council update',
          body: 'The City Council reviewed meeting updates.',
          localitySlug: `town-${state.toLowerCase()}`,
          scopeSlug: `county-${state.toLowerCase()}`,
        },
      ];
      const citation = [{ sourceKey: evidence[0].sourceKey, civicItemId: 7 }];
      expect(() =>
        validateClaimGrounding(
          `Key updates from Town, ${state} Council meetings.`,
          citation,
          evidence
        )
      ).not.toThrow();
      expect(() =>
        validateClaimGrounding(
          `Town ${state} County meeting updates.`,
          citation,
          evidence
        )
      ).not.toThrow();
      expect(() =>
        validateClaimGrounding(
          `Town ${state} Department updates.`,
          citation,
          evidence
        )
      ).not.toThrow();
    }
  });

  it('does not globally whitelist state abbreviations or turn unsupported names into geographic qualifiers', () => {
    const citation = [{ sourceKey: 'town-ga', civicItemId: 7 }];
    const unsupportedMetadata: LlmEvidence[] = [
      {
        sourceKey: 'town-ga',
        civicItemId: 7,
        title: 'Council update',
        body: 'The City Council reviewed meeting updates.',
        localitySlug: 'town-oh',
        scopeSlug: 'county-oh',
      },
    ];
    for (const text of [
      'Key updates from Town, GA Council meetings.',
      'Town GA County meeting updates.',
      'Town GA Department updates.',
      'Key updates from Town, ZZ Council meetings.',
    ])
      expect(() =>
        validateClaimGrounding(text, citation, unsupportedMetadata)
      ).toThrow(/named|identifier/i);
    const noMetadata: LlmEvidence[] = [
      {
        sourceKey: 'town-ga',
        civicItemId: 7,
        title: 'Council update',
        body: 'The City Council reviewed meeting updates.',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'Key updates from Town, GA Council meetings.',
        citation,
        noMetadata
      )
    ).toThrow(/named|identifier/i);
  });

  it('grounds institutional roles in item/source evidence, never synthetic section headings', () => {
    const adelEvidence: LlmEvidence[] = [
      {
        sourceKey: 'adel-documents',
        civicItemId: 141,
        title: 'Scanned document',
        body: '[needs_ocr] City of Adel agendas and minutes: scanned-image PDF, text extraction and OCR empty.',
        heading: 'Council Meetings',
        sourceName: 'City of Adel agendas and minutes documents',
        localitySlug: 'adel-ga',
        scopeSlug: 'adel-ga',
      },
    ];
    const adelCitation = [{ sourceKey: 'adel-documents', civicItemId: 141 }];
    // The old output borrowed "Council Meetings" from the synthetic section
    // heading. That navigation label is not evidence for a council claim.
    expect(() =>
      validateClaimGrounding(
        'Adel city council agendas and minutes are available.',
        adelCitation,
        adelEvidence
      )
    ).toThrow(/institutional|role|council|grounding/i);

    const schoolEvidence: LlmEvidence[] = [
      {
        sourceKey: 'cook-schools-board',
        civicItemId: 145,
        title: 'eBoard Site',
        body: 'Cook County Schools board of education: eBoard Site',
        heading: 'School Board',
        sourceName: 'Cook County Schools board of education',
        localitySlug: 'adel-ga',
        scopeSlug: 'cook-county-ga',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The Cook County school board publishes meeting records.',
        [{ sourceKey: 'cook-schools-board', civicItemId: 145 }],
        schoolEvidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The board of education publishes meeting records.',
        [{ sourceKey: 'cook-schools-board', civicItemId: 145 }],
        schoolEvidence
      )
    ).not.toThrow();
  });

  it('rejects a substituted state while preserving supported locality roles and safe ordinary wording', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'nashville-documents',
        civicItemId: 105,
        title: 'City Council agenda',
        body: 'Nashville city council meeting includes public works items.',
        sourceName: 'City of Nashville GA agenda and minutes documents',
        localitySlug: 'nashville-ga',
        scopeSlug: 'berrien-county-ga',
      },
    ];
    const citation = [{ sourceKey: 'nashville-documents', civicItemId: 105 }];
    expect(() =>
      validateClaimGrounding(
        'Nashville, GA city council reviewed public works items.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'Nashville, TN city council reviewed public works items.',
        citation,
        evidence
      )
    ).toThrow(/state|named|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'Nashville, Tennessee city council reviewed public works items.',
        citation,
        evidence
      )
    ).toThrow(/state|named|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The council reviewed public works items.',
        citation,
        evidence
      )
    ).not.toThrow();
  });

  it('rejects an unsupported full state in a comma-qualified locality claim without a civic role word', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'nashville-documents',
        civicItemId: 106,
        title: 'Nashville update',
        body: 'Nashville update: the report discusses Tennessee history.',
        sourceName: 'City of Nashville GA agenda and minutes documents',
        localitySlug: 'nashville-ga',
        scopeSlug: 'berrien-county-ga',
      },
    ];
    const citation = [{ sourceKey: 'nashville-documents', civicItemId: 106 }];
    expect(() =>
      validateClaimGrounding('Nashville, Tennessee', citation, evidence)
    ).toThrow(/state|named|identifier/i);
    // A state name used as ordinary subject matter is not a geographic
    // qualifier and remains grounded by the cited body.
    expect(() =>
      validateClaimGrounding(
        'The report discusses Tennessee history.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding('Nashville, Georgia', citation, evidence)
    ).not.toThrow();
  });

  it('keeps evidenced personal initials strict when civic words follow a state qualifier', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'town-ga',
        civicItemId: 7,
        title: 'School update',
        body: 'The district recognized J.T. Reddick Elementary.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tift-county-ga',
      },
    ];
    const citation = [{ sourceKey: 'town-ga', civicItemId: 7 }];
    expect(() =>
      validateClaimGrounding(
        'The district recognized JT Reddick Elementary in Tifton, GA.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The district recognized J.R. Reddick Elementary in Tifton, GA.',
        citation,
        evidence
      )
    ).toThrow(/named|identifier/i);
    expect(() =>
      validateClaimGrounding(
        'The district recognized J.T. Reddick Elementary in Tifton, GA.',
        citation,
        evidence
      )
    ).not.toThrow();
  });

  it('rejects the run-25 internal civic item ID in public prose while accepting its corrected fallback headline', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 131,
        title: 'Agenda 08/17/2026',
        body: 'AGENDA CITY OF TIFTON COUNCIL MEETING. Resolution designating La Fiesta Del Pueblo as a festival.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tift-county-ga',
      },
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'Agenda 09/08/2026',
        body: 'AGENDA CITY OF TIFTON COUNCIL WORKSHOP. Resolution approving zoning changes.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tift-county-ga',
      },
    ];
    const citations = evidence.map(({ sourceKey, civicItemId }) => ({
      sourceKey,
      civicItemId,
    }));
    const primary = {
      headline:
        'City of Tifton Council Addresses Festivals, Tax Agreements, and Zoning in Recent Meetings',
      summary:
        'The August 17, 2026, council meeting included resolutions designating La Fiesta Del Pueblo as a festival (civicItemId=131) and approved tax agreement amendments. The September 8, 2026, workshop focused on zoning changes (civicItemId=130).',
      whyItMatters:
        "These actions reflect the city's efforts to support local events, manage fiscal responsibilities, and regulate land use.",
      citations,
    };
    expect(() =>
      validateClusterAnalysis(JSON.stringify(primary), evidence, {
        requireGrounding: true,
      })
    ).toThrow(/internal.*marker|unsupported.*131|number.*131/i);
    const fallback = {
      headline: 'Key Updates from Tifton, GA Council Meetings',
      summary:
        'The Tifton City Council agendas list award recommendations and public comments for August 17, 2026, and a zoning application for September 8, 2026.',
      whyItMatters: 'Council meetings support local development.',
      citations,
    };
    expect(() =>
      validateClusterAnalysis(JSON.stringify(fallback), evidence, {
        requireGrounding: true,
      })
    ).not.toThrow();
  });

  it('fails closed on the observed model identifier and processing-label leakage', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'nashville-documents',
        civicItemId: 19,
        title: 'Council agenda',
        body: 'The council agenda includes a public hearing.',
        localitySlug: 'nashville-ga',
        scopeSlug: 'nashville-ga',
      },
      {
        sourceKey: 'tifton-documents',
        civicItemId: 126,
        title: 'Agenda 08/17/2026',
        body: 'The council agenda includes a festival resolution.',
        localitySlug: 'tifton-ga',
        scopeSlug: 'tifton-ga',
      },
      {
        sourceKey: 'adel-documents',
        civicItemId: 130,
        title: 'Council Meeting Agenda — March 16, 2026',
        body: 'The council meeting agenda was published for March 16, 2026.',
        localitySlug: 'adel-ga',
        scopeSlug: 'adel-ga',
      },
    ];
    const citation = (sourceKey: string, civicItemId: number) => [
      { sourceKey, civicItemId },
    ];
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline: 'Nashville agenda',
          summary:
            'The council agenda includes a public hearing (civicItemId=19).',
          whyItMatters: 'Residents can follow the hearing.',
          citations: citation('nashville-documents', 19),
        }),
        evidence,
        { requireGrounding: true }
      )
    ).toThrow(/internal.*marker|unsupported.*19|number.*19/i);
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline:
            'Townsfolk Update: City Council Meetings Provide Civic Opportunities and Community Engagement',
          summary: 'The council agenda includes a festival resolution.',
          whyItMatters: 'Residents can follow the agenda.',
          citations: citation('tifton-documents', 126),
        }),
        evidence,
        { requireGrounding: true }
      )
    ).toThrow(/named.*townsfolk|identifier.*townsfolk/i);
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline: 'No OCR-Related Council Meeting Items Discussed',
          summary:
            'The council meeting agenda was published for March 16, 2026.',
          whyItMatters: 'Residents can follow the agenda.',
          citations: citation('adel-documents', 130),
        }),
        evidence,
        { requireGrounding: true }
      )
    ).toThrow(/named.*ocr|identifier.*ocr/i);
  });

  it('rejects formatted citation identity markers but permits ordinary wording and citation fields', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'town-news',
        civicItemId: 19,
        title: 'Council agenda',
        body: 'The council agenda includes item 19 for public comment.',
        localitySlug: 'town-ga',
        scopeSlug: 'town-ga',
      },
    ];
    const citation = [{ sourceKey: 'town-news', civicItemId: 19 }];
    const leaked = [
      'sourceKey=town-news',
      'sourceKey: town-news',
      '"sourceKey": "town-news"',
      'source key town-news',
      'source key = "town-news"',
      'SOURCE_KEY: town-news',
      'source-key (town-news)',
      'civicItemId=19',
      'civicItemId: 19',
      '"civicItemId": 19',
      'civic item id = "19"',
      'CIVIC_ITEM_ID - 19',
      'civic-item-id (19)',
      'civic item id 19',
    ];
    for (const marker of leaked) {
      expect(() =>
        validateClaimGrounding(
          `The council agenda includes a public comment (${marker}).`,
          citation,
          evidence
        )
      ).toThrow(/internal-citation-marker/i);
    }
    expect(() =>
      validateClaimGrounding(
        'The source key identifies the council agenda article.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'A civic record receives an internal label for each council agenda entry.',
        citation,
        evidence
      )
    ).not.toThrow();
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline: 'Council agenda',
          summary: 'The council agenda includes item 19 for public comment.',
          whyItMatters: 'Residents can follow the agenda.',
          citations: citation,
        }),
        evidence,
        { requireGrounding: true }
      )
    ).not.toThrow();
  });

  it('rejects URLs, URI schemes, markdown/autolinks, anchors, and obfuscated links in limitations', () => {
    const evidence = [
      {
        sourceKey: 'town-news',
        civicItemId: 7,
        title: 'Road work',
        body: 'Road work begins.',
        snippetOnly: false,
      },
    ];
    const base = {
      headline: 'Road work',
      summary: 'Road work begins.',
      whyItMatters: 'Residents should follow the work.',
      citations: [{ sourceKey: 'town-news', civicItemId: 7 }],
    };
    for (const limitation of [
      'Read https://example.com for details.',
      'Try javascript:alert(1).',
      'Try javascript : alert(1).',
      'See [the source](https://example.com).',
      'See <https://example.com>.',
      'See <a href="https://example.com">the source</a>.',
      'See example[.]com for details.',
      'See example dot com for details.',
      'See hxxps://example.com for details.',
    ]) {
      expect(() =>
        validateClusterAnalysis(
          JSON.stringify({ ...base, limitation }),
          evidence
        )
      ).toThrow(/limitation|URL|link|scheme/i);
    }
    for (const limitation of [
      'The source is available only as a short excerpt.',
      'Note: only the excerpt was available.',
      'More details. Follow future updates.',
    ]) {
      const accepted = validateClusterAnalysis(
        JSON.stringify({ ...base, limitation }),
        evidence
      );
      expect(accepted.limitation).toBe(limitation);
    }
  });

  it('normalizes case-insensitive empty limitation sentinels across cluster, brief, and story output', () => {
    const evidence = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'Agenda 09/08/2026',
        body: 'The council approved a housing application.',
      },
      {
        sourceKey: 'tifton-gazette',
        civicItemId: 132,
        title: 'School update',
        body: 'The school recognized a retired principal.',
      },
    ];
    const sentinels = [
      'None',
      'NONE',
      'n/a',
      'N/A',
      'Not Applicable',
      'not applicable',
      'OPTIONAL',
      '',
      '   ',
      '-',
      '–',
      '—',
    ];

    for (const limitation of sentinels) {
      const cluster = validateClusterAnalysis(
        JSON.stringify({
          headline: 'Council housing application',
          summary: 'The council approved a housing application.',
          whyItMatters: 'Residents can follow the council action.',
          citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
          limitation,
        }),
        evidence
      );
      expect(cluster.limitation).toBe(undefined);

      const brief = validateBriefAnalysis(
        JSON.stringify({
          bullets: [
            {
              text: 'The school recognized a retired principal.',
              citations: [{ sourceKey: 'tifton-gazette', civicItemId: 132 }],
              limitation,
            },
          ],
        }),
        evidence
      );
      expect(brief.bullets[0]?.limitation).toBe(undefined);

      const story = validateStoryAnalysis(
        JSON.stringify({
          title: 'Council housing application',
          narrative: 'The council approved a housing application.',
          status: 'ongoing',
          citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
          limitation,
        }),
        evidence
      );
      expect(story.limitation).toBe(undefined);
    }

    const substantive = validateClusterAnalysis(
      JSON.stringify({
        headline: 'Council housing application',
        summary: 'The council approved a housing application.',
        whyItMatters: 'Residents can follow the council action.',
        citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
        limitation: 'No limitation was identified in the supplied records.',
      }),
      evidence
    );
    expect(substantive.limitation).toBe(
      'No limitation was identified in the supplied records.'
    );
    expect(() =>
      validateClusterAnalysis(
        JSON.stringify({
          headline: 'Council housing application',
          summary: 'The council approved a housing application.',
          whyItMatters: 'Residents can follow the council action.',
          citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
          limitation: 'None; see https://example.com.',
        }),
        evidence
      )
    ).toThrow(/limitation|URL|link|scheme/i);
  });

  it('normalizes the generation-78 four-bullet brief shape without storing literal None or optional', () => {
    const evidence = [
      {
        sourceKey: 'tifton-documents',
        civicItemId: 130,
        title: 'Agenda 09/08/2026',
        body: 'The council approved a housing application.',
      },
      {
        sourceKey: 'tifton-gazette',
        civicItemId: 132,
        title: 'School update one',
        body: 'The school recognized a retired principal.',
      },
      {
        sourceKey: 'tifton-gazette',
        civicItemId: 133,
        title: 'School update two',
        body: 'The school reported academic growth.',
      },
    ];
    const raw = {
      bullets: [
        {
          text: 'The council approved a housing application.',
          citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
          limitation: 'None',
        },
        {
          text: 'The council approved a housing application.',
          citations: [{ sourceKey: 'tifton-documents', civicItemId: 130 }],
          limitation: 'optional',
        },
        {
          text: 'The school recognized a retired principal.',
          citations: [{ sourceKey: 'tifton-gazette', civicItemId: 132 }],
          limitation: 'N/A',
        },
        {
          text: 'The school reported academic growth.',
          citations: [{ sourceKey: 'tifton-gazette', civicItemId: 133 }],
          limitation: ' ',
        },
      ],
    };
    const result = validateBriefAnalysis(JSON.stringify(raw), evidence);
    expect(result.bullets.map((bullet) => bullet.limitation)).toStrictEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
    expect(JSON.stringify(result).match(/\b(?:none|optional)\b/iu)).toBe(null);
  });

  it('does not let a limitation sentinel satisfy mixed full and snippet policy', () => {
    const evidence = [
      {
        sourceKey: 'full',
        civicItemId: 1,
        title: 'Full report',
        body: 'The full report describes road work.',
        snippetOnly: false,
      },
      {
        sourceKey: 'snip',
        civicItemId: 2,
        title: 'Snippet report',
        body: 'The snippet describes road work.',
        snippetOnly: true,
      },
    ];
    const output = {
      headline: 'Road work',
      summary: 'The full report and snippet describe road work.',
      whyItMatters: 'Residents can follow the work.',
      citations: [
        { sourceKey: 'full', civicItemId: 1 },
        { sourceKey: 'snip', civicItemId: 2 },
      ],
      limitation: 'None',
    };
    expect(() =>
      validateClusterAnalysis(JSON.stringify(output), evidence)
    ).toThrow(/limitation/i);
  });
});

describe('per-claim rejection', () => {
  const evidence: LlmEvidence[] = [
    {
      sourceKey: 'city-news',
      civicItemId: 7,
      title: 'Council sets millage rate',
      body: 'The council set the millage rate at 9.5 mills for the 2026 budget after a public hearing.',
    },
    {
      sourceKey: 'city-news',
      civicItemId: 8,
      title: 'Library extends weekend hours',
      body: 'The public library will open on Sundays starting next month.',
    },
  ];
  const strict = {
    requireGrounding: true,
    requireNumericCitationIds: true,
    dropInvalidClaims: true,
  };

  it('keeps grounded bullets and records why the others were dropped', () => {
    const brief = validateBriefAnalysis(
      JSON.stringify({
        bullets: [
          {
            text: 'The council set the millage rate at 9.5 mills.',
            citations: [{ sourceKey: 'city-news', civicItemId: 7 }],
          },
          {
            text: 'The council set the millage rate at 12 mills.',
            citations: [{ sourceKey: 'city-news', civicItemId: 7 }],
          },
          {
            text: 'The library will open on Sundays.',
            citations: [{ sourceKey: 'city-news', civicItemId: 8 }],
          },
        ],
      }),
      evidence,
      strict
    );
    expect(brief.bullets.map((bullet) => bullet.text)).toStrictEqual([
      'The council set the millage rate at 9.5 mills.',
      'The library will open on Sundays.',
    ]);
    expect(brief.rejected?.length).toBe(1);
    expect(brief.rejected?.[0]?.index).toBe(1);
    expect(brief.rejected?.[0]?.reason ?? '').toMatch(
      /claim-grounding\/unsupported-number-or-identifier/u
    );
  });

  it('still rejects the whole output when no bullet survives, keeping the first grounding reason', () => {
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({
          bullets: [
            {
              text: 'The council set the millage rate at 12 mills.',
              citations: [{ sourceKey: 'city-news', civicItemId: 7 }],
            },
          ],
        }),
        evidence,
        strict
      )
    ).toThrow(
      /no valid entries; claim-grounding\/unsupported-number-or-identifier/u
    );
    expect(() =>
      validateBriefAnalysis(
        JSON.stringify({
          bullets: [
            {
              text: 'The council set the millage rate at 9.5 mills.',
              citations: [{ sourceKey: 'city-news', civicItemId: 7 }],
            },
            {
              text: 'The council set the millage rate at 12 mills.',
              citations: [{ sourceKey: 'city-news', civicItemId: 7 }],
            },
          ],
        }),
        evidence,
        { requireGrounding: true, requireNumericCitationIds: true }
      )
    ).toThrow(/unsupported-number-or-identifier/u);
  });

  it('drops ungrounded story claims and replaces an ungrounded title with the evidence title', () => {
    const story = validateStoryAnalysis(
      JSON.stringify({
        title: 'Council raises taxes to 12 mills',
        claims: [
          {
            text: 'The council set the millage rate at 9.5 mills.',
            citations: [{ sourceKey: 'city-news', civicItemId: 7 }],
          },
          {
            text: 'The mayor resigned after the vote.',
            citations: [{ sourceKey: 'city-news', civicItemId: 7 }],
          },
        ],
        status: 'ongoing',
      }),
      evidence,
      {
        requireClaims: true,
        requireNumericCitationIds: true,
        dropInvalidClaims: true,
        fallbackTitle: 'Council sets millage rate',
        fallbackTitleOrigin: 'evidence',
      }
    );
    expect(story.claims?.map((claim) => claim.text)).toStrictEqual([
      'The council set the millage rate at 9.5 mills.',
    ]);
    expect(story.title).toBe('Council sets millage rate');
    expect(story.titleOrigin).toBe('evidence');
    expect(story.rejected?.map((entry) => entry.index)).toStrictEqual([1, -1]);
  });
});

describe('date grounding with abbreviated months', () => {
  it('accepts a spelled-out date when the evidence abbreviates the month with a period (AP style)', () => {
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'paper',
        civicItemId: 238,
        title: 'Fillies set to open 2026 regular season',
        body: 'The Fillies soccer team will begin its regular season Aug. 29, in a home match versus New College of Florida.',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The Fillies soccer team will begin its regular season on August 29 against New College of Florida.',
        [{ sourceKey: 'paper', civicItemId: 238 }],
        evidence,
        'bullet'
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The Fillies soccer team will begin its regular season on August 30 against New College of Florida.',
        [{ sourceKey: 'paper', civicItemId: 238 }],
        evidence,
        'bullet'
      )
    ).toThrow(/unsupported-(?:date|number-or-identifier)/u);
  });
});

describe('agenda rules apply only to agenda evidence', () => {
  it('lets a news article report that an event took place or is scheduled', () => {
    const recoveryFest: LlmEvidence[] = [
      {
        sourceKey: 'paper',
        civicItemId: 304,
        evidenceKind: 'source-item',
        date: '2026-09-07',
        title:
          'Community celebrates road to recovery at sixth annual RecoveryFest',
        body: 'Community members gathered once again this past weekend. The sixth annual RecoveryFest was held September 5 at Fulwood Park and was scheduled to include testimonials.',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The sixth annual RecoveryFest took place on September 5 at Fulwood Park.',
        [{ sourceKey: 'paper', civicItemId: 304 }],
        recoveryFest,
        'claim',
        { asOf: '2026-09-17' }
      )
    ).not.toThrow();
    const thunderCon: LlmEvidence[] = [
      {
        sourceKey: 'paper',
        civicItemId: 189,
        evidenceKind: 'source-item',
        date: '2026-08-19',
        title: 'ThunderCon returns to ABAC Sept. 19',
        body: 'ThunderCon is scheduled to return to ABAC on Saturday, Sept. 19, from 10 a.m. to 6 p.m. in Gressette Gymnasium.',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'ThunderCon is scheduled to return to ABAC on Sept. 19 in Gressette Gymnasium.',
        [{ sourceKey: 'paper', civicItemId: 189 }],
        thunderCon,
        'claim',
        { asOf: '2026-09-17' }
      )
    ).not.toThrow();
  });

  it('still refuses occurrence wording for an agenda row', () => {
    const agenda: LlmEvidence[] = [
      {
        sourceKey: 'city-docs',
        civicItemId: 214,
        agendaItemId: 192,
        evidenceKind: 'agenda-row',
        date: '2026-08-24',
        title: 'Agenda item',
        body: '1. Ripple Award – Shon McQueen',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The meeting was held for the Ripple Award for Shon McQueen.',
        [{ sourceKey: 'city-docs', civicItemId: 214, agendaItemId: 192 }],
        agenda,
        'claim',
        { asOf: '2026-09-17' }
      )
    ).toThrow(/agenda/u);
  });

  it('refuses upcoming wording for an agenda already past, though it lists approval of minutes', () => {
    const agenda: LlmEvidence[] = [
      {
        sourceKey: 'town-docs',
        civicItemId: 71,
        agendaItemId: 87,
        evidenceKind: 'agenda-row',
        date: '2026-09-23',
        title: 'Inland Wetlands Agency Regular Meeting Agenda 2026-09-23',
        body: 'Approval of Minutes. Pending Applications: IWA26-0008 Jones Residence',
      },
    ];
    const cite = [
      { sourceKey: 'town-docs', civicItemId: 71, agendaItemId: 87 },
    ];
    expect(() =>
      validateClaimGrounding(
        'The Inland Wetlands Agency is scheduled to consider the Jones Residence application.',
        cite,
        agenda,
        'claim',
        { asOf: '2026-09-24' }
      )
    ).toThrow(/temporal-modality/u);
    expect(() =>
      validateClaimGrounding(
        'The Inland Wetlands Agency meets to consider the Jones Residence application.',
        cite,
        agenda,
        'claim',
        { asOf: '2026-09-24' }
      )
    ).toThrow(/temporal-modality/u);
    expect(() =>
      validateClaimGrounding(
        'The Jones Residence application was on the Inland Wetlands Agency agenda for Sept. 23.',
        cite,
        agenda,
        'claim',
        { asOf: '2026-09-24' }
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The Inland Wetlands Agency meets to consider the Jones Residence application.',
        cite,
        agenda,
        'claim',
        { asOf: '2026-09-22' }
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The Inland Wetlands Agency was set to review the Jones Residence application on Sept. 23.',
        cite,
        agenda,
        'claim',
        { asOf: '2026-09-24' }
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The Inland Wetlands Agency was scheduled to consider the Jones Residence application.',
        cite,
        agenda,
        'claim',
        { asOf: '2026-09-24' }
      )
    ).not.toThrow();
  });

  it('does not read a game score as a date', () => {
    const game: LlmEvidence[] = [
      {
        sourceKey: 'paper',
        civicItemId: 423,
        title: 'Tift softball drops region game',
        body: 'Tift County lost at Thomas County Central 9-0 on Tuesday.',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'Tift County lost 9-0 at Thomas County Central on Tuesday.',
        [{ sourceKey: 'paper', civicItemId: 423 }],
        game,
        'claim'
      )
    ).not.toThrow();
  });
});

describe('undated evidence', () => {
  const evidence = [
    {
      sourceKey: 'berrien-schools-board',
      civicItemId: 7,
      undated: true,
      body: 'The Berrien County Board of Education will hold public hearings on April 20th and May 11th at 5:30 p.m. on the proposed budget.',
      title: 'Board meetings',
    },
  ];

  it('rejects a dated claim whose only evidence is a page with no date', () => {
    expect(() =>
      validateBriefAnalysis(
        {
          bullets: [
            {
              text: 'The Berrien County Board of Education will hold public hearings on April 20th and May 11th at 5:30 p.m.',
              citations: [
                { sourceKey: 'berrien-schools-board', civicItemId: 7 },
              ],
            },
          ],
        },
        evidence,
        { requireGrounding: true }
      )
    ).toThrow(/undated-evidence-date/);
  });

  it('keeps an undated claim from the same page, and a dated claim from dated evidence', () => {
    const undatedClaim = validateBriefAnalysis(
      {
        bullets: [
          {
            text: 'The Berrien County Board of Education plans public hearings on the proposed budget.',
            citations: [{ sourceKey: 'berrien-schools-board', civicItemId: 7 }],
          },
        ],
      },
      evidence,
      { requireGrounding: true }
    );
    expect(undatedClaim.bullets.length).toBe(1);
    const dated = validateBriefAnalysis(
      {
        bullets: [
          {
            text: 'The board set hearings for April 20th.',
            citations: [{ sourceKey: 'berrien-schools-board', civicItemId: 8 }],
          },
        ],
      },
      [
        {
          sourceKey: 'berrien-schools-board',
          civicItemId: 8,
          date: '2026-04-01',
          body: 'The board set hearings for April 20th on the budget.',
          title: 'Budget hearings',
        },
      ],
      { requireGrounding: true }
    );
    expect(dated.bullets.length).toBe(1);
  });
});

describe('the edition as an article', () => {
  const evidence = [
    {
      sourceKey: 'gazette',
      civicItemId: 1,
      title: 'Council sets millage rate for 2027',
      body: 'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills, holding it level for homeowners.',
      date: '2026-09-15',
      role: 'news' as const,
    },
    {
      sourceKey: 'agendas',
      civicItemId: 2,
      title: 'Millage rate discussion',
      body: 'The council first discussed the millage rate at its August 24 meeting and scheduled public hearings.',
      date: '2026-08-24',
      role: 'background' as const,
    },
  ];
  const article = (
    paragraphs: unknown[],
    headline = 'Council sets millage rate for 2027'
  ) => JSON.stringify({ headline, paragraphs });
  const claim = (text: string, civicItemId: number) => ({
    text,
    citations: [
      { sourceKey: civicItemId === 1 ? 'gazette' : 'agendas', civicItemId },
    ],
  });
  const strict = {
    requireGrounding: true,
    requireNumericCitationIds: true,
    dropInvalidClaims: true,
  };

  it('keeps an article that opens on the news and dates its background', () => {
    const result = validateBriefAnalysis(
      article([
        {
          claims: [
            claim(
              'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills.',
              1
            ),
          ],
        },
        {
          claims: [
            claim(
              'The council first discussed the millage rate on Aug. 24 and scheduled public hearings.',
              2
            ),
          ],
        },
      ]),
      evidence,
      strict
    );
    expect(result.headline).toBe('Council sets millage rate for 2027');
    expect(result.paragraphs?.length).toBe(2);
    expect(result.bullets.length).toBe(2);
  });

  it('drops a claim that uses background without saying when it happened', () => {
    const result = validateBriefAnalysis(
      article([
        {
          claims: [
            claim(
              'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills.',
              1
            ),
          ],
        },
        {
          claims: [
            claim(
              'The council discussed the millage rate and scheduled public hearings.',
              2
            ),
          ],
        },
      ]),
      evidence,
      strict
    );
    expect(result.paragraphs?.length).toBe(1);
    expect(JSON.stringify(result.rejected)).toMatch(
      /does not say when it happened/
    );
  });

  it('moves the news to the top when the model opens on background', () => {
    const result = validateBriefAnalysis(
      article([
        {
          claims: [
            claim(
              'The council first discussed the millage rate on Aug. 24 and scheduled public hearings.',
              2
            ),
          ],
        },
        {
          claims: [
            claim(
              'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills.',
              1
            ),
          ],
        },
      ]),
      evidence,
      strict
    );
    expect(result.paragraphs![0]!.claims[0]!.text).toMatch(/voted Monday/);
  });

  it('refuses an article that cites nothing new', () => {
    expect(() =>
      validateBriefAnalysis(
        article([
          {
            claims: [
              claim(
                'The council first discussed the millage rate on Aug. 24 and scheduled public hearings.',
                2
              ),
            ],
          },
        ]),
        evidence,
        strict
      )
    ).toThrow(/cites nothing new/);
  });

  it('falls back to the lead claim when the headline is not grounded', () => {
    const result = validateBriefAnalysis(
      article(
        [
          {
            claims: [
              claim(
                'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills.',
                1
              ),
            ],
          },
        ],
        'Mayor resigns amid scandal'
      ),
      evidence,
      strict
    );
    expect(result.headline).toBe(
      'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills'
    );
    expect(result.headlineOrigin).toBe('claim');
  });

  it("falls back to the lead record's title when the lead claim is too long to head the article", () => {
    const long =
      'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills, holding it level for homeowners in the city.';
    const result = validateBriefAnalysis(
      article([{ claims: [claim(long, 1)] }], 'Mayor resigns amid scandal'),
      evidence,
      strict
    );
    expect(result.headline).toBe('Council sets millage rate for 2027');
    expect(result.headlineOrigin).toBe('evidence');
  });

  it('grounds a headline that sums up the whole article, not the lead alone', () => {
    const result = validateBriefAnalysis(
      article(
        [
          {
            claims: [
              claim(
                'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills.',
                1
              ),
            ],
          },
          {
            claims: [
              claim(
                'The council first discussed the millage rate on Aug. 24 and scheduled public hearings.',
                2
              ),
            ],
          },
        ],
        'Council sets millage rate after public hearings'
      ),
      evidence,
      strict
    );
    expect(result.headline).toBe(
      'Council sets millage rate after public hearings'
    );
    expect(result.headlineOrigin).toBe('model');
  });

  it('drops a claim that only repeats what the article already said from the same source', () => {
    const result = validateBriefAnalysis(
      article([
        {
          claims: [
            claim(
              'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills.',
              1
            ),
            claim('The council set the 2027 millage rate at 8.1 mills.', 1),
          ],
        },
      ]),
      evidence,
      strict
    );
    expect(result.paragraphs![0]!.claims.length).toBe(1);
    expect(JSON.stringify(result.rejected)).toMatch(/repeats an earlier claim/);
  });

  it('does not call a different row of the same agenda a repeat', () => {
    const agenda = [
      ...evidence,
      {
        sourceKey: 'agendas',
        civicItemId: 5,
        agendaItemId: 51,
        title: 'Agenda 09/14/2026',
        body: '5. Millage Rate Tentative Proposal',
        date: '2026-09-14',
        role: 'news' as const,
      },
      {
        sourceKey: 'agendas',
        civicItemId: 5,
        agendaItemId: 52,
        title: 'Agenda 09/14/2026',
        body: '6. Discussion – Entertainment District',
        date: '2026-09-14',
        role: 'news' as const,
      },
    ];
    const result = validateBriefAnalysis(
      article([
        {
          claims: [
            {
              text: 'The Millage Rate Tentative Proposal was on the September 14 agenda.',
              citations: [
                { sourceKey: 'agendas', civicItemId: 5, agendaItemId: 51 },
              ],
            },
            {
              text: 'The Entertainment District was on the September 14 agenda.',
              citations: [
                { sourceKey: 'agendas', civicItemId: 5, agendaItemId: 52 },
              ],
            },
          ],
        },
      ]),
      agenda,
      strict
    );
    expect(result.paragraphs![0]!.claims.length).toBe(2);
  });

  it('drops a committee meeting "held" on the strength of its agenda', () => {
    const agenda: LlmEvidence[] = [
      {
        sourceKey: 'city-docs',
        civicItemId: 10,
        date: '2026-09-21',
        title: 'Agenda 09/21/2026',
        body: 'Beach & Parks Committee AGENDA Monday, September 21, 2026 OLD BUSINESS a. Farmers Market',
      },
    ];
    expect(() =>
      validateClaimGrounding(
        'The Beach & Parks Committee held a meeting on September 21 about the Farmers Market.',
        [{ sourceKey: 'city-docs', civicItemId: 10 }],
        agenda,
        'claim',
        { asOf: '2026-09-24' }
      )
    ).toThrow(/agenda/u);
  });

  it('drops a membership list, which is not news', () => {
    const board = [
      ...evidence,
      {
        sourceKey: 'agendas',
        civicItemId: 3,
        title: 'Parks and Recreation Commission agenda',
        body: 'Commission members: Chair Michael DiFranco, Elizabeth Hogan, Megan Raymond, James Steffes, Terry Tsang.',
        date: '2026-09-23',
        role: 'news' as const,
      },
    ];
    const result = validateBriefAnalysis(
      article([
        {
          claims: [
            claim(
              'The Tifton City Council voted Monday to set the 2027 millage rate at 8.1 mills.',
              1
            ),
          ],
        },
        {
          claims: [
            {
              text: 'Commission members included Chair Michael DiFranco, Elizabeth Hogan, Megan Raymond, James Steffes, and Terry Tsang.',
              citations: [{ sourceKey: 'agendas', civicItemId: 3 }],
            },
          ],
        },
      ]),
      board,
      strict
    );
    expect(result.paragraphs?.length).toBe(1);
    expect(JSON.stringify(result.rejected)).toMatch(/who sits on a body/);
  });
});

describe('validateBriefPlan', () => {
  const evidence: LlmEvidence[] = [
    {
      sourceKey: 'docs',
      civicItemId: 1,
      title: 'Agenda',
      body: 'Millage rate',
      date: '2026-09-14',
      role: 'news',
    },
    {
      sourceKey: 'docs',
      civicItemId: 2,
      title: 'Agenda',
      body: 'Earlier millage discussion',
      date: '2026-08-24',
      role: 'background',
    },
  ];
  it('keeps matters that rest on news, drops unbound facts and background-only matters', () => {
    const plan = validateBriefPlan(
      JSON.stringify({
        matters: [
          {
            body: 'City Council',
            subject: 'millage',
            facts: [
              {
                text: 'The millage rate was on the agenda.',
                citations: [{ sourceKey: 'docs', civicItemId: 1 }],
              },
              {
                text: 'Invented.',
                citations: [{ sourceKey: 'docs', civicItemId: 99 }],
              },
            ],
          },
          {
            body: 'City Council',
            subject: 'history',
            facts: [
              {
                text: 'Discussed Aug. 24.',
                citations: [{ sourceKey: 'docs', civicItemId: 2 }],
              },
            ],
          },
        ],
      }),
      evidence
    );
    expect(plan.matters.length).toBe(1);
    expect(plan.matters[0]!.facts.length).toBe(1);
  });
  it('refuses a plan with nothing new in it', () => {
    expect(() =>
      validateBriefPlan(
        JSON.stringify({
          matters: [
            {
              body: 'Council',
              subject: 'history',
              facts: [
                {
                  text: 'Discussed Aug. 24.',
                  citations: [{ sourceKey: 'docs', civicItemId: 2 }],
                },
              ],
            },
          ],
        }),
        evidence
      )
    ).toThrow(/no matter resting on news/);
  });
});

describe('plan-bound citations', () => {
  const evidence: LlmEvidence[] = [
    {
      sourceKey: 'docs',
      civicItemId: 1,
      agendaItemId: 11,
      title: 'Agenda 09/08/2026',
      body: '1. Zoning Application PP26-0016 submitted by Strong Rock Development Group',
      date: '2026-09-08',
      role: 'news',
    },
    {
      sourceKey: 'docs',
      civicItemId: 1,
      agendaItemId: 12,
      title: 'Agenda 09/08/2026',
      body: '6. Surplus and Sale of Property at 418 Ridge Avenue',
      date: '2026-09-08',
      role: 'news',
    },
  ];
  const strict = {
    requireGrounding: true,
    requireNumericCitationIds: true,
    dropInvalidClaims: true,
    asOf: '2026-09-09',
  };
  const miscited = JSON.stringify({
    headline: 'Strong Rock zoning application on agenda',
    paragraphs: [
      {
        claims: [
          {
            text: 'A zoning application from Strong Rock Development Group was on the Sept. 8 agenda.',
            citations: [
              { sourceKey: 'docs', civicItemId: 1, agendaItemId: 12 },
            ],
          },
        ],
      },
    ],
  });

  it('rebinds a claim to the plan citation it grounds on', () => {
    const result = validateBriefAnalysis(miscited, evidence, {
      ...strict,
      candidateCitations: [
        [{ sourceKey: 'docs', civicItemId: 1, agendaItemId: 12 }],
        [{ sourceKey: 'docs', civicItemId: 1, agendaItemId: 11 }],
      ],
    });
    expect(result.paragraphs![0]!.claims[0]!.citations).toStrictEqual([
      { sourceKey: 'docs', civicItemId: 1, agendaItemId: 11 },
    ]);
  });

  it('still drops a miscited claim without a plan', () => {
    expect(() => validateBriefAnalysis(miscited, evidence, strict)).toThrow(
      /no valid claims/
    );
  });
});

describe('agenda row context', () => {
  it('does not let a claim about one row borrow a name from another row of the same agenda', () => {
    const header =
      'Regular Meeting Agenda Parks and Recreation Commission Wednesday, September 23, 2026 4:00 PM Groton Community Center';
    const evidence: LlmEvidence[] = [
      {
        sourceKey: 'docs',
        civicItemId: 70,
        agendaItemId: 875,
        evidenceKind: 'agenda-row',
        title:
          'Parks and Recreation Commission Regular Meeting Agenda 2026-09-23',
        body: 'Unfinished Business: Food Supervisor',
        date: '2026-09-23',
        parentDocumentContext: {
          title:
            'Parks and Recreation Commission Regular Meeting Agenda 2026-09-23',
          body: header,
        },
      },
    ];
    const cite = [{ sourceKey: 'docs', civicItemId: 70, agendaItemId: 875 }];
    expect(() =>
      validateClaimGrounding(
        'A food supervisor application from David Jones was on the Parks and Recreation Commission agenda for Sept. 23.',
        cite,
        evidence,
        'claim',
        { asOf: '2026-09-24' }
      )
    ).toThrow(/David|jones|named/iu);
    expect(() =>
      validateClaimGrounding(
        'A food supervisor was on the Parks and Recreation Commission agenda for Sept. 23.',
        cite,
        evidence,
        'claim',
        { asOf: '2026-09-24' }
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'A food supervisor was on the agenda for the Groton Community Center meeting.',
        cite,
        evidence,
        'claim',
        { asOf: '2026-09-24' }
      )
    ).not.toThrow();
  });
});

describe('grounding false positives from the two-stage benchmark', () => {
  const ev: LlmEvidence[] = [
    {
      sourceKey: 's',
      civicItemId: 1,
      title: 'Millage and alerts',
      body: 'The school district set the millage rate at 11.777 at their Sept. 8 meeting, down from 12.275. Commissioners signed on with a new alerting software courtesy of GEMA/HS.',
    },
  ];
  const cite = [{ sourceKey: 's', civicItemId: 1 }];
  it('reads a decimal followed by a comma as the whole number', () => {
    expect(() =>
      validateClaimGrounding(
        'The district set its millage rate at 11.777, down from 12.275.',
        cite,
        ev,
        'claim'
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'The district set its millage rate at 11.778, down from 12.275.',
        cite,
        ev,
        'claim'
      )
    ).toThrow(/numeric/);
  });
  it('matches a slashed agency name to the same name in the evidence', () => {
    expect(() =>
      validateClaimGrounding(
        'Commissioners signed on with new alerting software from GEMA/HS.',
        cite,
        ev,
        'claim'
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'Commissioners signed on with new alerting software from GEMA/FL.',
        cite,
        ev,
        'claim'
      )
    ).toThrow(/named/);
  });
});

describe('fillFromPlan', () => {
  const evidence: LlmEvidence[] = [
    {
      sourceKey: 'docs',
      civicItemId: 71,
      agendaItemId: 882,
      title: 'Inland Wetlands Agency Regular Meeting Agenda 2026-09-23',
      body: 'PENDING APPLICATIONS: IWA26-0008 Jones Residence Permit Modification, 183 Oslo Street',
      date: '2026-09-23',
      role: 'news',
    },
    {
      sourceKey: 'docs',
      civicItemId: 70,
      agendaItemId: 878,
      title:
        'Parks and Recreation Commission Regular Meeting Agenda 2026-09-23',
      body: 'New Business: Memorial Benches',
      date: '2026-09-23',
      role: 'news',
    },
  ];
  const plan = {
    matters: [
      {
        body: 'Parks and Recreation Commission',
        subject: 'benches',
        facts: [
          {
            text: 'Memorial benches were on the Parks and Recreation Commission agenda for Sept. 23.',
            citations: [
              { sourceKey: 'docs', civicItemId: 70, agendaItemId: 878 },
            ],
          },
        ],
      },
      {
        body: 'Inland Wetlands Agency',
        subject: 'permit',
        facts: [
          {
            text: 'A permit modification for the Jones Residence at 183 Oslo Street was on the Inland Wetlands Agency agenda for Sept. 23.',
            citations: [
              { sourceKey: 'docs', civicItemId: 71, agendaItemId: 882 },
            ],
          },
          {
            text: 'A permit for the Smith Residence at 99 Elm Street was on the agenda.',
            citations: [
              { sourceKey: 'docs', civicItemId: 71, agendaItemId: 882 },
            ],
          },
        ],
      },
    ],
  };
  const written = {
    headline: 'Memorial benches on Parks agenda',
    bullets: [],
    paragraphs: [
      {
        claims: [
          {
            text: 'Memorial benches were on the Parks and Recreation Commission agenda.',
            citations: [
              { sourceKey: 'docs', civicItemId: 70, agendaItemId: 878 },
            ],
          },
        ],
      },
    ],
  };

  it("adds a planned fact the writer skipped, in the plan's words, when it grounds", () => {
    const filled = fillFromPlan(written as never, plan, evidence, {
      asOf: '2026-09-24',
    });
    expect(filled.paragraphs!.length).toBe(2);
    expect(filled.paragraphs![1]!.claims[0]!.text).toMatch(/183 Oslo Street/);
    expect(filled.paragraphs![1]!.claims[0]!.fromPlan).toBe(true);
    expect(filled.bullets.length).toBe(2);
  });

  it('grounds a skipped fact on a sibling citation of its matter when the planner bound it to the wrong row', () => {
    const rows: LlmEvidence[] = [
      ...evidence,
      {
        sourceKey: 'docs',
        civicItemId: 70,
        agendaItemId: 876,
        title:
          'Parks and Recreation Commission Regular Meeting Agenda 2026-09-23',
        body: 'Unfinished Business: David Jones Board Application',
        date: '2026-09-23',
        role: 'news',
      },
    ];
    const misbound = {
      matters: [
        {
          body: 'Parks and Recreation Commission',
          subject: 'business',
          facts: [
            {
              text: 'Memorial benches were on the Parks and Recreation Commission agenda for Sept. 23.',
              citations: [
                { sourceKey: 'docs', civicItemId: 70, agendaItemId: 878 },
              ],
            },
            {
              text: 'A board application from David Jones was on the Parks and Recreation Commission agenda for Sept. 23.',
              citations: [
                { sourceKey: 'docs', civicItemId: 70, agendaItemId: 878 },
              ],
            },
            {
              text: 'Placeholder fact.',
              citations: [
                { sourceKey: 'docs', civicItemId: 70, agendaItemId: 876 },
              ],
            },
          ],
        },
      ],
    };
    const filled = fillFromPlan(
      {
        headline: 'x',
        bullets: [],
        paragraphs: [
          {
            claims: [
              {
                text: 'Memorial benches were listed for the Parks and Recreation Commission.',
                citations: [
                  { sourceKey: 'docs', civicItemId: 70, agendaItemId: 878 },
                ],
              },
            ],
          },
        ],
      } as never,
      misbound,
      rows,
      { asOf: '2026-09-24' }
    );
    const jones = filled.bullets.find((claim) =>
      /David Jones/.test(claim.text)
    );
    expect(jones?.citations).toStrictEqual([
      { sourceKey: 'docs', civicItemId: 70, agendaItemId: 876 },
    ]);
  });

  it('does not add a fact the writer already stated under another citation', () => {
    const stated = {
      ...written,
      paragraphs: [
        ...written.paragraphs,
        {
          claims: [
            {
              text: 'A permit modification for the Jones Residence at 183 Oslo Street was on the Inland Wetlands Agency agenda.',
              citations: [
                { sourceKey: 'docs', civicItemId: 70, agendaItemId: 878 },
              ],
            },
          ],
        },
      ],
    };
    expect(
      fillFromPlan(stated as never, plan, evidence, { asOf: '2026-09-24' })
        .bullets.length
    ).toBe(2);
  });
});

describe('arranging a planned article', () => {
  const evidence: LlmEvidence[] = [
    {
      sourceKey: 'docs',
      civicItemId: 10,
      agendaItemId: 933,
      title: 'Agenda 09/21/2026',
      body: 'OLD BUSINESS: Social Media',
      date: '2026-09-21',
      role: 'news',
    },
    {
      sourceKey: 'docs',
      civicItemId: 71,
      agendaItemId: 882,
      title: 'Inland Wetlands Agency Regular Meeting Agenda 2026-09-23',
      body: 'PENDING APPLICATIONS: IWA26-0008 Jones Residence Permit Modification, 183 Oslo Street',
      date: '2026-09-23',
      role: 'news',
    },
  ];
  const social = {
    body: 'Beach & Parks Committee',
    subject: 'social media',
    facts: [
      {
        text: 'Social media was on the committee agenda.',
        citations: [{ sourceKey: 'docs', civicItemId: 10, agendaItemId: 933 }],
      },
    ],
  };
  const permit = {
    body: 'Inland Wetlands Agency',
    subject: 'permit modification',
    facts: [
      {
        text: 'A permit modification at 183 Oslo Street was on the agency agenda.',
        citations: [{ sourceKey: 'docs', civicItemId: 71, agendaItemId: 882 }],
      },
    ],
  };

  it('ranks an indictment of a public official above agenda listings', () => {
    const indictment = {
      body: 'Groton Housing Authority',
      subject: 'former director indicted',
      facts: [
        {
          text: 'The former executive director was indicted on wire fraud and money laundering charges.',
          citations: [],
        },
      ],
    };
    expect(
      orderPlanByConsequence({ matters: [social, indictment] }).matters[0]!
        .subject
    ).toBe('former director indicted');
  });

  it('puts the consequential matter first, keeping the planner order among equals', () => {
    expect(
      orderPlanByConsequence({ matters: [social, permit] }).matters.map(
        (matter) => matter.subject
      )
    ).toStrictEqual(['permit modification', 'social media']);
  });

  it('gives each matter its own paragraph, in plan order, when the writer ran them together', () => {
    const oneParagraph = {
      headline: 'x',
      bullets: [],
      paragraphs: [
        {
          claims: [
            {
              text: 'Social media was listed as old business for the Beach & Parks Committee.',
              citations: [
                { sourceKey: 'docs', civicItemId: 10, agendaItemId: 933 },
              ],
            },
            {
              text: 'A permit modification at 183 Oslo Street was on the Inland Wetlands Agency agenda.',
              citations: [
                { sourceKey: 'docs', civicItemId: 71, agendaItemId: 882 },
              ],
            },
          ],
        },
      ],
    };
    const arranged = fillFromPlan(
      oneParagraph as never,
      { matters: [permit, social] },
      evidence,
      { asOf: '2026-09-24' }
    );
    expect(
      arranged.paragraphs!.map((paragraph) => paragraph.claims.length)
    ).toStrictEqual([1, 1]);
    expect(arranged.paragraphs![0]!.claims[0]!.text).toMatch(/Oslo Street/);
  });
});

describe('salvaging a cut-off plan', () => {
  const evidence: LlmEvidence[] = [
    {
      sourceKey: 'docs',
      civicItemId: 1,
      title: 'Agenda',
      body: 'Millage rate 6.571 mills',
      date: '2026-09-24',
      role: 'news',
    },
  ];
  const fact = (text: string) => ({
    text,
    citations: [{ sourceKey: 'docs', civicItemId: 1 }],
  });
  it('keeps what a looping planner completed, without its repeats', () => {
    const whole = JSON.stringify({
      matters: [
        {
          body: 'Board of County Commissioners',
          subject: 'budget',
          facts: [
            fact('The county millage rate was 6.571 mills.'),
            fact('The board held a forum.'),
            fact('The board held a forum.'),
            fact('The board held a forum.'),
          ],
        },
      ],
    });
    const cut = whole.slice(
      0,
      whole.lastIndexOf('The board held a forum.') + 8
    );
    const plan = validateBriefPlan(cut, evidence);
    expect(plan.matters[0]!.facts.map((entry) => entry.text)).toStrictEqual([
      'The county millage rate was 6.571 mills.',
      'The board held a forum.',
    ]);
  });
  it('keeps one of a matter a loop repeated', () => {
    const matter = {
      body: 'Board',
      subject: 'forum',
      facts: [fact('The county millage rate was 6.571 mills.')],
    };
    expect(
      validateBriefPlan(
        JSON.stringify({ matters: [matter, matter, matter] }),
        evidence
      ).matters.length
    ).toBe(1);
  });

  it('closes an unfinished document at its last complete object', () => {
    expect(salvageJson('{"a":[{"b":1},{"b":2},{"b"')).toStrictEqual({
      a: [{ b: 1 }, { b: 2 }],
    });
  });
});

describe('money abbreviations', () => {
  it('reads $16M in the evidence as $16 million in a claim, and no other amount', () => {
    const ev: LlmEvidence[] = [
      {
        sourceKey: 'ctx',
        civicItemId: 1,
        title: 'Feds Charge Former Housing Director in $16M Loan Scheme',
        body: 'Robert Cappelletti walks out of federal court following an indictment.',
      },
    ];
    const cite = [{ sourceKey: 'ctx', civicItemId: 1 }];
    expect(() =>
      validateClaimGrounding(
        'Robert Cappelletti was indicted in a $16 million loan scheme.',
        cite,
        ev,
        'claim'
      )
    ).not.toThrow();
    expect(() =>
      validateClaimGrounding(
        'Robert Cappelletti was indicted in a $17 million loan scheme.',
        cite,
        ev,
        'claim'
      )
    ).toThrow(/numeric/);
  });
});

describe('adjectival participles on an agenda row', () => {
  const ev: LlmEvidence[] = [
    {
      sourceKey: 'docs',
      civicItemId: 1,
      agendaItemId: 7,
      evidenceKind: 'agenda-row',
      title: 'Second Budget Public Hearing Agenda 2026-09-24',
      body: 'Board Adoption of the Final Millage Resolution. Millage rates presented are: County-wide millage rate - 6.571 mills',
      date: '2026-09-24',
      parentDocumentContext: {
        title: 'Second Budget Public Hearing Agenda 2026-09-24',
        body: 'AGENDA Second Budget Public Hearing September 24, 2026 5:01 P.M.',
      },
    },
  ];
  const cite = [{ sourceKey: 'docs', civicItemId: 1, agendaItemId: 7 }];
  it('reads "the proposed rate" as naming the item, not as someone proposing it', () => {
    expect(() =>
      validateClaimGrounding(
        'The proposed county-wide millage rate was 6.571 mills.',
        cite,
        ev,
        'claim',
        { asOf: '2026-09-25' }
      )
    ).not.toThrow();
  });
  it('still refuses a claim that someone proposed it', () => {
    expect(() =>
      validateClaimGrounding(
        'The chair proposed a county-wide millage rate of 6.571 mills.',
        cite,
        ev,
        'claim',
        { asOf: '2026-09-25' }
      )
    ).toThrow(/proposed/);
  });
});
