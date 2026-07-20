import { TestBed } from '@angular/core/testing';
import { LocalityResolutionService } from './locality-resolution.service';

describe('LocalityResolutionService', () => {
  let service: LocalityResolutionService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LocalityResolutionService],
    });

    service = TestBed.inject(LocalityResolutionService);
  });

  it('resolves a community label from locality metadata when available', () => {
    expect(
      service.resolveFromCommunity({
        name: 'Savannah, GA',
        city: 'Savannah',
        adminArea: 'GA',
        countryCode: 'US',
        timezone: 'America/New_York',
        coordinates: { lat: 32.0809, lng: -81.0912 },
      })
    ).toEqual({
      primary: 'Savannah',
      secondary: 'GA, US',
      formatted: 'Savannah, GA, US',
      city: 'Savannah',
      adminArea: 'GA',
      countryCode: 'US',
      timezone: 'America/New_York',
      source: 'community-metadata',
    });
  });

  it('falls back to the anchor when community metadata is missing', () => {
    expect(
      service.resolveFromCommunity({
        name: 'Unknown locality',
        coordinates: { lat: 32.0809, lng: -81.0912 },
      })
    ).toEqual({
      primary: 'Near 32.081, -81.091',
      secondary: 'Anchor coordinates',
      formatted: 'Near 32.081, -81.091',
      source: 'coordinates',
    });
  });
});
