import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateGoalDto {
  @ApiProperty({ description: 'The name of the goal', example: 'Complete MVP' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name: string;

  @ApiProperty({
    description: 'The description of the goal',
    example: 'Finish all MVP features by Q1',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @ApiProperty({ description: 'The ID of the user creating the goal' })
  @IsString()
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'The ID of the timeline associated with the goal',
  })
  @IsString()
  @IsUUID()
  timelineId: string;

  @ApiProperty({
    description: 'The ID of the project associated with the goal',
  })
  @IsString()
  @IsUUID()
  projectId: string;

  @ApiProperty({
    description: 'The ID of the profile associated with the goal',
  })
  @IsString()
  @IsUUID()
  profileId: string;
}
