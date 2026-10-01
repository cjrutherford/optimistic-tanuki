import {
  evidenceSignature,
  extractIdentifiers,
  scoreEvidence,
  STORY_MATCH_THRESHOLD,
  storyTitle,
  termWeights,
} from '../src/story-engine.js';

const places = new Set(['riverton', 'cook', 'georgia']);
// Numbered lines are agenda lines; everything else is a headline.
const sig = (text: string) =>
  evidenceSignature(
    {
      text,
      explicitIds: [],
      agendaItemId: /^\d{1,2}\.\s/u.test(text) ? 1 : null,
    },
    places
  );

/** An article as the corpus holds it: a headline, and the text the matcher compares. */
function article(headline: string, body: string) {
  return evidenceSignature(
    {
      text: headline,
      explicitIds: [],
      agendaItemId: null,
      content: `${headline}\n${body}`,
    },
    places
  );
}

function articlesMatch(
  a: ReturnType<typeof article>,
  b: ReturnType<typeof article>
): boolean {
  const all = [a, b, ...CORPUS.map(sig)];
  return scoreEvidence(a, b, termWeights(all)).score >= STORY_MATCH_THRESHOLD;
}

function matches(
  a: string,
  b: string,
  corpus: readonly string[] = []
): boolean {
  const signatures = [a, b, ...corpus].map(sig);
  return (
    scoreEvidence(signatures[0]!, signatures[1]!, termWeights(signatures))
      .score >= STORY_MATCH_THRESHOLD
  );
}

const CORPUS = [
  '1. Fire Department Recognition for School Fire Response',
  '2. Recovery Proclamation',
  '3. Sanitation Tipping Fee Increase',
  '6. Resolution Authorizing the Surplus and Sale of Property at 418 Ridge Avenue (Economic Development Director)',
  'Stay Ahead of the Flu: Get Vaccinated Today',
  'Brooks Co. Health Dept to Host Vaccine Walk-In Day',
  '5. Resolution Amending the FY2027 Budget for Radio Upgrade Purchase (City Manager)',
];

describe('story engine matching', () => {
  it('joins the same topic across agendas and articles', () => {
    expect(
      matches(
        '4. Discussion - FY 27 Millage Rate',
        '5. Millage Rate Tentative Proposal',
        CORPUS
      )
    ).toBeTruthy();
    expect(
      matches(
        '4. Resolution Setting the Millage Rate for 2026 (City Manager)',
        '3. Resolution Approving the Final Tax Digest & Setting the Millage Rate For 2026',
        CORPUS
      )
    ).toBeTruthy();
    expect(
      matches(
        'DPH Confirms Additional Measles Cases in Georgia',
        'DPH Confirms Four Additional Measles Cases in Georgia',
        CORPUS
      )
    ).toBeTruthy();
    expect(
      matches(
        '3. Pickle Ball/Tennis Court Land and Water Conservation Grant Resolution 26-03',
        '4. Agreement – SGRC Technical Assistance Land and Water Conservation Fund',
        CORPUS
      )
    ).toBeTruthy();
  });

  it('keeps different topics apart, including ones that share a place name or one generic word', () => {
    expect(
      !matches(
        'Cook County budget approved',
        'Riverton road grant for Cook County',
        CORPUS
      )
    ).toBeTruthy();
    expect(
      !matches(
        'Stay Ahead of the Flu: Get Vaccinated Today',
        'Brooks Co. Health Dept to Host Vaccine Walk-In Day',
        CORPUS
      )
    ).toBeTruthy();
    expect(
      !matches(
        '5. Resolution Amending the FY2027 Budget for Radio Upgrade Purchase',
        '4. Resolution Setting the Millage Rate for 2026',
        CORPUS
      )
    ).toBeTruthy();
    expect(
      !matches(
        '3. Sanitation Tipping Fee Increase',
        '2. Recovery Proclamation',
        CORPUS
      )
    ).toBeTruthy();
  });

  it('does not join recurring features, columnist prefixes, or formulaic headline phrases', () => {
    expect(
      !matches(
        'Riverton Education Briefs Aug. 6',
        'Education Briefs Aug. 13',
        CORPUS
      )
    ).toBeTruthy();
    expect(
      !matches(
        'ADANN ALEXXANDAR MOVIE REVIEWS: “The Odyssey”',
        'ADANN ALEXXANDAR MOVIE REVIEWS: “The Drama”',
        CORPUS
      )
    ).toBeTruthy();
    // Two editions of one column, written up the same way and signed slightly differently.
    const odyssey = article(
      'ADANN ALEXXANDAR MOVIE REVIEWS: “The Odyssey”',
      'This reviewer gives the film three stars. The director stages the voyage handsomely, the cast is game, and the screenplay finds its footing in the second hour of a long picture.'
    );
    const disclosure = article(
      'ADANN-KENNN ALEXXANDAR MOVIE REVIEWS: “Disclosure Day”',
      'This reviewer gives the film two stars. The director stages the thriller handsomely enough, but the cast is stranded by a screenplay that loses its footing well before the second hour.'
    );
    expect(!articlesMatch(odyssey, disclosure)).toBeTruthy();
    const hospital = article(
      'Hospital honors nurses with regional leadership class award',
      "Tift Regional Medical Center recognized six nurses Tuesday for completing the hospital's nursing leadership program, citing their work in intensive care and emergency staffing."
    );
    const college = article(
      'College welcomes regional leadership class members',
      "Twenty students from four counties joined the college's civic leadership class, which meets monthly with local officials and business owners through the spring semester."
    );
    expect(!articlesMatch(hospital, college)).toBeTruthy();
  });

  it('joins a follow-up article whose headline is worded differently, by what the texts say', () => {
    const first = article(
      'American Red Cross calls for increased donations amid blood shortage',
      'The American Red Cross is urging donors to give blood and platelets as the national blood supply falls to critically low levels, with type O donors especially needed at drives across the region.'
    );
    const later = article(
      'Red Cross says blood crisis persists',
      'Two weeks after an emergency appeal, the American Red Cross says the blood supply remains critically low and asks donors, especially type O, to book appointments at drives this month.'
    );
    expect(articlesMatch(first, later)).toBeTruthy();
  });

  it('keeps apart articles that share a formula but not a subject', () => {
    const tift = article(
      'Tift County Health Department Hosting Back-to-School Health Day on July 22',
      'The health department will offer immunizations, vision and hearing screenings required for school enrollment at its clinic on Thursday, July 22.'
    );
    const berrien = article(
      'Berrien Hosting Back to School Bash Aug 3-4',
      'Berrien Primary School invites families to a back to school bash with free supplies, bounce houses and a hot dog lunch in the gym on August 3 and 4.'
    );
    expect(!articlesMatch(tift, berrien)).toBeTruthy();
  });

  it('joins headlines that share a coined name, but not a common acronym', () => {
    expect(
      matches(
        'ThunderCon returns to ABAC Sept. 19 with voice actors',
        'ABAC announces cancellation of fourth year of ThunderCon',
        CORPUS
      )
    ).toBeTruthy();
    expect(
      matches(
        'Sixth annual RecoveryFest slated for early September',
        'Community celebrates road to recovery at sixth annual RecoveryFest',
        CORPUS
      )
    ).toBeTruthy();
    expect(
      !matches(
        'TRMC welcomes three hospital-based providers',
        'TRMC honors award recipients',
        CORPUS
      )
    ).toBeTruthy();
  });

  it('matches on shared case and resolution numbers regardless of wording', () => {
    expect(
      extractIdentifiers(
        '1. Zoning Application PP26-0016 – Submitted by Strong Rock Development Group'
      )
    ).toStrictEqual(['pp260016']);
    expect(
      extractIdentifiers('Pickle Ball Grant Resolution 26-03 and RFP# 2026-03')
    ).toStrictEqual(['rfp202603', '2603', '202603']);
    const a = sig('Planning commission hears PP26-0016');
    const b = sig('Council votes on zoning case PP26-0016');
    expect(scoreEvidence(a, b, termWeights([a, b]))).toStrictEqual({
      score: 1,
      reason: 'shared identifier pp260016',
    });
  });

  it('derives readable story titles from agenda lines', () => {
    expect(storyTitle('4. Discussion - FY 27 Millage Rate')).toBe(
      'FY 27 Millage Rate'
    );
    expect(
      storyTitle(
        '4. Resolution Setting the Millage Rate for 2026 (Bobby Bennett, City Manager)'
      )
    ).toBe('Resolution Setting the Millage Rate for 2026');
    expect(storyTitle('County approves bridge repair')).toBe(
      'County approves bridge repair'
    );
    expect(
      storyTitle(
        '1. Zoning Application PP26-0016 – Submitted by Strong Rock Development Group, Requesting to Amend the Existing Planned Development Overlay (PDO) on…'
      )
    ).toBe('Zoning Application PP26-0016');
    expect(
      storyTitle(
        '4. Agreement – SGRC Technical Assistance Land and Water Conservation Fund'
      )
    ).toBe(
      'Agreement – SGRC Technical Assistance Land and Water Conservation Fund'
    );
    expect(
      storyTitle(
        'Resolution Approving the Preliminary Plan for Amendment to the Planned Development Overlay on Mill Road and the Frontage Parcels'
      )
    ).toBe(
      'Resolution Approving the Preliminary Plan for Amendment to the Planned Development…'
    );
  });
});
