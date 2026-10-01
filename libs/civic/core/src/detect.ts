export type Platform =
  | 'legistar'
  | 'granicus'
  | 'civicclerk'
  | 'civicplus'
  | 'apptegy'
  | 'generic';

export interface Detection {
  platform: Platform;
  adapter: string;
  hints: string[];
  suggestedConfig: Record<string, unknown>;
}

const UA = 'civic-pipeline/0.1 (civic intelligence POC)';

/** Fingerprint municipal-site HTML → platform + adapter suggestion (no network). */
export function detectFromHtml(html: string, url: string): Detection {
  const t = `${url}\n${html.slice(0, 60_000)}`;
  const has = (...markers: string[]) => markers.some((m) => t.includes(m));
  if (has('InSite.aspx', 'legistar.com', 'Legistar')) {
    const client = url.match(/https?:\/\/([^./]+)\./)?.[1];
    return {
      platform: 'legistar',
      adapter: 'legistar',
      hints: ['legistar-markers'],
      suggestedConfig: client ? { client } : {},
    };
  }
  if (has('granicus.com', 'ViewPublisher', 'MetaViewer', 'iqm2')) {
    return {
      platform: 'granicus',
      adapter: 'granicus',
      hints: ['granicus-markers'],
      suggestedConfig: {},
    };
  }
  if (has('civicclerk.com', 'civicweb', 'CivicClerk')) {
    return {
      platform: 'civicclerk',
      adapter: 'civicclerk',
      hints: ['civicclerk-markers'],
      suggestedConfig: {},
    };
  }
  if (has('agendacenter', 'civicplus.com', 'CivicPlus', 'AgendaCenter')) {
    return {
      platform: 'civicplus',
      adapter: 'http-scrape',
      hints: ['civicplus-markers'],
      suggestedConfig: { linkPattern: 'ViewFile|\\.pdf$|/Minutes/|/Agenda/' },
    };
  }
  if (has('thrillshare', 'apptegy', 'Apptegy')) {
    return {
      platform: 'apptegy',
      adapter: 'apptegy',
      hints: ['apptegy-markers'],
      suggestedConfig: {},
    };
  }
  return {
    platform: 'generic',
    adapter: 'http-scrape',
    hints: ['no-markers'],
    suggestedConfig: { linkPattern: 'Agenda|Minutes|Packet|\\.pdf$' },
  };
}

/** Fetch a town site and suggest the adapter + config. Failures return generic. */
export async function detectPlatform(url: string): Promise<Detection> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) {
      return {
        platform: 'generic',
        adapter: 'http-scrape',
        hints: [`http-${res.status}`],
        suggestedConfig: {},
      };
    }
    return detectFromHtml(await res.text(), url);
  } catch (error) {
    return {
      platform: 'generic',
      adapter: 'http-scrape',
      hints: [`fetch-error:${error instanceof Error ? error.message : error}`],
      suggestedConfig: {},
    };
  }
}
