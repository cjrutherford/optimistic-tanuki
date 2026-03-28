import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ChassisType } from '../chassis-type.enum';
import { ChassisUseCase } from '../chassis-usecase.enum';

export interface ChassisSpecifications {
  formFactor: string;
  maxPower: string;
  noiseLevel: string;
  dimensions: string;
}

@Entity()
export class Chassis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 10 })
  type: ChassisType;

  @Column({ type: 'varchar', length: 20 })
  useCase: ChassisUseCase;

  @Column()
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice: number;

  @Column({ type: 'jsonb' })
  specifications: ChassisSpecifications;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
