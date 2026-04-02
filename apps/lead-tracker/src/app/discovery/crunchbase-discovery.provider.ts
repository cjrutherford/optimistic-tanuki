import { Injectable, Logger } from '@nestjs/common';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadDiscoverySource, LeadSource } from '@optimistic-tanuki/models/leads-contracts';
import { ProviderSearchResult, SearchResult, TopicDiscoveryProvider } from './discovery.types';
import { buildAnalysisHaystack, getMatchedTerms, normalizeTopicTerms, truncateText } from './provider-result-analysis.util';
import { SearchAcquisitionService } from './search-acquisition.service';
import { createLeadEntity, estimateCompensationValue, hasExcludedTerms, normalizeExcludedTerms } from './source-provider.util';
import { buildProviderQueries, getProviderQueryRecipe } from './provider-query.util';

@Injectable()
export class CrunchbaseDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'crunchbase';
  readonly supportedSources = [LeadDiscoverySource.CRUNCHBASE];
  private readonly logger = new Logger(CrunchbaseDiscoveryProvider.name);

  constructor(private readonly searchAcquisitionService: SearchAcquisitionService) {}

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicTerms([...(topic.keywords || []), topic.name || '']).slice(0, 4);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const queries = buildProviderQueries(
      topic,
      getProviderQueryRecipe('crunchbase', topic.discoveryIntent),
      this.searchAcquisitionService.getMaxQueriesPerProvider()
    );

    try {
      const rawResults = await Promise.all(queries.map((query) => this.searchAcquisitionService.searchNews(query)));
      const results = rawResults.flat().filter((result) => /crunchbase\.com\//i.test(result.url));
      const analyzed = await Promise.all(results.map(async (result) => this.mapResult(result, keywords, excludedTerms)));
      const candidates = analyzed.filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

      return {
        candidates,
        warnings: candidates.length ? [] : ['Crunchbase search returned no analyzable funding leads for the configured topic.'],
        queries,
      };
    } catch (error) {
      this.logger.warn(`Crunchbase discovery failed for topic ${topic.id}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        candidates: [],
        warnings: [`Crunchbase search failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        queries,
      };
    }
  }

  private async mapResult(result: SearchResult, keywords: string[], excludedTerms: string[]) {
    const pageAnalysis = await this.searchAcquisitionService.analyzePage(result.url);
    const haystack = buildAnalysisHaystack(result, pageAnalysis);
    if (hasExcludedTerms(haystack, excludedTerms)) {
      return null;
    }
    const matchedKeywords = getMatchedTerms(haystack, keywords);
    if (!matchedKeywords.length) {
      return null;
    }

    const title = (pageAnalysis?.title || result.title).replace(/\s*\|\s*Crunchbase.*$/i, '').trim();
    return {
      lead: createLeadEntity({
        seed: `crunchbase:${result.url}`,
        name: `${title} - Tech Development`,
        company: title || 'Crunchbase company',
        source: LeadSource.CRUNCHBASE,
        originalPostingUrl: result.url,
        notes: `Discovered via Crunchbase funding search. Source: ${result.url}. ${truncateText(pageAnalysis?.description || result.snippet || '', 260)}`,
        searchKeywords: matchedKeywords,
        value: estimateCompensationValue(pageAnalysis?.description, result.snippet),
      }),
      matchedKeywords,
      providerName: this.providerName,
    };
  }
}
