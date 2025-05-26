import { PartialType } from '@nestjs/mapped-types';
import { CreateKeyDatumDto } from './create-key-datum.dto';

export class UpdateKeyDatumDto extends PartialType(CreateKeyDatumDto) {
  id: number;
  pub?: string;
  salt?: string;
}
