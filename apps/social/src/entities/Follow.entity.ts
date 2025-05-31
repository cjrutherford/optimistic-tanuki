import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export default class FollowEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    followerId: string;

    @Column()
    followeeId: string;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
    createdAt: Date;

    @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
    updatedAt: Date;

    @Column({ default: false })
    isMutual: boolean; // if true, then these two are friends.
}