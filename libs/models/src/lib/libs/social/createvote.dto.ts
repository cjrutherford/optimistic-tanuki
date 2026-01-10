import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, IsIn, IsOptional } from 'class-validator';

export class CreateVoteDto {
  @ApiProperty({ description: 'The value of the vote (-1, 0, or 1)', enum: [-1, 0, 1] })
  @IsNumber()
  @IsIn([-1, 0, 1], { message: 'Vote value must be -1 (downvote), 0 (unvote), or 1 (upvote)' })
  value: number;

  @ApiProperty({ description: 'The ID of the user', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'The ID of the post' })
  @IsUUID()
  postId: string;

  @ApiProperty({ description: 'The ID of the profile' })
  @IsUUID()
  profileId: string;
}
