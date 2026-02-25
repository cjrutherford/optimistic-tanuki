import { ApiProperty } from '@nestjs/swagger';

export class TopicDto {
  @ApiProperty({ description: 'The unique identifier of the topic' })
  id!: string;

  @ApiProperty({ description: 'The title of the topic' })
  title!: string;

  @ApiProperty({ description: 'The description of the topic' })
  description!: string;

  @ApiProperty({ description: 'The ID of the user who created the topic' })
  userId!: string;

  @ApiProperty({
    description: 'The ID of the profile associated with the topic',
  })
  profileId!: string;

  @ApiProperty({ description: 'The date the topic was created' })
  createdAt!: Date;

  @ApiProperty({ description: 'The date the topic was last updated' })
  updatedAt!: Date;

  @ApiProperty({ description: 'Visibility of the topic' })
  visibility!: 'public' | 'private';

  @ApiProperty({ description: 'Whether the topic is pinned' })
  isPinned!: boolean;

  @ApiProperty({ description: 'Whether the topic is locked' })
  isLocked!: boolean;
}
