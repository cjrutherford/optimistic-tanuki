/* istanbul ignore file */
import { Column, Entity, OneToMany, PrimaryGeneratedColumn, Index } from "typeorm";

import { Timeline } from "../../timelines/entities/timeline.entity";

export enum BlogRole {
    NONE = 'none',
    POSTER = 'poster',
    OWNER = 'owner'
}

@Entity()
@Index(['userId', 'appScope'], { unique: true })
export class Profile {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column({ nullable: true })
    appScope: string;

    @Column()
    profileName: string;

    @Column()
    profilePic: string;

    @Column()
    coverPic: string;

    @Column()
    bio: string;

    @Column()
    location: string;

    @Column()
    occupation: string;

    @Column()
    interests: string;

    @Column()
    skills: string;

    @Column({ 
        type: 'varchar',
        enum: BlogRole,
        default: BlogRole.NONE
    })
    blogRole: BlogRole;

    @OneToMany( type => Timeline, timeline => timeline.related_profile)
    timeLineEvents: Timeline[];

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}
