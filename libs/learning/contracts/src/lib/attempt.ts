import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDefined,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

/**
 * Mirrors `ActivityTypeSchema` in learning-domain
 * (`typescript/go/cpp/rust`). Pinned by the parity spec.
 */
export enum CodeLanguage {
  TYPESCRIPT = 'typescript',
  GO = 'go',
  CPP = 'cpp',
  RUST = 'rust',
}

export enum EvaluationMode {
  SYNC = 'sync',
  ASYNC = 'async',
}

export enum EvaluationGrader {
  AUTO = 'auto',
  LLM = 'llm',
  HUMAN = 'human',
}

/** `LearningCommands.SubmitAttempt` — mirrors the service-local `SubmitAttemptDto`. */
export class SubmitAttemptDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  offeringId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activityType!: string;

  @ApiProperty({
    description: 'Grader-defined submission payload; validated domain-side.',
  })
  @IsDefined()
  submission!: unknown;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAsync?: boolean;
}

/** `LearningCommands.RecordEvaluation` — mirrors `RecordEvaluationInput`. */
export class RecordEvaluationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  attemptId!: string;

  @ApiProperty({ enum: EvaluationMode })
  @IsEnum(EvaluationMode)
  mode!: EvaluationMode;

  @ApiProperty({ enum: EvaluationGrader })
  @IsEnum(EvaluationGrader)
  grader!: EvaluationGrader;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  score!: number;

  @ApiProperty()
  @IsNumber()
  maxScore!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  feedback!: string;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  rubric?: Record<string, unknown>;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  humanOverride?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  recordedByUserId?: string;
}

/** `LearningCommands.RunCode`. */
export class RunCodeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  activityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  offeringId?: string;
}

/** `LearningCommands.SubmitExercise`. */
export class SubmitExerciseDto {
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
  activityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  offeringId?: string;
}

/** `LearningCommands.AnswerActivity` — submission validated domain-side. */
export class AnswerActivityDto {
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
  activityId!: string;

  @ApiProperty({
    description: 'Activity-defined answer payload; validated domain-side.',
  })
  @IsDefined()
  submission!: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  offeringId?: string;
}
