import { Injectable, Logger } from '@nestjs/common';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadDiscoverySource, LeadSource } from '@optimistic-tanuki/models/leads-contracts';
import { ProviderSearchResult, TopicDiscoveryProvider } from './discovery.types';
import {
  createLeadEntity,
  getMatchedKeywords,
  hasExcludedTerms,
  normalizeExcludedTerms,
  isRecentPublication,
  normalizeTopicKeywords,
  parseJustRemoteEmbeddedJobs,
  parseRssItems,
  stripHtml,
} from './source-provider.util';

@Injectable()
export class JustRemoteDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'justremote';
  readonly supportedSources = [LeadDiscoverySource.JUST_REMOTE];
  private readonly logger = new Logger(JustRemoteDiscoveryProvider.name);

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);

    try {
      const response = await fetch('https://justremote.co/jobs.xml');
      const body = await response.text();
      const feedItems = /<rss\b/i.test(body)
        ? parseRssItems(body)
        : parseJustRemoteEmbeddedJobs(body);
      let excludedCount = 0;
      let staleCount = 0;
      const candidates = feedItems
        .filter((item) => {
          const isRecent = isRecentPublication(item.pubDate);
          if (!isRecent) {
            staleCount += 1;
          }
          return isRecent;
        })
        .map((item) => {
          const text = stripHtml(`${item.title} ${item.description}`);
          if (hasExcludedTerms(text, excludedTerms)) {
            excludedCount += 1;
            return null;
          }
          const matchedKeywords = getMatchedKeywords(text, keywords);
          if (!matchedKeywords.length) {
            return null;
          }

          return {
            lead: createLeadEntity({
              seed: `justremote:${item.link}`,
              name: item.title,
              company:
                'companyName' in item
                  ? item.companyName
                  : 'JustRemote opportunity',
              source: LeadSource.JUST_REMOTE,
              originalPostingUrl: item.link,
              notes: `Discovered via JustRemote. Source: ${item.link}. ${stripHtml(item.description)}`,
              searchKeywords: matchedKeywords,
            }),
            matchedKeywords,
            providerName: this.providerName,
          };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

      const warnings = excludedCount
        ? [`Excluded ${excludedCount} result(s) because they matched blocked terms: ${excludedTerms.join(', ')}.`]
        : [];
      if (!/<rss\b/i.test(body) && !feedItems.length) {
        warnings.push(
          'JustRemote no longer returned an RSS feed, and no embedded job data could be recovered from the HTML response.'
        );
      }
      if (staleCount) {
        warnings.push(
          `Skipped ${staleCount} stale JustRemote feed item(s) older than 120 days.`
        );
      }
      if (!candidates.length) {
        warnings.push('JustRemote returned no feed items that matched the configured topic keywords.');
      }

      return {
        candidates,
        warnings,
        queries: ['https://justremote.co/jobs.xml'],
      };
    } catch (error) {
      this.logger.warn(`JustRemote discovery failed for topic ${topic.id}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        candidates: [],
        warnings: [`JustRemote request failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        queries: ['https://justremote.co/jobs.xml'],
      };
    }
  }
}
