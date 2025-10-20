import { DateRange } from '../util/date-range';

export interface BlogDto {
    id: string;
    name: string;
    description: string;
    ownerId: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateBlogDto {
    name: string;
    description: string;
    ownerId: string;
}

export interface UpdateBlogDto {
    name?: string;
    description?: string;
    ownerId?: string;
}

export interface BlogQueryDto {
    id?: string;
    name?: string;
    description?: string;
    ownerId?: string;
    createdAt?: DateRange;
    updatedAt?: DateRange;
}
