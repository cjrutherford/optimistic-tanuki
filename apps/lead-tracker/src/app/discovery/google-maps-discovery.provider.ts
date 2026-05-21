import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeadTopic } from '@optimistic-tanuki/models/leads-entities';
import { LeadDiscoverySource, LeadSource, LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';
import { readJsonResponse } from './provider-http.util';
import { ProviderSearchResult, TopicDiscoveryProvider } from './discovery.types';
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
  maxResults?: number;
};

@Injectable()
export class GoogleMapsDiscoveryProvider implements TopicDiscoveryProvider {
  readonly providerName = 'google-maps';
  readonly supportedSources = [LeadDiscoverySource.GOOGLE_MAPS];
  private readonly logger = new Logger(GoogleMapsDiscoveryProvider.name);
  private readonly geocodeCache = new Map<string, { lat: number; lng: number } | null>();

  constructor(private readonly configService: ConfigService) {}

  async search(topic: LeadTopic): Promise<ProviderSearchResult> {
    const config = this.configService.get<GoogleMapsConfig>('leadDiscovery.googleMaps', { infer: true }) || {};
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

    const cities = Array.from(new Set((topic.googleMapsCities || []).map((value) => value.trim()).filter(Boolean)));
    const types = splitCsvInput(topic.googleMapsTypes || []);
    if (!cities.length || !types.length) {
      return {
        candidates: [],
        warnings: ['Google Maps discovery requires at least one city and one business type.'],
        queries: [],
      };
    }

    const keywords = normalizeTopicKeywords(topic.name, topic.keywords);
    const excludedTerms = normalizeExcludedTerms(topic.excludedTerms);
    const discoveryIntent = getTopicDiscoveryIntent(topic);
    const queries = cities.flatMap((city) => types.map((type) => `${type} in ${city}`));
    const maxResults = Math.max(1, config.maxResults || 10);
    const urlBase = config.textSearchUrl || 'https://maps.googleapis.com/maps/api/place/textsearch/json';
    const locationBias = await this.resolveLocationBias(
      topic.googleMapsLocation,
      topic.googleMapsRadiusMiles,
      config.apiKey || ''
    );

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
          const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
          const payloadResult = await readJsonResponse<{ results?: GoogleMapsPlace[] }>(response, 'Google Maps');
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
      const candidates = payloads
        .flatMap(({ query, payload }) => (payload.results || []).slice(0, maxResults).map((place) => ({ query, place })))
        .map(({ query, place }) => {
          const text = stripHtml(`${place.name || ''} ${place.formatted_address || ''} ${query}`);
          if (hasExcludedTerms(text, excludedTerms)) {
            excludedCount += 1;
            return null;
          }

          const matchedKeywords = getMatchedKeywords(text, keywords);
          const querySignals = getMatchedKeywords(query, splitCsvInput(topic.googleMapsTypes || []));
          const effectiveKeywords = discoveryIntent === LeadTopicDiscoveryIntent.SERVICE_BUYERS
            ? Array.from(new Set([...querySignals, ...matchedKeywords]))
            : matchedKeywords;

          if (!effectiveKeywords.length) {
            return null;
          }

          return {
            lead: createLeadEntity({
              seed: `google-maps:${place.place_id || `${place.name}:${place.formatted_address}`}`,
              name: `${place.name || 'Business'} - Website Development`,
              company: place.name || 'Google Maps opportunity',
              source: LeadSource.GOOGLE_MAPS,
              originalPostingUrl: undefined,
              notes: `Discovered via Google Maps text search. Query: ${query}. Address: ${place.formatted_address || 'n/a'}. Business status: ${place.business_status || 'unknown'}. Discovery intent: ${discoveryIntent}.`,
              searchKeywords: effectiveKeywords,
              value: 3000,
            }),
            matchedKeywords: effectiveKeywords,
            providerName: this.providerName,
          };
        })
        .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

      const warnings = payloads.flatMap((entry) => entry.warning ? [entry.warning] : []);
      if (excludedCount) {
        warnings.push(`Excluded ${excludedCount} result(s) because they matched blocked terms: ${excludedTerms.join(', ')}.`);
      }

      return {
        candidates,
        warnings: candidates.length
          ? warnings
          : [...warnings, 'Google Maps returned no places that matched the configured topic keywords.'],
        queries,
      };
    } catch (error) {
      this.logger.warn(`Google Maps discovery failed for topic ${topic.id}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        candidates: [],
        warnings: [`Google Maps request failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        queries,
      };
    }
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

      const coordinates = payloadResult.payload?.results?.[0]?.geometry?.location;
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
