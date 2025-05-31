import { PartialType } from '@nestjs/mapped-types';
import { CreateAttachmentDto } from './createattachment.dto';

export class UpdateAttachmentDto extends PartialType(CreateAttachmentDto) {
  // Add any additional fields or methods if needed
}
