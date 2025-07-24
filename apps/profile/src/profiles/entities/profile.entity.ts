/* istanbul ignore file */
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

import { Timeline } from "../../timelines/entities/timeline.entity";

@Entity()
export class Profile {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

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

    @OneToMany( type => Timeline, timeline => timeline.related_profile)
    timeLineEvents: Timeline[];

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}
