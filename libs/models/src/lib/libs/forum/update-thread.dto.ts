import { ApiProperty } from '@nestjs/swagger';

export class UpdateThreadDto {
  @ApiProperty({ description: 'The title of the thread', required: false })
  title?: string;

  @ApiProperty({ description: 'The content of the thread', required: false })
  content?: string;

  @ApiProperty({ description: 'Visibility of the thread', required: false })
  visibility?: 'public' | 'private';

  @ApiProperty({ description: 'Whether the thread is pinned', required: false })
  isPinned?: boolean;

  @ApiProperty({ description: 'Whether the thread is locked', required: false })
  isLocked?: boolean;
}
