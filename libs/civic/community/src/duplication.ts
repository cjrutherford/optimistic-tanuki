import { words } from './words.js';

/**
 * Near-duplicate detection against the crawled corpus.
 *
 * Contributors post their own words plus a link. A quotation is allowed, up
 * to 75 words or ten percent of its source, whichever is smaller; anything
 * more — up to and including a whole article pasted in — is refused at
 * submission, with the source named, because copyright is outside §230's
 * protection and the platform cannot wait for a takedown notice to find out.
 *
 * Copying is found by shared runs of words. Every run of at least
 * `MIN_RUN` words that appears in both texts counts, and a contribution's
 * copied words are totalled per source, so a piece copied in several short
 * extracts is caught as surely as one long paste. Runs shorter than
 * `MIN_RUN` are ordinary shared phrasing ("the city council voted to") and
 * never count.
 */

export const MIN_RUN = 8;
export const QUOTE_WORD_CAP = 75;
export const QUOTE_SHARE_CAP = 0.1;

export interface CorpusDocument {
  id: string;
  /** Who published it, as a reader would name them. */
  publisher: string;
  title: string;
  body: string;
  url: string | null;
}

export interface DuplicationFinding {
  /** More than half the contribution is copied: it is a repost, not a report. */
  kind: 'repost' | 'over-quote';
  document: Pick<CorpusDocument, 'id' | 'publisher' | 'title' | 'url'>;
  copiedWords: number;
  /** The most that may be quoted from this document. */
  allowedWords: number;
  contributionWords: number;
}

interface Posting {
  document: number;
  position: number;
}

/** An index of every `MIN_RUN`-word run in the corpus, built once and reused for every submission. */
export class CorpusIndex {
  private readonly documents: { meta: CorpusDocument; words: string[] }[] = [];
  private readonly runs = new Map<string, Posting[]>();

  constructor(documents: Iterable<CorpusDocument>) {
    for (const meta of documents) {
      const text = words(meta.body);
      if (text.length < MIN_RUN) continue;
      const index = this.documents.push({ meta, words: text }) - 1;
      for (let position = 0; position + MIN_RUN <= text.length; position += 1) {
        const key = text.slice(position, position + MIN_RUN).join(' ');
        const postings = this.runs.get(key);
        if (postings) postings.push({ document: index, position });
        else this.runs.set(key, [{ document: index, position }]);
      }
    }
  }

  get size(): number {
    return this.documents.length;
  }

  /**
   * The worst breach of the quotation rule, or null when there is none.
   * "Worst" is the document with the most words copied from it.
   */
  check(text: string): DuplicationFinding | null {
    const contribution = words(text);
    if (contribution.length < MIN_RUN) return null;
    // Which contribution words each document accounts for; a word covered by
    // two overlapping runs from one document counts once.
    const covered = new Map<number, Set<number>>();
    for (
      let position = 0;
      position + MIN_RUN <= contribution.length;
      position += 1
    ) {
      const postings = this.runs.get(
        contribution.slice(position, position + MIN_RUN).join(' ')
      );
      if (!postings) continue;
      for (const posting of postings) {
        let set = covered.get(posting.document);
        if (!set) covered.set(posting.document, (set = new Set()));
        for (let offset = 0; offset < MIN_RUN; offset += 1)
          set.add(position + offset);
      }
    }
    let worst: DuplicationFinding | null = null;
    for (const [documentIndex, set] of covered) {
      const document = this.documents[documentIndex]!;
      const allowed = allowedQuotation(document.words.length);
      const copied = set.size;
      if (copied <= allowed) continue;
      if (worst && worst.copiedWords >= copied) continue;
      const { id, publisher, title, url } = document.meta;
      worst = {
        kind: copied * 2 > contribution.length ? 'repost' : 'over-quote',
        document: { id, publisher, title, url },
        copiedWords: copied,
        allowedWords: allowed,
        contributionWords: contribution.length,
      };
    }
    return worst;
  }
}

/** 75 words or ten percent of the source, whichever is smaller. */
export function allowedQuotation(sourceWords: number): number {
  return Math.min(QUOTE_WORD_CAP, Math.floor(sourceWords * QUOTE_SHARE_CAP));
}

/** The reason shown to the contributor, naming what was copied and how to fix it. */
export function describeFinding(finding: DuplicationFinding): string {
  const source = `“${finding.document.title}” (${finding.document.publisher})`;
  if (finding.kind === 'repost') {
    return `Most of this text matches ${source}. Link to the article and say in your own words what you saw or know; you may quote up to ${finding.allowedWords} words of it.`;
  }
  return `This quotes ${finding.copiedWords} words from ${source}; the most allowed from that piece is ${finding.allowedWords}. Shorten the quotation or put it in your own words.`;
}
