import { Inject, Injectable } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, LessThanOrEqual, Between } from 'typeorm';
import { Event, EventStatus, EventPrivacy } from '../../entities/event.entity';
import {
  CreateEventDto,
  UpdateEventDto,
  EventDto,
} from '@optimistic-tanuki/models';

@Injectable()
export class EventService {
  constructor(
    @Inject(getRepositoryToken(Event))
    private readonly eventRepo: Repository<Event>
  ) {}

  async create(createEventDto: CreateEventDto): Promise<Event> {
    const event = this.eventRepo.create({
      title: createEventDto.title,
      description: createEventDto.description,
      startDate: new Date(createEventDto.startDate),
      endDate: createEventDto.endDate ? new Date(createEventDto.endDate) : null,
      location: createEventDto.location,
      locationUrl: createEventDto.locationUrl,
      privacy: createEventDto.privacy || EventPrivacy.PUBLIC,
      communityId: createEventDto.communityId,
      profileId: createEventDto.profileId,
      userId: createEventDto.userId,
      coverImageUrl: createEventDto.coverImageUrl,
      status: EventStatus.DRAFT,
      attendeeCount: 0,
      attendeeIds: [],
    });
    return await this.eventRepo.save(event);
  }

  async findOne(id: string): Promise<Event | null> {
    return await this.eventRepo.findOne({ where: { id } });
  }

  async findMany(options?: {
    profileId?: string;
    communityId?: string;
    status?: EventStatus;
    upcoming?: boolean;
  }): Promise<Event[]> {
    const where: any = {};

    if (options?.profileId) {
      where.profileId = options.profileId;
    }
    if (options?.communityId) {
      where.communityId = options.communityId;
    }
    if (options?.status) {
      where.status = options.status;
    }

    let queryOptions: any = { where };

    if (options?.upcoming) {
      queryOptions = {
        ...queryOptions,
        where: {
          ...queryOptions.where,
          startDate: MoreThanOrEqual(new Date()),
          status: EventStatus.PUBLISHED,
        },
      };
    }

    return await this.eventRepo.find({
      ...queryOptions,
      order: { startDate: 'ASC' },
    });
  }

  async findUpcoming(limit: number = 10): Promise<Event[]> {
    return await this.eventRepo.find({
      where: {
        startDate: MoreThanOrEqual(new Date()),
        status: EventStatus.PUBLISHED,
      },
      order: { startDate: 'ASC' },
      take: limit,
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Event[]> {
    return await this.eventRepo.find({
      where: {
        startDate: Between(startDate, endDate),
      },
      order: { startDate: 'ASC' },
    });
  }

  async update(id: string, updateEventDto: UpdateEventDto): Promise<Event> {
    const event = await this.findOne(id);
    if (!event) {
      throw new Error('Event not found');
    }

    const updateData: Partial<Event> = {};
    if (updateEventDto.title !== undefined)
      updateData.title = updateEventDto.title;
    if (updateEventDto.description !== undefined)
      updateData.description = updateEventDto.description;
    if (updateEventDto.startDate !== undefined)
      updateData.startDate = new Date(updateEventDto.startDate);
    if (updateEventDto.endDate !== undefined)
      updateData.endDate = updateEventDto.endDate
        ? new Date(updateEventDto.endDate)
        : null;
    if (updateEventDto.location !== undefined)
      updateData.location = updateEventDto.location;
    if (updateEventDto.locationUrl !== undefined)
      updateData.locationUrl = updateEventDto.locationUrl;
    if (updateEventDto.privacy !== undefined)
      updateData.privacy = updateEventDto.privacy;
    if (updateEventDto.communityId !== undefined)
      updateData.communityId = updateEventDto.communityId;
    if (updateEventDto.status !== undefined)
      updateData.status = updateEventDto.status;
    if (updateEventDto.coverImageUrl !== undefined)
      updateData.coverImageUrl = updateEventDto.coverImageUrl;

    await this.eventRepo.update(id, updateData);
    return await this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.eventRepo.delete(id);
  }

  async attend(eventId: string, profileId: string): Promise<Event> {
    const event = await this.findOne(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    const attendeeIds = event.attendeeIds || [];
    if (!attendeeIds.includes(profileId)) {
      attendeeIds.push(profileId);
      await this.eventRepo.update(eventId, {
        attendeeIds,
        attendeeCount: attendeeIds.length,
      });
    }

    return await this.findOne(eventId);
  }

  async unattend(eventId: string, profileId: string): Promise<Event> {
    const event = await this.findOne(eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    const attendeeIds = (event.attendeeIds || []).filter(
      (id) => id !== profileId
    );
    await this.eventRepo.update(eventId, {
      attendeeIds,
      attendeeCount: attendeeIds.length,
    });

    return await this.findOne(eventId);
  }

  async isAttending(eventId: string, profileId: string): Promise<boolean> {
    const event = await this.findOne(eventId);
    if (!event) {
      return false;
    }
    return (event.attendeeIds || []).includes(profileId);
  }
}
