import {
  ParsedTranscript,
  TranscriptAppearance,
  TranscriptExhibit,
  TranscriptTurn,
  TranscriptTurnRole,
} from '@optimistic-tanuki/models';

const SPEAKER_HEADING = /^([A-Z][A-Z0-9 .'&()-]{1,60}):\s*(.*)$/;
const QUESTION_MARKER = /^(Q\.|Q\s)\s*/;
const ANSWER_MARKER = /^(A\.|A\s)\s*/;
const PAGE_MARKER = /^(?:---\s*(\d{1,4})\s*---|Page\s+(\d{1,4})|(\d{1,4}))$/i;
const LINE_GUTTER = /^(\d{1,4})[ \t]{2,}(?=\S)/;
const EXHIBIT_MARKER =
  /\[?\s*\(?\s*Exhibit\s+(?:No\.?\s*)?(\d{1,4})[^\n]*\]?\s*\)?/i;
const EXHIBIT_ONLY_LINE =
  /^[\s]*[[(]?\s*Exhibit\s+(?:No\.?\s*)?(\d{1,4})\b[^\n]*[\])]?\s*$/i;
const APPEARANCES_HEADING = /^APPEARANCES:?\s*$/i;
const BY_LINE = /^By:\s*(.+)$/i;
const CASE_NUMBER = /^Case\s+No\.?\s*[:.]?\s*(\S+)\s*$/i;
const CAPTION = /^(.+?\s+v\.?\s+.+)$/i;
const REPORTED_BY =
  /^Reported\s+by:\s*(.+?),\s*(?:CSR|CRR|Certified\s+Reporter)\s*(?:No\.?\s*)?(\S+)/i;
const VOLUME = /^Volume\s+([IVXLCDM]+)\b/i;

const MONTHS: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

const speakerRole = (speaker: string): TranscriptTurnRole => {
  const normalized = speaker.trim().toUpperCase();
  if (normalized === 'THE COURT') {
    return 'the-court';
  }
  if (normalized === 'THE CLERK' || normalized === 'THE REPORTER') {
    return 'the-clerk';
  }
  if (normalized === 'THE WITNESS') {
    return 'the-witness';
  }
  if (
    /^(THE\s+)?(PLAINTIFF|DEFENDANT)(\s+BY\s+(COUNSEL|ATTORNEY))?$/.test(
      normalized
    )
  ) {
    return 'counsel';
  }
  if (/^(MR|MRS|MS|MISS|DR)\b/.test(normalized)) {
    return 'counsel';
  }
  return 'statement';
};

const toIsoDate = (value: string): string | null => {
  const trimmed = value.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const named = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(trimmed);
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    return month ? `${named[3]}-${month}-${named[2].padStart(2, '0')}` : null;
  }

  const slashed = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (slashed) {
    return `${slashed[3]}-${slashed[1].padStart(2, '0')}-${slashed[2].padStart(
      2,
      '0'
    )}`;
  }

  return null;
};

const mergeTurn = (turn: TranscriptTurn, addition: string): void => {
  turn.text = turn.text ? `${turn.text} ${addition}`.trim() : addition;
};

/**
 * Reads a hearing or deposition transcript into structured turns.
 *
 * This is deliberately not a model. A transcript is already structured, and the
 * two things a reviewer needs from a parse — who said what, and on which page
 * — are recoverable exactly, so a language model would only add a way to be
 * wrong about the page number.
 *
 * The rules, in the order a line is tested:
 *
 *  - a page marker moves the page cursor and is not testimony
 *  - an exhibit marker on its own line is collected and is not testimony
 *  - a `SPEAKER:` heading with no text on it changes who is speaking and adds
 *    no turn, which is what a `THE WITNESS:` or `MR. KIM:` block heading is
 *  - `Q.` and `A.` always open a turn, attributed to whoever is currently
 *    speaking, because that attribution is the whole point of the parse
 *  - anything else is a continuation of the turn in progress
 *
 * Everything not read off the page is null rather than guessed.
 */
export const parseTranscript = (text: string): ParsedTranscript => {
  const result: ParsedTranscript = {
    documentId: '',
    caseCaption: null,
    caseNumber: null,
    date: null,
    volume: null,
    reporter: null,
    certificationNumber: null,
    appearances: [],
    turns: [],
    exhibits: [],
    pageCount: 0,
    turnCount: 0,
    exhibitCount: 0,
  };

  if (typeof text !== 'string' || !text.trim()) {
    return result;
  }

  const lines = text.split(/\r?\n/);
  const highestPage = new Set<number>([1]);
  let page = 1;
  let currentSpeaker = '';
  let currentTurn: TranscriptTurn | null = null;
  let inAppearances = false;
  let pendingParty: string | null = null;

  const closeTurn = (): void => {
    currentTurn = null;
  };

  for (const rawLine of lines) {
    let line = rawLine.trim();

    if (!line) {
      continue;
    }

    const pageMarker = PAGE_MARKER.exec(line);
    if (pageMarker) {
      page = Number(pageMarker[1] ?? pageMarker[2] ?? pageMarker[3]);
      highestPage.add(page);
      closeTurn();
      continue;
    }

    const exhibitOnly = EXHIBIT_ONLY_LINE.exec(line);
    if (exhibitOnly) {
      const marker = exhibitOnly[0].trim();
      const already = result.exhibits.some(
        (exhibit: TranscriptExhibit) => exhibit.marker === marker
      );
      if (!already) {
        result.exhibits.push({ number: Number(exhibitOnly[1]), marker });
      }
      closeTurn();
      continue;
    }

    let lineNumber: number | null = null;
    const gutter = LINE_GUTTER.exec(line);
    if (gutter) {
      lineNumber = Number(gutter[1]);
      line = line.slice(gutter[0].length).trim();
    }

    if (APPEARANCES_HEADING.test(line)) {
      inAppearances = true;
      pendingParty = null;
      closeTurn();
      continue;
    }

    const heading = SPEAKER_HEADING.exec(line);
    const question = QUESTION_MARKER.exec(line);
    const answer = ANSWER_MARKER.exec(line);

    // The appearances block is a header: it ends at the first line that talks,
    // which is either a speaker heading or a question.
    if (heading || question || answer) {
      inAppearances = false;
    }

    if (inAppearances) {
      const appearance = BY_LINE.exec(line);
      if (appearance) {
        if (pendingParty) {
          result.appearances.push({
            party: pendingParty,
            counsel: appearance[1].trim(),
          } satisfies TranscriptAppearance);
          pendingParty = null;
        }
        closeTurn();
        continue;
      }
      if (/^Counsel for/i.test(line)) {
        continue;
      }
      if (/[A-Z]/.test(line)) {
        pendingParty = line;
      }
      closeTurn();
      continue;
    }

    const reportedBy = REPORTED_BY.exec(line);
    if (reportedBy) {
      result.reporter = reportedBy[1].trim();
      result.certificationNumber = reportedBy[2].trim();
      continue;
    }

    const volume = VOLUME.exec(line);
    if (volume) {
      result.volume = volume[1].toUpperCase();
      continue;
    }

    const dateLine = /^Date(?:d)?\s*[:.]?\s*(.+)$/i.exec(line);
    if (dateLine && !result.date) {
      result.date = toIsoDate(dateLine[1]);
      continue;
    }

    const caseNumber = CASE_NUMBER.exec(line);
    if (caseNumber) {
      result.caseNumber = caseNumber[1];
      continue;
    }

    if (!result.caseCaption) {
      const caption = CAPTION.exec(line);
      if (caption) {
        result.caseCaption = caption[1].trim();
        continue;
      }
    }

    if (heading) {
      const speaker = heading[1].trim().replace(/\s+/g, ' ');
      const rest = heading[2].trim();
      if (!rest) {
        currentSpeaker = speaker;
        closeTurn();
        continue;
      }
      currentSpeaker = speaker;
      currentTurn = {
        page,
        line: lineNumber,
        speaker,
        role: speakerRole(speaker),
        text: rest,
      };
      result.turns.push(currentTurn);
      continue;
    }

    if (question || answer) {
      const speaker = currentSpeaker || 'THE WITNESS';
      const text = line.slice((question ?? answer)![0].length).trim();
      currentTurn = {
        page,
        line: lineNumber,
        speaker,
        role: question ? 'question' : 'answer',
        text,
      };
      result.turns.push(currentTurn);
      continue;
    }

    if (currentTurn) {
      mergeTurn(currentTurn, line);
      continue;
    }

    if (currentSpeaker) {
      currentTurn = {
        page,
        line: lineNumber,
        speaker: currentSpeaker,
        role: speakerRole(currentSpeaker),
        text: line,
      };
      result.turns.push(currentTurn);
      continue;
    }

    const exhibitOnProse = EXHIBIT_MARKER.exec(line);
    if (exhibitOnProse) {
      result.exhibits.push({
        number: Number(exhibitOnProse[1]),
        marker: exhibitOnProse[0].trim(),
      });
    }
  }

  result.pageCount = highestPage.size;
  result.turnCount = result.turns.length;
  result.exhibitCount = result.exhibits.length;
  return result;
};
