/* istanbul ignore file */
import { Column, Entity, ManyToMany, PrimaryGeneratedColumn } from "typeorm";
import { Role } from "../../roles/entities/role.entity";

@Entity()
export class Permission {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    name: string;

    @Column()
    description: string;

    @Column()
    resource: string;

    @Column()
    action: string;

    @Column({ nullable: true })
    targetId: string; // Optional: for item-level permissions

    @Column({ default: () => 'CURRENT_TIMESTAMP' })
    created_at: Date;

    @ManyToMany(() => Role, role => role.permissions)
    roles: Role[];
}
