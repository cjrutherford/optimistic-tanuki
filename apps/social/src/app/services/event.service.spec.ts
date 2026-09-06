import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventService } from './event.service';
import { Event, EventPrivacy, EventStatus } from '../../entities/event.entity';
import { EventPrivacy as DtoEventPrivacy } from '@optimistic-tanuki/models';

describe('EventService', () => {
  let service: EventService;
  let eventRepo: jest.Mocked<Repository<Event>>;

  const mockEventRepo = () => ({
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        { provide: getRepositoryToken(Event), useFactory: mockEventRepo },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    eventRepo = module.get(getRepositoryToken(Event));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a draft event with defaults', async () => {
      const created = { id: 'e1' } as Event;
      eventRepo.create.mockReturnValue(created);
      eventRepo.save.mockResolvedValue(created);

      const result = await service.create({
        title: 'Town hall',
        startDate: '2030-02-01T10:00:00.000Z',
        profileId: 'prof-1',
        userId: 'user-1',
      });

      expect(eventRepo.create).toHaveBeenCalledWith({
        title: 'Town hall',
        description: undefined,
        startDate: new Date('2030-02-01T10:00:00.000Z'),
        endDate: null,
        location: undefined,
        locationUrl: undefined,
        privacy: EventPrivacy.PUBLIC,
        communityId: undefined,
        profileId: 'prof-1',
        userId: 'user-1',
        coverImageUrl: undefined,
        status: EventStatus.DRAFT,
        attendeeCount: 0,
        attendeeIds: [],
      });
      expect(result).toBe(created);
    });

    it('passes through supplied optional fields', async () => {
      eventRepo.create.mockReturnValue({} as Event);
      eventRepo.save.mockResolvedValue({} as Event);

      await service.create({
        title: 'Private meetup',
        description: 'members only',
        startDate: '2030-02-01T10:00:00.000Z',
        endDate: '2030-02-01T12:00:00.000Z',
        location: 'HQ',
        locationUrl: 'https://maps.example/hq',
        privacy: DtoEventPrivacy.PRIVATE,
        communityId: 'c1',
        profileId: 'prof-1',
        userId: 'user-1',
        coverImageUrl: 'https://img.example/cover.png',
      });

      expect(eventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'members only',
          endDate: new Date('2030-02-01T12:00:00.000Z'),
          location: 'HQ',
          locationUrl: 'https://maps.example/hq',
          privacy: DtoEventPrivacy.PRIVATE,
          communityId: 'c1',
          coverImageUrl: 'https://img.example/cover.png',
        })
      );
    });
  });

  describe('findOne', () => {
    it('looks the event up by id', async () => {
      const event = { id: 'e1' } as Event;
      eventRepo.findOne.mockResolvedValue(event);

      expect(await service.findOne('e1')).toBe(event);
      expect(eventRepo.findOne).toHaveBeenCalledWith({ where: { id: 'e1' } });
    });
  });

  describe('findMany', () => {
    it('queries with no filters when no options are given', async () => {
      eventRepo.find.mockResolvedValue([]);

      await service.findMany();

      expect(eventRepo.find).toHaveBeenCalledWith({
        where: {},
        order: { startDate: 'ASC' },
      });
    });

    it('applies profile, community and status filters', async () => {
      eventRepo.find.mockResolvedValue([]);

      await service.findMany({
        profileId: 'prof-1',
        communityId: 'c1',
        status: EventStatus.PUBLISHED,
      });

      expect(eventRepo.find).toHaveBeenCalledWith({
        where: {
          profileId: 'prof-1',
          communityId: 'c1',
          status: EventStatus.PUBLISHED,
        },
        order: { startDate: 'ASC' },
      });
    });

    it('forces published status and a start-date floor for upcoming events', async () => {
      eventRepo.find.mockResolvedValue([]);

      await service.findMany({
        profileId: 'prof-1',
        status: EventStatus.DRAFT,
        upcoming: true,
      });

      const arg = eventRepo.find.mock.calls[0][0] as any;
      expect(arg.where.profileId).toBe('prof-1');
      // `upcoming` overrides an explicitly requested status.
      expect(arg.where.status).toBe(EventStatus.PUBLISHED);
      expect(arg.where.startDate).toBeDefined();
      expect(arg.order).toEqual({ startDate: 'ASC' });
    });
  });

  describe('findUpcoming', () => {
    it('defaults to a limit of 10', async () => {
      eventRepo.find.mockResolvedValue([]);

      await service.findUpcoming();

      const arg = eventRepo.find.mock.calls[0][0] as any;
      expect(arg.take).toBe(10);
      expect(arg.where.status).toBe(EventStatus.PUBLISHED);
    });

    it('honours an explicit limit', async () => {
      eventRepo.find.mockResolvedValue([]);

      await service.findUpcoming(3);

      expect((eventRepo.find.mock.calls[0][0] as any).take).toBe(3);
    });
  });

  describe('findByDateRange', () => {
    it('queries between the two dates', async () => {
      const events = [{ id: 'e1' }] as Event[];
      eventRepo.find.mockResolvedValue(events);

      const result = await service.findByDateRange(
        new Date('2030-01-01'),
        new Date('2030-02-01')
      );

      expect(result).toBe(events);
      const arg = eventRepo.find.mock.calls[0][0] as any;
      expect(arg.where.startDate).toBeDefined();
      expect(arg.order).toEqual({ startDate: 'ASC' });
    });
  });

  describe('update', () => {
    it('throws when the event is missing', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.update('e1', {})).rejects.toThrow('Event not found');
      expect(eventRepo.update).not.toHaveBeenCalled();
    });

    it('sends only the supplied fields', async () => {
      const event = { id: 'e1' } as Event;
      eventRepo.findOne.mockResolvedValue(event);
      eventRepo.update.mockResolvedValue({} as any);

      const result = await service.update('e1', { title: 'Renamed' });

      expect(eventRepo.update).toHaveBeenCalledWith('e1', {
        title: 'Renamed',
      });
      expect(result).toBe(event);
    });

    it('maps every updatable field', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'e1' } as Event);
      eventRepo.update.mockResolvedValue({} as any);

      await service.update('e1', {
        title: 't',
        description: 'd',
        startDate: '2030-03-01T00:00:00.000Z',
        endDate: '2030-03-02T00:00:00.000Z',
        location: 'loc',
        locationUrl: 'url',
        privacy: DtoEventPrivacy.COMMUNITY,
        communityId: 'c9',
        status: EventStatus.CANCELLED as any,
        coverImageUrl: 'cover',
      });

      expect(eventRepo.update).toHaveBeenCalledWith('e1', {
        title: 't',
        description: 'd',
        startDate: new Date('2030-03-01T00:00:00.000Z'),
        endDate: new Date('2030-03-02T00:00:00.000Z'),
        location: 'loc',
        locationUrl: 'url',
        privacy: DtoEventPrivacy.COMMUNITY,
        communityId: 'c9',
        status: EventStatus.CANCELLED,
        coverImageUrl: 'cover',
      });
    });

    it('clears the end date when given an empty value', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'e1' } as Event);
      eventRepo.update.mockResolvedValue({} as any);

      await service.update('e1', { endDate: null as unknown as string });

      expect(eventRepo.update).toHaveBeenCalledWith('e1', { endDate: null });
    });
  });

  describe('remove', () => {
    it('deletes the event', async () => {
      eventRepo.delete.mockResolvedValue({} as any);

      await service.remove('e1');

      expect(eventRepo.delete).toHaveBeenCalledWith('e1');
    });
  });

  describe('attend', () => {
    it('throws when the event is missing', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.attend('e1', 'prof-1')).rejects.toThrow(
        'Event not found'
      );
    });

    it('adds the attendee and recounts', async () => {
      eventRepo.findOne.mockResolvedValue({
        id: 'e1',
        attendeeIds: ['prof-0'],
      } as Event);
      eventRepo.update.mockResolvedValue({} as any);

      await service.attend('e1', 'prof-1');

      expect(eventRepo.update).toHaveBeenCalledWith('e1', {
        attendeeIds: ['prof-0', 'prof-1'],
        attendeeCount: 2,
      });
    });

    it('treats a null attendee list as empty', async () => {
      eventRepo.findOne.mockResolvedValue({
        id: 'e1',
        attendeeIds: null,
      } as unknown as Event);
      eventRepo.update.mockResolvedValue({} as any);

      await service.attend('e1', 'prof-1');

      expect(eventRepo.update).toHaveBeenCalledWith('e1', {
        attendeeIds: ['prof-1'],
        attendeeCount: 1,
      });
    });

    it('does not write again when already attending', async () => {
      eventRepo.findOne.mockResolvedValue({
        id: 'e1',
        attendeeIds: ['prof-1'],
      } as Event);

      await service.attend('e1', 'prof-1');

      expect(eventRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('unattend', () => {
    it('throws when the event is missing', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      await expect(service.unattend('e1', 'prof-1')).rejects.toThrow(
        'Event not found'
      );
    });

    it('removes the attendee and recounts', async () => {
      eventRepo.findOne.mockResolvedValue({
        id: 'e1',
        attendeeIds: ['prof-0', 'prof-1'],
      } as Event);
      eventRepo.update.mockResolvedValue({} as any);

      await service.unattend('e1', 'prof-1');

      expect(eventRepo.update).toHaveBeenCalledWith('e1', {
        attendeeIds: ['prof-0'],
        attendeeCount: 1,
      });
    });

    it('handles a null attendee list', async () => {
      eventRepo.findOne.mockResolvedValue({
        id: 'e1',
        attendeeIds: null,
      } as unknown as Event);
      eventRepo.update.mockResolvedValue({} as any);

      await service.unattend('e1', 'prof-1');

      expect(eventRepo.update).toHaveBeenCalledWith('e1', {
        attendeeIds: [],
        attendeeCount: 0,
      });
    });
  });

  describe('isAttending', () => {
    it('returns false when the event is missing', async () => {
      eventRepo.findOne.mockResolvedValue(null);

      expect(await service.isAttending('e1', 'prof-1')).toBe(false);
    });

    it('returns true when the profile is in the attendee list', async () => {
      eventRepo.findOne.mockResolvedValue({
        id: 'e1',
        attendeeIds: ['prof-1'],
      } as Event);

      expect(await service.isAttending('e1', 'prof-1')).toBe(true);
    });

    it('returns false for a null attendee list', async () => {
      eventRepo.findOne.mockResolvedValue({
        id: 'e1',
        attendeeIds: null,
      } as unknown as Event);

      expect(await service.isAttending('e1', 'prof-1')).toBe(false);
    });
  });
});
