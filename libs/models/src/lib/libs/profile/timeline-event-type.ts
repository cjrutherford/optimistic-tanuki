/**
 * Defines the types of events that can occur on a timeline.
 */
export enum TimelineEventType {
    /** A goal was added. */
    AddedGoal = 'AddedGoal',
    /** A project was added. */
    AddedProject = 'AddedProject',
    /** A goal was updated. */
    UpdatedGoal = 'UpdatedGoal',
    /** A project was updated. */
    UpdatedProject = 'UpdatedProject',
    /** A profile was created. */
    CreateProfile = 'CreateProfile',
    /** A profile was updated. */
    UpdatedProfile = 'UpdatedProfile',
    /** A goal was completed. */
    CompletedGoal = 'CompletedGoal',
    /** A project was completed. */
    CompletedProject = 'CompletedProject',
    /** A goal was deleted. */
    DeletedGoal = 'DeletedGoal',
    /** A post was made. */
    Posted = 'Posted',
    /** A comment was made. */
    Commented = 'Commented',
    /** A post was liked. */
    Liked = 'Liked',
    /** A contribution was made. */
    Contrubuted = 'Contributed'
}