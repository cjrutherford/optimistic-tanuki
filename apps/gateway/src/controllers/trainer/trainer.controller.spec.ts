import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { BadRequestException } from '@nestjs/common';
import { of } from 'rxjs';

import {
  AppointmentCommands,
  AvailabilityCommands,
  LeadCommands,
  TrainerConfigCommands,
} from '@optimistic-tanuki/constants';
import { LeadStatus } from '@optimistic-tanuki/models';

import { AuthGuard } from '../../auth/auth.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { PermissionsGuard } from '../../guards/permissions.guard';

import { TrainerController } from './trainer.controller';

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

    expect(storeClient.send).toHaveBeenCalledWith(TrainerConfigCommands.UPDATE_CONFIG, {
      id: 'cfg-1',
      config: {
        brand: { businessName: 'North Star Coaching' },
        leadContext: {
          profileId: 'owner-profile-1',
          appScope: 'business-site',
        },
      },
    });
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

    expect(leadClient.send).toHaveBeenCalledWith({ cmd: LeadCommands.CREATE }, {
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
    });
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
      'client-user-1'
    );
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
      send: jest.fn(() => of([{ id: 'lead-1', userId: 'client-user-1', status: LeadStatus.NEW }])),
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

    expect(Reflect.getMetadata(GUARDS_METADATA, getClientBookings)).toEqual([AuthGuard]);
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

  it('protects real booking creation with client auth', () => {
    const createBooking = TrainerController.prototype.createBooking;

    expect(Reflect.getMetadata(GUARDS_METADATA, createBooking)).toEqual([AuthGuard]);
  });
});
