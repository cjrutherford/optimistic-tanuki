import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
  buildTopicMatcher,
  describeEmptyTopic,
  getTokenThreshold,
} from './topic-matcher.util';

const buildTopic = (overrides: Partial<LeadTopic>): Partial<LeadTopic> => ({
  name: '',
  keywords: [],
  painPoints: null,
  targetCompanies: null,
  buyerPersona: null,
  valueProposition: null,
  searchStrategy: null,
  ...overrides,
});

describe('buildTopicMatcher', () => {
  it('still matches a short keyword on its own, as the literal test did', () => {
    const matcher = buildTopicMatcher(
      buildTopic({ name: 'React roles', keywords: ['react'] })
    );

    expect(matcher.match('Senior React Engineer at Acme')).toEqual(['react']);
  });

  it('matches a posting through a long profile sentence it never quotes', () => {
    // The shape the onboarding profile actually produces: `serviceOffer` is
    // prose, so no posting will ever contain it verbatim.
    const matcher = buildTopicMatcher(
      buildTopic({
        name: 'Fractional CTO and platform engineering leadership roles',
        keywords: ['Fractional CTO and platform engineering leadership'],
      })
    );

    expect(
      matcher.match(
        'Head of Platform  We need engineering leadership for our platform team.'
      )
    ).toEqual(
      expect.arrayContaining(['platform', 'engineering', 'leadership'])
    );
  });

  it('will not qualify a posting on a single generic word', () => {
    const matcher = buildTopicMatcher(
      buildTopic({
        keywords: ['Cut cloud spend by 40%'],
      })
    );

    // "cloud" alone is every infrastructure posting ever written.
    expect(matcher.match('Cloud Engineer wanted for a growing team')).toEqual(
      []
    );
    expect(matcher.match('Own our cloud spend and capacity planning')).toEqual(
      expect.arrayContaining(['cloud', 'spend'])
    );
  });

  it('requires corroborating words to come from the same topic term', () => {
    const matcher = buildTopicMatcher(
      buildTopic({
        keywords: [
          'Cut cloud spend by 40%',
          'Rescue delivery from legacy monoliths',
        ],
      })
    );

    // One word from each unrelated term says nothing about the posting.
    expect(matcher.match('We deliver cloud training courses')).toEqual([]);
    // Two words from one term does.
    expect(
      matcher.match('Untangling a legacy monolith to unblock delivery')
    ).toEqual(expect.arrayContaining(['legacy', 'delivery']));
  });

  it('respects word boundaries so short skills do not match inside other words', () => {
    const matcher = buildTopicMatcher(buildTopic({ keywords: ['aws', 'go'] }));

    expect(matcher.match('Spot the flaws in our ongoing process')).toEqual([]);
    expect(matcher.match('AWS and Go experience required')).toEqual(
      expect.arrayContaining(['aws', 'go'])
    );
  });

  it('ignores numbers and filler when breaking a term into words', () => {
    const matcher = buildTopicMatcher(
      buildTopic({ keywords: ['Shipped 3 platforms in 2024 for the team'] })
    );

    const tokens = matcher.tokenGroups[0].tokens;
    expect(tokens).toEqual(expect.arrayContaining(['shipped', 'platforms']));
    expect(tokens).not.toEqual(
      expect.arrayContaining(['2024', 'the', 'for', '3'])
    );
  });

  it('reads the whole topic, not just its name and keywords', () => {
    const matcher = buildTopicMatcher(
      buildTopic({
        name: 'Buyers',
        keywords: [],
        painPoints: ['Manual invoice reconciliation eats the finance team'],
        buyerPersona: 'finance director',
      })
    );

    expect(matcher.match('Finance Director, invoice reconciliation')).toEqual(
      expect.arrayContaining(['finance director'])
    );
  });

  it('does not report a matched phrase and its own words twice', () => {
    const matcher = buildTopicMatcher(
      buildTopic({ keywords: ['react modernization'] })
    );

    expect(matcher.match('React modernization consulting')).toEqual([
      'react modernization',
    ]);
  });

  it('holds a conservative topic to a higher bar than a balanced one', () => {
    const keywords = ['Reduce delivery risk across squads'];
    // Two of the term's words, so it clears a bar of 2 but not one of 3.
    const posting = 'Reduce delivery time for our team';

    expect(
      buildTopicMatcher(
        buildTopic({ keywords, searchStrategy: 'balanced' })
      ).match(posting)
    ).not.toEqual([]);
    expect(
      buildTopicMatcher(
        buildTopic({ keywords, searchStrategy: 'conservative' })
      ).match(posting)
    ).toEqual([]);
  });

  it('offers a short primary term for sources that run their own search', () => {
    const matcher = buildTopicMatcher(
      buildTopic({
        name: 'Fractional CTO and platform engineering leadership buyers - Global',
        keywords: [
          'Fractional CTO and platform engineering leadership',
          'kubernetes',
        ],
      })
    );

    // Not the sentence — a job board's search box cannot answer that.
    expect(matcher.primaryTerm).toBe('kubernetes');
  });

  it('reports a topic that has nothing searchable rather than matching nothing', () => {
    const matcher = buildTopicMatcher(buildTopic({ name: '', keywords: [] }));

    expect(matcher.isEmpty).toBe(true);
    expect(matcher.match('any posting at all')).toEqual([]);
    expect(describeEmptyTopic({ name: 'Untitled' })).toContain(
      'no searchable keywords'
    );
  });
});

describe('getTokenThreshold', () => {
  it('defaults to the balanced bar when a topic has no strategy', () => {
    expect(getTokenThreshold(null)).toBe(2);
    expect(getTokenThreshold('balanced')).toBe(2);
    expect(getTokenThreshold('conservative')).toBe(3);
  });
});
