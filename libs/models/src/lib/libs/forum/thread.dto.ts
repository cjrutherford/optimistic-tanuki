import { ApiProperty } from '@nestjs/swagger';

export class ThreadDto {
  @ApiProperty({ description: 'The unique identifier of the thread' })
  id: string;

  @ApiProperty({ description: 'The title of the thread' })
  title: string;

  @ApiProperty({ description: 'The content of the thread' })
  content: string;

  @ApiProperty({ description: 'The ID of the user who created the thread' })
  userId: string;

  @ApiProperty({ description: 'The ID of the profile associated with the thread' })
  profileId: string;

  @ApiProperty({ description: 'The ID of the topic this thread belongs to' })
  topicId: string;

  @ApiProperty({ description: 'The date the thread was created' })
  createdAt: Date;

  @ApiProperty({ description: 'The date the thread was last updated' })
  updatedAt: Date;

  @ApiProperty({ description: 'Visibility of the thread' })
  visibility: 'public' | 'private';

  @ApiProperty({ description: 'Whether the thread is pinned' })
  isPinned: boolean;

  @ApiProperty({ description: 'Whether the thread is locked' })
  isLocked: boolean;

  @ApiProperty({ description: 'Number of views' })
  viewCount: number;
}
