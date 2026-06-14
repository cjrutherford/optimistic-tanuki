import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('trainer_site_configs')
export class TrainerSiteConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true, default: 'default' })
  configKey: string;

  @Column({ type: 'varchar', length: 64, nullable: true, default: 'general' })
  businessType: string;

  @Column({ type: 'jsonb', nullable: true })
  leadContext: {
    profileId?: string;
    appScope?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  site: Record<string, unknown>;

  // Brand configuration (stored as JSON)
  @Column({ type: 'jsonb', nullable: true })
  brand: Record<string, unknown>;

  // Contact configuration (stored as JSON)
  @Column({ type: 'jsonb', nullable: true })
  contact: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  serviceCatalog: Record<string, unknown>;

  @Column({ type: 'jsonb', nullable: true })
  services: Record<string, unknown>[];

  @Column({ type: 'jsonb', nullable: true })
  landingPage: Record<string, unknown>;

  // Client portal copy (stored as JSON)
  @Column({ type: 'jsonb', nullable: true })
  clientPortal: Record<string, unknown>;

  // Testimonials (stored as JSON array)
  @Column({ type: 'jsonb', nullable: true })
  testimonials: Record<string, unknown>[];

  // Theme configuration
  @Column({ type: 'jsonb', nullable: true })
  theme: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
