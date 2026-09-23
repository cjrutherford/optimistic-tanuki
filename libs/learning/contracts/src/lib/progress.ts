import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

/** `LearningCommands.SaveLessonProgress` — a learner's read claim, no points. */
export class SaveLessonProgressDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lessonId!: string;

  @ApiProperty()
  @IsBoolean()
  completed!: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  offeringId?: string;
}
