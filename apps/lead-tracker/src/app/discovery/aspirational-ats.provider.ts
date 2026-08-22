import { Injectable, Logger } from '@nestjs/common';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
  LeadDiscoverySource,
  LeadSource,
} from '@optimistic-tanuki/models/leads-contracts';
import { AspirationalAtsProvider } from '@optimistic-tanuki/leads-contracts';
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
import {
  AtsPosting,
  boardUrl,
  companiesFor,
  parseGreenhousePostings,
  parseLeverPostings,
} from './ats-board.util';

/**
 * Watches the job boards of specific employers the user wants to work for.
 *
 * These are deliberately narrow: they do not broadcast across a market, they
 * check a handful of named companies. Most runs will find nothing, and that is
 * the expected outcome rather than a fault — which is why an empty result here
 * is reported as "no openings right now" rather than as a discovery failure.
 */
abstract class AspirationalAtsDiscoveryProvider
  implements TopicDiscoveryProvider
{
  abstract readonly providerName: string;
  abstract readonly supportedSources: LeadDiscoverySource[];
  protected abstract readonly ats: AspirationalAtsProvider;
  protected abstract readonly leadSource: LeadSource;
  protected abstract readonly displayName: string;
  protected abstract parse(payload: unknown): AtsPosting[];

  protected readonly logger = new Logger(AspirationalAtsDiscoveryProvider.name);

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const companies = companiesFor(this.ats, topic.aspirationalCompanies);
    const queries: string[] = [];

    if (!companies.length) {
      return {
        candidates: [],
        warnings: [
          `${this.displayName} watches companies you name. Add at least one to this topic to use it.`,
        ],
        queries,
      };
    }

    const warnings: string[] = [];
    const candidates: ProviderSearchResult['candidates'] = [];
    let excludedCount = 0;
    let companiesWithNoOpenings = 0;

    for (const company of companies) {
      const url = boardUrl(this.ats, company.token);
      queries.push(url);

      try {
        const response = await fetch(url, {
          headers: { accept: 'application/json' },
        });

        if (response.status === 404) {
          // The token was verified when it was added, so a 404 now means the
          // board moved or closed — worth saying plainly.
          warnings.push(
            `${company.label} no longer has a ${this.displayName} board at "${company.token}".`
          );
          continue;
        }
        if (!response.ok) {
          warnings.push(
            `${company.label} returned HTTP ${response.status} from ${this.displayName}.`
          );
          continue;
        }

        const postings = this.parse(await response.json());
        if (!postings.length) {
          companiesWithNoOpenings += 1;
          continue;
        }

        let matchedForCompany = 0;
        for (const posting of postings) {
          const text = stripHtml(
            `${posting.title} ${posting.location || ''} ${
              posting.description || ''
            }`
          );
          if (hasExcludedTerms(text, excludedTerms)) {
            excludedCount += 1;
            continue;
          }

          const matchedKeywords = getMatchedKeywords(text, keywords);
          if (!matchedKeywords.length) {
            continue;
          }

          matchedForCompany += 1;
          candidates.push({
            lead: createLeadEntity({
              seed: `${this.providerName}:${company.token}:${posting.id}`,
              name: posting.title,
              company: company.label,
              source: this.leadSource,
              originalPostingUrl: posting.url,
              notes: `Dream-company opening at ${company.label} via ${
                this.displayName
              }${posting.location ? ` (${posting.location})` : ''}. Source: ${
                posting.url || 'n/a'
              }. ${stripHtml(posting.description)}`,
              searchKeywords: matchedKeywords,
            }),
            matchedKeywords,
            providerName: this.providerName,
          });
        }

        if (!matchedForCompany) {
          companiesWithNoOpenings += 1;
        }
      } catch (error) {
        this.logger.warn(
          `${this.displayName} discovery failed for ${company.label}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        warnings.push(
          `Could not reach ${this.displayName} for ${company.label}.`
        );
      }
    }

    if (excludedCount) {
      warnings.push(
        `Excluded ${excludedCount} result(s) because they matched blocked terms: ${excludedTerms.join(
          ', '
        )}.`
      );
    }
    if (!candidates.length) {
      // Deliberately not phrased as a failure: a dream company simply may not
      // be hiring, which is the normal case for this kind of source.
      warnings.push(
        `No matching openings right now at ${
          companiesWithNoOpenings || companies.length
        } watched ${this.displayName} compan${
          companies.length === 1 ? 'y' : 'ies'
        }. These are long shots — it is normal for them to be quiet.`
      );
    }

    return { candidates, warnings, queries };
  }
}

@Injectable()
export class GreenhouseDiscoveryProvider extends AspirationalAtsDiscoveryProvider {
  readonly providerName = 'greenhouse';
  readonly supportedSources = [LeadDiscoverySource.GREENHOUSE];
  protected readonly ats: AspirationalAtsProvider = 'greenhouse';
  protected readonly leadSource = LeadSource.GREENHOUSE;
  protected readonly displayName = 'Greenhouse';
  protected parse(payload: unknown): AtsPosting[] {
    return parseGreenhousePostings(payload);
  }
}

@Injectable()
export class LeverDiscoveryProvider extends AspirationalAtsDiscoveryProvider {
  readonly providerName = 'lever';
  readonly supportedSources = [LeadDiscoverySource.LEVER];
  protected readonly ats: AspirationalAtsProvider = 'lever';
  protected readonly leadSource = LeadSource.LEVER;
  protected readonly displayName = 'Lever';
  protected parse(payload: unknown): AtsPosting[] {
    return parseLeverPostings(payload);
  }
}
