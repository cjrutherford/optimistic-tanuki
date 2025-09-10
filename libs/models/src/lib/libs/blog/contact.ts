// filepath: /home/cjrutherford/workspace/optimistic-tanuki/libs/models/src/lib/libs/blog/contact.ts
import { DateRange } from '../util/date-range';

export interface ContactDto {
    id: string;
    name: string;
    message: string;
    email: string;
    phone: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateContactDto {
    name: string;
    message: string;
    email: string;
    phone: string;
}

export interface UpdateContactDto {
    name?: string;
    message?: string;
    email?: string;
    phone?: string;
}

export interface ContactQueryDto {
    id?: string;
    name?: string;
    message?: string;
    email?: string;
    phone?: string;
    createdAt?: DateRange;
    updatedAt?: DateRange;
}