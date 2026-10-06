import {
  isBelowTheFold,
  isNotCivicRecord,
  rankByNewsworthiness,
  scoreNewsworthiness,
} from '../src/newsworthiness.js';

/** Real Tifton material from the 2026-09-19 edition, in the order an editor would run it. */
const TIFTON = [
  {
    title: 'Tift County Schools terminates contract with school superintendent',
    kind: 'news',
  },
  {
    title: 'City, county, school board set millage rates for 2027 fiscal year',
    kind: 'news',
  },
  {
    title:
      'Resolution Approving the Final Tax Digest & Setting the Millage Rate For 2026',
    kind: 'meeting',
  },
  {
    title:
      'Ordinance Proposing the Creation of a Downtown Entertainment District',
    kind: 'meeting',
  },
  {
    title:
      'Zoning Application PP26-0016 – Submitted by Strong Rock Development Group, Requesting to Amend',
    kind: 'meeting',
  },
  {
    title:
      'Tift County Schools appoints Jennifer Howell as interim superintendent',
    kind: 'news',
  },
  {
    title:
      'City of Tifton awarded GMA Life Health Insurance funds Well-Being Grant',
    body: 'The city received a $9,000 grant.',
    kind: 'news',
  },
  {
    title: 'Proclamation for Adult Education and Family Literacy Week',
    kind: 'meeting',
  },
  {
    title: 'Exchange Club organizes Field of Flags for Patriot Day',
    kind: 'news',
  },
  {
    title: 'Tift County softball drops region game',
    body: 'Tift County lost 9-0 to Thomas County Central.',
    kind: 'news',
  },
  {
    title: 'DEAN POLING BOOK REVIEWS: A Trade of Blood: Robert Jackson Bennett',
    kind: 'news',
  },
];

describe('newsworthiness', () => {
  it("ranks the week's civic decisions above ceremony, sports and reviews", () => {
    const ranked = rankByNewsworthiness(TIFTON, (item) => item);
    const order = ranked.map((entry) => entry.item.title);
    const at = (fragment: string) =>
      order.findIndex((title) => title.includes(fragment));
    for (const lead of [
      'terminates contract',
      'set millage rates',
      'Entertainment District',
      'Zoning Application',
    ]) {
      for (const buried of [
        'softball',
        'BOOK REVIEWS',
        'Field of Flags',
        'Proclamation',
      ]) {
        expect(at(lead) < at(buried)).toBeTruthy();
      }
    }
    expect(
      at('$9,000') < 0 || at('Well-Being Grant') > at('set millage rates')
    ).toBeTruthy();
  });

  it('keeps sports, reviews and ceremony below the fold', () => {
    for (const title of [
      'Tift County softball drops region game',
      'DEAN POLING BOOK REVIEWS: A Trade of Blood',
      'Proclamation for Adult Education and Family Literacy Week',
    ]) {
      expect(isBelowTheFold(scoreNewsworthiness({ title }))).toBe(true);
    }
    for (const title of [
      'Ordinance Proposing the Creation of a Downtown Entertainment District',
      'Tift County Schools terminates contract with school superintendent',
    ]) {
      expect(isBelowTheFold(scoreNewsworthiness({ title }))).toBe(false);
    }
  });

  it('recognizes reviews and columns however the headline is spelled', () => {
    for (const title of [
      'DEAN POLING BOOK REVIEWS: A Trade of Blood: Robert Jackson Bennett',
      'Adann Alexxandar Movie Reviews: \u201CSpider-Man: A Brand New Day\u201D',
      'BECKY TAYLOR: McWilliams legendary on and off the football field',
      'TERRY TURNER: Democrats have much to reform',
    ]) {
      expect(
        isNotCivicRecord(scoreNewsworthiness({ title, kind: 'news' }))
      ).toBe(true);
    }
    // A headline that merely contains a person's name is not a column.
    expect(
      isNotCivicRecord(
        scoreNewsworthiness({
          title: 'City council approves rezoning for daycare',
          kind: 'news',
        })
      )
    ).toBe(false);
  });

  it('weighs money by how much moves', () => {
    const small = scoreNewsworthiness({
      title: 'Council accepts grant',
      body: 'The award is $9,000.',
    });
    const large = scoreNewsworthiness({
      title: 'Council accepts grant',
      body: 'The award is $2.4 million.',
    });
    expect(large.score > small.score).toBeTruthy();
    expect(
      large.signals.find((signal) => signal.name === 'public money')?.match
    ).toBe('$2.4 million');
  });

  it('explains why an item leads', () => {
    const rank = scoreNewsworthiness({
      title: 'Resolution Setting the Millage Rate for 2026',
      kind: 'meeting',
    });
    expect(rank.reason).toMatch(/tax rate/);
    expect(
      rank.signals.some(
        (signal) =>
          signal.name === 'tax rate' && signal.match.toLowerCase() === 'millage'
      )
    ).toBeTruthy();
  });

  it('does not let a passing mention in a long body promote an item', () => {
    const mention = scoreNewsworthiness({
      title: 'Tift softball blanks Brookwood',
      body: 'The game was played after the board of education meeting.',
    });
    const real = scoreNewsworthiness({
      title: 'Board of education adopts budget',
      body: 'The board voted 5-0.',
    });
    expect(real.score > mention.score).toBeTruthy();
    expect(isBelowTheFold(mention)).toBe(true);
  });
});
