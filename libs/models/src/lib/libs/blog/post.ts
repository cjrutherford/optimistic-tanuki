import { DateRange } from '../util/date-range';
export interface PostDto {
    id: string;
    title: string;
    content: string;
    authorId: string;
    isDraft: boolean;
    publishedAt: Date | null;
    createdAt: Date; // ISO string
    updatedAt: Date; // ISO string
}

export interface CreatePostDto {
    title: string;
    content: string;
    authorId: string;
    isDraft?: boolean;
}

export interface UpdatePostDto {
    id: string;
    title?: string;
    content?: string;
    authorId?: string;
    isDraft?: boolean;
}

export interface PostQueryDto {
    id?: string;
    title?: string;
    content?: string;
    authorId?: string;
    isDraft?: boolean;
    createdAt?: DateRange;
    updatedAt?: DateRange;
}
