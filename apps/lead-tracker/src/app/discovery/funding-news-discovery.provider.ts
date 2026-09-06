import { Injectable, Logger } from '@nestjs/common';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
  LeadDiscoverySource,
  LeadSource,
} from '@optimistic-tanuki/models/leads-contracts';
import {
  ProviderSearchResult,
  SearchResult,
  TopicDiscoveryProvider,
} from './discovery.types';
import {
  buildAnalysisHaystack,
  truncateText,
} from './provider-result-analysis.util';
import { SearchAcquisitionService } from './search-acquisition.service';
import {
  createLeadEntity,
  hasExcludedTerms,
  normalizeExcludedTerms,
} from './source-provider.util';
import {
  extractCompanyFromHeadline,
  extractFundingAmount,
  stripPublisherSuffix,
} from './funding-headline.util';
import { buildTopicMatcher, TopicMatcher } from './topic-matcher.util';
import {
  buildProviderQueries,
  getProviderQueryRecipe,
} from './provider-query.util';

@Injectable()
export class FundingNewsDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'funding-news';
  readonly supportedSources = [LeadDiscoverySource.FUNDING_NEWS];
  private readonly logger = new Logger(FundingNewsDiscoveryProvider.name);

  constructor(
    private readonly searchAcquisitionService: SearchAcquisitionService
  ) {}

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    // This provider serves the service-buyer topics, whose keywords are the
    // longest prose of any topic the onboarding generates. Taking the first
    // four of them literally meant testing news articles against four
    // sentences, which no article ever contained.
    const matcher = buildTopicMatcher(topic);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const queries = buildProviderQueries(
      topic,
      getProviderQueryRecipe('funding-news', topic.discoveryIntent),
      this.searchAcquisitionService.getMaxQueriesPerProvider()
    );

    try {
      const rawResults = await Promise.all(
        queries.map((query) => this.searchAcquisitionService.searchNews(query))
      );
      // Deliberately unfiltered by domain. The old source pinned this to
      // crunchbase.com, which both misdescribed the data and threw away most of
      // the funding coverage the feed actually returns.
      const results = rawResults.flat();
      const analyzed = await Promise.all(
        results.map(async (result) =>
          this.mapResult(result, matcher, excludedTerms)
        )
      );
      const candidates = analyzed.filter(
        (candidate): candidate is NonNullable<typeof candidate> =>
          Boolean(candidate)
      );

      return {
        candidates,
        warnings: candidates.length
          ? []
          : [
              'Funding news search returned no analyzable funding leads for the configured topic.',
            ],
        queries,
      };
    } catch (error) {
      this.logger.warn(
        `Funding news discovery failed for topic ${topic.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        candidates: [],
        warnings: [
          `Funding news search failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        ],
        queries,
      };
    }
  }

  private async mapResult(
    result: SearchResult,
    matcher: TopicMatcher,
    excludedTerms: string[]
  ) {
    const pageAnalysis = await this.searchAcquisitionService.analyzePage(
      result.url
    );
    const haystack = buildAnalysisHaystack(result, pageAnalysis);
    if (hasExcludedTerms(haystack, excludedTerms)) {
      return null;
    }
    const matchedKeywords = matcher.match(haystack);
    if (!matchedKeywords.length) {
      return null;
    }

    const headline = stripPublisherSuffix(pageAnalysis?.title || result.title);
    const company = extractCompanyFromHeadline(headline);
    // Stated, not converted. The raise is the company's money, and anything
    // numeric in this position ends up rendered as the value of a deal to the
    // user — which is how a $50M round became a $50,000,000 lead.
    const fundingAmount = extractFundingAmount(
      `${headline} ${result.snippet || ''} ${pageAnalysis?.description || ''}`
    );

    return {
      lead: createLeadEntity({
        seed: `funding-news:${result.url}`,
        // The headline is a fair name for the lead — it is what was found.
        // It is not a company, so `company` stays unset unless one was read.
        name: company || headline || 'Funding announcement',
        company: company || undefined,
        source: LeadSource.FUNDING_NEWS,
        originalPostingUrl: result.url,
        notes: [
          `Discovered via funding-news search. Source: ${result.url}.`,
          fundingAmount ? `Reported raise: ${fundingAmount}.` : '',
          company ? '' : 'No company name could be read from the headline.',
          truncateText(pageAnalysis?.description || result.snippet || '', 260),
        ]
          .filter(Boolean)
          .join(' '),
        searchKeywords: matchedKeywords,
        // Left unset: a buyer lead's value is the user's own engagement size,
        // applied when the lead is persisted.
        value: 0,
      }),
      matchedKeywords,
      providerName: this.providerName,
    };
  }
}
