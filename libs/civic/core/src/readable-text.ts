import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export interface ReadableArticle {
  /** Article paragraphs separated by blank lines. */
  text: string;
  title: string | null;
  byline: string | null;
  publishedTime: string | null;
  method: 'readability' | 'structure';
}

export interface EditorialAssessment {
  words: number;
  /** Share of words in complete sentences outside menu-like runs. */
  proseRatio: number;
  /** Share of words in long runs of capitalized labels ("Home News Sports Obituaries ..."). */
  menuRatio: number;
}

type Doc = ReturnType<typeof parseHTML>['document'];
type El = ReturnType<Doc['createElement']>;

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'br',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'td',
  'th',
  'tr',
  'ul',
]);
const NON_CONTENT =
  'script, style, noscript, template, svg, iframe, button, select, input, textarea, nav, header, footer, aside, form, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], [role="search"], [aria-hidden="true"], [hidden]';
const CHROME_CLASS =
  /(?:^|[\s_-])(?:nav|navbar|menu|breadcrumbs?|footer|header|masthead|sidebar|share|sharing|social|related|recommended|newsletter|subscribe|signup|comments?|advert|ads?|promo|cookie|skip-link|screen-reader-text|visually-hidden|sr-only)(?:$|[\s_-])/iu;
const CHROME_PHRASE =
  /\b(?:newsletter|sign\s?up|subscribe|subscriptions?|advertisement|sponsored|audio player|swipe or click|share (?:this|on)|follow us|skip to (?:main )?content|read more|click here|print this|you might like|most popular|related (?:stories|articles|posts)|cookies?|privacy policy|terms of (?:use|service)|all rights reserved|copyright)\b|©/iu;
const MIN_ARTICLE_WORDS = 40;

function words(value: string): string[] {
  return value.split(/\s+/u).filter(Boolean);
}

/** Text of a subtree with a line break at every block boundary, so paragraphs and list items stay separate. */
function blockText(root: El): string[] {
  const lines: string[] = [];
  let current = '';
  const flush = () => {
    const line = current.replace(/\s+/gu, ' ').trim();
    if (line) lines.push(line);
    current = '';
  };
  const walk = (node: El) => {
    for (const child of Array.from(node.childNodes) as El[]) {
      if (child.nodeType === 3) {
        current += child.textContent ?? '';
      } else if (child.nodeType === 1) {
        const block = BLOCK_TAGS.has(child.tagName.toLowerCase());
        if (block) flush();
        walk(child);
        if (block) flush();
      }
    }
  };
  walk(root);
  flush();
  return lines;
}

/** Short standalone widgets such as "Email newsletter signup" or "Getting your audio player ready...". */
function isChromeLine(line: string): boolean {
  const count = words(line).length;
  if (count > 14) return false;
  const sentence = /[.!?]["”’)]?$/u.test(line) && !/\.\.\.$|…$/u.test(line);
  return CHROME_PHRASE.test(line) && (!sentence || count <= 6);
}

/** Closing promotions publishers append after the story ("follow us on Facebook", "download our app"). */
const TRAILING_PROMO =
  /\b(?:follow (?:us|[\p{Lu}][\p{L}\d]*) on (?:facebook|x|twitter|instagram|tiktok|youtube)|download (?:the|our) [^.]{0,40}\bapp\b|preferred source on google|have a news tip|see an error that needs correction|sign up for (?:our|the) [^.]{0,40}newsletter)/iu;

function joinLines(lines: string[]): string {
  const kept: string[] = [];
  for (const line of lines) {
    if (isChromeLine(line)) continue;
    if (kept[kept.length - 1] === line) continue;
    kept.push(line);
  }
  while (kept.length > 1 && TRAILING_PROMO.test(kept[kept.length - 1]!))
    kept.pop();
  return kept.join('\n\n');
}

function linkDensity(element: El): number {
  const total = (element.textContent ?? '').replace(/\s+/gu, '').length;
  if (!total) return 0;
  const linked = Array.from(
    element.querySelectorAll('a') as ArrayLike<El>
  ).reduce(
    (sum, link) => sum + (link.textContent ?? '').replace(/\s+/gu, '').length,
    0
  );
  return linked / total;
}

function structuralText(document: Doc): string {
  for (const element of Array.from(
    document.querySelectorAll(NON_CONTENT) as ArrayLike<El>
  ))
    element.remove();
  for (const element of Array.from(
    document.querySelectorAll('[class], [id]') as ArrayLike<El>
  )) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'body' || tag === 'html' || tag === 'main' || tag === 'article')
      continue;
    if (
      CHROME_CLASS.test(
        `${element.getAttribute('class') ?? ''} ${
          element.getAttribute('id') ?? ''
        }`
      )
    )
      element.remove();
  }
  for (const element of Array.from(
    document.querySelectorAll('ul, ol, div, section, table') as ArrayLike<El>
  )) {
    if (element.isConnected && linkDensity(element) > 0.6) element.remove();
  }
  const articles = Array.from(
    document.querySelectorAll('article') as ArrayLike<El>
  ).sort((a, b) => (b.textContent ?? '').length - (a.textContent ?? '').length);
  const root =
    articles[0] ??
    document.querySelector('main') ??
    document.querySelector('[role="main"]') ??
    document.body;
  return root ? joinLines(blockText(root as El)) : '';
}

/**
 * Extract the readable article from a publisher page. Mozilla Readability
 * (the Firefox reader view engine) selects the article; a structural pass that
 * strips navigation, headers, footers, and link lists is used when Readability
 * finds nothing article-sized.
 */
export function extractReadableArticle(
  html: string,
  url: string
): ReadableArticle | null {
  const { document } = parseHTML(html);
  let parsed: ReturnType<Readability['parse']> = null;
  try {
    parsed = new Readability(document as unknown as Document, {
      charThreshold: 200,
    }).parse();
  } catch {
    parsed = null;
  }
  if (parsed?.content) {
    const { document: content } = parseHTML(
      `<!doctype html><html><body>${parsed.content}</body></html>`
    );
    const text = joinLines(blockText(content.body as El));
    if (words(text).length >= MIN_ARTICLE_WORDS) {
      return {
        text,
        title: parsed.title?.trim() || null,
        byline: parsed.byline?.trim() || null,
        publishedTime: parsed.publishedTime?.trim() || null,
        method: 'readability',
      };
    }
  }
  const { document: fresh } = parseHTML(html);
  const text = structuralText(fresh);
  if (!text) return null;
  void url;
  return {
    text,
    title: fresh.querySelector('title')?.textContent?.trim() || null,
    byline: null,
    publishedTime: null,
    method: 'structure',
  };
}

/** Readable text of an arbitrary HTML page (index pages, notices) without article selection. */
export function readablePageText(html: string): string {
  return structuralText(parseHTML(html).document);
}

const CONNECTORS = new Set(['&', 'of', 'and', 'the', 'to', 'for', 'in', 'a']);

function isLabelToken(token: string): boolean {
  return (
    /^[\p{Lu}\d][\p{L}\d&'’-]*$/u.test(token) ||
    CONNECTORS.has(token.toLowerCase())
  );
}

/**
 * Measure how much of a text is prose rather than page chrome. Navigation
 * menus and link lists are long runs of capitalized labels without sentence
 * punctuation; article text is mostly complete sentences.
 */
export function assessEditorialText(value: string): EditorialAssessment {
  const tokens = words(value);
  if (!tokens.length) return { words: 0, proseRatio: 0, menuRatio: 0 };
  const inMenu = new Array<boolean>(tokens.length).fill(false);
  let start = 0;
  const closeRun = (end: number) => {
    const labels = tokens
      .slice(start, end)
      .filter((token) => !CONNECTORS.has(token.toLowerCase())).length;
    if (labels >= 8)
      for (let index = start; index < end; index += 1) inMenu[index] = true;
  };
  for (let index = 0; index <= tokens.length; index += 1) {
    const token = tokens[index];
    const continues =
      token !== undefined &&
      isLabelToken(token) &&
      !/[.!?,;:]["”’)]?$/u.test(tokens[index - 1] ?? '');
    if (!continues) {
      closeRun(index);
      start = index + 1;
    }
  }
  // Paragraph breaks (from extraction) make each line a unit; collapsed text
  // is split at sentence punctuation instead. Teasers cut off with an
  // ellipsis are listing entries, not prose.
  const terminal = (token: string) =>
    /[.!?]["”’)]?$/u.test(token) && !/(?:\.\.\.|…)["”’)]?$/u.test(token);
  const lineEnds = new Set<number>();
  if (value.includes('\n')) {
    let offset = 0;
    for (const line of value.split(/\n+/u)) {
      const count = words(line).length;
      if (count) lineEnds.add(offset + count - 1);
      offset += count;
    }
  }
  let prose = 0;
  let sentenceStart = 0;
  for (let index = 0; index < tokens.length; index += 1) {
    const boundary = lineEnds.size
      ? lineEnds.has(index)
      : /[.!?…]["”’)]?$/u.test(tokens[index]!);
    if (!boundary && index !== tokens.length - 1) continue;
    const plain = inMenu
      .slice(sentenceStart, index + 1)
      .filter((menu) => !menu).length;
    if (terminal(tokens[index]!) && plain >= 6) prose += plain;
    sentenceStart = index + 1;
  }
  const menu = inMenu.filter(Boolean).length;
  return {
    words: tokens.length,
    proseRatio: prose / tokens.length,
    menuRatio: menu / tokens.length,
  };
}

/** A fetched article body is usable evidence only when it is article-sized and mostly prose. */
export function isReadableArticleText(value: string): boolean {
  const assessment = assessEditorialText(value);
  return (
    assessment.words >= MIN_ARTICLE_WORDS &&
    assessment.proseRatio >= 0.6 &&
    assessment.menuRatio <= 0.15
  );
}
