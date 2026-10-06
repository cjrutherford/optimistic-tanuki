/**
 * Identity of the persisted briefing synthesis contract.
 *
 * This is deliberately independent from application/code versions: changing
 * unrelated implementation details must not invalidate an otherwise complete
 * publication receipt. Bump it only when the evidence/grounding contract
 * changes in a way that requires regenerating stored briefings.
 */
// v2: the edition is an article — headline and paragraphs — with news and dated background evidence.
// v3: agendas are written as scheduled business, rosters are dropped, and the headline falls back to the lead claim.
// v4: the edition's date is given, so an agenda already past is written as past.
// v5: past agendas are labelled as past in the evidence, and a claim that repeats an earlier one is dropped.
// v6: an outline agenda with no business is not news evidence.
// v7: "was scheduled to consider" is accepted as the past framing of a past agenda.
// v8: repeats are judged per agenda row, not per agenda document.
// v9: an agenda row's context is its agenda's header only, and a capitalized name must appear in the cited evidence.
// v10: all relevant facts — a planner checklist, numbered facts for the writer, planned facts filled in, higher caps; three grounding false positives fixed.
// v11: a planned fact already stated in the article is not filled in again.
// v12: planned matters are ordered by consequence, and the article gets one paragraph per matter in that order.
// v13: meetings dated after the edition appear under Coming up.
// v14: planned facts name their body and never say a body met; a planned fact grounds on its matter's citations; twelve claims a paragraph.
// v15: courts and crime rank as consequential; the writer lists one meeting's items in one sentence.
// v16: the plan is capped, discouraged from repeating, and retried once warmer.
// v17: the planner lists a meeting's brief items as one fact, so the article gives a meeting one sentence.
// v18: a cut-off plan is salvaged and de-duplicated; the repeat penalty looks further back; standard notices are not news.
// v19: no repeat penalty on the plan (salvage handles loops); $16M reads as $16 million; a sentence-long body is not glued into a headline.
// v20: agenda headers drop their standard notices; proof of publication and public forum rows are procedural.
// v21: "the proposed rate" names an item; one cited row no longer covers every fact on it; notice rows are procedural.
export const SYNTHESIS_CONTRACT_VERSION = 'claim-grounded-article-v21' as const;
export type SynthesisContractVersion = typeof SYNTHESIS_CONTRACT_VERSION;

/** Identity of the story-specific grounding and rendering contract. This is
 * separate from the briefing contract because story timelines and markdown
 * can change without changing the model's evidence prompt. Bump it when a
 * story semantic/grounding/rendering change requires fresh revisions and
 * immutable artifacts. */
export const STORY_SYNTHESIS_CONTRACT_VERSION =
  'story-grounded-render-v3' as const;
export type StorySynthesisContractVersion =
  typeof STORY_SYNTHESIS_CONTRACT_VERSION;

/** Qualify a model request identity with the story contract. The model prompt
 * may remain otherwise identical when only deterministic rendering changes;
 * this keeps generations and immutable revisions from colliding across such
 * semantic contract changes. */
export function storyInputSha256(modelInputSha256: string): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        storySynthesisContractVersion: STORY_SYNTHESIS_CONTRACT_VERSION,
        modelInputSha256,
      }),
      'utf8'
    )
    .digest('hex');
}

/** Quiet editions are deterministic status publications, not LLM synthesis. */
export const QUIET_DAY_SYNTHESIS_CONTRACT_VERSION =
  'quiet-day-article-v2' as const;
/** Deterministic first-run empty publication has no comparison baseline. */
export const INITIAL_EMPTY_SYNTHESIS_CONTRACT_VERSION =
  'initial-empty-v1' as const;
import { createHash } from 'node:crypto';
