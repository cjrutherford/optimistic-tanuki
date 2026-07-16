import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
// Mirrors `FinanceWorkspace` from '@optimistic-tanuki/models'. Defined locally
// because libs/constants is a low-level library and must not depend on
// libs/models (doing so breaks its rootDir-scoped build — TS6059).
type FinanceWorkspace = 'personal' | 'business' | 'net-worth';

export const FinCommanderPlanCommands = {
  CREATE: 'CREATE_FIN_COMMANDER_PLAN',
  UPDATE: 'UPDATE_FIN_COMMANDER_PLAN',
  DELETE: 'DELETE_FIN_COMMANDER_PLAN',
  FIND: 'FIND_FIN_COMMANDER_PLAN',
  FIND_MANY: 'FIND_MANY_FIN_COMMANDER_PLAN',
};

export const FinCommanderGoalCommands = {
  CREATE: 'CREATE_FIN_COMMANDER_GOAL',
  UPDATE: 'UPDATE_FIN_COMMANDER_GOAL',
  DELETE: 'DELETE_FIN_COMMANDER_GOAL',
  FIND: 'FIND_FIN_COMMANDER_GOAL',
  FIND_MANY: 'FIND_MANY_FIN_COMMANDER_GOAL',
};

export const FinCommanderScenarioCommands = {
  CREATE: 'CREATE_FIN_COMMANDER_SCENARIO',
  UPDATE: 'UPDATE_FIN_COMMANDER_SCENARIO',
  DELETE: 'DELETE_FIN_COMMANDER_SCENARIO',
  FIND: 'FIND_FIN_COMMANDER_SCENARIO',
  FIND_MANY: 'FIND_MANY_FIN_COMMANDER_SCENARIO',
};

/**
 * Plan DTOs
 */
export class FinCommanderPlanDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  defaultWorkspace: FinanceWorkspace;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  tenantId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  updatedAt: string;
}

export class CreateFinCommanderPlanDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ default: 'personal' })
  @IsString()
  @IsOptional()
  defaultWorkspace?: FinanceWorkspace;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  appScope?: string;
}

export class UpdateFinCommanderPlanDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  defaultWorkspace?: FinanceWorkspace;
}

/**
 * Goal DTOs — money fields are integer cents, never floats.
 */
export class FinCommanderGoalDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Target amount in integer cents' })
  @IsInt()
  @Min(0)
  targetAmountCents: number;

  @ApiProperty({ description: 'Current amount in integer cents' })
  @IsInt()
  @Min(0)
  currentAmountCents: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dueDate: string;

  @ApiProperty()
  @IsString()
  strategy: string;
}

export class CreateFinCommanderGoalDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Target amount in integer cents' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  targetAmountCents: number;

  @ApiProperty({ description: 'Current amount in integer cents', default: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  currentAmountCents?: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dueDate: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  strategy?: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  appScope?: string;
}

export class UpdateFinCommanderGoalDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({
    required: false,
    description: 'Target amount in integer cents',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  targetAmountCents?: number;

  @ApiProperty({
    required: false,
    description: 'Current amount in integer cents',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  currentAmountCents?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  dueDate?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  strategy?: string;
}

/**
 * Scenario DTOs
 */
export class FinCommanderScenarioAssumptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  delta: string;

  @ApiProperty({ enum: ['income', 'spend', 'savings', 'debt'] })
  @IsIn(['income', 'spend', 'savings', 'debt'])
  impactArea: 'income' | 'spend' | 'savings' | 'debt';
}

export class FinCommanderScenarioDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsString()
  summary: string;

  @ApiProperty({ type: [FinCommanderScenarioAssumptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FinCommanderScenarioAssumptionDto)
  assumptions: FinCommanderScenarioAssumptionDto[];
}

export class CreateFinCommanderScenarioDto {
  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({ type: [FinCommanderScenarioAssumptionDto], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FinCommanderScenarioAssumptionDto)
  assumptions?: FinCommanderScenarioAssumptionDto[];

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  profileId?: string;

  @ApiProperty()
  @IsString()
  @IsUUID()
  @IsOptional()
  tenantId?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  appScope?: string;
}

export class UpdateFinCommanderScenarioDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiProperty({
    type: [FinCommanderScenarioAssumptionDto],
    required: false,
  })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => FinCommanderScenarioAssumptionDto)
  assumptions?: FinCommanderScenarioAssumptionDto[];
}
