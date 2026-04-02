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
  for (const term of termsToUse) {
    for (const scope of recipe.siteScopes) {
      for (const signal of recipe.contextSignals) {
        queries.add(
          [scope, quoteIfNeeded(term), signal].filter(Boolean).join(' ').trim()
        );
        if (queries.size >= normalizedMaxQueries) {
          return Array.from(queries);
        }
      }

      queries.add([scope, quoteIfNeeded(term)].filter(Boolean).join(' ').trim());
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
  providerName: 'indeed' | 'clutch' | 'crunchbase',
  intent: LeadTopicDiscoveryIntent | string | null | undefined
): QueryRecipe => {
  const normalizedIntent =
    intent || LeadTopicDiscoveryIntent.JOB_OPENINGS;

  if (providerName === 'indeed') {
    return {
      siteScopes: ['site:indeed.com/viewjob', 'site:indeed.com/jobs'],
      contextSignals:
        normalizedIntent === LeadTopicDiscoveryIntent.JOB_OPENINGS
          ? ['remote', '"work from home"', 'hiring']
          : ['remote', 'contractor'],
    };
  }

  if (providerName === 'clutch') {
    return {
      siteScopes: ['site:clutch.co', 'site:clutch.co/agencies', 'site:clutch.co/profile'],
      contextSignals:
        normalizedIntent === LeadTopicDiscoveryIntent.SERVICE_BUYERS
          ? ['"client reviews"', 'agency', 'services']
          : ['company', 'development'],
    };
  }

  return {
    siteScopes: ['site:crunchbase.com/organization', 'site:crunchbase.com'],
    contextSignals: ['funding', 'raised', 'series'],
  };
};
