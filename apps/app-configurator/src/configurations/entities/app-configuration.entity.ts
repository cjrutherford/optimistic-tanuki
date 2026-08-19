import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import {
  AppConfigReleaseState,
  ConfigurablePluginManifest,
} from '@optimistic-tanuki/app-config-models';

@Entity()
@Index(['ownerProfileId', 'appScope', 'name'], { unique: true })
export class AppConfigurationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  ownerUserId: string;

  @Column()
  ownerProfileId: string;

  @Column()
  appScope: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
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

  @Column({ type: 'jsonb', default: () => "'{}'" })
  release: AppConfigReleaseState;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}
