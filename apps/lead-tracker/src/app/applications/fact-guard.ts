import {
  TailoredCoverLetter,
  TailoredResume,
  UserOnboardingProfile,
} from '@optimistic-tanuki/models';

/**
 * The anti-fabrication gate.
 *
 * A language model asked to "tailor a resume" will readily invent an employer,
 * a date, a certification, or a metric, and the result reads perfectly. The
 * prompt asks it not to; this enforces it. Prompting is a request, and a
 * request is not a guarantee — so nothing reaches the user that cannot be
 * traced back to material they supplied.
 *
 * The check is deliberately asymmetric. Losing a true statement costs the user
 * a line on a resume; keeping a false one costs them their credibility.
 */

/** Every fact the user actually gave us, in comparable form. */
export interface FactBase {
  /** Employers named in the parsed resume. */
  companies: Set<string>;
  /** Role titles named in the parsed resume. */
  titles: Set<string>;
  /** Skills from the interview and the resume combined. */
  skills: Set<string>;
  certifications: Set<string>;
  /** Free text of everything the user wrote or uploaded, for phrase checking. */
  corpus: string;
  /** Highlight lines exactly as they appeared in the resume. */
  highlights: Set<string>;
}

const norm = (value: string): string =>
  (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9+#. ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normSet = (values: (string | undefined)[]): Set<string> =>
  new Set(values.map((v) => norm(v || '')).filter(Boolean));

export const buildFactBase = (profile: UserOnboardingProfile): FactBase => {
  const roles = profile.resumeRoleSummaries || [];

  const corpusParts = [
    profile.madLibSummary,
    profile.resumeParseSummary,
    profile.serviceOffer,
    profile.idealCustomer,
    ...(profile.skills || []),
    ...(profile.resumeDerivedSkills || []),
    ...(profile.certifications || []),
    ...(profile.resumeDerivedCertifications || []),
    ...(profile.resumeDerivedExperience || []),
    ...(profile.outcomes || []),
    ...(profile.problemsSolved || []),
    ...(profile.industries || []),
    ...roles.flatMap((role) => [
      role.title,
      role.company,
      role.dateRange,
      ...role.highlights,
      ...role.outcomes,
      ...role.skills,
    ]),
  ];

  return {
    companies: normSet(roles.map((role) => role.company)),
    titles: normSet(roles.map((role) => role.title)),
    skills: normSet([
      ...(profile.skills || []),
      ...(profile.resumeDerivedSkills || []),
      ...roles.flatMap((role) => role.skills),
    ]),
    certifications: normSet([
      ...(profile.certifications || []),
      ...(profile.resumeDerivedCertifications || []),
    ]),
    highlights: normSet(roles.flatMap((role) => role.highlights)),
    corpus: norm(corpusParts.filter(Boolean).join(' ')),
  };
};

/** Numbers are the easiest thing to invent and the most damaging to get wrong. */
const claimedNumbers = (text: string): string[] =>
  (text.match(/\b\d+(?:\.\d+)?%?\b/g) || []).filter(
    // Ignore small ordinals that are almost always prose, not metrics.
    (value) => !/^\d$/.test(value)
  );

const numbersAreSupported = (text: string, facts: FactBase): boolean =>
  claimedNumbers(text).every((value) => facts.corpus.includes(norm(value)));

/**
 * A sentence is supported when its distinctive words all appear in the user's
 * own material. Common words are ignored so ordinary phrasing is not penalised.
 */
const STOPWORDS = new Set(
  (
    'a an the and or but for with to of in on at by from as is are was were be ' +
    'been being i my me we our they them this that these those it its will can ' +
    'have has had do does did not no so than then there here how what which who ' +
    'you your their his her about into over under more most very much many team ' +
    'teams work working worked role roles company companies experience years year'
  ).split(' ')
);

const distinctiveWords = (text: string): string[] =>
  norm(text)
    .split(' ')
    .filter((word) => word.length > 3 && !STOPWORDS.has(word));

export const isStatementSupported = (
  statement: string,
  facts: FactBase
): boolean => {
  if (!statement.trim()) {
    return false;
  }
  if (!numbersAreSupported(statement, facts)) {
    return false;
  }

  const words = distinctiveWords(statement);
  if (!words.length) {
    // Nothing specific claimed; harmless connective prose.
    return true;
  }

  const supported = words.filter((word) => facts.corpus.includes(word));
  // Most of the substance must come from the user's own material. A little
  // slack allows natural rephrasing without permitting invented content.
  return supported.length / words.length >= 0.8;
};

export interface GuardResult<T> {
  value: T;
  removedClaims: string[];
}

/**
 * Strips anything from a generated resume that the user's material does not
 * support: unknown employers, unknown titles, skills they never claimed,
 * certifications they do not hold, and highlights with invented specifics.
 */
export const guardResume = (
  resume: TailoredResume,
  facts: FactBase
): GuardResult<TailoredResume> => {
  const removedClaims: string[] = [];

  const roles = (resume.roles || [])
    .filter((role) => {
      const company = norm(role.company || '');
      const title = norm(role.title || '');
      // An employer that never appears in the resume is fabricated outright.
      if (company && !facts.companies.has(company)) {
        removedClaims.push(
          `Removed role at "${role.company}" — not present in your resume.`
        );
        return false;
      }
      if (title && !facts.titles.has(title) && !facts.corpus.includes(title)) {
        removedClaims.push(
          `Removed role titled "${role.title}" — not present in your resume.`
        );
        return false;
      }
      return true;
    })
    .map((role) => ({
      ...role,
      highlights: (role.highlights || []).filter((highlight) => {
        if (isStatementSupported(highlight, facts)) {
          return true;
        }
        removedClaims.push(
          `Removed unsupported highlight: "${highlight.slice(0, 120)}"`
        );
        return false;
      }),
    }));

  const skills = (resume.skills || []).filter((skill) => {
    if (facts.skills.has(norm(skill))) {
      return true;
    }
    removedClaims.push(`Removed skill "${skill}" — you never listed it.`);
    return false;
  });

  const certifications = (resume.certifications || []).filter((cert) => {
    const normalized = norm(cert);
    if (
      facts.certifications.has(normalized) ||
      [...facts.certifications].some((known) => known.includes(normalized))
    ) {
      return true;
    }
    // Inventing a credential is the single most damaging failure here.
    removedClaims.push(
      `Removed certification "${cert}" — you never listed it.`
    );
    return false;
  });

  const summary = isStatementSupported(resume.summary || '', facts)
    ? resume.summary
    : '';
  if (!summary && resume.summary) {
    removedClaims.push('Removed a summary that made unsupported claims.');
  }

  return {
    value: { summary, skills, roles, certifications },
    removedClaims,
  };
};

/**
 * The cover letter is prose, so it is checked paragraph by paragraph. The
 * greeting and sign-off are formulaic and exempt.
 */
export const guardCoverLetter = (
  letter: TailoredCoverLetter,
  facts: FactBase
): GuardResult<TailoredCoverLetter> => {
  const removedClaims: string[] = [];

  const check = (text: string, label: string): string => {
    if (!text || isStatementSupported(text, facts)) {
      return text;
    }
    removedClaims.push(
      `Removed ${label} from the cover letter — it made claims your profile does not support.`
    );
    return '';
  };

  return {
    value: {
      greeting: letter.greeting || '',
      opening: check(letter.opening || '', 'the opening'),
      body: (letter.body || []).filter((paragraph, index) => {
        if (isStatementSupported(paragraph, facts)) {
          return true;
        }
        removedClaims.push(
          `Removed body paragraph ${
            index + 1
          } from the cover letter — unsupported claims.`
        );
        return false;
      }),
      closing: check(letter.closing || '', 'the closing'),
      signOff: letter.signOff || '',
    },
    removedClaims,
  };
};

/** Posting requirements with nothing in the profile to back them. */
export const findGaps = (
  postingText: string,
  facts: FactBase,
  limit = 8
): string[] => {
  const requirementLines = (postingText || '')
    .split(/[\n•·]|(?<=\.)\s+/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 12 &&
        line.length < 200 &&
        /(experience|proficien|familiar|knowledge|skilled|required|must have|years)/i.test(
          line
        )
    );

  const gaps: string[] = [];
  for (const line of requirementLines) {
    const words = distinctiveWords(line);
    if (!words.length) continue;
    const covered = words.filter((word) => facts.corpus.includes(word));
    if (covered.length / words.length < 0.4) {
      gaps.push(line);
    }
    if (gaps.length >= limit) break;
  }

  return gaps;
};
