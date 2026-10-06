/** Rule-based agenda item extraction + cross-item linking (threads). */

import { truncate } from './text.js';

export interface AgendaItemDraft {
  section: string;
  ordinal: number;
  heading: string;
  body: string;
  procedural: boolean;
}

const PROCEDURAL_PHRASES = [
  'rules of decorum',
  'decorum for',
  'americans with disabilities',
  'invocation',
  'pledge',
  'prayer',
  'roll call',
  'call to order',
  'approval of the agenda',
  'adoption of the agenda',
  'approval of agenda',
  'approval of minutes',
  'approval of meeting minutes',
  'proof of publication',
  'assistive technology',
  'ada coordinator',
  'public forum',
  'approval of the minutes',
  'adjournment',
  'executive session',
  'closing comments',
  'council comments',
  'commission comments',
  'manager report',
  'department head report',
  'each speaker will',
  'members of the audience',
  'members of the governing body',
  'member of the governing body',
  'ruled out of order',
  'roberts rules of order',
  'shall not interrupt the speaker',
  'refrain from communicating',
  'due respect for the speaker',
  'personal attacks',
  'three minutes to speak',
  'direct his or her comments',
  'maintain a civil',
  'notice of',
  'pursuant to',
];

const STOPWORDS = new Set(
  'the,a,an,of,to,in,on,for,and,or,at,by,from,with,regarding,discussion,consider,approval,approve,proposed,request,city,county'.split(
    ','
  )
);

function isProcedural(text: string): boolean {
  const lower = text.toLowerCase().replace(/\s*&\s*/g, ' and ');
  return PROCEDURAL_PHRASES.some((p) => lower.includes(p));
}

/**
 * Section names common to US municipal, county, and school board agendas.
 * They are recognized when written as headings: ALL CAPS, followed by a
 * colon, or (for multi-word names) in title case at a heading boundary.
 */
const SECTION_NAMES = [
  'welcome and call to order',
  'meeting call to order',
  'call to order',
  'invocation/pledge',
  'invocation and pledge',
  'prayer and pledge',
  'pledge of allegiance',
  'invocation',
  'roll call',
  'approval of the minutes',
  'approval of minutes',
  'approval of the agenda',
  'adoption of the agenda',
  'approval of agenda',
  'consent agenda',
  'regular agenda',
  'new business',
  'old business',
  'unfinished business',
  'other business',
  'general business',
  'zoning public hearing',
  'public hearings',
  'public hearing',
  'public comments',
  'public comment',
  'citizens to be heard',
  'citizen comments',
  'special presentations',
  'special presentation',
  'presentations',
  'proclamations',
  'recognitions',
  'announcements',
  'appointments',
  'city manager report',
  'county manager report',
  'administrator report',
  'department head report',
  'department head reports',
  'staff reports',
  'committee reports',
  'reports',
  'rules of decorum for the governing body',
  'rules of decorum for the public',
  'decorum for council meetings',
  'rules of decorum',
  'mayor and council comments',
  'closing comments from governing body',
  'commissioner comments',
  'executive session',
  'adjournment',
].sort((a, b) => b.length - a.length);

const MONTHS =
  'January|February|March|April|May|June|July|August|September|October|November|December';
const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]
  .flatMap((day) => [day, day.toUpperCase()])
  .join('|');
/** "Monday, September 14, 2026 5:30 PM" / "Monday September 14, 2026 at 6:00 PM". */
const MEETING_DATE_TIME = new RegExp(
  `\\b(?:${WEEKDAYS}),?\\s+(?:${MONTHS}|${MONTHS.toUpperCase()})\\s+\\d{1,2},\\s*\\d{4},?\\s+(?:at\\s+)?\\d{1,2}:\\d{2}\\s*(?:[AaPp]\\.?\\s?[Mm]\\.?)?`,
  'g'
);
const CAPS_TOKEN = /^(?:[A-Z][A-Z&/'’.-]*|OF|THE|FOR|AND|TO|A|AN|ON|IN)$/;
const CONNECTOR = /^(?:of|the|for|and|to|a|an|on|in|from|&)$/i;
const NUMBERED_RE = /(?:^|\s)(\d{1,2})\.\s+(?=[A-Z("“])/g;

interface Marker {
  index: number;
  end: number;
  title: string;
  /** A meeting header ("CITY COUNCIL MEETING Monday, ... 5:30 PM"): its trailing location is not an item, but numbered items after it are. */
  header: boolean;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Text right after an item number ("3. Call to Order") is that item, not a section heading. */
function followsItemNumber(text: string, index: number): boolean {
  return /(?:^|\s)\d{1,2}\.\s*$/.test(
    text.slice(Math.max(0, index - 6), index)
  );
}

function atHeadingBoundary(text: string, index: number): boolean {
  const before = text.slice(0, index).trimEnd();
  return before === '' || /[:.!?)]$/.test(before) || /\b\d{4}$/.test(before);
}

function isAllCaps(value: string): boolean {
  return /[A-Z]/.test(value) && !/[a-z]/.test(value);
}

function isTitleCase(value: string): boolean {
  return value
    .split(/[\s/]+/)
    .every((word) => CONNECTOR.test(word) || /^[A-Z&]/.test(word));
}

function overlaps(
  markers: readonly Marker[],
  index: number,
  end: number
): boolean {
  return markers.some((marker) => index < marker.end && end > marker.index);
}

function findMarkers(text: string): Marker[] {
  const markers: Marker[] = [];
  // Meeting headers: an ALL-CAPS run (the body and meeting type) ending in a date and time.
  for (const match of text.matchAll(MEETING_DATE_TIME)) {
    const tokens = text.slice(0, match.index).trimEnd().split(' ');
    let start = match.index;
    let consumed = 0;
    for (
      let i = tokens.length - 1;
      i >= 0 && CAPS_TOKEN.test(tokens[i]!);
      i -= 1
    ) {
      consumed += tokens[i]!.length + 1;
      start = match.index - consumed;
    }
    const run = text.slice(start, match.index);
    if (!/\b(?:AGENDA|MEETING|SESSION|WORKSHOP|HEARING)\b/.test(run)) continue;
    markers.push({
      index: Math.max(0, start),
      end: match.index + match[0].length,
      title: 'Agenda',
      header: true,
    });
  }
  for (const name of SECTION_NAMES) {
    const pattern = new RegExp(
      `(?<![\\w/])${name
        .split(' ')
        .map((word) =>
          word === 'and'
            ? '(?:and|&)'
            : escapeRegex(word).replace('/', '\\s*/\\s*')
        )
        .join('\\s+')}(?![\\w/])(\\s*:(?!\\s*\\d))?`,
      'gi'
    );
    for (const match of text.matchAll(pattern)) {
      const raw = match[0].replace(/\s*:$/, '');
      const colon = Boolean(match[1]);
      const multiWord = name.includes(' ') || name.includes('/');
      const accepted =
        isAllCaps(raw) ||
        colon ||
        (multiWord && isTitleCase(raw) && atHeadingBoundary(text, match.index));
      if (
        !accepted ||
        followsItemNumber(text, match.index) ||
        overlaps(markers, match.index, match.index + match[0].length)
      )
        continue;
      markers.push({
        index: match.index,
        end: match.index + match[0].length,
        title: raw.trim(),
        header: false,
      });
    }
  }
  // Other colon headings ("Recognitions & Awards:"), never a clock time ("6:00").
  for (const match of text.matchAll(
    /([A-Z][A-Za-z&/'’-]*(?:\s+(?:[A-Z][A-Za-z&/'’-]*|of|the|and|for|to|&|a|an|on|in|from)){0,5})\s*:(?!\s*\d)/g
  )) {
    if (
      !atHeadingBoundary(text, match.index) ||
      followsItemNumber(text, match.index) ||
      overlaps(markers, match.index, match.index + match[0].length)
    )
      continue;
    markers.push({
      index: match.index,
      end: match.index + match[0].length,
      title: match[1]!.trim(),
      header: false,
    });
  }
  // Remaining ALL-CAPS runs of two or more words that introduce numbered items or a notice.
  for (const match of text.matchAll(
    /(?<![\w])[A-Z][A-Z&/'’-]+(?:\s+(?:[A-Z][A-Z&/'’-]+|OF|THE|FOR|AND|TO|A|&))+(?![\w])/g
  )) {
    const end = match.index + match[0].length;
    const next = text.slice(end, end + 6);
    const notice = /^NOTICE\b/.test(match[0]);
    if (!notice && !/^\s+\d{1,2}\.\s/.test(next)) continue;
    if (
      match[0].split(/\s+/).filter((word) => !CONNECTOR.test(word)).length <
        2 ||
      followsItemNumber(text, match.index) ||
      overlaps(markers, match.index, end)
    )
      continue;
    markers.push({
      index: match.index,
      end,
      title: match[0].trim(),
      header: false,
    });
  }
  return markers.sort((a, b) => a.index - b.index);
}

const ROMAN = /(?<![\w.])([IVXL]{1,5})\.\s+(?=[A-Z])/g;
const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };
/** "VII.1." / "VIII.A." — an item under outline section VII / VIII. */
const OUTLINE_ITEM = /(?<![\w.])([IVXL]{1,5})\.(\d{1,2}|[A-Z])\.\s+/g;
/** Standing lines of an outline agenda that carry no business of their own. */
const ROUTINE_OUTLINE_ITEMS =
  /^(?:report of (?:the )?(?:chair(?:man|person)?|staff|agency|commission|board|director)|application update|receipt of new applications|next meeting date)\b/iu;

function romanValue(numeral: string): number {
  let total = 0;
  for (let i = 0; i < numeral.length; i += 1) {
    const value = ROMAN_VALUES[numeral[i]!] ?? 0;
    const next = ROMAN_VALUES[numeral[i + 1] ?? ''] ?? 0;
    total += value < next ? -value : value;
  }
  return total;
}

/**
 * Top-level sections of an outline agenda ("I. ROLL CALL ... VII. PENDING
 * APPLICATIONS VII.1. IWA26-0008 ..."), as AgendaSuite and similar systems
 * print them. Numerals must rise (sections may be skipped when empty) and
 * there must be at least three, so a stray "I." in prose is not an outline.
 */
function outlineSections(
  clean: string
): { numeral: string; index: number; end: number }[] {
  const sections: { numeral: string; index: number; end: number }[] = [];
  let last = 0;
  for (const match of clean.matchAll(ROMAN)) {
    const value = romanValue(match[1]!);
    if (value <= last || value > last + 4) continue;
    last = value;
    sections.push({
      numeral: match[1]!,
      index: match.index,
      end: match.index + match[0].length,
    });
  }
  return sections.length >= 3 && sections[0]!.numeral === 'I' ? sections : [];
}

/** "a. Social Media b. Farmers Market" — lettered items in sequence from a. */
function letteredItems(body: string): RegExpExecArray[] {
  const items: RegExpExecArray[] = [];
  for (const match of body.matchAll(/(?<![\w.])([a-z])\.\s+(?=[A-Z0-9])/g)) {
    if (match[1]!.charCodeAt(0) - 97 === items.length) items.push(match);
  }
  return items;
}

/**
 * An outline agenda's items are its sub-items; a section with none ("II.
 * PUBLIC HEARING(S)" followed directly by "III.") is an empty heading, which
 * is not business and yields no row.
 */
function extractOutlineItems(
  clean: string,
  sections: readonly { numeral: string; index: number; end: number }[]
): AgendaItemDraft[] {
  const out: AgendaItemDraft[] = [];
  const preamble = clean.slice(0, sections[0]!.index).trim();
  if (preamble)
    out.push({
      section: 'Preamble',
      ordinal: 1,
      heading: 'Preamble',
      body: truncate(`Preamble: ${preamble}`, 800),
      procedural: true,
    });
  sections.forEach((section, i) => {
    const body = clean.slice(
      section.end,
      sections[i + 1]?.index ?? clean.length
    );
    let items: RegExpExecArray[] = [...body.matchAll(OUTLINE_ITEM)].filter(
      (match) => match[1] === section.numeral
    );
    if (!items.length) items = letteredItems(body);
    const title = body
      .slice(0, items[0]?.index ?? body.length)
      .replace(/[:\s]+$/u, '')
      .trim();
    if (!title) return;
    const proceduralSection = isProcedural(title);
    items.forEach((item, j) => {
      const text = body
        .slice(item.index + item[0].length, items[j + 1]?.index ?? body.length)
        .trim();
      if (!text) return;
      // Under a Reports heading, a short line ("Parks & Recreation", "Monthly
      // Report") is a standing report, not a matter before the body.
      const standingReport =
        /\breports?\b/iu.test(title) &&
        (text.match(/\p{L}{2,}/gu) ?? []).length <= 4;
      const routine =
        ROUTINE_OUTLINE_ITEMS.test(text) ||
        text.toLowerCase() === title.toLowerCase() ||
        standingReport;
      out.push({
        section: title,
        ordinal: out.length + 1,
        heading: truncate(text, 150),
        // The row body is the row's evidence, so it carries its own heading.
        body: truncate(`${title}: ${text}`, 800),
        procedural:
          proceduralSection || routine || isProcedural(text.slice(0, 150)),
      });
    });
  });
  return out;
}

/**
 * An agenda's header: who meets, when and where — the text before its first
 * item. It is the context an agenda row may lean on for body, time and place;
 * the rest of the document is other rows' business, and a claim about one row
 * must not borrow names from another.
 */
export function agendaHeader(text: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const outline = outlineSections(clean);
  const numbered = [...clean.matchAll(NUMBERED_RE)].find(
    (match) => match[1] === '1'
  );
  const end = outline[0]?.index ?? numbered?.index ?? clean.length;
  // A header's standard notices are not about this meeting; a model that
  // reads them reports them, or fuses them with the chair's name.
  return clean
    .slice(0, end)
    .split(/(?<=[.!?])\s+/u)
    .filter((sentence) => !STANDARD_NOTICE.test(sentence))
    .join(' ')
    .trim();
}

/** Boilerplate an agenda header carries for every meeting. */
const STANDARD_NOTICE =
  /\b(?:accessib\w*|assistive technology|ADA\b|Americans with Disabilities|cell phones?|televised|sign[- ]up|speaker cards?|reasonable accommodation)\b/iu;

/** An outline agenda parses completely by rule: few rows means little business, not a failed parse to repair. */
export function isOutlineAgenda(text: string): boolean {
  return outlineSections(text.replace(/\s+/g, ' ').trim()).length > 0;
}

/** Split document text into agenda items. Deterministic; LLM fixup lives in @civic/llm. */
export function extractAgendaItems(text: string): AgendaItemDraft[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const outline = outlineSections(clean);
  if (outline.length) return extractOutlineItems(clean, outline);
  const markers = findMarkers(clean);
  const sections: { title: string; body: string; header: boolean }[] = [];
  const leading = clean.slice(0, markers[0]?.index ?? clean.length).trim();
  // Text before the first heading is the notice/roster preamble unless the
  // document has no headings at all.
  if (leading)
    sections.push({
      title: markers.length ? 'Preamble' : 'General',
      body: leading,
      header: false,
    });
  markers.forEach((marker, i) => {
    sections.push({
      title: marker.title,
      body: clean
        .slice(marker.end, markers[i + 1]?.index ?? clean.length)
        .trim(),
      header: marker.header,
    });
  });
  const out: AgendaItemDraft[] = [];
  let lastNumber = 0;
  for (const section of sections) {
    // Section flag uses the title only: body mentions (e.g. a listed executive
    // session) must not condemn the section's real items; those are judged
    // individually below.
    const proceduralSection =
      section.title === 'Preamble' || isProcedural(section.title);
    // Item numbers continue across sections or restart at 1; anything else
    // ("Suite 2.", "Ave. 5.") is part of the surrounding text.
    const nums = [...section.body.matchAll(NUMBERED_RE)].filter((match) => {
      const n = Number(match[1]);
      if (n !== 1 && n !== lastNumber + 1) return false;
      lastNumber = n;
      return true;
    });
    if (nums.length === 0) {
      if (section.header || section.body.split(' ').length < 3) continue;
      out.push({
        section: section.title,
        ordinal: out.length + 1,
        heading: section.title,
        // The row body is the row's evidence, so it carries its own heading.
        body: truncate(`${section.title}: ${section.body}`, 800),
        procedural: proceduralSection,
      });
      continue;
    }
    for (let i = 0; i < nums.length; i++) {
      const start = nums[i].index + nums[i][0].indexOf(nums[i][1]);
      const end = i + 1 < nums.length ? nums[i + 1].index : section.body.length;
      const raw = section.body.slice(start, end).trim();
      if (!raw) continue;
      out.push({
        section: section.title,
        ordinal: Number(nums[i][1]),
        heading: truncate(raw, 150),
        body: truncate(raw, 800),
        // Item-level check looks at the item's own opening only: trailing
        // boilerplate from the next section must not condemn real items.
        procedural: proceduralSection || isProcedural(raw.slice(0, 150)),
      });
    }
  }
  return out;
}

/** First sentence carrying a decision/outcome; fallback to first sentence. */
export function extractOutcome(body: string): string {
  const sentences = body.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()) ?? [
    body.trim(),
  ];
  const outcome = sentences.find((s) =>
    /(passed|approved|voted|motion|seconded|decided|tabled|scheduled|failed|carried|unanimous|\d+-\d+)/i.test(
      s
    )
  );
  return (outcome ?? sentences[0] ?? body).slice(0, 300);
}
export function topicKey(text: string): string {
  const caseId = text.match(/\b([A-Z]{1,5}-?\d{2,4}-?\d{1,4}[A-Z]?)\b/);
  if (caseId) return `case:${caseId[1].toLowerCase().replace(/-/g, '')}`;
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, 5);
  return `topic:${words.join('-') || 'general'}`;
}

/** A date that exists on the calendar; digit runs that are not dates are rejected. */
export function isCalendarDate(
  year: number,
  month: number,
  day: number
): boolean {
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1)
    return false;
  const value = new Date(Date.UTC(year, month - 1, day));
  return (
    value.getUTCFullYear() === year &&
    value.getUTCMonth() === month - 1 &&
    value.getUTCDate() === day
  );
}

function isoDate(year: string, month: string, day: string): string | null {
  return isCalendarDate(Number(year), Number(month), Number(day))
    ? `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    : null;
}

const MONTH_NUMBERS: Record<string, string> = {
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
const MONTH_NAME =
  'January|February|March|April|May|June|July|August|September|October|November|December';
const WEEKDAY = 'Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday';
/** "Printed on 09/14/2026" is when the packet was produced, not when the body meets. */
const NOT_A_MEETING_DATE =
  /(?:printed(?:\s+on)?|posted|revised|published|updated|prepared|as\s+of|page)\s*(?:on\s*)?$/iu;

/**
 * ISO date from "07/27/2026" or "August 24, 2026" in a title. Patterns are tried in
 * turn and a pattern that yields an impossible date (a file id such as "109363"
 * reading as 10/93/63) is skipped rather than believed.
 */
export function meetingDateFromTitle(title: string): string | null {
  const patterns: [RegExp, (m: RegExpMatchArray) => string | null][] = [
    [/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/u, (m) => isoDate(m[1], m[2], m[3])],
    [/(\d{2})\/(\d{2})\/(\d{4})/u, (m) => isoDate(m[3], m[1], m[2])],
    // County styles: "07 07 2026", "020326" (MMDDYY).
    [
      /(?<!\d)(\d{1,2})\s(\d{1,2})\s(20\d{2})(?!\d)/u,
      (m) => isoDate(m[3], m[1], m[2]),
    ],
    [
      /(?<!\d)(\d{2})(\d{2})(\d{2})(?!\d)/u,
      (m) => isoDate(`20${m[3]}`, m[1], m[2]),
    ],
    // Tift style 09.14.26.
    [
      /(?<!\d)(\d{2})\.(\d{2})\.(\d{2})(?!\d)/u,
      (m) => isoDate(`20${m[3]}`, m[1], m[2]),
    ],
    [
      new RegExp(`(${MONTH_NAME})\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'iu'),
      (m) => isoDate(m[3], MONTH_NUMBERS[m[1].toLowerCase()], m[2]),
    ],
  ];
  for (const [pattern, toDate] of patterns) {
    const match = title.match(pattern);
    const date = match ? toDate(match) : null;
    if (date) return date;
  }
  return null;
}

/**
 * Meeting date from the document body, for platforms whose file URLs are opaque
 * ids. Agenda and minutes cover pages name the day ("Thursday, September 17,
 * 2026"); dates that label the printing or posting of the packet are skipped.
 */
export function meetingDateFromDocumentText(text: string): string | null {
  const head = text.replace(/\s+/gu, ' ').slice(0, 3000);
  const weekday = head.match(
    new RegExp(
      `(?:${WEEKDAY}),?\\s+(${MONTH_NAME})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
      'iu'
    )
  );
  if (weekday) {
    const date = isoDate(
      weekday[3],
      MONTH_NUMBERS[weekday[1].toLowerCase()],
      weekday[2]
    );
    if (date) return date;
  }
  // Without a weekday, only the cover header is trusted: later dates are
  // usually minutes being approved or the next meeting.
  const cover = head.slice(0, 400);
  const candidates = [
    ...cover.matchAll(
      new RegExp(`(${MONTH_NAME})\\s+(\\d{1,2}),?\\s+(\\d{4})`, 'giu')
    ),
    ...cover.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/gu),
  ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const match of candidates) {
    const before = cover.slice(
      Math.max(0, (match.index ?? 0) - 40),
      match.index ?? 0
    );
    if (
      NOT_A_MEETING_DATE.test(before.slice(-24)) ||
      /minutes|next\s+meeting/iu.test(before)
    )
      continue;
    const numeric = /^\d/u.test(match[1]);
    const date = numeric
      ? isoDate(match[3], match[1], match[2])
      : isoDate(match[3], MONTH_NUMBERS[match[1].toLowerCase()], match[2]);
    if (date) return date;
  }
  return null;
}

const STATE_NAMES = new Set([
  'alabama',
  'alaska',
  'arizona',
  'arkansas',
  'california',
  'colorado',
  'connecticut',
  'delaware',
  'florida',
  'georgia',
  'hawaii',
  'idaho',
  'illinois',
  'indiana',
  'iowa',
  'kansas',
  'kentucky',
  'louisiana',
  'maine',
  'maryland',
  'massachusetts',
  'michigan',
  'minnesota',
  'mississippi',
  'missouri',
  'montana',
  'nebraska',
  'nevada',
  'hampshire',
  'jersey',
  'mexico',
  'york',
  'carolina',
  'dakota',
  'ohio',
  'oklahoma',
  'oregon',
  'pennsylvania',
  'rhode',
  'island',
  'tennessee',
  'texas',
  'utah',
  'vermont',
  'virginia',
  'washington',
  'wisconsin',
  'wyoming',
  'columbia',
]);
const ORG_PREFIX = new Set([
  'town',
  'city',
  'county',
  'village',
  'borough',
  'township',
  'district',
  'page',
  'printed',
  'the',
  'of',
  'new',
  'north',
  'south',
  'west',
  'east',
]);
const DOCUMENT_TYPE = new RegExp(
  `((?:Regular|Special|Emergency|Annual|Organizational|Public|Joint)\\s+)?(?:(Meeting|Hearing|Session|Workshop)\\s+)?(Agenda|Minutes)\\b`,
  'u'
);

const BODY_KINDS =
  /^(?:Committee|Commission|Board|Council|Force|Authority|Agency|Trustees|Association|Workshop)$/u;
const NAME_CONNECTORS = new Set(['of', 'the', 'and', '&', 'for', 'on']);

/** Capitalized words next to the document type; connectors ("Committee of the Whole") stay inside a name. */
function capitalizedRun(words: readonly string[], fromEnd: boolean): string[] {
  const ordered = fromEnd ? [...words].reverse() : [...words];
  const run: string[] = [];
  for (const word of ordered) {
    if (/^[A-Z][A-Za-z'&.-]*,?$/u.test(word)) run.push(word);
    else if (NAME_CONNECTORS.has(word.toLowerCase()) && run.length)
      run.push(word);
    else break;
  }
  while (run.length && NAME_CONNECTORS.has(run.at(-1)!.toLowerCase()))
    run.pop();
  return fromEnd ? run.reverse() : run;
}

function withoutLeading(
  words: string[],
  drop: (word: string) => boolean
): string[] {
  let index = 0;
  while (index < words.length && drop(words[index])) index += 1;
  return words.slice(index);
}

function meetingBodyName(
  before: readonly string[],
  after: readonly string[]
): string | null {
  // "Town of Groton, Connecticut Athletic Fields Task Force Meeting Agenda":
  // everything through the last comma is the municipality, not the body.
  const leading = capitalizedRun(before, true);
  const lastComma = leading.map((word) => word.endsWith(',')).lastIndexOf(true);
  // "Town Council" is a body; "Town of Groton" is the municipality.
  let words = leading.slice(lastComma + 1);
  for (;;) {
    const first = words[0]?.toLowerCase() ?? '';
    if (
      STATE_NAMES.has(first) ||
      NAME_CONNECTORS.has(first) ||
      first === 'page' ||
      first === 'printed'
    )
      words = words.slice(1);
    else if (ORG_PREFIX.has(first) && words[1]?.toLowerCase() === 'of')
      words = words.slice(3);
    else break;
  }
  words = words.slice(-6);
  words = withoutLeading(words, (word) =>
    NAME_CONNECTORS.has(word.toLowerCase())
  );
  // Some platforms put the body after the document type instead ("Regular
  // Meeting Agenda Trails Coordinating Task Force").
  if (!words.length) {
    const trailing = capitalizedRun(after, false);
    const comma = trailing.findIndex((word) => word.endsWith(','));
    words = comma >= 0 ? trailing.slice(0, comma) : trailing;
    // The body's name ends at its kind; a department often follows it.
    const kind = words.findIndex((word) => BODY_KINDS.test(word));
    words = (kind >= 0 ? words.slice(0, kind + 1) : words).slice(0, 6);
    while (words.length && NAME_CONNECTORS.has(words.at(-1)!.toLowerCase()))
      words.pop();
  }
  return words.length ? words.join(' ') : null;
}

/**
 * Title for a meeting document from its own text: the body that meets, the kind
 * of document and the meeting date. Used when the file URL carries no title.
 */
export function meetingDocumentTitle(text: string): string | null {
  const head = text.replace(/\s+/gu, ' ').slice(0, 1500);
  const match = head.match(DOCUMENT_TYPE);
  if (!match) return null;
  const before = head
    .slice(0, match.index ?? 0)
    .trim()
    .split(' ');
  const after = head
    .slice((match.index ?? 0) + match[0].length)
    .trim()
    .split(' ');
  const body = meetingBodyName(before, after);
  const type = [match[1]?.trim(), match[2], match[3]].filter(Boolean).join(' ');
  const date = meetingDateFromDocumentText(text);
  const heading = [body, type].filter(Boolean).join(' ');
  if (!heading) return null;
  return date ? `${heading} ${date}` : heading;
}

export interface ThreadRow {
  /** Back-reference to the canonical civic item when loaded from storage. */
  itemId?: number;
  /** Exact persisted agenda row; parent CivicItem is not row identity. */
  agendaItemId?: number;
  /** Stable source binding for strict LLM evidence. */
  sourceKey?: string;
  snippetOnly?: boolean;
  topicKey: string;
  meetingDate: string | null;
  heading: string;
  body: string;
  itemTitle: string;
  uris: string[];
  /** Validated publisher URL, when one was supplied by enrichment. */
  canonicalUrl?: string | null;
}

export interface Thread {
  topicKey: string;
  items: ThreadRow[];
  meetings: string[];
  /** Same-meeting items on other topics (agenda ↔ minutes linkage). */
  related: ThreadRow[];
}

const BOILERPLATE_THREAD = [
  /approval of minutes/i,
  /\badjourn/i,
  /^preamble$/i,
  /meeting agenda\s*$/i,
  /^ession\b/i,
  /rules of decorum/i,
  /invocation/i,
  /americans with disabilities/i,
  /^at \d+\b/i,
  /^rathel and carried/i,
];

/** True when a thread is worth a full story (not recurring boilerplate). */
export function isSubstantiveThread(thread: Thread): boolean {
  if (thread.topicKey === 'topic:general') return false;
  if (thread.meetings.length < 2) return false;
  const head = thread.items[thread.items.length - 1]?.heading ?? '';
  if (head.trim().length < 20) return false;
  if (BOILERPLATE_THREAD.some((p) => p.test(head))) return false;
  return thread.items.some((i) => i.body.trim().length > 200);
}

/** Rank substantive threads (meetings weight 2, items weight 1) and take top N. */
export function selectStoryThreads(threads: Thread[], limit = 5): Thread[] {
  return threads
    .filter(isSubstantiveThread)
    .sort(
      (a, b) =>
        b.meetings.length * 2 +
        b.items.length -
        (a.meetings.length * 2 + a.items.length)
    )
    .slice(0, limit);
}

export function buildThreads(all: ThreadRow[]): Thread[] {
  // Keep generic rows available for canonical item storage.  They are
  // excluded from full-story selection by isSubstantiveThread above.
  const rows = all;
  const groups = new Map<string, ThreadRow[]>();
  for (const row of rows) {
    const g = groups.get(row.topicKey) ?? [];
    g.push(row);
    groups.set(row.topicKey, g);
  }
  // Merge groups sharing a case ID found anywhere in member bodies (union-find).
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    parent.set(k, parent.get(k) ?? k);
    if (parent.get(k) !== k) parent.set(k, find(parent.get(k) as string));
    return parent.get(k) as string;
  };
  const caseToKey = new Map<string, string>();
  for (const [key, rows] of groups) {
    const ids = new Set<string>();
    if (key.startsWith('case:')) ids.add(key);
    for (const r of rows) {
      for (const m of `${r.heading} ${r.body}`.matchAll(
        /\b([A-Z]{1,5}-?\d{2,4}-?\d{1,4}[A-Z]?)\b/g
      )) {
        ids.add(`case:${m[1].toLowerCase().replace(/-/g, '')}`);
      }
    }
    for (const id of ids) {
      if (caseToKey.has(id)) {
        const a = find(key);
        const b = find(caseToKey.get(id) as string);
        parent.set(a, b);
      } else {
        caseToKey.set(id, key);
      }
    }
  }
  const merged = new Map<string, ThreadRow[]>();
  for (const [key, rows] of groups) {
    const root = find(key);
    merged.set(root, [...(merged.get(root) ?? []), ...rows]);
  }
  const byDate = new Map<string, ThreadRow[]>();
  for (const row of rows) {
    if (!row.meetingDate) continue;
    const g = byDate.get(row.meetingDate) ?? [];
    g.push(row);
    byDate.set(row.meetingDate, g);
  }
  const threads: Thread[] = [];
  for (const [key, rows] of merged) {
    const sorted = [...rows].sort((a, b) =>
      (a.meetingDate ?? '').localeCompare(b.meetingDate ?? '')
    );
    const meetings = [
      ...new Set(sorted.map((r) => r.meetingDate).filter(Boolean) as string[]),
    ];
    const related: ThreadRow[] = [];
    for (const d of meetings) {
      for (const r of byDate.get(d) ?? []) {
        if (r.topicKey !== key && related.length < 5) related.push(r);
      }
    }
    threads.push({ topicKey: key, items: sorted, meetings, related });
  }
  return threads.sort((a, b) =>
    (b.meetings[0] ?? '').localeCompare(a.meetings[0] ?? '')
  );
}
