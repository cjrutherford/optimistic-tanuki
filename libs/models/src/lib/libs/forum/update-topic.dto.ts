import { ApiProperty } from '@nestjs/swagger';

export class UpdateTopicDto {
  @ApiProperty({ description: 'The title of the topic', required: false })
  title?: string;

  @ApiProperty({ description: 'The description of the topic', required: false })
  description?: string;

  @ApiProperty({ description: 'Visibility of the topic', required: false })
  visibility?: 'public' | 'private';

  @ApiProperty({ description: 'Whether the topic is pinned', required: false })
  isPinned?: boolean;

  @ApiProperty({ description: 'Whether the topic is locked', required: false })
  isLocked?: boolean;
}
