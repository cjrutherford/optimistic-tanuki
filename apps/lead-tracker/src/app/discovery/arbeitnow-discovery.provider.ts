import { Injectable, Logger } from '@nestjs/common';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
  LeadDiscoverySource,
  LeadSource,
} from '@optimistic-tanuki/models/leads-contracts';
import { readJsonResponse } from './provider-http.util';
import {
  ProviderSearchResult,
  TopicDiscoveryProvider,
} from './discovery.types';
import {
  createLeadEntity,
  getMatchedKeywords,
  hasExcludedTerms,
  normalizeExcludedTerms,
  normalizeTopicKeywords,
  stripHtml,
} from './source-provider.util';

/** Arbeitnow's public job board feed. No key, no documented quota. */
type ArbeitnowJob = {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  location?: string;
};

@Injectable()
export class ArbeitnowDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'arbeitnow';
  readonly supportedSources = [LeadDiscoverySource.ARBEITNOW];
  private readonly logger = new Logger(ArbeitnowDiscoveryProvider.name);

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const queryUrl = 'https://www.arbeitnow.com/api/job-board-api';

    try {
      const response = await fetch(queryUrl, {
        headers: { accept: 'application/json' },
      });
      const payloadResult = await readJsonResponse<{ data?: ArbeitnowJob[] }>(
        response,
        'Arbeitnow'
      );
      if (!payloadResult.ok) {
        return {
          candidates: [],
          warnings: [payloadResult.warning],
          queries: [queryUrl],
        };
      }

      const jobs = Array.isArray(payloadResult.payload?.data)
        ? payloadResult.payload.data
        : [];
      let excludedCount = 0;

      const candidates = jobs
        .map((job) => {
          const text = stripHtml(
            `${job.title || ''} ${job.company_name || ''} ${
              job.description || ''
            } ${(job.tags || []).join(' ')}`
          );
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
              seed: `arbeitnow:${job.slug || job.url || job.title}`,
              name: job.title || 'Remote role',
              company: job.company_name || 'Arbeitnow opportunity',
              source: LeadSource.ARBEITNOW,
              originalPostingUrl: job.url,
              notes: `Discovered via Arbeitnow${
                job.location ? ` (${job.location})` : ''
              }. Source: ${job.url || 'n/a'}. ${stripHtml(job.description)}`,
              searchKeywords: matchedKeywords,
            }),
            matchedKeywords,
            providerName: this.providerName,
          };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> =>
          Boolean(candidate)
        );

      const warnings = excludedCount
        ? [
            `Excluded ${excludedCount} result(s) because they matched blocked terms: ${excludedTerms.join(
              ', '
            )}.`,
          ]
        : [];
      if (!candidates.length) {
        warnings.push(
          'Arbeitnow returned no jobs that matched the configured topic keywords.'
        );
      }

      return { candidates, warnings, queries: [queryUrl] };
    } catch (error) {
      this.logger.warn(
        `Arbeitnow discovery failed for topic ${topic.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        candidates: [],
        warnings: ['Arbeitnow discovery request failed.'],
        queries: [queryUrl],
      };
    }
  }
}
