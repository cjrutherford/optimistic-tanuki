import { ChassisType } from './chassis-type.enum';
import { ChassisUseCase } from './chassis-usecase.enum';

export interface ChassisSpecifications {
  formFactor: string;
  maxPower: string;
  noiseLevel: string;
  dimensions: string;
}

export interface Chassis {
  id: string;
  type: ChassisType;
  useCase: ChassisUseCase;
  name: string;
  description: string;
  basePrice: number;
  specifications: ChassisSpecifications;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
