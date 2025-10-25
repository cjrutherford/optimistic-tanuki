/* istanbul ignore file */
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class AppScope {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

    @Column()
    description: string;

    @Column({ default: true })
    active: boolean;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    updated_at: Date;
}
