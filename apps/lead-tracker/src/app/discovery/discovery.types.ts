import { Lead, LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadDiscoverySource } from '@optimistic-tanuki/models/leads-contracts';

export type SearchResultType = 'web' | 'news';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  query: string;
  resultType: SearchResultType;
  rank: number;
}

export interface PageAnalysis {
  url: string;
  title: string;
  description: string;
  text: string;
  /**
   * Absolute outbound links found on the page. Kept because the page has
   * already been fetched and parsed: finding the company a funding article is
   * about means looking at what it links to, and re-fetching to do that would
   * pay for the same page twice.
   */
  links: string[];
}

export interface DiscoveredLeadCandidate {
  lead: Lead;
  matchedKeywords: string[];
  providerName: string;
}

export interface ProviderSearchResult {
  candidates: DiscoveredLeadCandidate[];
  warnings: string[];
  queries: string[];
}

export interface TopicDiscoveryProvider {
  providerName: string;
  supportedSources: LeadDiscoverySource[];
  search(topic: LeadTopic): Promise<ProviderSearchResult>;
}
