import { LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { normalizeTopicTerms } from './provider-result-analysis.util';

type QueryRecipe = {
  siteScopes: string[];
  contextSignals: string[];
};

const quoteIfNeeded = (term: string): string =>
  /\s/.test(term) ? `"${term}"` : term;

const deriveTopicSearchTerms = (topic: LeadTopic): string[] => {
  const terms = normalizeTopicTerms([
    topic.name || '',
    ...(topic.keywords || []),
    ...(topic.painPoints || []),
    ...(topic.targetCompanies || []),
    ...(topic.googleMapsTypes || []),
    topic.buyerPersona || '',
    topic.valueProposition || '',
    topic.description || '',
  ]);

  const phraseTerms = terms.filter((term) => term.includes(' '));
  const singleTerms = terms.filter((term) => !term.includes(' '));
  return [...phraseTerms, ...singleTerms].slice(0, 6);
};

export const buildProviderQueries = (
  topic: LeadTopic,
  recipe: QueryRecipe,
  maxQueries: number
): string[] => {
  const searchTerms = deriveTopicSearchTerms(topic);
  const normalizedMaxQueries = Math.max(1, maxQueries);
  const termsToUse = searchTerms.slice(0, 3);
  const fallbackQuery = [
    recipe.siteScopes[0],
    ...searchTerms.slice(0, 3).map((term) => quoteIfNeeded(term)),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  const queries = new Set<string>();
  // A recipe may legitimately have no site scopes — funding-news searches the
  // news feed at large rather than pinning to one domain. Iterating the raw
  // array would skip the body entirely and silently drop every context signal.
  const scopes = recipe.siteScopes.length ? recipe.siteScopes : [''];
  for (const term of termsToUse) {
    for (const scope of scopes) {
      for (const signal of recipe.contextSignals) {
        queries.add(
          [scope, quoteIfNeeded(term), signal].filter(Boolean).join(' ').trim()
        );
        if (queries.size >= normalizedMaxQueries) {
          return Array.from(queries);
        }
      }

      queries.add(
        [scope, quoteIfNeeded(term)].filter(Boolean).join(' ').trim()
      );
      if (queries.size >= normalizedMaxQueries) {
        return Array.from(queries);
      }
    }
  }

  if (fallbackQuery) {
    queries.add(fallbackQuery);
  }

  return Array.from(queries).slice(0, normalizedMaxQueries);
};

export const getProviderQueryRecipe = (
  providerName: 'funding-news',
  intent: LeadTopicDiscoveryIntent | string | null | undefined
): QueryRecipe => {
  const normalizedIntent = intent || LeadTopicDiscoveryIntent.SERVICE_BUYERS;

  // The indeed and clutch recipes were removed with their providers: both sites
  // answer server requests with HTTP 403, so no query against them could ever
  // return a readable result.
  //
  // Funding news is no longer scoped to crunchbase.com. It reads a news feed,
  // and pinning it to one domain was what made the old source misrepresent
  // where its data came from — while also discarding most of the signal.
  void providerName;

  return {
    siteScopes: [],
    contextSignals:
      normalizedIntent === LeadTopicDiscoveryIntent.SERVICE_BUYERS
        ? ['funding', 'raised', 'series', '"seed round"']
        : ['funding', 'hiring', 'expansion'],
  };
};
