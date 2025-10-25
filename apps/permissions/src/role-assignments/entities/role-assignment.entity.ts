/* istanbul ignore file */
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Role } from "../../roles/entities/role.entity";
import { AppScope } from "../../app-scopes/entities/app-scope.entity";

@Entity()
export class RoleAssignment {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    profileId: string;

    @ManyToOne(() => AppScope, { eager: true })
    appScope: AppScope;

    @ManyToOne(() => Role, role => role.assignments)
    role: Role;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;
}
