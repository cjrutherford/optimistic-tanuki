import { ChangeResolution, CreateChangeDto } from './create-change.dto';

import { PartialType } from '@nestjs/mapped-types';

export class UpdateChangeDto extends PartialType(CreateChangeDto) {
  id: string;
  resolution?: ChangeResolution
}

export class QueryChangeDto extends PartialType(CreateChangeDto) {
  createdBy?: string;
  updatedBy?: string;
  createdAt?: [Date, Date];
  updatedAt?: [Date, Date];
}