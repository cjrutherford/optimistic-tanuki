export type DiscoveredAgenda = {
  url: string;
  title: string;
  meetingDate: string;
};

const decodeHtml = (value: string): string =>
  value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code: string) =>
      String.fromCodePoint(Number(code))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) =>
      String.fromCodePoint(parseInt(code, 16))
    );

const textContent = (html: string): string =>
  decodeHtml(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();

const parseDate = (
  label: string
): { iso: string; time: number; label: string } | null => {
  const match =
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\b/i.exec(
      label
    );
  if (!match) return null;
  const parsed = new Date(match[0]);
  if (!Number.isFinite(parsed.getTime())) return null;
  return {
    iso: new Date(
      Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12)
    ).toISOString(),
    time: parsed.getTime(),
    label: match[0],
  };
};

/** Read the dated Agenda rows used by the Savannah and MPC public indexes. */
export const discoverAgendaLinks = (
  html: string,
  indexUrl: string,
  meetingBody: string,
  maxItems = 5
): DiscoveredAgenda[] => {
  const discovered: Array<DiscoveredAgenda & { time: number }> = [];
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(
      (match) => match[1]
    );
    if (cells.length < 2) continue;
    const date = parseDate(textContent(cells[0]));
    if (!date) continue;

    const agendaLink = [...row.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)]
      .map(([, attributes, label]) => ({
        href: /\bhref\s*=\s*["']([^"']+)["']/i.exec(attributes)?.[1],
        label: textContent(label),
      }))
      .find(
        ({ href, label }) =>
          !!href && /^agenda(?:\s|$)/i.test(label) && !/minutes/i.test(label)
      );
    if (!agendaLink?.href) continue;

    let url: string;
    try {
      url = new URL(decodeHtml(agendaLink.href), indexUrl).toString();
    } catch {
      continue;
    }

    const rowTitle = cells[1] ? textContent(cells[1]) : '';
    const rowTitleTail = rowTitle
      .replace(
        /^(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4}\s*/i,
        ''
      )
      .trim();
    const title = rowTitleTail
      ? rowTitle
      : `${date.label} ${
          meetingBody === 'planning-commission' ? 'MPC' : 'City Council'
        } Meeting`;
    discovered.push({ url, title, meetingDate: date.iso, time: date.time });
  }

  return discovered
    .sort((left, right) => right.time - left.time)
    .slice(0, Math.max(1, maxItems))
    .map(({ time: _time, ...agenda }) => agenda);
};

/** Convert the City of Savannah's Agenda Plus detail page into agenda text. */
export const agendaHtmlToText = (html: string): string =>
  decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<(?:br|hr)\b[^>]*\/?\s*>/gi, '\n')
      .replace(/<\/(?:div|p|li|tr|td|th|h[1-6]|table|section|article)>/gi, '\n')
      .replace(/<[^>]*>/g, ' ')
  )
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
