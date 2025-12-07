import { Inject, Injectable } from "@nestjs/common";
import { getRepositoryToken } from "@nestjs/typeorm";
import { Event } from "../entities";
import { Between, FindOptionsWhere, Like, Repository } from "typeorm";
import { EventDto, CreateEventDto, UpdateEventDto, EventQueryDto } from "@optimistic-tanuki/models";

@Injectable()
export class EventService {
    constructor(
        @Inject(getRepositoryToken(Event)) private readonly eventRepository: Repository<Event>,
    ) {
        console.log('EventService initialized');
    }

    async create(createEventDto: CreateEventDto): Promise<EventDto> {
        const event = this.eventRepository.create(createEventDto);
        return this.eventRepository.save(event);
    }

    async findAll(query: EventQueryDto): Promise<EventDto[]> {
        const where: FindOptionsWhere<Event> = {};
        if(query.name) {
            where.name = Like(`%${query.name}%`);
        }
        if(query.description) {
            where.description = Like(`%${query.description}%`);
        }
        if(query.location) {
            where.location = Like(`%${query.location}%`);
        }
        if(query.organizerId) {
            where.organizerId = query.organizerId;
        }
        if(query.startTime && query.startTime.length == 2) {
            where.startTime = Between(new Date(query.startTime[0]), new Date(query.startTime[1]));
        }
        if(query.endTime && query.endTime.length == 2) {
            where.endTime = Between(new Date(query.endTime[0]), new Date(query.endTime[1]));
        }
        if(query.createdAt && query.createdAt.length == 2) {
            where.createdAt = Between(new Date(query.createdAt[0]), new Date(query.createdAt[1]));
        }
        if(query.updatedAt && query.updatedAt.length == 2) {
            where.updatedAt = Between(new Date(query.updatedAt[0]), new Date(query.updatedAt[1]));
        }

        return this.eventRepository.find({ where });
    }

    async findOne(id: string): Promise<EventDto> {
        return await this.eventRepository.findOne({ where: { id } });
    }

    async update(id: string, updateEventDto: UpdateEventDto): Promise<EventDto> {
        await this.eventRepository.update(id, updateEventDto);
        return await this.eventRepository.findOne({ where: { id } });
    }

    async remove(id: string): Promise<void> {
        await this.eventRepository.delete(id);
    }
}