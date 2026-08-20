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

type RemotiveJob = {
  id?: number;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

@Injectable()
export class RemotiveDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'remotive';
  readonly supportedSources = [LeadDiscoverySource.REMOTIVE];
  private readonly logger = new Logger(RemotiveDiscoveryProvider.name);

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    // Remotive supports a search parameter, so the topic narrows the request
    // rather than pulling the whole board and filtering locally.
    const primaryKeyword = keywords[0] || '';
    const queryUrl = primaryKeyword
      ? `https://remotive.com/api/remote-jobs?limit=100&search=${encodeURIComponent(
          primaryKeyword
        )}`
      : 'https://remotive.com/api/remote-jobs?limit=100';

    try {
      const response = await fetch(queryUrl, {
        headers: { accept: 'application/json' },
      });
      const payloadResult = await readJsonResponse<{ jobs?: RemotiveJob[] }>(
        response,
        'Remotive'
      );
      if (!payloadResult.ok) {
        return {
          candidates: [],
          warnings: [payloadResult.warning],
          queries: [queryUrl],
        };
      }

      const jobs = Array.isArray(payloadResult.payload?.jobs)
        ? payloadResult.payload.jobs
        : [];
      let excludedCount = 0;

      const candidates = jobs
        .map((job) => {
          const text = stripHtml(
            `${job.title || ''} ${job.company_name || ''} ${
              job.category || ''
            } ${(job.tags || []).join(' ')} ${job.description || ''}`
          );
          if (hasExcludedTerms(text, excludedTerms)) {
            excludedCount += 1;
            return null;
          }

          const matchedKeywords = getMatchedKeywords(text, keywords);
          if (!matchedKeywords.length) {
            return null;
          }

          const details = [
            job.candidate_required_location,
            job.job_type,
            job.salary,
          ]
            .filter(Boolean)
            .join(' · ');

          return {
            lead: createLeadEntity({
              seed: `remotive:${job.id || job.url || job.title}`,
              name: job.title || 'Remote role',
              company: job.company_name || 'Remotive opportunity',
              source: LeadSource.REMOTIVE,
              originalPostingUrl: job.url,
              notes: `Discovered via Remotive${
                details ? ` (${details})` : ''
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
          'Remotive returned no jobs that matched the configured topic keywords.'
        );
      }

      return { candidates, warnings, queries: [queryUrl] };
    } catch (error) {
      this.logger.warn(
        `Remotive discovery failed for topic ${topic.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        candidates: [],
        warnings: ['Remotive discovery request failed.'],
        queries: [queryUrl],
      };
    }
  }
}
