import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Business-page theme CONTENT (O13/E14 target). Plain columns — no FK to the
 * content row (loose coupling across the move; joined by `businessPageId`,
 * which references the social content row once dual-write lands).
 */
@Entity('business_theme_contents')
@Index(['businessPageId'])
export class BusinessThemeContent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessPageId: string;

  @Column({ type: 'varchar', nullable: true })
  personalityId: string;

  @Column({ type: 'varchar', nullable: true })
  primaryColor: string;

  @Column({ type: 'varchar', nullable: true })
  accentColor: string;

  @Column({ type: 'varchar', nullable: true })
  backgroundColor: string;

  @Column({ type: 'text', nullable: true })
  customCss: string;

  @Column({ type: 'varchar', nullable: true })
  customFontFamily: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
