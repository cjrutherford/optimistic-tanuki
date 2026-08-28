import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

export const AiChangeStatuses = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type AiChangeStatus = (typeof AiChangeStatuses)[number];

export class CreateAiChangeDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty()
  @IsUUID()
  proposedBy!: string;

  @ApiProperty({ description: 'Mutation operation, for example task.create' })
  @IsString()
  operation!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  payload!: Record<string, unknown>;

  /**
   * Why this was proposed, in the proposer's own words.
   *
   * A reviewer looking at a payload can see what would happen but not why
   * anyone thought it should. Without this the only honest answer to "why am
   * I being asked this" is that a model said so.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class ReviewAiChangeDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty({ enum: AiChangeStatuses })
  @IsIn(AiChangeStatuses)
  status!: AiChangeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewNote?: string;
}
