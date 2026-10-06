import { Marked } from 'marked';

/**
 * A briefing's text as HTML.
 *
 * The pipeline writes Markdown with one kind of raw HTML: a collapsed
 * `<details>` block for coverage notes. Every other piece of raw HTML is
 * escaped and shown as text, so nothing in a briefing (which quotes other
 * people's headlines) becomes markup. The result is then bound through
 * Angular's `[innerHTML]`, which sanitizes it again on the server and in the
 * browser. That is deliberately not DOMPurify: it needs a DOM, and jsdom
 * can't go in the server bundle (owner, P4.2; as in apps/learning).
 *
 * The briefing's own first heading is dropped: the page's masthead already
 * names the town and the date.
 */

const LEADING_TITLE = /^#\s[^\n]*\n+/u;

/** The only raw tags a briefing may carry. */
const KEPT_TAGS = /(<\/?(?:details|summary)>)/u;

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/gu, (character) => ESCAPES[character] ?? '');
}

const briefingMarked = new Marked({ gfm: true });

briefingMarked.use({
  renderer: {
    html({ text }) {
      return text
        .split(KEPT_TAGS)
        .map((part) => (KEPT_TAGS.test(part) ? part : escapeHtml(part)))
        .join('');
    },
    // A method, not an arrow: marked binds `this` to the renderer, which is
    // where the parser for the link's own markup lives.
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      // The pipeline links a thread to its story file by relative path
      // (../../stories/…md), which the site doesn't serve, and anything that
      // isn't http(s) may run. Both are kept as text; the story's substance
      // is in the briefing's own thread.
      if (!/^https?:\/\//iu.test(href)) return text;
      // Sources open beside the briefing, and learn nothing about the reader.
      const titled = title ? ` title="${escapeHtml(title)}"` : '';
      return `<a href="${escapeHtml(
        href
      )}"${titled} target="_blank" rel="noopener noreferrer">${text}</a>`;
    },
    // A briefing carries no pictures; loading one would tell its host who is
    // reading. The description stays.
    image({ text }) {
      return escapeHtml(text);
    },
  },
});

export function renderBriefing(markdown: string): string {
  return briefingMarked.parse(markdown.replace(LEADING_TITLE, ''), {
    async: false,
  });
}
