

/**
 * Defines the possible statuses for a note.
 */
export enum NoteStatus {
    /** Note is in draft state. */
    Draft = 'draft',
    /** Note has been published. */
    Published = 'published',
    /** Note has been archived. */
    Archived = 'archived',
    /** Note has been deleted. */
    Deleted = 'deleted',
    /** Note is publicly visible. */
    Public = 'public',
}

/**
 * Data transfer object for a note.
 */
export class NoteDto {
    /** The unique identifier of the note. */
    id!: string;
    /** The ID of the user who created the note. */
    userId!: string;
    /** The ID of the project the note belongs to. */
    projectId!: string;
    /** The ID of the task the note belongs to. */
    taskId!: string;
    /** The title of the note. */
    title!: string;
    /** The description of the note. */
    description!: string;
    /** The content of the note. */
    contents!: string;
    /** The creation timestamp of the note. */
    createdAt!: Date;
    /** The last update timestamp of the note. */
    updatedAt!: Date;
    /** The current status of the note. */
    status!: NoteStatus;
    /** The associated task (string representation). */
    task!: string;
}