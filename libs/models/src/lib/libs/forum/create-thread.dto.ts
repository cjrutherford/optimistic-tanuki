import { ApiProperty } from '@nestjs/swagger';

export class CreateThreadDto {
  @ApiProperty({ description: 'The title of the thread' })
  title: string;

  @ApiProperty({ description: 'The content of the thread' })
  content: string;

  @ApiProperty({ description: 'The ID of the user creating the thread' })
  userId?: string;

  @ApiProperty({ description: 'The ID of the profile creating the thread' })
  profileId: string;

  @ApiProperty({ description: 'The ID of the topic this thread belongs to' })
  topicId: string;

  @ApiProperty({ description: 'Visibility of the thread', required: false })
  visibility?: 'public' | 'private';

  @ApiProperty({ description: 'Whether the thread is pinned', required: false })
  isPinned?: boolean;

  @ApiProperty({ description: 'Whether the thread is locked', required: false })
  isLocked?: boolean;

  @ApiProperty({
    description: 'App scope for the thread',
    required: false,
    example: 'forum',
  })
  appScope?: string;
}
