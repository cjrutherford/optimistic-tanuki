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

type MuseJob = {
  id?: number;
  name?: string;
  contents?: string;
  publication_date?: string;
  locations?: Array<{ name?: string }>;
  levels?: Array<{ name?: string }>;
  company?: { name?: string };
  refs?: { landing_page?: string };
};

@Injectable()
export class TheMuseDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'themuse';
  readonly supportedSources = [LeadDiscoverySource.THE_MUSE];
  private readonly logger = new Logger(TheMuseDiscoveryProvider.name);

  /** Pages are 20 results each, so a couple of pages is enough to filter from. */
  private readonly pagesToFetch = 2;

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const queries: string[] = [];

    try {
      const jobs: MuseJob[] = [];
      const warnings: string[] = [];

      for (let page = 1; page <= this.pagesToFetch; page++) {
        const queryUrl = `https://www.themuse.com/api/public/jobs?page=${page}`;
        queries.push(queryUrl);

        const response = await fetch(queryUrl, {
          headers: { accept: 'application/json' },
        });
        const payloadResult = await readJsonResponse<{ results?: MuseJob[] }>(
          response,
          'The Muse'
        );
        if (!payloadResult.ok) {
          warnings.push(payloadResult.warning);
          break;
        }
        const results = payloadResult.payload?.results;
        if (!Array.isArray(results) || !results.length) {
          break;
        }
        jobs.push(...results);
      }

      let excludedCount = 0;
      const candidates = jobs
        .map((job) => {
          const locations = (job.locations || [])
            .map((location) => location.name)
            .filter(Boolean)
            .join(', ');
          const text = stripHtml(
            `${job.name || ''} ${job.company?.name || ''} ${
              job.contents || ''
            } ${locations}`
          );
          if (hasExcludedTerms(text, excludedTerms)) {
            excludedCount += 1;
            return null;
          }

          const matchedKeywords = getMatchedKeywords(text, keywords);
          if (!matchedKeywords.length) {
            return null;
          }

          const url = job.refs?.landing_page;
          const level = (job.levels || [])
            .map((entry) => entry.name)
            .filter(Boolean)
            .join(', ');

          return {
            lead: createLeadEntity({
              seed: `themuse:${job.id || url || job.name}`,
              name: job.name || 'Open role',
              company: job.company?.name || 'The Muse opportunity',
              source: LeadSource.THE_MUSE,
              originalPostingUrl: url,
              notes: `Discovered via The Muse${
                locations ? ` (${locations})` : ''
              }${level ? ` · ${level}` : ''}. Source: ${
                url || 'n/a'
              }. ${stripHtml(job.contents)}`,
              searchKeywords: matchedKeywords,
            }),
            matchedKeywords,
            providerName: this.providerName,
          };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> =>
          Boolean(candidate)
        );

      if (excludedCount) {
        warnings.push(
          `Excluded ${excludedCount} result(s) because they matched blocked terms: ${excludedTerms.join(
            ', '
          )}.`
        );
      }
      if (!candidates.length) {
        warnings.push(
          'The Muse returned no jobs that matched the configured topic keywords.'
        );
      }

      return { candidates, warnings, queries };
    } catch (error) {
      this.logger.warn(
        `The Muse discovery failed for topic ${topic.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        candidates: [],
        warnings: ['The Muse discovery request failed.'],
        queries,
      };
    }
  }
}
