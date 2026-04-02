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
  parseRssItems,
  stripHtml,
} from './source-provider.util';

@Injectable()
export class WeWorkRemotelyDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'weworkremotely';
  readonly supportedSources = [LeadDiscoverySource.WE_WORK_REMOTELY];
  private readonly logger = new Logger(WeWorkRemotelyDiscoveryProvider.name);

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);

    try {
      const response = await fetch('https://weworkremotely.com/remote-jobs.rss');
      const xml = await response.text();
      let excludedCount = 0;
      let staleCount = 0;
      const candidates = parseRssItems(xml)
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

          const [company] = item.title.split(':').map((part) => part.trim());
          return {
            lead: createLeadEntity({
              seed: `weworkremotely:${item.link}`,
              name: item.title,
              company: company || 'We Work Remotely opportunity',
              source: LeadSource.WE_WORK_REMOTELY,
              originalPostingUrl: item.link,
              notes: `Discovered via We Work Remotely. Source: ${item.link}. ${stripHtml(item.description)}`,
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
      if (staleCount) {
        warnings.push(
          `Skipped ${staleCount} stale We Work Remotely feed item(s) older than 120 days.`
        );
      }
      if (!candidates.length) {
        warnings.push('We Work Remotely returned no feed items that matched the configured topic keywords.');
      }

      return {
        candidates,
        warnings,
        queries: ['https://weworkremotely.com/remote-jobs.rss'],
      };
    } catch (error) {
      this.logger.warn(`We Work Remotely discovery failed for topic ${topic.id}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        candidates: [],
        warnings: [`We Work Remotely request failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        queries: ['https://weworkremotely.com/remote-jobs.rss'],
      };
    }
  }
}
