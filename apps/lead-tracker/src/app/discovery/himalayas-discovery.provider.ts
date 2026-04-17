import { Injectable, Logger } from '@nestjs/common';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadDiscoverySource, LeadSource } from '@optimistic-tanuki/models/leads-contracts';
import { readJsonResponse } from './provider-http.util';
import { ProviderSearchResult, TopicDiscoveryProvider } from './discovery.types';
import {
  createLeadEntity,
  estimateCompensationValue,
  getMatchedKeywords,
  hasExcludedTerms,
  normalizeExcludedTerms,
  normalizeTopicKeywords,
  stripHtml,
} from './source-provider.util';

type HimalayasJob = {
  title?: string;
  companyName?: string;
  description?: string;
  applicationLink?: string;
  guid?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  currency?: string;
};

@Injectable()
export class HimalayasDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'himalayas';
  readonly supportedSources = [LeadDiscoverySource.HIMALAYAS];
  private readonly logger = new Logger(HimalayasDiscoveryProvider.name);

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const queryUrl = 'https://himalayas.app/jobs/api?limit=100&offset=0';

    try {
      const response = await fetch(queryUrl, {
        headers: { accept: 'application/json' },
      });
      const payloadResult = await readJsonResponse<{ jobs?: HimalayasJob[] }>(response, 'Himalayas');
      if (!payloadResult.ok) {
        const { warning } = payloadResult;
        return {
          candidates: [],
          warnings: [warning],
          queries: [queryUrl],
        };
      }

      const payload = payloadResult.payload;
      const jobs = Array.isArray(payload?.jobs) ? payload.jobs : [];
      let excludedCount = 0;
      const candidates = jobs
        .map((job) => {
          const text = stripHtml(`${job.title || ''} ${job.companyName || ''} ${job.description || ''}`);
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
              seed: `himalayas:${job.guid || job.applicationLink || `${job.companyName}:${job.title}`}`,
              name: job.title || 'Remote role',
              company: job.companyName || 'Himalayas opportunity',
              source: LeadSource.HIMALAYAS,
              originalPostingUrl: job.applicationLink,
              notes: `Discovered via Himalayas. Source: ${job.applicationLink || 'n/a'}. ${stripHtml(job.description)}`,
              searchKeywords: matchedKeywords,
              value: estimateCompensationValue(job.maxSalary, job.minSalary),
            }),
            matchedKeywords,
            providerName: this.providerName,
          };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

      const warnings = excludedCount
        ? [`Excluded ${excludedCount} result(s) because they matched blocked terms: ${excludedTerms.join(', ')}.`]
        : [];
      if (!candidates.length) {
        warnings.push('Himalayas returned no jobs that matched the configured topic keywords.');
      }

      return {
        candidates,
        warnings,
        queries: [queryUrl],
      };
    } catch (error) {
      this.logger.warn(`Himalayas discovery failed for topic ${topic.id}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        candidates: [],
        warnings: [`Himalayas request failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        queries: [queryUrl],
      };
    }
  }
}
