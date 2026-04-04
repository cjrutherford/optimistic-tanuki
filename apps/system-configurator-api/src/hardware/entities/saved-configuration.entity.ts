import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('sc_saved_configurations')
export class SavedConfigurationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  label!: string;

  @Column({ type: 'varchar', length: 255 })
  customerEmail!: string;

  @Column({ type: 'jsonb' })
  configuration!: Record<string, unknown>;

  @Column({ type: 'jsonb' })
  priceBreakdown!: Record<string, unknown>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
