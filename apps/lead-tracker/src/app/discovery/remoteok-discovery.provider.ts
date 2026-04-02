import { Injectable, Logger } from '@nestjs/common';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadDiscoverySource, LeadSource } from '@optimistic-tanuki/models/leads-contracts';
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

type RemoteOkJob = {
  position?: string;
  company?: string;
  description?: string;
  url?: string;
  tags?: string[];
  salary_min?: number;
  salary_max?: number;
};

@Injectable()
export class RemoteOkDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'remoteok';
  readonly supportedSources = [LeadDiscoverySource.REMOTE_OK];
  private readonly logger = new Logger(RemoteOkDiscoveryProvider.name);

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);

    try {
      const response = await fetch('https://remoteok.com/api', {
        headers: { accept: 'application/json' },
      });
      const payload = (await response.json()) as RemoteOkJob[];
      const jobs = Array.isArray(payload) ? payload.filter((job) => job && job.position) : [];
      let excludedCount = 0;
      const candidates = jobs
        .map((job) => {
          const text = stripHtml(`${job.position || ''} ${job.company || ''} ${job.description || ''} ${(job.tags || []).join(' ')}`);
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
              seed: `remoteok:${job.url || `${job.company}:${job.position}`}`,
              name: job.position || 'Remote role',
              company: job.company || 'RemoteOK opportunity',
              source: LeadSource.REMOTE_OK,
              originalPostingUrl: job.url,
              notes: `Discovered via RemoteOK. Source: ${job.url || 'n/a'}. ${stripHtml(job.description)}`,
              searchKeywords: matchedKeywords,
              value: estimateCompensationValue(job.salary_max, job.salary_min),
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
        warnings.push('RemoteOK returned no jobs that matched the configured topic keywords.');
      }

      return {
        candidates,
        warnings,
        queries: ['https://remoteok.com/api'],
      };
    } catch (error) {
      this.logger.warn(`RemoteOK discovery failed for topic ${topic.id}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        candidates: [],
        warnings: [`RemoteOK request failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        queries: ['https://remoteok.com/api'],
      };
    }
  }
}
