import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  AppConfigReleaseState,
  APP_ACCESS_POLICIES,
  AppAccessPolicy,
  ConfigurablePluginManifest,
} from '@optimistic-tanuki/app-config-models';
import { AppInstanceEntity } from './app-instance.entity';

@Entity()
@Index(['appInstanceId', 'name'], { unique: true })
export class AppConfigurationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'uuid' })
  workspaceId: string;

  @Column({ type: 'uuid' })
  appInstanceId: string;

  @ManyToOne(() => AppInstanceEntity)
  @JoinColumn([
    { name: 'appInstanceId', referencedColumnName: 'id' },
    { name: 'workspaceId', referencedColumnName: 'workspaceId' },
    { name: 'appScope', referencedColumnName: 'appScope' },
  ])
  appInstance: AppInstanceEntity;

  @Column()
  ownerUserId: string;

  @Column()
  ownerProfileId: string;

  @Column()
  appScope: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true, unique: true })
  domain: string;

  @Column({ type: 'jsonb' })
  landingPage: {
    sections: unknown[];
    layout: string;
  };

  @Column({ type: 'jsonb', default: '[]' })
  routes: unknown[];

  @Column({ type: 'jsonb', default: '{}' })
  features: Record<string, unknown>;

  @Column({ type: 'jsonb', default: '{}' })
  theme: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  manifest?: ConfigurablePluginManifest;

  @Column({ default: true })
  active: boolean;

  @Column({
    type: 'enum',
    enum: [...APP_ACCESS_POLICIES],
    default: 'public',
  })
  accessPolicy: AppAccessPolicy;

  @Column({ default: 1 })
  revision: number;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  release: AppConfigReleaseState;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}
