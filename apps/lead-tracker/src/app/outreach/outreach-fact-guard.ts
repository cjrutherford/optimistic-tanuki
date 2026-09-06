import { OutreachDraft } from '@optimistic-tanuki/models';
import {
  FactBase,
  GuardResult,
  isStatementSupported,
} from '../applications/fact-guard';

export { buildFactBase, extendFactCorpus } from '../applications/fact-guard';
export type { FactBase } from '../applications/fact-guard';

/**
 * The contentless vocabulary of a first-contact email.
 *
 * "I came across your practice and noticed…" asserts nothing beyond the
 * practice and the thing noticed, but the base guard is tuned for resume prose
 * and counts every one of those words as substance the user must have
 * evidenced. Left in, they push honest openings below the threshold and the
 * most useful sentence in the message is the first one deleted.
 *
 * Only words that cannot carry a claim belong here. Nothing evaluative —
 * "certified", "leading", "expert", "best", "number one" — may ever be added,
 * because those are precisely the claims the guard exists to catch.
 */
const OUTREACH_CONNECTIVES: ReadonlySet<string> = new Set([
  'across',
  'along',
  'also',
  'another',
  'anything',
  'came',
  'chat',
  'come',
  'conversation',
  'else',
  'find',
  'found',
  'give',
  'glad',
  'happy',
  'hello',
  'help',
  'hope',
  'introduce',
  'just',
  'keen',
  'know',
  'label',
  'like',
  'look',
  'looking',
  'made',
  'make',
  'maybe',
  'mind',
  'noticed',
  'noticing',
  'perhaps',
  'please',
  'quick',
  'reach',
  'reaching',
  'right',
  'said',
  'saw',
  'seen',
  'sense',
  'short',
  'since',
  'someone',
  'something',
  'sorry',
  'sure',
  'take',
  'thanks',
  'think',
  'thought',
  'time',
  'touch',
  'want',
  'wanted',
  'week',
  'well',
  'when',
  'while',
  'wondering',
  'worth',
]);

/**
 * Strips anything from a generated first-contact message that neither the
 * user's material nor the lead's own record supports.
 *
 * Mirrors the cover-letter guard, with one deliberate difference in what
 * survives a failure. A cover letter with its opening removed is still a
 * document the user can repair; a cold email whose greeting or sign-off went
 * missing is not sendable at all. So the parts that carry no claims — the
 * greeting, the sign-off — are passed through untouched, and only the parts
 * that assert something are checked.
 */
export const guardOutreachDraft = (
  draft: OutreachDraft,
  facts: FactBase
): GuardResult<OutreachDraft> => {
  const removedClaims: string[] = [];

  const check = (text: string, label: string): string => {
    if (!text || isStatementSupported(text, facts, OUTREACH_CONNECTIVES)) {
      return text;
    }
    removedClaims.push(
      `Removed ${label} — it claimed something neither your profile nor this lead's record supports.`
    );
    return '';
  };

  return {
    value: {
      // A subject line is a fragment, not a claim, but it is the first thing
      // read and the easiest place to overstate, so it is checked too.
      subject: check(draft.subject || '', 'the subject line'),
      greeting: draft.greeting || '',
      opening: check(draft.opening || '', 'the opening line'),
      body: (draft.body || []).filter((paragraph, index) => {
        if (isStatementSupported(paragraph, facts, OUTREACH_CONNECTIVES)) {
          return true;
        }
        removedClaims.push(
          `Removed body paragraph ${index + 1} — unsupported claims.`
        );
        return false;
      }),
      closing: check(draft.closing || '', 'the closing line'),
      signOff: draft.signOff || '',
    },
    removedClaims,
  };
};
