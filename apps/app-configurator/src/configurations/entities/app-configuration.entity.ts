import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AppConfigReleaseState } from '@optimistic-tanuki/app-config-models';

@Entity()
export class AppConfigurationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

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

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  release: AppConfigReleaseState;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  updatedAt: Date;
}
