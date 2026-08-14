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
// Mirrors the `FinanceWorkspace` shape declared by the models library. Defined locally
// because libs/constants is a low-level library and must not depend on
// libs/models (doing so breaks its rootDir-scoped build — TS6059).
type FinanceWorkspace = 'personal' | 'business' | 'net-worth';

export interface FinCommanderGoalFundingDirective {
  fundingAccountId: string;
  fundingAccountName: string;
  fundingAccountBalanceCents: number;
  remainingAmountCents: number;
  monthsRemaining: number;
  requiredMonthlyContributionCents: number;
  isOverdue: boolean;
}

export interface FinCommanderFundingDirectivePreview {
  goalId: string;
  amountCents: number;
  cadence: 'monthly';
  startDate: string;
  fundingAccountId: string;
  fundingAccountName: string;
  effect: 'forecast-only; no transaction or account balance change';
}

export interface FinCommanderFundingDirectiveDto
  extends FinCommanderFundingDirectivePreview {
  id: string;
  recurringItemId: string | null;
  status: 'approved' | 'cancelled';
  approvedAt: string | null;
  approvedByUserId: string | null;
  cancelledAt: string | null;
  cancelledByUserId: string | null;
}

export interface FinCommanderCashFlowEvent {
  date: string;
  amountCents: number;
  kind: 'recurring-income' | 'recurring-expense' | 'goal-funding';
  label: string;
  sourceId: string;
}

export interface FinCommanderCashFlowProjection {
  calculatedAt: string;
  workspace: FinanceWorkspace;
  openingBalanceCents: number;
  projectedBalanceCents: number;
  horizonDays: number;
  events: FinCommanderCashFlowEvent[];
  dailyBalances: Array<{ date: string; closingBalanceCents: number }>;
}

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
  FUNDING_DIRECTIVE_PREVIEW: 'PREVIEW_FIN_COMMANDER_GOAL_FUNDING_DIRECTIVE',
  FUNDING_DIRECTIVE_APPROVE: 'APPROVE_FIN_COMMANDER_GOAL_FUNDING_DIRECTIVE',
  FUNDING_DIRECTIVE_CANCEL: 'CANCEL_FIN_COMMANDER_GOAL_FUNDING_DIRECTIVE',
};

export const FinCommanderScenarioCommands = {
  CREATE: 'CREATE_FIN_COMMANDER_SCENARIO',
  UPDATE: 'UPDATE_FIN_COMMANDER_SCENARIO',
  DELETE: 'DELETE_FIN_COMMANDER_SCENARIO',
  FIND: 'FIND_FIN_COMMANDER_SCENARIO',
  FIND_MANY: 'FIND_MANY_FIN_COMMANDER_SCENARIO',
};

export const FinCommanderProjectionCommands = {
  GET: 'GET_FIN_COMMANDER_CASH_FLOW_PROJECTION',
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

  @ApiProperty({
    required: false,
    description: 'Tenant account dedicated to funding this goal',
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  fundingAccountId?: string | null;

  fundingDirective?: FinCommanderGoalFundingDirective | null;
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

  @ApiProperty({
    required: false,
    description: 'Tenant account dedicated to funding this goal',
  })
  @IsString()
  @IsUUID()
  @IsOptional()
  fundingAccountId?: string;

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

  @ApiProperty({ required: false, nullable: true })
  @IsString()
  @IsUUID()
  @IsOptional()
  fundingAccountId?: string | null;
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
