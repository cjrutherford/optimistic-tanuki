import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import {
  CommunityCommands,
  PaymentCommands,
  ServiceTokens,
  VideoCommands,
} from '@optimistic-tanuki/constants';
import { LocalityDiscoveryController } from './locality-discovery.controller';

describe('LocalityDiscoveryController', () => {
  let controller: LocalityDiscoveryController;
  let socialClient: jest.Mocked<ClientProxy>;
  let paymentsClient: jest.Mocked<ClientProxy>;
  let storeClient: jest.Mocked<ClientProxy>;
  let videosClient: jest.Mocked<ClientProxy>;

  beforeEach(async () => {
    socialClient = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    paymentsClient = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    storeClient = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;
    videosClient = {
      send: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<ClientProxy>;

    socialClient.send.mockReturnValue(
      of([
        {
          id: 'savannah',
          name: 'Savannah, GA',
          slug: 'savannah-ga',
          localityType: 'city',
          city: 'Savannah',
          adminArea: 'GA',
          countryCode: 'US',
          lat: 32.0809,
          lng: -81.0912,
          timezone: 'America/New_York',
          description: 'Historic coastal city.',
          imageUrl: 'https://example.com/savannah.jpg',
          memberCount: 12,
          appScope: 'local-hub',
        },
        {
          id: 'starland',
          name: 'Starland Makers',
          slug: 'starland-makers',
          localityType: 'neighborhood',
          city: 'Savannah',
          adminArea: 'GA',
          countryCode: 'US',
          lat: 32.0725,
          lng: -81.0992,
          timezone: 'America/New_York',
          description: 'Neighborhood creators.',
          imageUrl: 'https://example.com/starland.jpg',
          memberCount: 5,
          appScope: 'local-hub',
        },
        {
          id: 'augusta',
          name: 'Augusta, GA',
          slug: 'augusta-ga',
          localityType: 'city',
          city: 'Augusta',
          adminArea: 'GA',
          countryCode: 'US',
          lat: 33.4735,
          lng: -82.0105,
          timezone: 'America/New_York',
          description: 'Far away city.',
          imageUrl: 'https://example.com/augusta.jpg',
          memberCount: 2,
          appScope: 'local-hub',
        },
      ])
    );

    paymentsClient.send.mockImplementation((pattern: any) => {
      if (pattern?.cmd !== PaymentCommands.LIST_ACTIVE_BUSINESS_PAGES) {
        return of([]);
      }

      return of([
        {
          id: 'business-savannah',
          communityId: 'savannah',
          ownerId: 'owner-savannah',
          name: 'Savannah Coffee Roasters',
          description: 'Small-batch local roasting.',
          logoUrl: 'https://example.com/coffee.jpg',
          subscriptionStatus: 'active',
          address: 'Savannah, GA',
          anchorLat: 32.0814,
          anchorLng: -81.0917,
        },
        {
          id: 'business-augusta-nearby',
          communityId: 'augusta',
          ownerId: 'owner-riverfront',
          name: 'Riverfront Pop-up',
          description: 'Travels closer than its home community.',
          logoUrl: 'https://example.com/popup.jpg',
          subscriptionStatus: 'active',
          address: 'Savannah, GA',
          anchorLat: 32.0821,
          anchorLng: -81.0905,
        },
      ]);
    });
    storeClient.send.mockImplementation((pattern: any) => {
      if (pattern !== 'trainer.config.listPublicSiteSummaries') {
        return of([]);
      }

      return of([
        {
          slug: 'savannah-coffee-roasters',
          businessName: 'Savannah Coffee Roasters',
          tagline: 'Small-batch local roasting.',
          location: 'Savannah, GA',
          businessType: 'coffee',
          ownerUserId: 'owner-savannah',
        },
      ]);
    });

    videosClient.send.mockReturnValue(
      of([
        {
          id: 'channel-savannah',
          name: 'Savannah Harbor Live',
          description: 'Neighborhood weather and harbor cams.',
          communityId: 'savannah',
          communitySlug: 'savannah-ga',
          isPublic: true,
          memberCount: 20,
          timezone: 'America/New_York',
        },
        {
          id: 'channel-augusta',
          name: 'Augusta Now',
          description: 'Far away.',
          communityId: 'augusta',
          communitySlug: 'augusta-ga',
          isPublic: true,
          memberCount: 8,
          timezone: 'America/New_York',
        },
        {
          id: 'channel-augusta-nearby',
          name: 'Metro Cast Street Desk',
          description: 'Anchored near Savannah despite a distant home base.',
          communityId: 'augusta',
          communitySlug: 'augusta-ga',
          isPublic: true,
          memberCount: 15,
          timezone: 'America/New_York',
          anchorLat: 32.0804,
          anchorLng: -81.092,
        },
      ])
    );

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocalityDiscoveryController],
      providers: [
        { provide: ServiceTokens.SOCIAL_SERVICE, useValue: socialClient },
        { provide: ServiceTokens.PAYMENTS_SERVICE, useValue: paymentsClient },
        { provide: ServiceTokens.STORE_SERVICE, useValue: storeClient },
        { provide: ServiceTokens.VIDEOS_SERVICE, useValue: videosClient },
      ],
    }).compile();

    controller = module.get<LocalityDiscoveryController>(
      LocalityDiscoveryController
    );
  });

  it('aggregates nearby communities and anchor-aware business pages and channels', async () => {
    const result = await controller.discoverNearby(
      32.0809,
      -81.0912,
      2000,
      'local-hub',
      10
    );

    expect(socialClient.send).toHaveBeenCalledWith(
      { cmd: CommunityCommands.LIST_LOCALITY },
      { appScope: 'local-hub', localityType: undefined }
    );
    expect(videosClient.send).toHaveBeenCalledWith(
      { cmd: VideoCommands.FIND_ALL_CHANNELS },
      {}
    );
    expect(paymentsClient.send).toHaveBeenCalledWith(
      { cmd: PaymentCommands.LIST_ACTIVE_BUSINESS_PAGES },
      {}
    );
    expect(storeClient.send).toHaveBeenCalledWith(
      'trainer.config.listPublicSiteSummaries',
      {}
    );

    expect(result.locality).toEqual({
      primary: 'Savannah',
      secondary: 'GA, US',
      formatted: 'Savannah, GA, US',
      city: 'Savannah',
      adminArea: 'GA',
      countryCode: 'US',
      timezone: 'America/New_York',
      source: 'community-metadata',
    });
    expect(result.communities.map((community) => community.id)).toEqual([
      'savannah',
      'starland',
    ]);
    expect(result.businesses).toEqual([
      expect.objectContaining({
        id: 'business-savannah',
        communityId: 'savannah',
        name: 'Savannah Coffee Roasters',
        siteSlug: 'savannah-coffee-roasters',
        sitePath: '/sites/savannah-coffee-roasters',
        coordinates: {
          lat: 32.0814,
          lng: -81.0917,
        },
      }),
      expect.objectContaining({
        id: 'business-augusta-nearby',
        communityId: 'augusta',
        communitySlug: 'augusta-ga',
        name: 'Riverfront Pop-up',
        coordinates: {
          lat: 32.0821,
          lng: -81.0905,
        },
      }),
    ]);
    expect(result.channels).toEqual([
      expect.objectContaining({
        id: 'channel-savannah',
        communityId: 'savannah',
        name: 'Savannah Harbor Live',
      }),
      expect.objectContaining({
        id: 'channel-augusta-nearby',
        communityId: 'augusta',
        name: 'Metro Cast Street Desk',
        coordinates: {
          lat: 32.0804,
          lng: -81.092,
        },
      }),
    ]);
  });
});
