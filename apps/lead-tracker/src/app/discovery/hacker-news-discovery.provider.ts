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

type HnStory = { objectID?: string; title?: string; created_at?: string };
type HnComment = {
  objectID?: string;
  author?: string;
  comment_text?: string;
  story_id?: number;
};

/**
 * Hacker News "Ask HN: Who is hiring?" — one thread per month, whose top-level
 * comments are individual job posts.
 *
 * Searching HN comments at large would return arbitrary discussion, so this
 * resolves the current monthly thread first and only reads comments belonging
 * to it.
 */
@Injectable()
export class HackerNewsDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'hackernews';
  readonly supportedSources = [LeadDiscoverySource.HACKER_NEWS];
  private readonly logger = new Logger(HackerNewsDiscoveryProvider.name);

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const queries: string[] = [];

    try {
      const storyUrl =
        'https://hn.algolia.com/api/v1/search?tags=story,author_whoishiring&query=hiring&hitsPerPage=5';
      queries.push(storyUrl);

      const storyResponse = await fetch(storyUrl, {
        headers: { accept: 'application/json' },
      });
      const storyResult = await readJsonResponse<{ hits?: HnStory[] }>(
        storyResponse,
        'Hacker News'
      );
      if (!storyResult.ok) {
        return {
          candidates: [],
          warnings: [storyResult.warning],
          queries,
        };
      }

      const thread = (storyResult.payload?.hits || []).find((hit) =>
        /who is hiring/i.test(hit.title || '')
      );
      if (!thread?.objectID) {
        return {
          candidates: [],
          warnings: [
            'Could not locate a current "Ask HN: Who is hiring?" thread.',
          ],
          queries,
        };
      }

      const commentsUrl = `https://hn.algolia.com/api/v1/search?tags=comment,story_${thread.objectID}&hitsPerPage=100`;
      queries.push(commentsUrl);

      const commentsResponse = await fetch(commentsUrl, {
        headers: { accept: 'application/json' },
      });
      const commentsResult = await readJsonResponse<{ hits?: HnComment[] }>(
        commentsResponse,
        'Hacker News'
      );
      if (!commentsResult.ok) {
        return {
          candidates: [],
          warnings: [commentsResult.warning],
          queries,
        };
      }

      let excludedCount = 0;
      const candidates = (commentsResult.payload?.hits || [])
        .map((comment) => {
          const text = stripHtml(comment.comment_text || '');
          if (!text) {
            return null;
          }
          if (hasExcludedTerms(text, excludedTerms)) {
            excludedCount += 1;
            return null;
          }

          const matchedKeywords = getMatchedKeywords(text, keywords);
          if (!matchedKeywords.length) {
            return null;
          }

          const url = `https://news.ycombinator.com/item?id=${comment.objectID}`;
          return {
            lead: createLeadEntity({
              seed: `hackernews:${comment.objectID}`,
              // A post's first line is conventionally "Company | Role | Location".
              name: this.deriveRoleName(text),
              company: this.deriveCompanyName(text, comment.author),
              source: LeadSource.HACKER_NEWS,
              originalPostingUrl: url,
              notes: `Discovered via HN "${thread.title}". Source: ${url}. ${text}`,
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
          'The current HN hiring thread had no posts matching the configured topic keywords.'
        );
      }

      return { candidates, warnings, queries };
    } catch (error) {
      this.logger.warn(
        `Hacker News discovery failed for topic ${topic.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        candidates: [],
        warnings: ['Hacker News discovery request failed.'],
        queries,
      };
    }
  }

  /** Posts are conventionally "Company | Role | Location | ..." on the first line. */
  private deriveCompanyName(text: string, author?: string): string {
    const [firstLine] = text.split('\n');
    const [company] = (firstLine || '').split('|');
    const trimmed = (company || '').trim();
    if (trimmed && trimmed.length <= 80) {
      return trimmed;
    }
    return author ? `HN post by ${author}` : 'HN hiring post';
  }

  private deriveRoleName(text: string): string {
    const [firstLine] = text.split('\n');
    const parts = (firstLine || '').split('|').map((part) => part.trim());
    const role = parts[1];
    if (role && role.length <= 100) {
      return role;
    }
    return (firstLine || 'Hiring post').slice(0, 100);
  }
}
