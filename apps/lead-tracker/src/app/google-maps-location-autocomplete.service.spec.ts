import { ConfigService } from '@nestjs/config';
import { GoogleMapsLocationAutocompleteService } from './google-maps-location-autocomplete.service';

describe('GoogleMapsLocationAutocompleteService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns deduplicated city suggestions from Places API (New)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type'
            ? 'application/json; charset=utf-8'
            : null,
      },
      text: async () =>
        JSON.stringify({
          suggestions: [
            {
              placePrediction: {
                placeId: 'place-1',
                text: {
                  text: 'Savannah, GA, USA',
                },
                structuredFormat: {
                  mainText: {
                    text: 'Savannah',
                  },
                  secondaryText: {
                    text: 'GA, USA',
                  },
                },
              },
            },
            {
              placePrediction: {
                placeId: 'place-1-duplicate',
                text: {
                  text: 'Savannah, GA, USA',
                },
                structuredFormat: {
                  mainText: {
                    text: 'Savannah',
                  },
                  secondaryText: {
                    text: 'GA, USA',
                  },
                },
              },
            },
          ],
        }),
    }) as typeof fetch;

    const service = new GoogleMapsLocationAutocompleteService({
      get: jest.fn().mockReturnValue({
        enabled: true,
        apiKey: 'test-key',
      }),
    } as unknown as ConfigService);

    const result = await service.searchCities('sav');

    expect(result).toEqual([
      {
        description: 'Savannah, GA, USA',
        primaryText: 'Savannah',
        secondaryText: 'GA, USA',
        placeId: 'place-1',
      },
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('places.googleapis.com/v1/places:autocomplete'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': 'test-key',
          'X-Goog-FieldMask': expect.stringContaining(
            'suggestions.placePrediction.placeId'
          ),
        }),
        body: JSON.stringify({
          input: 'sav',
          includedPrimaryTypes: ['(cities)'],
          includeQueryPredictions: false,
        }),
      })
    );
  });

  it('logs and returns an empty list when Google autocomplete responds with an error payload', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) =>
          name.toLowerCase() === 'content-type'
            ? 'application/json; charset=utf-8'
            : null,
      },
      text: async () =>
        JSON.stringify({
          status: 'REQUEST_DENIED',
          error_message: 'The provided API key is invalid.',
        }),
    }) as typeof fetch;

    const service = new GoogleMapsLocationAutocompleteService({
      get: jest.fn().mockReturnValue({
        enabled: true,
        apiKey: 'test-key',
      }),
    } as unknown as ConfigService);
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);

    const result = await service.searchCities('sav');

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Google Maps autocomplete returned a non-OK payload')
    );
  });
});
