import { PresenceGap } from '@optimistic-tanuki/models/leads-contracts';
import { findPresenceGaps } from '../discovery/presence-gap.util';
import { describeGapAsOpening, selectLeadingGap } from './gap-openers';
import {
  buildFactBase,
  extendFactCorpus,
  isStatementSupported,
} from '../applications/fact-guard';
import { UserOnboardingProfile } from '@optimistic-tanuki/models';

const business = 'Bright Smile Dental';

/** Every gap the local sources can actually produce. */
const allGaps = findPresenceGaps({
  website: null,
  phone: null,
  hasOpeningHours: false,
  rating: 3.1,
  reviewCount: 2,
});

const emptyProfile = {
  serviceOffer: '',
  yearsExperience: '',
  skills: [],
  certifications: [],
  idealCustomer: '',
  companySizeTarget: [],
  industries: [],
  problemsSolved: [],
  outcomes: [],
  budgetRange: [],
  geographicFocus: '',
  salesApproach: '',
  outreachMethod: [],
  communicationStyle: '',
  leadSignalTypes: [],
  excludedCompanies: [],
  excludedIndustries: [],
  currentStep: 4,
} as UserOnboardingProfile;

describe('gap openers', () => {
  it('opens on the heaviest gap, matching how the leads list ranks them', () => {
    const gaps: PresenceGap[] = [
      { code: 'no-phone', label: 'No phone number listed', weight: 10 },
      { code: 'no-website', label: 'No website listed', weight: 40 },
    ];

    expect(selectLeadingGap(gaps)?.code).toBe('no-website');
    expect(selectLeadingGap([])).toBeNull();
    expect(selectLeadingGap(null)).toBeNull();
  });

  it('writes a sentence rather than pinning a verdict to the business', () => {
    const gap = { code: 'no-website', label: 'No website listed', weight: 40 };

    expect(describeGapAsOpening(gap, business)).toBe(
      "Bright Smile Dental doesn't have a website listed."
    );
  });

  it('reads awkwardly rather than silently dropping an unknown gap', () => {
    const gap = { code: 'brand-new-signal', label: 'Something New', weight: 5 };

    expect(describeGapAsOpening(gap, business)).toContain('something new');
  });

  it('produces an opening the fact guard accepts, for every gap the sources emit', () => {
    // This is the real constraint on the phrasings. The guard checks the
    // opening like any other line, and only the gap's own label is provably
    // true of this business — so a nicer sentence built from unobserved words
    // would be removed before the user ever saw it.
    expect(allGaps.length).toBeGreaterThanOrEqual(5);

    for (const gap of allGaps) {
      const facts = extendFactCorpus(
        buildFactBase(emptyProfile),
        business,
        ...allGaps.map((entry) => entry.label)
      );
      const opening = describeGapAsOpening(gap, business);

      expect({
        code: gap.code,
        opening,
        supported: isStatementSupported(opening, facts),
      }).toEqual({ code: gap.code, opening, supported: true });
    }
  });

  it('says how many reviews there are without the chip formatting', () => {
    const [fewReviews] = findPresenceGaps({ reviewCount: 2 });

    expect(fewReviews.label).toBe('Only 2 reviews');
    expect(describeGapAsOpening(fewReviews, business)).toBe(
      'Bright Smile Dental has only 2 reviews.'
    );
  });

  it('does not pluralise a single review', () => {
    const [oneReview] = findPresenceGaps({ reviewCount: 1 });

    expect(oneReview.label).toBe('Only 1 review');
  });
});
