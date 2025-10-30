/* istanbul ignore file */
import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  Index,
  ManyToMany,
} from 'typeorm';
import { Role } from '../../roles/entities/role.entity';
// import { AppScope } from '../../app-scopes/entities/app-scope.entity';

@Entity()
@Index(['name', 'appScope', 'targetId'], { unique: true })
export class Permission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column()
  resource: string;

  @Column()
  action: string;

  @Column({ nullable: true })
  targetId: string; // profileId for profile-specific permissions

  @Column()
  appScope: string; // app scope for uniqueness

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @ManyToMany(() => Role, (role) => role.permissions)
  roles: Role[];
}
