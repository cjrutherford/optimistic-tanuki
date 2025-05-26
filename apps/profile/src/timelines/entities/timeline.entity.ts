import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Goal } from "../../goals/entities/goal.entity";
import { Project } from "../../projects/entities/project.entity";
import { Profile } from "../../profiles/entities/profile.entity";

export enum TimelineEventType {
    AddedGoal = 'AddedGoal',
    AddedProject = 'AddedProject',
    UpdatedGoal = 'UpdatedGoal',
    UpdatedProject = 'UpdatedProject',
    CreateProfile = 'CreateProfile',
    UpdatedProfile = 'UpdatedProfile',
    CompletedGoal = 'CompletedGoal',
    CompletedProject = 'CompletedProject',
    DeletedGoal = 'DeletedGoal',
    Posted = 'Posted',
    Commented = 'Commented',
    Liked = 'Liked',
    Contrubuted = 'Contributed'
}
@Entity()
export class Timeline {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column()
    title: string;

    @Column()
    description: string;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    timeStamp: Date;

    @ManyToOne(type => Goal, goal => goal.timeLineEvents)
    related_goal: Goal;

    @ManyToOne(type => Project, project => project.timeLineEvents)
    related_project: Project;

    @ManyToOne(type => Profile, profile => profile.timeLineEvents)
    related_profile: Profile;

    @Column({ type: 'enum', enum: TimelineEventType, default: TimelineEventType.Posted })
    eventType: TimelineEventType;
}
