import { ApiProperty } from '@nestjs/swagger';

export class UpdateForumPostDto {
  @ApiProperty({ description: 'The content of the post', required: false })
  content?: string;
}
