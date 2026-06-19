import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { BadRequestException, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { of } from 'rxjs';

import {
  AppointmentCommands,
  AvailabilityCommands,
  LeadCommands,
  ProductCommands,
  ServiceTokens,
  TrainerConfigCommands,
} from '@optimistic-tanuki/constants';
import { LeadStatus } from '@optimistic-tanuki/models';

import { AuthGuard } from '../../auth/auth.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';

import { TrainerController } from './trainer.controller';

function createJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

function injectJsonPut(
  app: INestApplication,
  path: string,
  body: Record<string, unknown>,
  tokenPayload: Record<string, unknown>
): Promise<{ statusCode: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const expressApp = app.getHttpAdapter().getInstance() as {
      handle: (
        req: Record<string, unknown>,
        res: Record<string, unknown>,
        next?: (error?: unknown) => void
      ) => void;
    };

    const req = {
      method: 'PUT',
      url: path,
      originalUrl: path,
      path,
      body,
      headers: {
        authorization: `Bearer ${createJwt(tokenPayload)}`,
        'content-type': 'application/json',
      },
      _body: true,
      get(headerName: string) {
        return this.headers[
          headerName.toLowerCase() as keyof typeof this.headers
        ];
      },
    };

    const res = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      body: null as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      getHeader(name: string) {
        return this.headers[name.toLowerCase()];
      },
      json(payload: unknown) {
        this.body = payload;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
      send(payload: unknown) {
        this.body = payload;
        resolve({ statusCode: this.statusCode, body: payload });
        return this;
      },
      end(payload?: unknown) {
        this.body = payload ?? this.body;
        resolve({ statusCode: this.statusCode, body: this.body });
        return this;
      },
    };

    try {
      expressApp.handle(req, res, (error?: unknown) => {
        if (error) {
          reject(error);
          return;
        }
        resolve({ statusCode: res.statusCode, body: res.body });
      });
    } catch (error) {
      reject(error);
    }
  });
}

describe('TrainerController', () => {
  it('registers both trainer and business route prefixes', () => {
    expect(Reflect.getMetadata(PATH_METADATA, TrainerController)).toEqual([
      'trainer',
      'business',
    ]);
  });

  it('derives public business offers without trainer-facing copy', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              services: [
                {
                  id: 'service-1',
                  name: 'Athletic Reset',
                  description: 'Owner-managed performance assessment.',
                  price: 135,
                },
              ],
            },
          });
        }

        return of([]);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;

    const controller = new TrainerController(storeClient, leadClient);

    await expect(controller.getOffers()).resolves.toEqual([
      {
        id: 'service-1',
        label: 'Athletic Reset',
        description: 'Owner-managed performance assessment.',
        serviceType: 'Athletic Reset',
        startingRate: 135,
      },
    ]);
  });

  it('loads public offers from the slug-scoped hosted tenant config when a site slug is provided', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          expect(payload).toEqual({
            configKey: 'default',
            slug: 'steady-hand-contracting',
          });
          return of({
            config: {
              services: [
                {
                  id: 'service-1',
                  name: 'Repair visit',
                  description: 'Half-day repair support.',
                  price: 325,
                },
              ],
            },
          });
        }

        return of([]);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;

    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getOffers('steady-hand-contracting')
    ).resolves.toEqual([
      {
        id: 'service-1',
        label: 'Repair visit',
        description: 'Half-day repair support.',
        serviceType: 'Repair visit',
        startingRate: 325,
      },
    ]);
  });

  it('loads public availabilities for the owner linked to the selected hosted business slug', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          expect(payload).toEqual({
            configKey: 'default',
            slug: 'steady-hand-contracting',
          });

          return of({
            config: {
              site: {
                slug: 'steady-hand-contracting',
                ownerUserId: 'owner-user-handyman',
              },
            },
          });
        }

        if (command === AvailabilityCommands.FIND_OWNER_AVAILABILITIES) {
          expect(payload).toBe('owner-user-handyman');
          return of([
            {
              id: 'availability-1',
              ownerId: 'owner-user-handyman',
              serviceType: 'Repair visit',
            },
          ]);
        }

        return of([]);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;

    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getAvailabilities('steady-hand-contracting')
    ).resolves.toEqual([
      {
        id: 'availability-1',
        ownerId: 'owner-user-handyman',
        serviceType: 'Repair visit',
      },
    ]);
  });

  it('creates a public booking scoped to the selected hosted business slug', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          expect(payload).toEqual({
            configKey: 'default',
            slug: 'steady-hand-contracting',
          });

          return of({
            config: {
              site: {
                slug: 'steady-hand-contracting',
                ownerUserId: 'owner-user-handyman',
              },
            },
          });
        }

        if (command === AppointmentCommands.CREATE_APPOINTMENT) {
          expect(payload).toEqual(
            expect.objectContaining({
              ownerId: 'owner-user-handyman',
              userId: 'accepted-client-user',
              title: 'Repair visit',
            })
          );

          return of({ id: 'booking-1', ...payload });
        }

        return of([]);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);
    jest
      .spyOn(controller as any, 'requireAcceptedClient')
      .mockResolvedValue({ id: 'lead-1', status: LeadStatus.WON });

    await expect(
      (
        controller.createBooking as unknown as (
          payload: Record<string, unknown>,
          user: Record<string, unknown>,
          slug: string
        ) => Promise<unknown>
      ).call(
        controller,
        {
          title: 'Repair visit',
          startTime: new Date('2026-06-20T14:00:00.000Z'),
          endTime: new Date('2026-06-20T15:00:00.000Z'),
        } as any,
        {
          userId: 'accepted-client-user',
          email: 'client@example.com',
          exp: 0,
          iat: 0,
          name: 'Accepted Client',
          profileId: 'accepted-client-profile',
        },
        'steady-hand-contracting'
      )
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'booking-1',
        ownerId: 'owner-user-handyman',
      })
    );
  });

  it('loads owner site config by authenticated profile when no slug is provided', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          expect(payload).toEqual({
            configKey: 'default',
            profileId: 'owner-profile-handyman',
            slug: undefined,
          });

          return of({
            configId: 'cfg-handyman',
            config: {
              site: { slug: 'steady-hand-contracting', status: 'published' },
              brand: { businessName: 'Steady Hand Contracting' },
            },
          });
        }

        return of(null);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;

    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getSiteConfig(undefined, {
        userId: 'owner-user-handyman',
        email: 'owner-handyman@localbusiness.test',
        exp: 0,
        iat: 0,
        name: 'Luis Moreno',
        profileId: 'owner-profile-handyman',
      })
    ).resolves.toEqual({
      configId: 'cfg-handyman',
      config: {
        site: { slug: 'steady-hand-contracting', status: 'published' },
        brand: { businessName: 'Steady Hand Contracting' },
      },
    });
  });

  it('loads client bookings scoped to the selected hosted business slug', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          expect(payload).toEqual({
            configKey: 'default',
            slug: 'steady-hand-contracting',
          });

          return of({
            config: {
              site: {
                slug: 'steady-hand-contracting',
                ownerUserId: 'owner-user-handyman',
              },
            },
          });
        }

        if (command === AppointmentCommands.FIND_USER_APPOINTMENTS) {
          expect(payload).toEqual({
            userId: 'accepted-client-user',
            ownerId: 'owner-user-handyman',
          });
          return of([{ id: 'booking-1' }]);
        }

        return of([]);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      (
        controller.getClientBookings as unknown as (
          user: Record<string, unknown>,
          slug: string
        ) => Promise<unknown>
      ).call(
        controller,
        {
          userId: 'accepted-client-user',
          email: 'client@example.com',
          exp: 0,
          iat: 0,
          name: 'Accepted Client',
          profileId: 'accepted-client-profile',
        },
        'steady-hand-contracting'
      )
    ).resolves.toEqual([{ id: 'booking-1' }]);
  });

  it('loads client booking status scoped to the selected hosted business slug', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          expect(payload).toEqual({
            configKey: 'default',
            slug: 'steady-hand-contracting',
          });

          return of({
            config: {
              leadContext: {
                profileId: 'owner-profile-handyman',
                appScope: 'business-site',
              },
            },
          });
        }

        return of([]);
      }),
    } as any;
    const leadClient = {
      send: jest.fn(() =>
        of([
          {
            id: 'lead-1',
            userId: 'accepted-client-user',
            status: LeadStatus.WON,
          },
        ])
      ),
    } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      (
        controller.getClientBookingStatus as unknown as (
          user: Record<string, unknown>,
          slug: string
        ) => Promise<unknown>
      ).call(
        controller,
        {
          userId: 'accepted-client-user',
          email: 'client@example.com',
          exp: 0,
          iat: 0,
          name: 'Accepted Client',
          profileId: 'accepted-client-profile',
        },
        'steady-hand-contracting'
      )
    ).resolves.toEqual({
      accepted: true,
      leadId: 'lead-1',
      leadStatus: LeadStatus.WON,
      hasAccount: true,
      stage: 'accepted_client',
      nextAction: 'Choose a published time to request your next session.',
      primaryAction: 'book_session',
    });
  });

  it('maps active store service products into public business offers when no site services are configured', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({ config: {} });
        }

        if (command?.cmd === ProductCommands.FIND_ALL_PRODUCTS.cmd) {
          return of([
            {
              id: 'product-1',
              name: 'Fractional Advisory Sprint',
              description:
                'Structured advisory engagement for business operators.',
              price: 250,
              type: 'service',
              active: true,
            },
            {
              id: 'product-2',
              name: 'Physical Workbook',
              description: 'Printed workbook',
              price: 40,
              type: 'physical',
              active: true,
            },
          ]);
        }

        return of([]);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;

    const controller = new TrainerController(storeClient, leadClient);

    await expect(controller.getOffers()).resolves.toEqual([
      {
        id: 'product-1',
        label: 'Fractional Advisory Sprint',
        description: 'Structured advisory engagement for business operators.',
        serviceType: 'service',
        startingRate: 250,
        allowOnlineBooking: true,
      },
    ]);
  });

  it('uses store-backed offers when the site config explicitly selects the store catalog', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              serviceCatalog: { source: 'store' },
              services: [
                {
                  id: 'service-1',
                  name: 'Legacy Manual Offer',
                  description:
                    'Manual copy that should be ignored in store mode.',
                  price: 90,
                },
              ],
            },
          });
        }

        if (command?.cmd === ProductCommands.FIND_ALL_PRODUCTS.cmd) {
          return of([
            {
              id: 'product-1',
              name: 'Store Strategy Sprint',
              description: 'Store-managed service offer.',
              price: 210,
              type: 'service',
              active: true,
            },
          ]);
        }

        return of([]);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;

    const controller = new TrainerController(storeClient, leadClient);

    await expect(controller.getOffers()).resolves.toEqual([
      {
        id: 'product-1',
        label: 'Store Strategy Sprint',
        description: 'Store-managed service offer.',
        serviceType: 'service',
        startingRate: 210,
        allowOnlineBooking: true,
      },
    ]);
  });

  it('uses owner-scoped store products for hosted store-backed business offers', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          expect(payload).toEqual({
            configKey: 'default',
            slug: 'steady-hand-contracting',
          });
          return of({
            config: {
              site: {
                ownerUserId: 'owner-user-handyman',
              },
              serviceCatalog: { source: 'store' },
            },
          });
        }

        if (command?.cmd === ProductCommands.FIND_OWNER_PRODUCTS.cmd) {
          expect(payload).toBe('owner-user-handyman');
          return of([
            {
              id: 'product-1',
              name: 'On-site Repair Visit',
              description: 'Owner-scoped repair service.',
              price: 325,
              type: 'service',
              active: true,
              ownerId: 'owner-user-handyman',
            },
            {
              id: 'product-2',
              name: 'Shared Physical Item',
              description: 'Should be ignored for offers.',
              price: 25,
              type: 'physical',
              active: true,
              ownerId: null,
            },
          ]);
        }

        return of([]);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getOffers('steady-hand-contracting')
    ).resolves.toEqual([
      {
        id: 'product-1',
        label: 'On-site Repair Visit',
        description: 'Owner-scoped repair service.',
        serviceType: 'service',
        startingRate: 325,
        allowOnlineBooking: true,
      },
    ]);
  });

  it('falls back to availability-derived offers when neither site services nor service products exist', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({ config: {} });
        }

        if (command?.cmd === ProductCommands.FIND_OWNER_PRODUCTS.cmd) {
          return of([
            {
              id: 'product-2',
              name: 'Physical Workbook',
              description: 'Printed workbook',
              price: 40,
              type: 'physical',
              active: true,
            },
          ]);
        }

        if (command === AvailabilityCommands.FIND_ALL_AVAILABILITIES) {
          return of([
            {
              id: 'availability-1',
              serviceType: 'Strategy Session',
              hourlyRate: 180,
              isActive: true,
            },
          ]);
        }

        return of([]);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;

    const controller = new TrainerController(storeClient, leadClient);

    await expect(controller.getOffers()).resolves.toEqual([
      {
        id: 'availability-1',
        label: 'Strategy Session',
        description: 'Bookable service derived from active availability.',
        serviceType: 'Strategy Session',
        startingRate: 180,
      },
    ]);
  });

  it('stores business lead context when site config is updated', async () => {
    const storeClient = {
      send: jest.fn(() => of({ id: 'cfg-1' })),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await controller.updateSiteConfig(
      {
        configId: 'cfg-1',
        config: { brand: { businessName: 'North Star Coaching' } },
      },
      {
        userId: 'owner-user-1',
        email: 'owner@example.com',
        exp: 0,
        iat: 0,
        name: 'Owner Example',
        profileId: 'owner-profile-1',
      }
    );

    expect(storeClient.send).toHaveBeenCalledWith(
      TrainerConfigCommands.UPDATE_CONFIG,
      {
        id: 'cfg-1',
        config: {
          brand: { businessName: 'North Star Coaching' },
          leadContext: {
            profileId: 'owner-profile-1',
            appScope: 'business-site',
          },
        },
      }
    );
  });

  it('creates slug-scoped site config when a hosted tenant slug is provided', async () => {
    const storeClient = {
      send: jest.fn(() => of({ id: 'cfg-slug' })),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await controller.updateSiteConfig(
      {
        configId: null,
        config: { brand: { businessName: 'Steady Hand Contracting' } },
      },
      {
        userId: 'owner-user-1',
        email: 'owner@example.com',
        exp: 0,
        iat: 0,
        name: 'Owner Example',
        profileId: 'owner-profile-1',
      },
      'steady-hand-contracting'
    );

    expect(storeClient.send).toHaveBeenCalledWith(
      TrainerConfigCommands.CREATE_CONFIG,
      {
        configKey: 'business-site:steady-hand-contracting',
        brand: { businessName: 'Steady Hand Contracting' },
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      }
    );
  });

  it('creates a first-time owner site config with an owner-scoped config key', async () => {
    const storeClient = {
      send: jest.fn(() => of({ id: 'cfg-new' })),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await controller.updateSiteConfig(
      {
        configId: null,
        config: { brand: { businessName: 'Harbor Light Studio' } },
      },
      {
        userId: 'owner-user-1',
        email: 'owner@example.com',
        exp: 0,
        iat: 0,
        name: 'Owner Example',
        profileId: 'owner-profile-1',
      }
    );

    expect(storeClient.send).toHaveBeenCalledWith(
      TrainerConfigCommands.CREATE_CONFIG,
      {
        configKey: 'business-site:owner-profile-1',
        brand: { businessName: 'Harbor Light Studio' },
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      }
    );
  });

  it('updates catalog source through a dedicated permission-scoped business-site endpoint', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            configId: 'cfg-1',
            config: {
              brand: { businessName: 'North Star Coaching' },
              serviceCatalog: { source: 'manual' },
            },
          });
        }

        if (command?.cmd === ProductCommands.FIND_OWNER_PRODUCTS.cmd) {
          return of([
            {
              id: 'product-1',
              name: 'Store Strategy Sprint',
              description: 'Store-managed service offer.',
              price: 210,
              type: 'service',
              active: true,
            },
          ]);
        }

        return of({ id: 'cfg-1' });
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await controller.updateCatalogSource(
      {
        configId: 'cfg-1',
        source: 'store',
      },
      {
        userId: 'owner-user-1',
        email: 'owner@example.com',
        exp: 0,
        iat: 0,
        name: 'Owner Example',
        profileId: 'owner-profile-1',
      }
    );

    expect(storeClient.send).toHaveBeenCalledWith(
      TrainerConfigCommands.UPDATE_CONFIG,
      {
        id: 'cfg-1',
        config: {
          brand: { businessName: 'North Star Coaching' },
          features: {
            store: {
              enabled: false,
            },
          },
          leadContext: {
            profileId: 'owner-profile-1',
            appScope: 'business-site',
          },
          serviceCatalog: {
            source: 'store',
          },
        },
      }
    );
  });

  it('creates slug-scoped catalog config when a hosted tenant slug is provided', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            configId: null,
            config: {
              serviceCatalog: { source: 'manual' },
            },
          });
        }

        if (command?.cmd === ProductCommands.FIND_OWNER_PRODUCTS.cmd) {
          return of([
            {
              id: 'product-1',
              name: 'Store Strategy Sprint',
              description: 'Store-managed service offer.',
              price: 210,
              type: 'service',
              active: true,
            },
          ]);
        }

        return of({ id: 'cfg-slug' });
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await controller.updateCatalogSource(
      {
        configId: null,
        source: 'store',
      },
      {
        userId: 'owner-user-1',
        email: 'owner@example.com',
        exp: 0,
        iat: 0,
        name: 'Owner Example',
        profileId: 'owner-profile-1',
      },
      'steady-hand-contracting'
    );

    expect(storeClient.send).toHaveBeenCalledWith(
      TrainerConfigCommands.CREATE_CONFIG,
      {
        configKey: 'business-site:steady-hand-contracting',
        features: {
          store: {
            enabled: false,
          },
        },
        serviceCatalog: { source: 'store' },
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      }
    );
  });

  it('creates a first-time owner catalog config with an owner-scoped config key', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            configId: null,
            config: null,
          });
        }

        return of({ id: 'cfg-new' });
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await controller.updateCatalogSource(
      {
        configId: null,
        source: 'manual',
      },
      {
        userId: 'owner-user-1',
        email: 'owner@example.com',
        exp: 0,
        iat: 0,
        name: 'Owner Example',
        profileId: 'owner-profile-1',
      }
    );

    expect(storeClient.send).toHaveBeenCalledWith(
      TrainerConfigCommands.CREATE_CONFIG,
      {
        configKey: 'business-site:owner-profile-1',
        features: {
          store: {
            enabled: false,
          },
        },
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
        serviceCatalog: {
          source: 'manual',
        },
      }
    );
  });

  describe('catalog source request contract', () => {
    let app: INestApplication;
    let storeClient: { send: jest.Mock };

    const operatorTokenPayload = {
      userId: 'owner-user-1',
      email: 'owner@example.com',
      exp: 0,
      iat: 0,
      name: 'Owner Example',
      profileId: 'owner-profile-1',
    };

    beforeEach(async () => {
      storeClient = {
        send: jest.fn(),
      };

      const moduleRef = Test.createTestingModule({
        controllers: [TrainerController],
        providers: [
          {
            provide: ServiceTokens.STORE_SERVICE,
            useValue: storeClient,
          },
          {
            provide: ServiceTokens.LEAD_SERVICE,
            useValue: { send: jest.fn() },
          },
        ],
      })
        .overrideGuard(AuthGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(PermissionsGuard)
        .useValue({ canActivate: () => true });

      const module: TestingModule = await moduleRef.compile();
      app = module.createNestApplication();
      await app.init();
    });

    afterEach(async () => {
      await app?.close();
    });

    it('accepts catalog-source updates through the business route with bearer-token identity', async () => {
      storeClient.send.mockImplementation((command: any) => {
        if (command?.cmd === ProductCommands.FIND_OWNER_PRODUCTS.cmd) {
          return of([
            {
              id: 'product-1',
              name: 'Store Strategy Sprint',
              description: 'Store-managed service offer.',
              price: 210,
              type: 'service',
              active: true,
            },
          ]);
        }

        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              brand: { businessName: 'North Star Coaching' },
              serviceCatalog: { source: 'manual' },
            },
          });
        }

        if (command === TrainerConfigCommands.UPDATE_CONFIG) {
          return of({ id: 'cfg-1' });
        }

        return of(null);
      });

      const response = await injectJsonPut(
        app,
        '/business/site-config/catalog-source',
        { configId: 'cfg-1', source: 'store' },
        operatorTokenPayload
      );

      expect(response).toEqual({
        statusCode: 200,
        body: { id: 'cfg-1' },
      });
      expect(storeClient.send).toHaveBeenCalledWith(
        TrainerConfigCommands.UPDATE_CONFIG,
        {
          id: 'cfg-1',
          config: {
            brand: { businessName: 'North Star Coaching' },
            features: {
              store: {
                enabled: false,
              },
            },
            leadContext: {
              profileId: 'owner-profile-1',
              appScope: 'business-site',
            },
            serviceCatalog: {
              source: 'store',
            },
          },
        }
      );
    });
  });

  it('rejects store mode when no active store service products exist', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              brand: { businessName: 'North Star Coaching' },
              serviceCatalog: { source: 'manual' },
            },
          });
        }

        if (command?.cmd === ProductCommands.FIND_OWNER_PRODUCTS.cmd) {
          return of([]);
        }

        return of({ id: 'cfg-1' });
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.updateCatalogSource(
        {
          configId: 'cfg-1',
          source: 'store',
        },
        {
          userId: 'owner-user-1',
          email: 'owner@example.com',
          exp: 0,
          iat: 0,
          name: 'Owner Example',
          profileId: 'owner-profile-1',
        }
      )
    ).rejects.toThrow('At least one active store service product is required');
  });

  it('rejects store mode when the current owner has no owner-scoped products', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              brand: { businessName: 'North Star Coaching' },
              serviceCatalog: { source: 'manual' },
            },
          });
        }

        if (command?.cmd === ProductCommands.FIND_OWNER_PRODUCTS.cmd) {
          expect(payload).toBe('owner-user-1');
          return of([]);
        }

        if (command?.cmd === ProductCommands.FIND_ALL_PRODUCTS.cmd) {
          return of([
            {
              id: 'global-product-1',
              name: 'Someone Else Service',
              description: 'Global service product.',
              price: 120,
              type: 'service',
              active: true,
            },
          ]);
        }

        return of({ id: 'cfg-1' });
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.updateCatalogSource(
        {
          configId: 'cfg-1',
          source: 'store',
        },
        {
          userId: 'owner-user-1',
          email: 'owner@example.com',
          exp: 0,
          iat: 0,
          name: 'Owner Example',
          profileId: 'owner-profile-1',
        }
      )
    ).rejects.toThrow('At least one active store service product is required');
  });

  it('rejects store mode when active store service products are not publish-ready', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              brand: { businessName: 'North Star Coaching' },
              serviceCatalog: { source: 'manual' },
            },
          });
        }

        if (command?.cmd === ProductCommands.FIND_OWNER_PRODUCTS.cmd) {
          return of([
            {
              id: 'product-1',
              name: 'Strategy Sprint',
              description: '',
              price: 0,
              type: 'service',
              active: true,
            },
          ]);
        }

        return of({ id: 'cfg-1' });
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.updateCatalogSource(
        {
          configId: 'cfg-1',
          source: 'store',
        },
        {
          userId: 'owner-user-1',
          email: 'owner@example.com',
          exp: 0,
          iat: 0,
          name: 'Owner Example',
          profileId: 'owner-profile-1',
        }
      )
    ).rejects.toThrow('publish-ready');
  });

  it('bridges public business intake into the leads domain with anonymous context', async () => {
    const storeClient = {
      send: jest.fn((command: string) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            configId: 'cfg-1',
            config: {
              leadContext: {
                profileId: 'owner-profile-1',
                appScope: 'business-site',
              },
            },
          });
        }

        return of(null);
      }),
    } as any;
    const leadClient = {
      send: jest.fn(() => of({ id: 'lead-1' })),
    } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await controller.createLeadIntake({
      name: 'Jordan Prospect',
      email: 'jordan@example.com',
      phone: '(555) 100-2000',
      goal: 'Build a consistent routine',
      context: 'Needs a sustainable weekly plan.',
      preferredStart: '2026-05-10T10:00',
      preferredEnd: '2026-05-10T11:00',
    });

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.CREATE },
      {
        dto: expect.objectContaining({
          name: 'Jordan Prospect',
          email: 'jordan@example.com',
          phone: '(555) 100-2000',
          searchKeywords: expect.arrayContaining(['business-site-intake']),
        }),
        context: {
          userId: 'anonymous-business-site',
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      }
    );
  });

  it('falls back to a non-empty lead name when public business intake omits it', async () => {
    const storeClient = {
      send: jest.fn((command: string) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            configId: 'cfg-1',
            config: {
              leadContext: {
                profileId: 'owner-profile-1',
                appScope: 'business-site',
              },
            },
          });
        }

        return of(null);
      }),
    } as any;
    const leadClient = {
      send: jest.fn(() => of({ id: 'lead-1' })),
    } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await controller.createLeadIntake({
      name: '   ',
      email: 'jordan@example.com',
      goal: 'Build a consistent routine',
    });

    expect(leadClient.send).toHaveBeenCalledWith(
      { cmd: LeadCommands.CREATE },
      {
        dto: expect.objectContaining({
          name: 'jordan@example.com',
        }),
        context: {
          userId: 'anonymous-business-site',
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      }
    );
  });

  it('reads client bookings for the authenticated user only', async () => {
    const storeClient = {
      send: jest.fn(() => of([{ id: 'booking-1' }])),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getClientBookings({
        userId: 'client-user-1',
        email: 'client@example.com',
        exp: 0,
        iat: 0,
        name: 'Client Example',
        profileId: 'client-profile-1',
      })
    ).resolves.toEqual([{ id: 'booking-1' }]);

    expect(storeClient.send).toHaveBeenCalledWith(
      AppointmentCommands.FIND_USER_APPOINTMENTS,
      {
        userId: 'client-user-1',
        ownerId: undefined,
      }
    );
  });

  it('returns richer lifecycle status for authenticated clients who are still under review', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              leadContext: {
                profileId: 'owner-profile-1',
                appScope: 'business-site',
              },
            },
          });
        }

        if (command === AppointmentCommands.FIND_USER_APPOINTMENTS) {
          return of([]);
        }

        return of([]);
      }),
    } as any;
    const leadClient = {
      send: jest.fn(() =>
        of([
          {
            id: 'lead-1',
            userId: 'client-user-1',
            status: LeadStatus.CONTACTED,
          },
        ])
      ),
    } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getClientBookingStatus({
        userId: 'client-user-1',
        email: 'client@example.com',
        exp: 0,
        iat: 0,
        name: 'Client Example',
        profileId: 'client-profile-1',
      })
    ).resolves.toEqual({
      accepted: false,
      leadId: 'lead-1',
      leadStatus: LeadStatus.CONTACTED,
      hasAccount: true,
      stage: 'lead_under_review',
      nextAction:
        'Your request is under review. The business will follow up before booking opens.',
      primaryAction: 'await_review',
    });
  });

  it('only creates real bookings for accepted clients', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              leadContext: {
                profileId: 'owner-profile-1',
                appScope: 'business-site',
              },
            },
          });
        }

        if (command?.cmd === AppointmentCommands.CREATE_APPOINTMENT.cmd) {
          return of({ id: 'booking-1' });
        }

        return of([]);
      }),
    } as any;
    const leadClient = {
      send: jest.fn(() =>
        of([
          {
            id: 'lead-1',
            userId: 'client-user-1',
            status: LeadStatus.WON,
          },
        ])
      ),
    } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.createBooking(
        {
          title: 'Consultation',
          description: 'Need help with planning.',
          startTime: new Date('2026-05-10T14:00:00.000Z'),
          endTime: new Date('2026-05-10T15:00:00.000Z'),
        } as any,
        {
          userId: 'client-user-1',
          email: 'client@example.com',
          exp: 0,
          iat: 0,
          name: 'Client Example',
          profileId: 'client-profile-1',
        }
      )
    ).resolves.toEqual({ id: 'booking-1' });

    expect(storeClient.send).toHaveBeenCalledWith(
      AppointmentCommands.CREATE_APPOINTMENT,
      expect.objectContaining({
        userId: 'client-user-1',
        title: 'Consultation',
      })
    );
  });

  it('rejects client routine completion when the feature is disabled', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              features: {
                clientTasks: {
                  enabled: true,
                  allowClientCompletion: false,
                },
              },
            },
          });
        }

        return of(null);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.completeClientRoutine('routine-1', {
        userId: 'client-user-1',
        email: 'client@example.com',
        exp: 0,
        iat: 0,
        name: 'Client Example',
        profileId: 'client-profile-1',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects invoice payment when online payment is disabled', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              features: {
                booking: {
                  enabled: true,
                  allowOnlinePayment: false,
                },
              },
            },
          });
        }

        return of(null);
      }),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.payClientInvoice('invoice-1', {
        userId: 'client-user-1',
        email: 'client@example.com',
        exp: 0,
        iat: 0,
        name: 'Client Example',
        profileId: 'client-profile-1',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects real bookings for signed-in clients who are not accepted yet', async () => {
    const storeClient = {
      send: jest.fn((command: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              leadContext: {
                profileId: 'owner-profile-1',
                appScope: 'business-site',
              },
            },
          });
        }

        return of([]);
      }),
    } as any;
    const leadClient = {
      send: jest.fn(() =>
        of([{ id: 'lead-1', userId: 'client-user-1', status: LeadStatus.NEW }])
      ),
    } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.createBooking(
        {
          title: 'Consultation',
          startTime: new Date('2026-05-10T14:00:00.000Z'),
          endTime: new Date('2026-05-10T15:00:00.000Z'),
        } as any,
        {
          userId: 'client-user-1',
          email: 'client@example.com',
          exp: 0,
          iat: 0,
          name: 'Client Example',
          profileId: 'client-profile-1',
        }
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('approves linked prospects into accepted clients', async () => {
    const storeClient = { send: jest.fn() } as any;
    const leadClient = {
      send: jest.fn(() => of({ id: 'lead-1', status: LeadStatus.WON })),
    } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.approveOwnerProspect('lead-1', {
        userId: 'owner-user-1',
        email: 'owner@example.com',
        exp: 0,
        iat: 0,
        name: 'Owner Example',
        profileId: 'owner-profile-1',
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'lead-1',
        status: LeadStatus.WON,
      })
    );
  });

  it('scopes owner booking operations to the authenticated owner', async () => {
    const storeClient = {
      send: jest.fn(() => of([{ id: 'booking-1' }])),
    } as any;
    const leadClient = { send: jest.fn() } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getOwnerBookings({
        userId: 'owner-user-1',
        email: 'owner@example.com',
        exp: 0,
        iat: 0,
        name: 'Owner Example',
        profileId: 'owner-profile-1',
      })
    ).resolves.toEqual([{ id: 'booking-1' }]);

    expect(storeClient.send).toHaveBeenCalledWith(
      AppointmentCommands.FIND_ALL_APPOINTMENTS,
      {
        ownerId: 'owner-user-1',
      }
    );
  });

  it('derives owner workflow cards from leads and bookings', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          return of({
            config: {
              leadContext: {
                profileId: 'owner-profile-1',
                appScope: 'business-site',
              },
            },
          });
        }

        if (command === AppointmentCommands.FIND_ALL_APPOINTMENTS) {
          expect(payload).toEqual({ ownerId: 'owner-user-1' });
          return of([
            {
              id: 'booking-1',
              userId: 'accepted-client-user',
              title: 'Strategy session',
              status: 'pending',
              startTime: '2026-05-10T14:00:00.000Z',
              endTime: '2026-05-10T15:00:00.000Z',
            },
            {
              id: 'booking-2',
              userId: 'accepted-client-user',
              title: 'Completed audit',
              status: 'completed',
              startTime: '2026-05-11T14:00:00.000Z',
              endTime: '2026-05-11T15:00:00.000Z',
            },
          ]);
        }

        return of([]);
      }),
    } as any;
    const leadClient = {
      send: jest.fn(() =>
        of([
          {
            id: 'lead-1',
            name: 'Jordan Prospect',
            email: 'jordan@example.com',
            phone: '(555) 100-2000',
            status: LeadStatus.NEW,
            source: 'other',
            notes: 'Goal: Build consistency',
          },
          {
            id: 'lead-2',
            userId: 'accepted-client-user',
            name: 'Avery Client',
            email: 'avery@example.com',
            phone: '(555) 222-3333',
            status: LeadStatus.WON,
            source: 'other',
            notes: 'Accepted',
          },
        ])
      ),
    } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getOwnerWorkflow({
        userId: 'owner-user-1',
        email: 'owner@example.com',
        exp: 0,
        iat: 0,
        name: 'Owner Example',
        profileId: 'owner-profile-1',
      })
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'lead:lead-1',
          bucket: 'needs_response',
          stage: 'new_lead',
          title: 'Jordan Prospect',
          primaryAction: 'accept_client',
        }),
        expect.objectContaining({
          id: 'booking:booking-1',
          bucket: 'ready_to_schedule',
          stage: 'booking_requested',
          title: 'Avery Client',
          primaryAction: 'approve_booking',
        }),
        expect.objectContaining({
          id: 'booking:booking-2',
          bucket: 'needs_invoicing',
          stage: 'session_completed',
          title: 'Avery Client',
          primaryAction: 'generate_invoice',
        }),
      ])
    );
  });

  it('loads owner workflow from the hosted tenant slug when provided', async () => {
    const storeClient = {
      send: jest.fn((command: any, payload: any) => {
        if (command === TrainerConfigCommands.GET_CONFIG) {
          expect(payload).toEqual({
            configKey: 'default',
            slug: 'steady-hand-contracting',
          });
          return of({
            config: {
              site: {
                slug: 'steady-hand-contracting',
                ownerUserId: 'owner-user-handyman',
              },
              leadContext: {
                profileId: 'handyman-profile',
                appScope: 'business-site',
              },
            },
          });
        }

        if (command === AppointmentCommands.FIND_ALL_APPOINTMENTS) {
          expect(payload).toEqual({ ownerId: 'owner-user-handyman' });
          return of([]);
        }

        return of([]);
      }),
    } as any;
    const leadClient = {
      send: jest.fn((command: any, payload: any) => {
        expect(payload).toEqual({
          profileId: 'handyman-profile',
          appScope: 'business-site',
        });
        return of([]);
      }),
    } as any;
    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getOwnerWorkflow(
        {
          userId: 'owner-user-1',
          email: 'owner@example.com',
          exp: 0,
          iat: 0,
          name: 'Owner Example',
          profileId: 'owner-profile-1',
        },
        'steady-hand-contracting'
      )
    ).resolves.toEqual([]);
  });

  it('protects owner prospect listing with business auth', () => {
    const getOwnerProspects = TrainerController.prototype.getOwnerProspects;

    expect(Reflect.getMetadata(GUARDS_METADATA, getOwnerProspects)).toEqual([
      AuthGuard,
      PermissionsGuard,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, getOwnerProspects)).toEqual({
      permissions: ['app-config.update'],
    });
  });

  it('protects client bookings with business auth', () => {
    const getClientBookings = TrainerController.prototype.getClientBookings;

    expect(Reflect.getMetadata(GUARDS_METADATA, getClientBookings)).toEqual([
      AuthGuard,
    ]);
  });

  it('protects owner booking operations with owner permissions', () => {
    for (const method of [
      TrainerController.prototype.getOwnerBookings,
      TrainerController.prototype.approveBooking,
      TrainerController.prototype.completeBooking,
      TrainerController.prototype.generateInvoice,
      TrainerController.prototype.getOwnerProspects,
      TrainerController.prototype.markOwnerProspectContacted,
      TrainerController.prototype.approveOwnerProspect,
      TrainerController.prototype.getAcceptedClients,
      TrainerController.prototype.getOwnerAvailabilities,
      TrainerController.prototype.createOwnerAvailability,
      TrainerController.prototype.updateOwnerAvailability,
      TrainerController.prototype.removeOwnerAvailability,
      TrainerController.prototype.getOwnerAvailabilityOverrides,
      TrainerController.prototype.createOwnerAvailabilityOverride,
      TrainerController.prototype.updateOwnerAvailabilityOverride,
      TrainerController.prototype.removeOwnerAvailabilityOverride,
      TrainerController.prototype.getOwnerRoutines,
      TrainerController.prototype.assignRoutine,
    ]) {
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
        AuthGuard,
        PermissionsGuard,
      ]);
      expect(Reflect.getMetadata(PERMISSIONS_KEY, method)).toEqual({
        permissions: ['app-config.update'],
      });
    }
  });

  it('protects site-config updates with owner permissions', () => {
    const updateSiteConfig = TrainerController.prototype.updateSiteConfig;

    expect(Reflect.getMetadata(GUARDS_METADATA, updateSiteConfig)).toEqual([
      AuthGuard,
      PermissionsGuard,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, updateSiteConfig)).toEqual({
      permissions: ['app-config.update'],
    });
  });

  it('protects catalog source updates with a dedicated business-site catalog permission', () => {
    const updateCatalogSource = TrainerController.prototype.updateCatalogSource;

    expect(Reflect.getMetadata(GUARDS_METADATA, updateCatalogSource)).toEqual([
      AuthGuard,
      PermissionsGuard,
    ]);
    expect(Reflect.getMetadata(PERMISSIONS_KEY, updateCatalogSource)).toEqual({
      permissions: ['business-site.catalog.update'],
    });
  });

  it('protects real booking creation with client auth', () => {
    const createBooking = TrainerController.prototype.createBooking;

    expect(Reflect.getMetadata(GUARDS_METADATA, createBooking)).toEqual([
      AuthGuard,
    ]);
  });

  it('passes tenant slug lookups through to the store-backed site config query', async () => {
    const storeClient = {
      send: jest.fn(() =>
        of({
          configId: 'cfg-1',
          config: {
            site: { slug: 'north-star-advisory' },
            brand: { businessName: 'North Star Advisory' },
          },
        })
      ),
    } as any;
    const leadClient = { send: jest.fn() } as any;

    const controller = new TrainerController(storeClient, leadClient);

    await expect(
      controller.getSiteConfig('north-star-advisory')
    ).resolves.toEqual({
      configId: 'cfg-1',
      config: {
        site: { slug: 'north-star-advisory' },
        brand: { businessName: 'North Star Advisory' },
      },
    });

    expect(storeClient.send).toHaveBeenCalledWith(
      TrainerConfigCommands.GET_CONFIG,
      {
        configKey: 'default',
        slug: 'north-star-advisory',
      }
    );
  });
});
