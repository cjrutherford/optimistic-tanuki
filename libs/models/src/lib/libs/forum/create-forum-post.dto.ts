import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateForumPostDto {
  @ApiProperty({ description: 'The content of the post' })
  @IsString()
  @IsNotEmpty()
  content!: string;

  @ApiProperty({ description: 'The ID of the user creating the post' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ description: 'The ID of the profile creating the post' })
  @IsString()
  profileId!: string;

  @ApiProperty({ description: 'The ID of the thread this post belongs to' })
  @IsString()
  @IsNotEmpty()
  threadId!: string;

  @ApiProperty({
    description: 'App scope for the post',
    required: false,
    example: 'forum',
  })
  @IsOptional()
  @IsString()
  appScope?: string;
}
