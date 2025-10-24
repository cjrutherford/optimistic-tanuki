/* istanbul ignore file */
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Role } from "../../roles/entities/role.entity";

@Entity()
export class RoleAssignment {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    profileId: string;

    @Column()
    appScope: string; // Application scope where this role applies

    @ManyToOne(() => Role, role => role.assignments)
    role: Role;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}
