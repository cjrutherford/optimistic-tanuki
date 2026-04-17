import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocationAutocompleteSuggestion } from '@optimistic-tanuki/models';
import { readJsonResponse } from './discovery/provider-http.util';

type GoogleAutocompleteSuggestion = {
  placePrediction?: {
    placeId?: string;
    text?: {
      text?: string;
    };
    structuredFormat?: {
      mainText?: {
        text?: string;
      };
      secondaryText?: {
        text?: string;
      };
    };
  };
};

type GoogleAutocompletePayload = {
  status?: string;
  error_message?: string;
  error?: {
    message?: string;
    status?: string;
  };
  suggestions?: GoogleAutocompleteSuggestion[];
};

type GoogleAutocompleteConfig = {
  enabled?: boolean;
  apiKey?: string;
  autocompleteUrl?: string;
};

@Injectable()
export class GoogleMapsLocationAutocompleteService {
  private readonly logger = new Logger(
    GoogleMapsLocationAutocompleteService.name
  );

  constructor(private readonly configService: ConfigService) {}

  async searchCities(query: string): Promise<LocationAutocompleteSuggestion[]> {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) {
      return [];
    }

    const config =
      this.configService.get<GoogleAutocompleteConfig>(
        'leadDiscovery.googleMaps',
        {
          infer: true,
        }
      ) || {};

    if (!config.enabled || !config.apiKey) {
      return [];
    }

    const url = new URL(
      config.autocompleteUrl ||
        'https://places.googleapis.com/v1/places:autocomplete'
    );

    try {
      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': config.apiKey,
          'X-Goog-FieldMask':
            'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text',
        },
        body: JSON.stringify({
          input: normalizedQuery,
          includedPrimaryTypes: ['(cities)'],
          includeQueryPredictions: false,
        }),
      });
      const payloadResult = await readJsonResponse<GoogleAutocompletePayload>(
        response,
        'Google Maps autocomplete'
      );

      if (!payloadResult.ok) {
        this.logger.warn(
          `Google Maps autocomplete failed for "${normalizedQuery}": ${payloadResult.warning}`
        );
        return [];
      }

      const status =
        payloadResult.payload?.error?.status || payloadResult.payload?.status || 'OK';
      const errorMessage =
        payloadResult.payload?.error?.message ||
        payloadResult.payload?.error_message;
      if (status !== 'OK' && status !== 'ZERO_RESULTS') {
        this.logger.warn(
          `Google Maps autocomplete returned a non-OK payload for "${normalizedQuery}": ${status}${
            errorMessage
              ? ` - ${errorMessage}`
              : ''
          }`
        );
        return [];
      }

      const seen = new Set<string>();
      return (payloadResult.payload?.suggestions || [])
        .map((suggestion) => {
          const placePrediction = suggestion.placePrediction;
          const description = placePrediction?.text?.text?.trim() || '';
          if (!description) {
            return null;
          }

          const dedupeKey = description.toLowerCase();
          if (seen.has(dedupeKey)) {
            return null;
          }
          seen.add(dedupeKey);

          return {
            description,
            primaryText:
              placePrediction?.structuredFormat?.mainText?.text?.trim() ||
              description,
            secondaryText:
              placePrediction?.structuredFormat?.secondaryText?.text?.trim() ||
              undefined,
            placeId: placePrediction?.placeId,
          };
        })
        .filter(Boolean) as LocationAutocompleteSuggestion[];
    } catch (error) {
      this.logger.warn(
        `Google Maps autocomplete failed for "${normalizedQuery}": ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return [];
    }
  }
}
