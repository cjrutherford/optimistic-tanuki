import { ApiProperty } from '@nestjs/swagger';

export class CreateTopicDto {
  @ApiProperty({ description: 'The title of the topic' })
  title: string;

  @ApiProperty({ description: 'The description of the topic' })
  description: string;

  @ApiProperty({ description: 'The ID of the user creating the topic' })
  userId?: string;

  @ApiProperty({ description: 'The ID of the profile creating the topic' })
  profileId: string;

  @ApiProperty({ description: 'Visibility of the topic', required: false })
  visibility?: 'public' | 'private';

  @ApiProperty({ description: 'Whether the topic is pinned', required: false })
  isPinned?: boolean;

  @ApiProperty({ description: 'Whether the topic is locked', required: false })
  isLocked?: boolean;

  @ApiProperty({
    description: 'App scope for the topic',
    required: false,
    example: 'forum',
  })
  appScope?: string;
}
