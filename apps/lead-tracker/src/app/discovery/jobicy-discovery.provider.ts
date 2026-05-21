import { Injectable, Logger } from '@nestjs/common';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadDiscoverySource, LeadSource } from '@optimistic-tanuki/models/leads-contracts';
import { readJsonResponse } from './provider-http.util';
import { ProviderSearchResult, TopicDiscoveryProvider } from './discovery.types';
import {
  createLeadEntity,
  getMatchedKeywords,
  hasExcludedTerms,
  normalizeExcludedTerms,
  normalizeTopicKeywords,
  stripHtml,
} from './source-provider.util';

type JobicyJob = {
  jobTitle?: string;
  companyName?: string;
  jobDescription?: string;
  url?: string;
};

@Injectable()
export class JobicyDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'jobicy';
  readonly supportedSources = [LeadDiscoverySource.JOBICY];
  private readonly logger = new Logger(JobicyDiscoveryProvider.name);

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const queryUrl = 'https://jobicy.com/api/v2/remote-jobs?count=100';

    try {
      const response = await fetch(queryUrl, {
        headers: { accept: 'application/json' },
      });
      const payloadResult = await readJsonResponse<{ jobs?: JobicyJob[] }>(response, 'Jobicy');
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
          const text = stripHtml(`${job.jobTitle || ''} ${job.companyName || ''} ${job.jobDescription || ''}`);
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
              seed: `jobicy:${job.url || `${job.companyName}:${job.jobTitle}`}`,
              name: job.jobTitle || 'Remote role',
              company: job.companyName || 'Jobicy opportunity',
              source: LeadSource.JOBICY,
              originalPostingUrl: job.url,
              notes: `Discovered via Jobicy. Source: ${job.url || 'n/a'}. ${stripHtml(job.jobDescription)}`,
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
      if (!candidates.length) {
        warnings.push('Jobicy returned no jobs that matched the configured topic keywords.');
      }

      return {
        candidates,
        warnings,
        queries: [queryUrl],
      };
    } catch (error) {
      this.logger.warn(`Jobicy discovery failed for topic ${topic.id}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        candidates: [],
        warnings: [`Jobicy request failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        queries: [queryUrl],
      };
    }
  }
}
