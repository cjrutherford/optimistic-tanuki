import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('trainer_progress_check_ins')
export class TrainerProgressCheckInEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  clientId: string;

  @Column({ type: 'uuid' })
  assignmentId: string;

  @Column({ type: 'uuid', nullable: true })
  ownerId: string | null;

  @Column({ type: 'text' })
  notes: string;

  @Column({ type: 'int' })
  energy: number;

  @CreateDateColumn()
  completedAt: Date;
}
