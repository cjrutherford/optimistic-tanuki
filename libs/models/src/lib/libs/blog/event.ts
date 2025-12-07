// filepath: /home/cjrutherford/workspace/optimistic-tanuki/libs/models/src/lib/libs/blog/event.ts
import { DateRange } from '../util/date-range';

export interface EventDto {
    id: string;
    name: string;
    description: string;
    location: string;
    startTime: Date;
    endTime: Date;
    organizerId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateEventDto {
    name: string;
    description: string;
    location: string;
    startTime: Date;
    endTime: Date;
    organizerId: string;
}

export interface UpdateEventDto {
    name?: string;
    description?: string;
    location?: string;
    startTime?: Date;
    endTime?: Date;
    organizerId?: string;
}

export interface EventQueryDto {
    id?: string;
    name?: string;
    description?: string;
    location?: string;
    startTime?: DateRange;
    endTime?: DateRange;
    organizerId?: string;
    createdAt?: DateRange;
    updatedAt?: DateRange;
}