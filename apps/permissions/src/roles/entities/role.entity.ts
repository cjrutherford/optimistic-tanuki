/* istanbul ignore file */
import { Column, Entity, JoinTable, ManyToMany, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Permission } from "../../permissions/entities/permission.entity";
import { RoleAssignment } from "../../role-assignments/entities/role-assignment.entity";
import { AppScope } from "../../app-scopes/entities/app-scope.entity";

@Entity()
export class Role {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

    @Column()
    description: string;

    @ManyToOne(() => AppScope, { eager: true })
    appScope: AppScope;

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @ManyToMany(() => Permission, permission => permission.roles)
    @JoinTable({
        name: 'role_permissions',
        joinColumn: { name: 'role_id', referencedColumnName: 'id' },
        inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' }
    })
    permissions: Permission[];

    @OneToMany(() => RoleAssignment, assignment => assignment.role)
    assignments: RoleAssignment[];
}
