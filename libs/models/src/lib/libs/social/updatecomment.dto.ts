import { PartialType } from '@nestjs/mapped-types';
import { CreateCommentDto } from './createcomment.dto';

export class UpdateCommentDto extends PartialType(CreateCommentDto) {
  // Add any additional fields or methods if needed
}