import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, IsIn, IsOptional } from 'class-validator';

export class CreateReactionDto {
  @ApiProperty({
    description: 'The value of the reaction (1-6)',
    enum: [1, 2, 3, 4, 5, 6],
  })
  @IsNumber()
  @IsIn([1, 2, 3, 4, 5, 6], {
    message: 'Reaction value must be 1-6',
  })
  value!: number;

  @ApiProperty({ description: 'The ID of the user', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiProperty({ description: 'The ID of the post', required: false })
  @IsOptional()
  @IsUUID()
  postId?: string;

  @ApiProperty({ description: 'The ID of the comment', required: false })
  @IsOptional()
  @IsUUID()
  commentId?: string;

  @ApiProperty({ description: 'The ID of the profile' })
  @IsUUID()
  profileId!: string;
}

export class UpdateReactionDto {
  @ApiProperty({
    description: 'The new value of the reaction (1-6)',
    enum: [1, 2, 3, 4, 5, 6],
  })
  @IsNumber()
  @IsIn([1, 2, 3, 4, 5, 6], {
    message: 'Reaction value must be 1-6',
  })
  value!: number;
}

export class ReactionDto {
  @ApiProperty({ description: 'The ID of the reaction' })
  id!: string;

  @ApiProperty({ description: 'The value of the reaction' })
  value!: number;

  @ApiProperty({ description: 'The ID of the user' })
  userId!: string;

  @ApiProperty({ description: 'The ID of the profile' })
  profileId!: string;

  @ApiProperty({ description: 'The ID of the post', required: false })
  postId?: string;

  @ApiProperty({ description: 'The ID of the comment', required: false })
  commentId?: string;

  @ApiProperty({ description: 'When the reaction was created' })
  createdAt!: Date;
}
