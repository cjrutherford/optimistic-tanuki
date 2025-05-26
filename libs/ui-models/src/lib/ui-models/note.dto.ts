

export enum NoteStatus {
    Draft = 'draft',
    Published = 'published',
    Archived = 'archived',
    Deleted = 'deleted',
    Public = 'public',
}

export class NoteDto {
    id!: string;
    userId!: string;
    projectId!: string;
    taskId!: string;
    title!: string;
    description!: string;
    contents!: string;
    createdAt!: Date;
    updatedAt!: Date;
    status!: NoteStatus;
    task!: string;
}