import { ApiProperty } from '@nestjs/swagger';

export class ForumPostDto {
  @ApiProperty({ description: 'The unique identifier of the post' })
  id: string;

  @ApiProperty({ description: 'The content of the post' })
  content: string;

  @ApiProperty({ description: 'The ID of the user who created the post' })
  userId: string;

  @ApiProperty({ description: 'The ID of the profile associated with the post' })
  profileId: string;

  @ApiProperty({ description: 'The ID of the thread this post belongs to' })
  threadId: string;

  @ApiProperty({ description: 'The date the post was created' })
  createdAt: Date;

  @ApiProperty({ description: 'The date the post was last updated' })
  updatedAt: Date;

  @ApiProperty({ description: 'Whether the post has been edited' })
  isEdited: boolean;
}
