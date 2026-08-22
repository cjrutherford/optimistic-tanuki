import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import {
  LeadDiscoverySource,
  LeadSource,
  LeadTopicDiscoveryIntent,
} from '@optimistic-tanuki/models/leads-contracts';
import { readJsonResponse } from './provider-http.util';
import {
  estimateGapValue,
  findPresenceGaps,
  scoreGaps,
  summarizeGaps,
} from './presence-gap.util';
import {
  ProviderSearchResult,
  TopicDiscoveryProvider,
} from './discovery.types';
import {
  createLeadEntity,
  getMatchedKeywords,
  getTopicDiscoveryIntent,
  hasExcludedTerms,
  normalizeExcludedTerms,
  normalizeTopicKeywords,
  splitCsvInput,
  stripHtml,
} from './source-provider.util';

type GoogleMapsPlace = {
  name?: string;
  formatted_address?: string;
  place_id?: string;
  business_status?: string;
  // Text Search returns ratings and review counts on the basic result.
  rating?: number;
  user_ratings_total?: number;
  // These three do NOT come back from Text Search — they are Place Details
  // fields, filled in by enrichWithPlaceDetails. `null` means Details was
  // consulted and the business genuinely has none; `undefined` means it was
  // never established, and the gap scorer must not read anything into it.
  website?: string | null;
  formatted_phone_number?: string | null;
  hasOpeningHours?: boolean;
};

/** The subset of Place Details worth one billed request per candidate. */
type GoogleMapsPlaceDetails = {
  website?: string;
  formatted_phone_number?: string;
  opening_hours?: { open_now?: boolean };
};

type GoogleGeocodeResult = {
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GoogleMapsConfig = {
  enabled?: boolean;
  apiKey?: string;
  textSearchUrl?: string;
  detailsUrl?: string;
  maxResults?: number;
  /**
   * Ceiling on billed Place Details requests per discovery run. Details is
   * charged per call, so a topic covering several cities could otherwise run up
   * a surprising bill in one pass.
   */
  maxDetailLookups?: number;
};

@Injectable()
export class GoogleMapsDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'google-maps';
  readonly supportedSources = [LeadDiscoverySource.GOOGLE_MAPS];
  private readonly logger = new Logger(GoogleMapsDiscoveryProvider.name);
  private readonly geocodeCache = new Map<
    string,
    { lat: number; lng: number } | null
  >();

  constructor(private readonly configService: ConfigService) {}

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const config =
      this.configService.get<GoogleMapsConfig>('leadDiscovery.googleMaps', {
        infer: true,
      }) || {};
    if (!config.enabled) {
      return {
        candidates: [],
        warnings: ['Google Maps discovery is disabled.'],
        queries: [],
      };
    }

    if (!config.apiKey) {
      return {
        candidates: [],
        warnings: ['Google Maps discovery requires an API key.'],
        queries: [],
      };
    }

    const cities = Array.from(
      new Set(
        (topic.googleMapsCities || [])
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );
    const types = splitCsvInput(topic.googleMapsTypes || []);
    if (!cities.length || !types.length) {
      return {
        candidates: [],
        warnings: [
          'Google Maps discovery requires at least one city and one business type.',
        ],
        queries: [],
      };
    }

    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const discoveryIntent = getTopicDiscoveryIntent(topic);
    const queries = cities.flatMap((city) =>
      types.map((type) => `${type} in ${city}`)
    );
    const maxResults = Math.max(1, config.maxResults || 10);
    const urlBase =
      config.textSearchUrl ||
      'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const locationBias = await this.resolveLocationBias(
      topic.googleMapsLocation,
      topic.googleMapsRadiusMiles,
      config.apiKey || ''
    );
    const detailsWarnings: string[] = [];

    try {
      const payloads = await Promise.all(
        queries.map(async (query) => {
          const url = new URL(urlBase);
          url.searchParams.set('query', query);
          url.searchParams.set('key', config.apiKey || '');
          if (locationBias) {
            url.searchParams.set(
              'location',
              `${locationBias.lat},${locationBias.lng}`
            );
            url.searchParams.set('radius', String(locationBias.radiusMeters));
          }
          const response = await fetch(url.toString(), {
            headers: { accept: 'application/json' },
          });
          const payloadResult = await readJsonResponse<{
            results?: GoogleMapsPlace[];
          }>(response, 'Google Maps');
          if (!payloadResult.ok) {
            const { warning } = payloadResult;
            return {
              query,
              warning,
              payload: { results: [] },
            };
          }

          return {
            query,
            warning: null,
            payload: payloadResult.payload,
          };
        })
      );

      let excludedCount = 0;
      let gaplessCount = 0;

      // Filtering happens before enrichment so the Details lookups below are
      // only spent on places that could actually become leads.
      const survivors = payloads
        .flatMap(({ query, payload }) =>
          (payload.results || [])
            .slice(0, maxResults)
            .map((place) => ({ query, place }))
        )
        .map(({ query, place }) => {
          const text = stripHtml(
            `${place.name || ''} ${place.formatted_address || ''} ${query}`
          );
          if (hasExcludedTerms(text, excludedTerms)) {
            excludedCount += 1;
            return null;
          }

          const matchedKeywords = getMatchedKeywords(text, keywords);
          const querySignals = getMatchedKeywords(
            query,
            splitCsvInput(topic.googleMapsTypes || [])
          );
          const effectiveKeywords =
            discoveryIntent === LeadTopicDiscoveryIntent.SERVICE_BUYERS
              ? Array.from(new Set([...querySignals, ...matchedKeywords]))
              : matchedKeywords;

          if (!effectiveKeywords.length) {
            return null;
          }

          return { query, place, effectiveKeywords };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

      const detailed = await this.enrichWithPlaceDetails(
        survivors,
        config,
        detailsWarnings
      );

      const candidates = detailed
        .map(({ query, place, effectiveKeywords }) => {
          // Text Search does not carry website, phone, or opening hours — those
          // come from the Details lookup above. Anything it could not supply
          // stays `undefined`, which the gap scorer treats as unknown. Mapping
          // them to `false`/`0` instead reported a confirmed gap for a field
          // never actually checked, putting a phantom "No website listed" on
          // every single result.
          const gaps = findPresenceGaps({
            website: place.website,
            phone: place.formatted_phone_number,
            hasOpeningHours: place.hasOpeningHours,
            rating: place.rating,
            reviewCount: place.user_ratings_total,
          });
          const gapScore = scoreGaps(gaps);

          // A business with a complete online presence is not a lead for this
          // kind of work; surfacing it wastes the operator's attention.
          if (!gaps.length) {
            gaplessCount += 1;
            return null;
          }

          const gapSummary = summarizeGaps(gaps);

          return {
            lead: createLeadEntity({
              seed: `google-maps:${
                place.place_id || `${place.name}:${place.formatted_address}`
              }`,
              name: `${place.name || 'Business'} - ${gaps[0].label}`,
              company: place.name || 'Google Maps opportunity',
              source: LeadSource.GOOGLE_MAPS,
              originalPostingUrl: place.website,
              notes: `Discovered via Google Maps text search. Query: ${query}. Address: ${
                place.formatted_address || 'n/a'
              }. Business status: ${
                place.business_status || 'unknown'
              }. Presence gaps (${gapScore}/100): ${gapSummary}. Discovery intent: ${discoveryIntent}.`,
              searchKeywords: effectiveKeywords,
              // Bigger gaps are worth more work, so the estimate tracks the score.
              value: estimateGapValue(gapScore),
            }),
            matchedKeywords: effectiveKeywords,
            providerName: this.providerName,
          };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> =>
          Boolean(candidate)
        );

      const warnings = [
        ...payloads.flatMap((entry) => (entry.warning ? [entry.warning] : [])),
        ...detailsWarnings,
      ];
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

      return {
        candidates,
        warnings: candidates.length
          ? warnings
          : [
              ...warnings,
              'Google Maps returned no places that matched the configured topic keywords.',
            ],
        queries,
      };
    } catch (error) {
      this.logger.warn(
        `Google Maps discovery failed for topic ${topic.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return {
        candidates: [],
        warnings: [
          `Google Maps request failed: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
        ],
        queries,
      };
    }
  }

  /**
   * Fills in the gap signals Text Search does not carry.
   *
   * Website, phone and opening hours are Place Details fields. Without this
   * step they are always absent from the payload, and treating that absence as
   * a finding put "No website listed" and "No phone number listed" on every
   * business the provider returned — 50 points of fabricated gap score.
   *
   * A place whose Details lookup fails or is skipped keeps those fields
   * `undefined`, so it is scored on what is actually known rather than being
   * penalised for a request that did not happen.
   */
  private async enrichWithPlaceDetails<T extends { place: GoogleMapsPlace }>(
    entries: T[],
    config: GoogleMapsConfig,
    warnings: string[]
  ): Promise<T[]> {
    if (!entries.length) {
      return entries;
    }

    const detailsUrl =
      config.detailsUrl ||
      'https://maps.googleapis.com/maps/api/place/details/json';
    const budget = Math.max(0, config.maxDetailLookups ?? 25);
    if (!budget) {
      warnings.push(
        'Place Details lookups are disabled, so website, phone and opening-hours gaps were not assessed.'
      );
      return entries;
    }

    let spent = 0;
    let failed = 0;

    const enriched = await Promise.all(
      entries.map(async (entry) => {
        const placeId = entry.place.place_id;
        if (!placeId || spent >= budget) {
          return entry;
        }
        spent += 1;

        try {
          const url = new URL(detailsUrl);
          url.searchParams.set('place_id', placeId);
          url.searchParams.set('key', config.apiKey || '');
          url.searchParams.set(
            'fields',
            'website,formatted_phone_number,opening_hours'
          );

          const response = await fetch(url.toString(), {
            headers: { accept: 'application/json' },
          });
          const result = await readJsonResponse<{
            result?: GoogleMapsPlaceDetails;
          }>(response, 'Google Maps Details');
          if (!result.ok) {
            failed += 1;
            return entry;
          }

          const details = result.payload.result || {};
          return {
            ...entry,
            place: {
              ...entry.place,
              // Details answered, so absence here is a real finding: null, not
              // undefined.
              website: details.website ?? null,
              formatted_phone_number: details.formatted_phone_number ?? null,
              hasOpeningHours: Boolean(details.opening_hours),
            },
          };
        } catch {
          failed += 1;
          return entry;
        }
      })
    );

    const skipped = entries.length - Math.min(entries.length, budget);
    if (skipped > 0) {
      warnings.push(
        `Checked online presence for the first ${budget} business(es); ${skipped} more were scored on ratings alone to stay within the Place Details budget.`
      );
    }
    if (failed) {
      warnings.push(
        `Could not check website or phone details for ${failed} business(es); they were scored on what was known.`
      );
    }

    return enriched;
  }

  private async resolveLocationBias(
    location: string | null | undefined,
    radiusMiles: number | null | undefined,
    apiKey: string
  ): Promise<{ lat: number; lng: number; radiusMeters: number } | null> {
    const normalizedLocation = location?.trim();
    if (!normalizedLocation || !radiusMiles) {
      return null;
    }

    const geocoded = await this.geocodeLocation(normalizedLocation, apiKey);
    if (!geocoded) {
      return null;
    }

    return {
      ...geocoded,
      radiusMeters: Math.round(radiusMiles * 1609.34),
    };
  }

  private async geocodeLocation(
    location: string,
    apiKey: string
  ): Promise<{ lat: number; lng: number } | null> {
    if (this.geocodeCache.has(location)) {
      return this.geocodeCache.get(location) || null;
    }

    try {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      url.searchParams.set('address', location);
      url.searchParams.set('key', apiKey);
      const response = await fetch(url.toString(), {
        headers: { accept: 'application/json' },
      });
      const payloadResult = await readJsonResponse<{
        results?: GoogleGeocodeResult[];
      }>(response, 'Google Maps geocode');
      if (!payloadResult.ok) {
        this.geocodeCache.set(location, null);
        return null;
      }

      const coordinates =
        payloadResult.payload?.results?.[0]?.geometry?.location;
      if (
        typeof coordinates?.lat !== 'number' ||
        typeof coordinates?.lng !== 'number'
      ) {
        this.geocodeCache.set(location, null);
        return null;
      }

      const resolved = { lat: coordinates.lat, lng: coordinates.lng };
      this.geocodeCache.set(location, resolved);
      return resolved;
    } catch (error) {
      this.logger.warn(
        `Google Maps geocode failed for "${location}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      this.geocodeCache.set(location, null);
      return null;
    }
  }
}
