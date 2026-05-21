import { PageAnalysis, SearchResult } from './discovery.types';

export const normalizeTopicTerms = (values: string[]): string[] => {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    )
  );
};

export const buildAnalysisHaystack = (
  result: SearchResult,
  pageAnalysis?: PageAnalysis | null
): string => {
  return [
    result.title,
    result.snippet,
    result.url,
    pageAnalysis?.title,
    pageAnalysis?.description,
    pageAnalysis?.text,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
};

export const getMatchedTerms = (haystack: string, terms: string[]): string[] => {
  return terms.filter((term) => haystack.includes(term));
};

export const scoreMatches = (
  haystack: string,
  matchedTerms: string[],
  requiredSignals: string[],
  optionalSignals: string[]
): number => {
  let score = matchedTerms.length * 8;

  requiredSignals.forEach((signal) => {
    if (haystack.includes(signal)) {
      score += 10;
    }
  });

  optionalSignals.forEach((signal) => {
    if (haystack.includes(signal)) {
      score += 4;
    }
  });

  return score;
};

export const truncateText = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`;
};