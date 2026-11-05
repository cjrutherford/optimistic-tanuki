/** A person named with an office in an agenda's text. */
export interface ExtractedOfficial {
  name: string;
  role: string;
}

/** Title spellings (case-sensitive, capitalised as agendas print them) and the role each stands for. */
const TITLES: Array<[RegExp, string]> = [
  [/Mayor[ \t]+Pro[ \t]+Tem(?:pore)?/, 'Mayor Pro Tem'],
  [/Vice[- ]Mayor/, 'Vice Mayor'],
  [/Deputy[ \t]+Mayor/, 'Deputy Mayor'],
  [/Mayor/, 'Mayor'],
  [
    /Council[ \t]*(?:[Mm]embers?|[Pp]ersons?)|Councilors?|Councilmen|Councilwomen|Councilman|Councilwoman/,
    'Council Member',
  ],
  [/Council[ \t]+President/, 'Council President'],
  [/Alder(?:men|man|woman|women|persons?)/, 'Alderman'],
  [/Commissioners?/, 'Commissioner'],
  [/Vice[- ]Chair(?:man|woman|person)?/, 'Vice Chair'],
  [/Chair(?:man|woman|person)?/, 'Chair'],
  [/Select(?:men|man|woman|women|persons?)/, 'Selectman'],
  [/Supervisors?/, 'Supervisor'],
  [/Trustees?/, 'Trustee'],
  [/(?:City|Town|County|Village)[ \t]+(?:Manager|Administrator)/, 'Manager'],
  [/(?:City|Town|County|Village)[ \t]+Clerk/, 'Clerk'],
  [/(?:City|Town|County|Village)[ \t]+Attorney/, 'Attorney'],
];

const TITLE_SOURCE = TITLES.map(([pattern]) => `(?:${pattern.source})`).join(
  '|'
);

/** Words that follow a title on an agenda without being part of a name. */
const NOT_NAME_WORDS = new Set(
  `street st avenue ave road rd drive dr boulevard blvd lane ln court ct way place pl highway hwy circle trail
   parkway square park bridge office report reports comments comment update updates remarks proclamation
   proclamations presentation presentations announcements announcement appointment appointments salary
   election elections minutes agenda item items resolution ordinance meeting meetings session hearing
   district ward department division committee commission council board city town county village state
   of the and or for to in on at by with from as is are was be a an no none other others vacant
   presents moves seconds reads called asked announced recognizes proclaims presented said thanked opened
   closed adjourns introduces introduced recommends requests reported discussion action approval consent
   public staff members member pro tem vice deputy mayor chair chairman chairwoman chairperson clerk manager
   attorney administrator trustee trustees supervisor commissioner commissioners alderman aldermen selectman
   present absent excused roll call order pledge invocation`
    .split(/\s+/)
    .filter(Boolean)
);

const TOKEN = /^[A-Z][A-Za-z'’-]*\.?$/;

function isNameToken(token: string): boolean {
  if (!TOKEN.test(token)) return false;
  const bare = token.replace(/\.$/, '');
  if (bare.length > 1 && bare === bare.toUpperCase()) return false;
  if (bare.length > 1 && NOT_NAME_WORDS.has(bare.toLowerCase())) return false;
  return true;
}

/** Up to three capitalised words from the start of `text`, on one line, trimmed to a plausible personal name. */
function readName(text: string): { name: string; end: number } | null {
  const tokens: string[] = [];
  let position = 0;
  const word = /^([ \t]+)?([^\s,;:()]+)/;
  while (tokens.length < 3) {
    const match = word.exec(text.slice(position));
    if (!match || (tokens.length > 0 && !match[1])) break;
    if (tokens.length === 0 && match[1]) {
      // A title is followed by its name after spaces.
    }
    const token = match[2].replace(/[.]+$/u, (dots) =>
      /^[A-Z]$/.test(match[2].slice(0, -dots.length)) ? '.' : ''
    );
    if (!isNameToken(token)) break;
    tokens.push(token);
    position += match[0].length;
    if (token !== match[2]) break;
  }
  if (tokens.length < 2) return null;
  if (tokens.every((token) => token.length <= 2)) return null;
  return { name: tokens.join(' '), end: position };
}

/** Collapses a name for comparison: case, accents, punctuation, spacing and a trailing Jr./Sr. aside. */
export function normalizeOfficialName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+(?:jr|sr|ii|iii|iv)$/u, '');
}

function roleOf(title: string): string {
  for (const [pattern, role] of TITLES) {
    if (new RegExp(`^(?:${pattern.source})$`).test(title.trim())) return role;
  }
  return title.trim();
}

/** Names after a title: `Mayor Jane Smith`, `Council Members John Doe, Mary Roe and Sam Poe`. */
function titled(text: string, found: ExtractedOfficial[]): void {
  const title = new RegExp(`(?<![A-Za-z])(${TITLE_SOURCE})(?![A-Za-z'’])`, 'g');
  for (const match of text.matchAll(title)) {
    const role = roleOf(match[1]);
    let rest = text.slice(match.index + match[0].length);
    for (let count = 0; count < 12; count++) {
      const first = readName(rest);
      if (!first) break;
      found.push({ name: first.name, role });
      rest = rest.slice(first.end);
      const next = /^[ \t]*(?:,|;|\band\b|&)[ \t]*/.exec(rest);
      if (!next) break;
      rest = rest.slice(next[0].length);
    }
  }
}

/** `Jane Smith, Mayor`. */
function postfixed(text: string, found: ExtractedOfficial[]): void {
  const pattern = new RegExp(
    `([A-Z][A-Za-z'’.-]*(?:[ \\t]+[A-Z][A-Za-z'’.-]*){1,2}),[ \\t]*(${TITLE_SOURCE})(?![A-Za-z'’])`,
    'g'
  );
  for (const match of text.matchAll(pattern)) {
    const tokens = match[1].split(/[ \t]+/);
    if (tokens.length > 2 && /^(?:Jr|Sr)\.?$/.test(tokens[tokens.length - 1]))
      tokens.pop();
    // Two words, or three when the middle one is an initial.
    const candidates = [tokens.slice(-2)];
    if (tokens.length === 3 && /^[A-Z]\.?$/.test(tokens[1]))
      candidates.unshift(tokens);
    for (const candidate of candidates) {
      if (candidate.every(isNameToken)) {
        found.push({ name: candidate.join(' '), role: roleOf(match[2]) });
        break;
      }
    }
  }
}

/** `Present: Jane Smith, Mayor; John Doe, Council Member` or `Present: Mayor Jane Smith, John Doe`. */
function rollCall(text: string, found: ExtractedOfficial[]): void {
  const line =
    /^[ \t]*((?:Council[ \t]*|Board[ \t]+|Commission[ \t]+)?(?:Members?[ \t]+)?(?:Present|In[ \t]+Attendance|Roll[ \t]+Call))[ \t]*:[ \t]*(.+)$/gimu;
  for (const match of text.matchAll(line)) {
    const header = match[1];
    const body = match[2].split(
      /\b(?:Absent|Excused|Also[ \t]+Present|Staff)\b[ \t]*:/iu
    )[0];
    const fallbackRole = /council/i.test(header)
      ? 'Council Member'
      : /commission/i.test(header)
      ? 'Commissioner'
      : 'Member';
    const entries = body.includes(';')
      ? body.split(';')
      : body.split(/,|\band\b|&/u);
    let last: ExtractedOfficial | undefined;
    for (const raw of entries) {
      const entry = raw.trim().replace(/\.$/u, '');
      if (!entry) continue;
      const titleOnly = new RegExp(`^(?:${TITLE_SOURCE})$`).exec(entry);
      if (titleOnly && last) {
        last.role = roleOf(entry);
        continue;
      }
      const before = found.length;
      titled(entry, found);
      if (found.length === before) postfixed(entry, found);
      if (found.length > before) {
        last = found[found.length - 1];
        continue;
      }
      const inline = /^(.+?)[ \t]+[-–—][ \t]+(.+)$/u.exec(entry);
      const bare = readName(inline ? inline[1] : entry);
      if (bare && bare.end === (inline ? inline[1] : entry).length) {
        last = {
          name: bare.name,
          role: inline ? roleOf(inline[2]) : fallbackRole,
        };
        found.push(last);
      } else {
        last = undefined;
      }
    }
  }
}

/**
 * The officials an agenda's text names: a title followed by a personal name
 * (`Mayor Jane Smith`), a name followed by a title (`Jane Smith, Mayor`), and
 * the names in a `Present:` roll call. Deterministic and conservative: a
 * name needs at least two capitalised words, and street, department and
 * business words after a title (`Mayor's Office`, `Commissioner Road`) are
 * not names. One entry per person, with the first role found.
 */
export function extractOfficials(text: string): ExtractedOfficial[] {
  const found: ExtractedOfficial[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  const joined = lines.join('\n');
  rollCall(joined, found);
  for (const line of lines) {
    titled(line, found);
    postfixed(line, found);
  }
  const seen = new Map<string, ExtractedOfficial>();
  for (const official of found) {
    const key = normalizeOfficialName(official.name);
    if (!key) continue;
    const existing = seen.get(key);
    // A generic "Member" is replaced by a real role found later.
    if (!existing) seen.set(key, official);
    else if (existing.role === 'Member' && official.role !== 'Member')
      existing.role = official.role;
  }
  return [...seen.values()];
}
