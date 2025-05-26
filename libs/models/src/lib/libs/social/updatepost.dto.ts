import { PartialType } from '@nestjs/mapped-types';
import { CreatePostDto } from './createpost.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  // Add any additional fields or methods if needed
}
