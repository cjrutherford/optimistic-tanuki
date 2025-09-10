import { DateRange } from '../util/date-range';
export interface PostDto {
    id: string;
    title: string;
    content: string;
    authorId: string;
    createdAt: Date; // ISO string
    updatedAt: Date; // ISO string
}

export interface CreatePostDto {
    title: string;
    content: string;
    authorId: string;
}

export interface UpdatePostDto {
    id: string;
    title?: string;
    content?: string;
    authorId?: string;
}

export interface PostQueryDto {
    id?: string;
    title?: string;
    content?: string;
    authorId?: string;
    createdAt?: DateRange;
    updatedAt?: DateRange;
}
