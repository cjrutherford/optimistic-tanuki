import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';

/**
 * Deciding whether a posting belongs to a topic.
 *
 * Every provider used to gate on `haystack.includes(keyword)` over the topic's
 * raw keywords. That only works when a keyword is a single word. The onboarding
 * profile does not produce single words: `serviceOffer` is a sentence, and
 * `outcomes` and `problemsSolved` are achievement lines like "Cut cloud spend
 * by 40%". Generated topic names inherit the same prose ("<serviceOffer> buyers
 * - Global"). A job board will never reproduce any of those verbatim, so the
 * whole-phrase test rejected every result and the topic reported zero leads —
 * including for postings that were an obvious match on skills and industry.
 *
 * A topic term therefore becomes a *signal* rather than a literal:
 *
 * - a term short enough to appear verbatim ("react", "fractional cto") stays a
 *   **phrase**, and still qualifies a result on its own;
 * - a longer term becomes a **token group** of its meaningful words. Any one of
 *   those words is too generic to trust — "cloud" alone should not pull in
 *   every posting that mentions the cloud — so a group qualifies a result only
 *   when several of its own words turn up together. Requiring the corroborating
 *   words to come from the *same* term is what keeps this honest: two words
 *   from one idea ("platform" and "engineering") mean the posting is about that
 *   idea, whereas one word each from two unrelated terms means very little.
 *
 * How many words is "enough" is the topic's `searchStrategy`, which until now
 * was collected during onboarding and never consulted when filtering.
 */

/** A phrase that qualifies a result by itself. */
export interface TopicPhraseSignal {
  term: string;
}

/** The meaningful words of one long topic term, and how many must appear. */
export interface TopicTokenGroup {
  /** The topic term these words came from, for diagnostics. */
  source: string;
  tokens: string[];
  required: number;
}

export interface TopicMatcher {
  readonly phrases: TopicPhraseSignal[];
  readonly tokenGroups: TopicTokenGroup[];
  /** True when the topic carries nothing searchable at all. */
  readonly isEmpty: boolean;
  /**
   * The single best term to hand a source that does its own server-side
   * search. Prefers a short phrase, because that is what a job board's search
   * box can actually answer; a sentence returns nothing.
   */
  readonly primaryTerm: string;
  /**
   * The terms `text` matched — phrases first — or an empty array when the text
   * does not clear the topic's bar.
   */
  match(text: string): string[];
}

/**
 * Words that carry no discriminating power on their own. Kept deliberately
 * small: it only has to cover what leaks out of profile prose, and every entry
 * added is a word a user can no longer search for.
 */
const STOP_WORDS = new Set([
  'and',
  'any',
  'are',
  'but',
  'can',
  'for',
  'from',
  'get',
  'had',
  'has',
  'have',
  'into',
  'its',
  'more',
  'most',
  'much',
  'new',
  'not',
  'off',
  'one',
  'our',
  'out',
  'over',
  'own',
  'per',
  'that',
  'the',
  'their',
  'them',
  'they',
  'this',
  'through',
  'too',
  'use',
  'using',
  'very',
  'was',
  'were',
  'what',
  'when',
  'who',
  'why',
  'will',
  'with',
  'within',
  'without',
  'you',
  'your',
]);

/** Longest term still worth testing as a literal phrase. */
const MAX_PHRASE_WORDS = 3;
const MIN_TOKEN_LENGTH = 3;
/** A group needs at least two words, or it is just a phrase by another name. */
const MIN_GROUP_TOKENS = 2;
/** Guards against a pathological profile producing thousands of signals. */
const MAX_PHRASES = 24;
const MAX_TOKEN_GROUPS = 16;

const TOKEN_SPLIT = /[^a-z0-9+#./-]+/;
/** Trailing punctuation belongs to the sentence, not to the word. */
const TOKEN_TRIM = /^[-./]+|[-./]+$/g;

const normalize = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, ' ').trim();

/** Numbers and bare measurements ("40%", "2024", "3x") discriminate nothing. */
const isNumericNoise = (token: string): boolean => /^[\d.,]+[%x]?$/.test(token);

const toTokens = (term: string): string[] =>
  Array.from(
    new Set(
      term
        .split(TOKEN_SPLIT)
        .map((token) => token.replace(TOKEN_TRIM, ''))
        .filter(
          (token) =>
            token.length >= MIN_TOKEN_LENGTH &&
            !STOP_WORDS.has(token) &&
            !isNumericNoise(token)
        )
    )
  );

/**
 * Word-boundary containment. Plain `includes` matched "aws" inside "flaws" and
 * "ai" inside "detail" — tolerable when a whole sentence had to match, but not
 * now that individual words can qualify a result.
 */
const containsTerm = (haystack: string, term: string): boolean => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, 'i').test(haystack);
};

const TOKEN_THRESHOLD_BY_STRATEGY: Record<string, number> = {
  aggressive: 2,
  balanced: 2,
  conservative: 3,
};

export const getTokenThreshold = (
  searchStrategy: LeadTopic['searchStrategy']
): number => TOKEN_THRESHOLD_BY_STRATEGY[searchStrategy || 'balanced'] ?? 2;

/**
 * Everything on a topic that says what the user is looking for.
 *
 * This is the same set `buildProviderQueries` already searches on. The two
 * disagreed before — queries were built from the wide set while results were
 * filtered against name and keywords alone — so a provider could ask a source
 * the right question and then throw the answer away.
 */
const collectTopicTerms = (topic: Partial<LeadTopic>): string[] =>
  Array.from(
    new Set(
      [
        topic.name || '',
        ...(topic.keywords || []),
        ...(topic.painPoints || []),
        ...(topic.targetCompanies || []),
        topic.buyerPersona || '',
        topic.valueProposition || '',
      ]
        .map(normalize)
        .filter(Boolean)
    )
  );

export const buildTopicMatcher = (topic: Partial<LeadTopic>): TopicMatcher => {
  const threshold = getTokenThreshold(topic.searchStrategy);
  const phrases: TopicPhraseSignal[] = [];
  const tokenGroups: TopicTokenGroup[] = [];
  const seenPhrases = new Set<string>();

  for (const term of collectTopicTerms(topic)) {
    // Short enough to survive verbatim in a posting, so it keeps its meaning
    // whole. A longer term only survives as its parts.
    if (
      term.split(' ').length <= MAX_PHRASE_WORDS &&
      term.length >= 2 &&
      !seenPhrases.has(term) &&
      phrases.length < MAX_PHRASES
    ) {
      seenPhrases.add(term);
      phrases.push({ term });
    }

    const tokens = toTokens(term);
    if (
      tokens.length < MIN_GROUP_TOKENS ||
      tokenGroups.length >= MAX_TOKEN_GROUPS
    ) {
      continue;
    }
    tokenGroups.push({
      source: term,
      tokens,
      // Never ask for more words than the term actually has.
      required: Math.min(threshold, tokens.length),
    });
  }

  return {
    phrases,
    tokenGroups,
    isEmpty: phrases.length === 0 && tokenGroups.length === 0,
    primaryTerm: phrases[0]?.term || tokenGroups[0]?.tokens[0] || '',
    match(text: string): string[] {
      if (!text || (!phrases.length && !tokenGroups.length)) {
        return [];
      }

      const haystack = normalize(text);
      const matchedPhrases = phrases
        .filter((phrase) => containsTerm(haystack, phrase.term))
        .map((phrase) => phrase.term);

      const matchedPhraseSet = new Set(matchedPhrases);
      const corroboratedTokens = new Set<string>();
      for (const group of tokenGroups) {
        // The phrase this group came from already matched in full, which is
        // the stronger statement. Reporting its individual words on top would
        // pad the lead's keyword list with the same signal three times over.
        if (matchedPhraseSet.has(group.source)) {
          continue;
        }
        const hits = group.tokens.filter((token) =>
          containsTerm(haystack, token)
        );
        if (hits.length >= group.required) {
          hits.forEach((token) => {
            if (!matchedPhraseSet.has(token)) {
              corroboratedTokens.add(token);
            }
          });
        }
      }

      if (!matchedPhrases.length && !corroboratedTokens.size) {
        return [];
      }

      return [...matchedPhrases, ...corroboratedTokens];
    },
  };
};

/**
 * Why a topic can never match anything, phrased for the discovery report.
 * Returning nothing because the topic has no searchable terms is a
 * configuration problem, and it used to be indistinguishable from a source
 * genuinely having nothing on offer that day.
 */
export const describeEmptyTopic = (topic: Partial<LeadTopic>): string =>
  `Topic "${
    topic.name || 'untitled'
  }" has no searchable keywords, so nothing can match it. Add a few short keywords to the topic.`;
