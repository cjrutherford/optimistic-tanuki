import { ApiProperty } from '@nestjs/swagger';

export class CreateForumPostDto {
  @ApiProperty({ description: 'The content of the post' })
  content: string;

  @ApiProperty({ description: 'The ID of the user creating the post' })
  userId?: string;

  @ApiProperty({ description: 'The ID of the profile creating the post' })
  profileId: string;

  @ApiProperty({ description: 'The ID of the thread this post belongs to' })
  threadId: string;
}
