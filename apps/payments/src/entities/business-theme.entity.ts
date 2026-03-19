import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BusinessPage } from './business-page.entity';

@Entity('business_themes')
export class BusinessTheme {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  businessPageId: string;

  @ManyToOne(() => BusinessPage, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'businessPageId' })
  businessPage: BusinessPage;

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
