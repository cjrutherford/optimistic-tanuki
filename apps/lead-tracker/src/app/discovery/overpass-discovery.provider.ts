import { Injectable, Logger } from '@nestjs/common';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
  LeadDiscoverySource,
  LeadSource,
} from '@optimistic-tanuki/models/leads-contracts';
import {
  ProviderSearchResult,
  TopicDiscoveryProvider,
} from './discovery.types';
import {
  createLeadEntity,
  normalizeExcludedTerms,
  hasExcludedTerms,
  splitCsvInput,
} from './source-provider.util';

import {
  estimateGapValue,
  findPresenceGaps,
  scoreGaps,
  summarizeGaps,
} from './presence-gap.util';

type OverpassElement = {
  type?: string;
  id?: number;
  tags?: Record<string, string>;
};

/**
 * OpenStreetMap via the Overpass API — the keyless counterpart to Google
 * Places.
 *
 * Places is the only other source that finds local businesses and it requires a
 * billable API key, so without this there is no local discovery at all in a
 * deployment that has not configured one.
 *
 * Queries are scoped by administrative area name rather than a coordinate
 * radius, which avoids needing a geocoder: Nominatim would add a second
 * dependency with its own strict usage policy, and Overpass can resolve the
 * area itself.
 */
@Injectable()
export class OverpassDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'overpass';
  readonly supportedSources = [LeadDiscoverySource.OVERPASS];
  private readonly logger = new Logger(OverpassDiscoveryProvider.name);

  private readonly endpoint = 'https://overpass-api.de/api/interpreter';
  private readonly maxResultsPerArea = 60;

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const areas = this.deriveAreas(topic);
    const queries: string[] = [];

    if (!areas.length) {
      return {
        candidates: [],
        warnings: [
          'OpenStreetMap discovery needs at least one city or location on the topic.',
        ],
        queries,
      };
    }

    const businessTypes = this.deriveBusinessFilters(topic);
    const warnings: string[] = [];
    const candidates: ProviderSearchResult['candidates'] = [];
    let excludedCount = 0;
    let gaplessCount = 0;

    for (const area of areas) {
      const query = this.buildQuery(area, businessTypes);
      queries.push(`overpass:${area}`);

      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'user-agent': 'OptimisticTanukiLeadDiscovery/1.0',
          },
          body: new URLSearchParams({ data: query }).toString(),
        });

        if (!response.ok) {
          warnings.push(
            `OpenStreetMap query for "${area}" failed with HTTP ${response.status}.`
          );
          continue;
        }

        const payload = (await response.json()) as {
          elements?: OverpassElement[];
        };
        const elements = Array.isArray(payload?.elements)
          ? payload.elements
          : [];

        for (const element of elements) {
          const tags = element.tags || {};
          const name = tags['name'];
          // An unnamed map feature cannot be contacted or pitched to.
          if (!name) {
            continue;
          }

          const haystack = Object.values(tags).join(' ');
          if (hasExcludedTerms(haystack, excludedTerms)) {
            excludedCount += 1;
            continue;
          }

          const website = tags['website'] || tags['contact:website'] || null;
          const phone = tags['phone'] || tags['contact:phone'] || null;
          const gaps = findPresenceGaps({
            website,
            phone,
            hasOpeningHours: Boolean(tags['opening_hours']),
            // OSM carries no ratings, so those gap types stay unknown rather
            // than being reported as missing.
          });

          if (!gaps.length) {
            gaplessCount += 1;
            continue;
          }

          const gapScore = scoreGaps(gaps);
          const category =
            tags['shop'] || tags['amenity'] || tags['office'] || tags['craft'];
          const matchedKeywords = [category, area].filter(
            (value): value is string => Boolean(value)
          );

          candidates.push({
            lead: createLeadEntity({
              seed: `overpass:${element.type}/${element.id}`,
              name: `${name} - ${gaps[0].label}`,
              company: name,
              source: LeadSource.OVERPASS,
              originalPostingUrl: website || undefined,
              notes: `Discovered via OpenStreetMap in ${area}${
                category ? ` (${category})` : ''
              }. Presence gaps (${gapScore}/100): ${summarizeGaps(
                gaps
              )}. Map feature: https://www.openstreetmap.org/${element.type}/${
                element.id
              }.`,
              searchKeywords: matchedKeywords,
              value: estimateGapValue(gapScore),
            }),
            matchedKeywords,
            providerName: this.providerName,
          });
        }
      } catch (error) {
        this.logger.warn(
          `OpenStreetMap discovery failed for topic ${topic.id} in ${area}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        warnings.push(`OpenStreetMap query for "${area}" could not complete.`);
      }
    }

    if (excludedCount) {
      warnings.push(
        `Excluded ${excludedCount} result(s) because they matched blocked terms: ${excludedTerms.join(
          ', '
        )}.`
      );
    }
    if (gaplessCount) {
      warnings.push(
        `Skipped ${gaplessCount} business(es) with no gaps in their online presence — they are not leads for this kind of work.`
      );
    }
    if (!candidates.length) {
      warnings.push(
        'OpenStreetMap returned no businesses with presence gaps for the configured areas.'
      );
    }

    return { candidates, warnings, queries };
  }

  /** Reuses the same location fields the Google Maps source already collects. */
  private deriveAreas(topic: LeadTopic): string[] {
    // Deliberately not splitCsvInput: entries are "City, State" pairs, and
    // splitting them on the comma turns one place into two areas — querying
    // Overpass for a state abbreviation and duplicating every result.
    const raw = [...(topic.googleMapsCities || []), topic.googleMapsLocation]
      .map((value) => (value || '').trim())
      .filter(Boolean);

    // Overpass matches an administrative area by its own name, so "Savannah,
    // GA" reduces to "Savannah".
    const areas = raw.map((value) => value.split(',')[0].trim());
    return Array.from(new Set(areas.filter(Boolean)));
  }

  /**
   * OSM classifies businesses by tag key rather than free text, so topic
   * business types are mapped onto the keys that actually carry them.
   */
  private deriveBusinessFilters(topic: LeadTopic): string[] {
    const types = splitCsvInput(topic.googleMapsTypes || []).map((value) =>
      value.toLowerCase().trim()
    );

    const keys = new Set<string>();
    for (const type of types) {
      if (/(restaurant|cafe|bar|pharmacy|clinic|dentist|school)/.test(type)) {
        keys.add('amenity');
      }
      if (/(shop|store|retail|market|boutique)/.test(type)) {
        keys.add('shop');
      }
      if (/(agency|office|consult|firm|studio)/.test(type)) {
        keys.add('office');
      }
      if (/(plumb|electric|builder|carpenter|craft|contractor)/.test(type)) {
        keys.add('craft');
      }
    }

    // Nothing recognisable: sweep the common commercial keys rather than
    // returning nothing at all.
    return keys.size ? Array.from(keys) : ['shop', 'office', 'craft'];
  }

  private buildQuery(area: string, businessKeys: string[]): string {
    // Quotes are escaped because the area name is interpolated into the
    // Overpass QL string.
    const safeArea = area.replace(/["\\]/g, '');
    const selectors = businessKeys
      .map((key) => `nwr["${key}"](area.searchArea);`)
      .join('');

    return `[out:json][timeout:30];area["name"="${safeArea}"]["boundary"="administrative"]->.searchArea;(${selectors});out tags ${this.maxResultsPerArea};`;
  }
}
