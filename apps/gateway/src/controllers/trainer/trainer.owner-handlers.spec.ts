import { of } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import {
  AppointmentCommands,
  AvailabilityCommands,
} from '@optimistic-tanuki/constants';
import { TrainerController } from './trainer.controller';
import type { UserDetails } from '../../decorators/user.decorator';

/**
 * The spec beside this one covers the public site/booking surface. These drive
 * the owner-side availability, override and booking handlers: the pattern and
 * payload each sends to the store service, and how the caller's own id is
 * stamped on as owner or requester.
 */
describe('Gateway TrainerController owner handlers', () => {
  let controller: TrainerController;
  let store: { send: jest.Mock };
  let leads: { send: jest.Mock };

  const user = { userId: 'owner-1', profileId: 'profile-1' } as UserDetails;

  const lastPattern = () => store.send.mock.calls.at(-1)?.[0];
  const lastPayload = () => store.send.mock.calls.at(-1)?.[1];

  beforeEach(() => {
    store = { send: jest.fn().mockReturnValue(of({ ok: true })) };
    leads = { send: jest.fn().mockReturnValue(of(null)) };

    controller = new TrainerController(
      store as unknown as ClientProxy,
      leads as unknown as ClientProxy
    );
  });

  describe('availabilities', () => {
    it('lists the caller’s own availabilities by user id alone', async () => {
      await controller.getOwnerAvailabilities(user);

      expect(lastPattern()).toBe(
        AvailabilityCommands.FIND_OWNER_AVAILABILITIES
      );
      // This one sends the bare id, not an object.
      expect(lastPayload()).toBe('owner-1');
    });

    it('defaults a new availability to the caller as owner', async () => {
      await controller.createOwnerAvailability({ dayOfWeek: 1 } as never, user);

      expect(lastPattern()).toBe(AvailabilityCommands.CREATE_AVAILABILITY);
      expect(lastPayload()).toEqual({ dayOfWeek: 1, ownerId: 'owner-1' });
    });

    it('honours an explicit owner id on create', async () => {
      await controller.createOwnerAvailability(
        { dayOfWeek: 1, ownerId: 'someone-else' } as never,
        user
      );

      expect(lastPayload()).toEqual({
        dayOfWeek: 1,
        ownerId: 'someone-else',
      });
    });

    it('sends the patch and the requester on update', async () => {
      await controller.updateOwnerAvailability(
        'avail-1',
        { dayOfWeek: 2 } as never,
        user
      );

      expect(lastPattern()).toBe(AvailabilityCommands.UPDATE_AVAILABILITY);
      expect(lastPayload()).toEqual({
        id: 'avail-1',
        updateAvailabilityDto: { dayOfWeek: 2 },
        requesterOwnerId: 'owner-1',
      });
    });

    it('sends the id and the requester on remove', async () => {
      await controller.removeOwnerAvailability('avail-1', user);

      expect(lastPattern()).toBe(AvailabilityCommands.REMOVE_AVAILABILITY);
      expect(lastPayload()).toEqual({
        id: 'avail-1',
        requesterOwnerId: 'owner-1',
      });
    });
  });

  describe('availability overrides', () => {
    it('lists the caller’s own overrides', async () => {
      await controller.getOwnerAvailabilityOverrides(user);

      expect(store.send).toHaveBeenCalled();
    });

    it('defaults a new override to the caller as owner', async () => {
      await controller.createOwnerAvailabilityOverride(
        { date: '2026-03-04' } as never,
        user
      );

      expect(lastPattern()).toBe(
        AvailabilityCommands.CREATE_AVAILABILITY_OVERRIDE
      );
      expect(lastPayload()).toEqual({
        date: '2026-03-04',
        ownerId: 'owner-1',
      });
    });

    it('honours an explicit owner id on override create', async () => {
      await controller.createOwnerAvailabilityOverride(
        { date: '2026-03-04', ownerId: 'someone-else' } as never,
        user
      );

      expect(lastPayload()).toMatchObject({ ownerId: 'someone-else' });
    });

    it('sends the patch and the requester on override update', async () => {
      await controller.updateOwnerAvailabilityOverride(
        'ovr-1',
        { date: '2026-03-05' } as never,
        user
      );

      expect(lastPattern()).toBe(
        AvailabilityCommands.UPDATE_AVAILABILITY_OVERRIDE
      );
      expect(lastPayload()).toEqual({
        id: 'ovr-1',
        updateAvailabilityOverrideDto: { date: '2026-03-05' },
        requesterOwnerId: 'owner-1',
      });
    });

    it('sends the id and the requester on override remove', async () => {
      await controller.removeOwnerAvailabilityOverride('ovr-1', user);

      expect(lastPattern()).toBe(
        AvailabilityCommands.REMOVE_AVAILABILITY_OVERRIDE
      );
      expect(lastPayload()).toEqual({
        id: 'ovr-1',
        requesterOwnerId: 'owner-1',
      });
    });
  });

  describe('bookings', () => {
    it('lists the caller’s own bookings by owner id', async () => {
      await controller.getOwnerBookings(user);

      expect(lastPattern()).toBe(AppointmentCommands.FIND_ALL_APPOINTMENTS);
      expect(lastPayload()).toEqual({ ownerId: 'owner-1' });
    });

    it('approves a booking as the requesting owner', async () => {
      await controller.approveBooking(
        'appt-1',
        { note: 'see you then' } as never,
        user
      );

      expect(lastPattern()).toBe(AppointmentCommands.APPROVE_APPOINTMENT);
      expect(lastPayload()).toEqual({
        id: 'appt-1',
        approveAppointmentDto: { note: 'see you then' },
        requesterOwnerId: 'owner-1',
      });
    });

    it('completes a booking as the requesting owner', async () => {
      await controller.completeBooking('appt-1', user);

      expect(lastPattern()).toBe(AppointmentCommands.COMPLETE_APPOINTMENT);
      expect(lastPayload()).toEqual({
        id: 'appt-1',
        requesterOwnerId: 'owner-1',
      });
    });

    it('generates an invoice as the requesting owner', async () => {
      await controller.generateInvoice('appt-1', user);

      expect(lastPattern()).toBe(AppointmentCommands.GENERATE_INVOICE);
      expect(lastPayload()).toEqual({
        id: 'appt-1',
        requesterOwnerId: 'owner-1',
      });
    });

    it('returns whatever the store service replies with', async () => {
      store.send.mockReturnValue(of({ id: 'appt-1', status: 'approved' }));

      await expect(controller.completeBooking('appt-1', user)).resolves.toEqual(
        { id: 'appt-1', status: 'approved' }
      );
    });
  });
});
