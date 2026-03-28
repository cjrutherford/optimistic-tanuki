import { ComponentType } from './component-type.enum';

export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  description: string;
  basePrice: number;
  sellingPrice: number;
  specs: Record<string, string | number>;
  compatibleWith: string[];
  inStock?: boolean;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
