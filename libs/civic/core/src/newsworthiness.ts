/**
 * What deserves the top of a town briefing.
 *
 * An edition gathers everything a town's sources published: tax decisions and
 * softball scores arrive together, and ordering by recency buries the news.
 * This scores civic consequence from the text itself — who is affected, what
 * changes, how much money moves — and records which signals fired, so an
 * editor can see why an item led and a test can pin the judgment down.
 *
 * Scores are comparable within one edition; they are not a truth claim about
 * importance, and they never decide what is true, only what is read first.
 */

export interface NewsworthinessSignal {
  name: string;
  weight: number;
  /** The matched phrase, so a ranking can be explained in one line. */
  match: string;
}

export interface Newsworthiness {
  score: number;
  signals: NewsworthinessSignal[];
  /** Short human-readable reason, e.g. "tax rate, affects every property owner". */
  reason: string;
}

interface Rule {
  name: string;
  weight: number;
  pattern: RegExp;
}

/**
 * Weights express editorial judgment, and deliberately so: a tax rate outranks
 * a ribbon cutting for every town, every day. Negative rules demote material
 * that is published often and changes nothing about how a town is governed.
 */
const RULES: readonly Rule[] = [
  // What a resident pays or owes.
  {
    name: 'tax rate',
    weight: 10,
    pattern:
      /\b(?:millage|tax digest|property tax|tax rate|assessment rate|homestead exemption)\b/iu,
  },
  {
    name: 'rate or fee change',
    weight: 7,
    pattern:
      /\b(?:rate increase|fee increase|tipping fee|utility rates?|water rates?|sewer rates?|surcharge|rate schedule)\b/iu,
  },
  // Who runs the place.
  {
    name: 'leadership change',
    weight: 9,
    pattern:
      /\b(?:terminat\w+|resign\w*|dismiss\w+|fired|steps? down|appoint\w*|interim|names? new|hir\w+)\b/iu,
  },
  // Land and what may be built on it.
  {
    name: 'land use',
    weight: 7,
    pattern:
      /\b(?:rezon\w+|zoning (?:application|amendment|change)|annex\w+|variance|subdivision|preliminary plan|plat\b|conditional use|overlay|entertainment district|comprehensive plan)\b/iu,
  },
  {
    name: 'ordinance',
    weight: 5,
    pattern: /\b(?:ordinance|moratorium|code amendment)\b/iu,
  },
  // Public money.
  {
    name: 'budget',
    weight: 6,
    pattern:
      /\b(?:budget|SPLOST|bond|millage|appropriat\w+|audit|deficit|surplus fund)\b/iu,
  },
  {
    name: 'contract or purchase',
    weight: 4,
    pattern:
      /\b(?:contract|agreement|purchase|procurement|bid\b|RFP|lease)\b/iu,
  },
  // Safety and essential services.
  {
    name: 'public safety',
    weight: 6,
    pattern:
      /\b(?:police|fire department|fire chief|sheriff|EMS|ambulance|911|emergency|evacuat\w+|boil water|water main|outage)\b/iu,
  },
  {
    name: 'services',
    weight: 4,
    pattern:
      /\b(?:sanitation|landfill|transfer station|road closure|paving|traffic signal|sidewalk|transit|broadband|sewer|water system)\b/iu,
  },
  {
    name: 'schools',
    weight: 5,
    pattern:
      /\b(?:school board|board of education|superintendent|school district|schools?)\b/iu,
  },
  // Chances for the public to act.
  {
    name: 'public input',
    weight: 4,
    pattern:
      /\b(?:public hearing|public comment|referendum|election|candidate forum|town hall|comment period)\b/iu,
  },
  {
    name: 'jobs and investment',
    weight: 4,
    pattern:
      /\b(?:jobs|hiring|layoffs?|plant|facility|expansion|development authority|enterprise zone|incentives?|grant award)\b/iu,
  },
  // Published often, changes nothing about governance.
  {
    name: 'ceremonial',
    weight: -8,
    pattern:
      /\b(?:proclamation|recognition|recognizing|award|honou?r(?:ing|ed)?|ribbon cutting|ground ?breaking|anniversary|celebrat\w+|appreciation|birthday|queen|pageant)\b/iu,
  },
  {
    name: 'sports',
    weight: -12,
    pattern:
      /\b(?:softball|baseball|football|volleyball|basketball|soccer|cross country|golf|region game|playoffs?|touchdown|innings?|final score|\d+-\d+ (?:win|loss|victory)|varsity|scoreboard)\b/iu,
  },
  {
    name: 'opinion or review',
    weight: -12,
    pattern:
      /\b(?:book|movie|film|restaurant)\s+reviews?\b|\b(?:columnist|columns?|editorial board|opinions?|letters? to the editor|recipes?|horoscopes?)\b/iu,
  },
  {
    name: 'routine notice',
    weight: -3,
    pattern:
      /\b(?:menu|calendar of events|road to recovery|blood drive|story ?time|registration is open|sign-?ups?)\b/iu,
  },
];

/** A syndicated column runs under an all-caps byline: "BECKY TAYLOR: ...". */
const COLUMN_BYLINE = /^[A-Z][A-Z.'-]+(?:\s+[A-Z][A-Z.'-]+){1,3}:/u;

/** Phrases that say an item reaches the whole town rather than one applicant. */
const BREADTH =
  /\b(?:every (?:resident|property owner|household)|all residents|county-?wide|city-?wide|district-?wide|each year|annually|all customers|taxpayers)\b/iu;

/** A decision that already happened outranks one merely scheduled. */
const DECIDED =
  /\b(?:approved|adopted|denied|rejected|passed|voted|terminated|awarded|set the|selected|authorized)\b/iu;

function moneyWeight(text: string): NewsworthinessSignal | null {
  let best: { amount: number; match: string } | null = null;
  for (const match of text.matchAll(
    /\$\s?([\d,]+(?:\.\d+)?)\s*(million|billion|m\b|b\b)?/giu
  )) {
    const digits = Number(match[1].replace(/,/gu, ''));
    if (!Number.isFinite(digits)) continue;
    const scale = /^m/iu.test(match[2] ?? '')
      ? 1e6
      : /^b/iu.test(match[2] ?? '')
      ? 1e9
      : 1;
    const amount = digits * scale;
    if (!best || amount > best.amount)
      best = { amount, match: match[0].trim() };
  }
  if (!best) return null;
  // A town notices six figures; five figures is a line item; four is a detail.
  const weight =
    best.amount >= 1e6
      ? 8
      : best.amount >= 1e5
      ? 5
      : best.amount >= 1e4
      ? 2
      : 1;
  return { name: 'public money', weight, match: best.match };
}

export function scoreNewsworthiness(input: {
  title: string;
  body?: string;
  kind?: string;
}): Newsworthiness {
  // The headline states the subject; the body is supporting detail and is
  // weighted less so that a passing mention cannot promote an item.
  const title = input.title ?? '';
  const body = (input.body ?? '').slice(0, 1200);
  const signals: NewsworthinessSignal[] = [];
  for (const rule of RULES) {
    const inTitle = title.match(rule.pattern);
    const inBody = inTitle ? null : body.match(rule.pattern);
    const hit = inTitle ?? inBody;
    if (!hit) continue;
    signals.push({
      name: rule.name,
      weight: inTitle ? rule.weight : Math.round(rule.weight * 0.4),
      match: hit[0],
    });
  }
  const money = moneyWeight(`${title}\n${body}`);
  if (money) signals.push(money);
  const breadth = `${title}\n${body}`.match(BREADTH);
  if (breadth)
    signals.push({
      name: 'affects the whole town',
      weight: 3,
      match: breadth[0],
    });
  const byline = title.match(COLUMN_BYLINE);
  if (byline)
    signals.push({ name: 'opinion or review', weight: -12, match: byline[0] });
  const decided = title.match(DECIDED);
  if (decided) signals.push({ name: 'decided', weight: 3, match: decided[0] });
  // A meeting record is civic business by construction, so it starts above
  // the noise floor that a general news feed sits on.
  if (input.kind === 'meeting')
    signals.push({ name: 'official record', weight: 2, match: input.kind });
  const score = signals.reduce((total, signal) => total + signal.weight, 0);
  const positives = signals
    .filter((signal) => signal.weight > 0)
    .sort((a, b) => b.weight - a.weight);
  const negatives = signals.filter((signal) => signal.weight < 0);
  const reason = positives.length
    ? positives
        .slice(0, 3)
        .map((signal) => signal.name)
        .join(', ')
    : negatives.length
    ? `not civic business (${negatives[0]!.name})`
    : 'no civic signal';
  return { score, signals, reason };
}

/** Not strong enough to lead an edition; may still belong further down. */
export function isBelowTheFold(value: Newsworthiness): boolean {
  return value.score <= 0;
}

/**
 * Not the town's civic record at all: box scores, reviews, columns, ceremony.
 * Neutral wording stays in, because a plain notice is still town business.
 */
export function isNotCivicRecord(value: Newsworthiness): boolean {
  return value.score < 0;
}

export function rankByNewsworthiness<T>(
  items: readonly T[],
  read: (item: T) => {
    title: string;
    body?: string;
    kind?: string;
    date?: string;
  }
): { item: T; rank: Newsworthiness }[] {
  return items
    .map((item) => ({
      item,
      rank: scoreNewsworthiness(read(item)),
      date: read(item).date ?? '',
    }))
    .sort((a, b) => b.rank.score - a.rank.score || b.date.localeCompare(a.date))
    .map(({ item, rank }) => ({ item, rank }));
}
