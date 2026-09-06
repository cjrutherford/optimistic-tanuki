/**
 * A first-contact message aimed at one lead.
 *
 * Shaped by the same rule as the application documents: generation may select
 * and re-emphasise facts already on record, and may never introduce new ones.
 * The stakes are higher here than on a cover letter. A cover letter overclaims
 * to someone who asked to hear from you; a cold pitch overclaims to a stranger,
 * about work they would be paying for.
 *
 * Two bodies of fact back a draft, and they are different in kind:
 *
 * - what the **user** can claim about themselves, from their onboarding
 *   profile and parsed resume;
 * - what the **source** observed about the **lead** — the posting text, the
 *   business name, the presence gaps a local source recorded.
 *
 * A sentence traceable to neither is invention, and is removed before the user
 * ever sees it.
 */

export interface OutreachDraft {
  /** Kept short; it is a subject line, not a summary. */
  subject: string;
  greeting: string;
  /** Why this business, now. The one line most likely to be read. */
  opening: string;
  /** One to three short paragraphs. Cold mail earns its length. */
  body: string[];
  closing: string;
  signOff: string;
}

/**
 * What the anti-fabrication gate did, surfaced rather than silently applied so
 * the user can see what the generator tried to say in their name.
 */
export interface OutreachEvidenceReport {
  /**
   * Statements that traced back to neither the user's material nor the lead's,
   * and were therefore removed.
   */
  removedClaims: string[];
  /**
   * What the draft was allowed to build on: the observed facts about this lead.
   * Shown so the user can judge whether the opening is actually true.
   */
  observedSignals: string[];
  /** True when nothing had to be removed. */
  clean: boolean;
}

export interface GeneratedOutreachDraft {
  leadId: string;
  draft: OutreachDraft;
  evidence: OutreachEvidenceReport;
  /** Increments each time a draft is regenerated for this lead. */
  version: number;
  /** False when no model was reachable and the deterministic path produced this. */
  modelGenerated: boolean;
  generatedAt: string;
}
