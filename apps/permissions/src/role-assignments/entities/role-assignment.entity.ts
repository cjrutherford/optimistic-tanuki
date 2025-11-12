/* istanbul ignore file */
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
import { AppScope } from '../../app-scopes/entities/app-scope.entity';

@Entity()
@Index(['roleId', 'profileId', 'appScopeId', 'targetId'], { unique: true })
export class RoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  profileId: string;

  @Column({ nullable: true })
  targetId: string; // e.g., specific resource ID for the assignment

  @Column()
  roleId: string;

  @Column({ nullable: true })
  appScopeId: string;

  @ManyToOne(() => AppScope, { eager: true })
  @JoinColumn({ name: 'appScopeId' })
  appScope: AppScope;

  @ManyToOne(() => Role, (role) => role.assignments)
  @JoinColumn({ name: 'roleId' })
  role: Role;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
