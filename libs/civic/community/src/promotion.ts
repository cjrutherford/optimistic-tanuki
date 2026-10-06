/**
 * Phase D: the narrow path from a contribution to a briefing.
 *
 * Almost nothing takes it. A briefing is a record of what can be shown, and
 * a resident's account, however plausible, is not that until something
 * outside it says so. Three things can:
 *
 *   1. material from an official the operator confirmed by callback — the
 *      official record, labeled as what it is;
 *   2. a contribution whose attached document has been authenticated, which
 *      nothing yet does, so this path is closed in the beta and says so;
 *   3. a report that crossed the corroboration gate *and* a later primary
 *      record bore out.
 *
 * Corroboration alone is not enough for the briefing. Independent residents
 * agreeing is enough to publish a report on the community surface as their
 * report; it is not enough for the town's record of what happened.
 *
 * Whatever takes the path is quoted and attributed, never paraphrased. That
 * is the §230 design consequence and it is not a style preference: the
 * platform hosts what contributors said, and the moment a briefing restates
 * a contributor's claim in its own sentences, the claim is the platform's.
 */

export type PromotionPath =
  | 'official-record'
  | 'authenticated-artifact'
  | 'confirmed';

export interface PromotionCandidate {
  state: string;
  /** null for a resident, 'official-record' for an official confirmed by callback. */
  officialStanding: string | null;
  /** Whether the corroboration gate is crossed for this report. */
  corroborated: boolean;
  /** Whether a later primary record bore it out. */
  confirmedByRecord: boolean;
  /** Whether it carries an attachment, and whether that attachment's provenance was established. */
  artifact: { authenticated: boolean } | null;
  /** Set when the contributor declared an interest in the matter. */
  disclosedInterest: string | null;
}

export interface PromotionVerdict {
  promoted: boolean;
  path: PromotionPath | null;
  /** Why, in the words the contributor and the reader are shown. */
  reasons: string[];
}

/**
 * Whether a contribution may be quoted in a briefing, and by which path.
 *
 * A disclosed interest does not disqualify official material — an official
 * speaking about their own office is the point — but it does disqualify a
 * resident's report, whatever else supports it.
 */
export function promotionOf(candidate: PromotionCandidate): PromotionVerdict {
  if (candidate.state !== 'accepted') {
    return {
      promoted: false,
      path: null,
      reasons: [
        'Only a contribution that cleared review can be quoted in a briefing.',
      ],
    };
  }
  if (candidate.officialStanding === 'official-record') {
    return {
      promoted: true,
      path: 'official-record',
      reasons: [
        'Material from an official whose account was confirmed by a call to the number the town publishes.',
      ],
    };
  }
  if (candidate.disclosedInterest) {
    return {
      promoted: false,
      path: null,
      reasons: [
        'Its contributor disclosed an interest in the matter, so it stays on the community page rather than the briefing.',
      ],
    };
  }
  if (candidate.artifact?.authenticated) {
    return {
      promoted: true,
      path: 'authenticated-artifact',
      reasons: ['It carries a document whose provenance was established.'],
    };
  }
  if (candidate.corroborated && candidate.confirmedByRecord) {
    return {
      promoted: true,
      path: 'confirmed',
      reasons: [
        'Independent residents corroborated it, and a later record of the town bore it out.',
      ],
    };
  }
  const missing: string[] = [];
  if (!candidate.corroborated) missing.push('independent corroboration');
  if (!candidate.confirmedByRecord)
    missing.push('a later record bearing it out');
  return {
    promoted: false,
    path: null,
    reasons: [
      `It is on the community page as what it is — a resident's report. A briefing quotes it once it has ${missing.join(
        ' and '
      )}.`,
    ],
  };
}
