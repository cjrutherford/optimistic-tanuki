import { CreateRiskDto } from './create-risk.dto';
import { PartialType } from '@nestjs/mapped-types';

export class UpdateRiskDto extends PartialType(CreateRiskDto) {
  id: string;
}

export class QueryRiskDto extends PartialType(CreateRiskDto) {
  createdBy?: string;
  updatedBy?: string;
  createdAt?: [Date, Date];
  updatedAt?: [Date, Date];
}